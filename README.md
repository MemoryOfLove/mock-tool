# Mock Tool

Mock Tool 是一个基于 Chrome Extension Manifest V3 的接口 Mock 调试工具。它会在页面主世界中拦截 `fetch` 和 `XMLHttpRequest` 请求，根据用户配置的规则匹配请求，并按需替换响应体、修改 JSON 字段、改写状态码或模拟延迟。

适合在前端联调、异常场景验证、接口未完成、灰度数据构造等场景中使用。

## 功能特性

- 支持全局启用/停用 Mock。
- 支持单条规则启用/停用。
- 支持规则优先级，数字越小越先匹配。
- 支持拖拽调整规则顺序。
- 支持导入、导出规则 JSON。
- 支持命中日志与扩展 badge 计数。
- 支持页面内 toast 提示命中的规则。
- 支持 `fetch` 请求拦截。
- 支持 `XMLHttpRequest` 请求拦截。

## 规则能力

### 请求匹配

规则可以组合多个条件。所有已配置条件都满足时，规则才会命中。

| 条件 | 能力 |
| --- | --- |
| URL | `contains`、`equals`、`wildcard`、`regex` |
| Method | `GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD`、`OPTIONS` |
| Query Params | `exists`、`equals`、`contains`、`regex` |
| Request Headers | `exists`、`equals`、`contains`、`regex` |
| Request Body | `contains`、`regex`、简易 `jsonpath` |

URL 匹配说明：

- `contains`：请求完整 URL 中包含指定字符串。
- `equals`：请求去掉 query 后的 URL 或 pathname 等于指定值。
- `wildcard`：支持 `*` 和 `?` 通配符。
- `regex`：使用正则表达式匹配完整 URL。

JSONPath 支持范围：

- 支持 `$.a.b.c`
- 支持 `$.a[0].b`
- 不支持过滤表达式、递归查询等高级 JSONPath 语法。

### 响应修改

| 修改类型 | 行为 |
| --- | --- |
| 替换响应体 | 直接返回配置的响应体，不再发起真实请求 |
| 修改 JSON 字段 | 先发真实请求，再解析 JSON 并按路径 `set` 或 `delete` 字段 |
| 状态码 | 覆盖 HTTP status |
| 延迟 | 模拟网络延迟，单位为毫秒 |

替换响应体示例：

```json
{
  "code": 0,
  "data": {
    "id": 1,
    "name": "Mock User"
  }
}
```

修改 JSON 字段示例：

| Path | Action | Value |
| --- | --- | --- |
| `$.data.name` | `set` | `"Mock User"` |
| `$.data.debug` | `set` | `true` |
| `$.data.unused` | `delete` | 留空 |

## 快速开始

### 环境要求

- Node.js `20.19+` 或 `22.12+`
- pnpm
- Chrome 或其他 Chromium 内核浏览器

> 项目使用 Vite 8。较低版本 Node 可能会出现 `CustomEvent is not defined` 或 Vite 版本不兼容错误。

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
pnpm dev
```

开发模式主要用于调试 React 页面，包括 popup 和 options 页。扩展完整能力依赖构建后的 content script、injected script 和 service worker。

### 构建扩展

```bash
pnpm build
```

构建完成后会生成 `dist/` 目录，包含：

- `manifest.json`
- `service-worker.js`
- `content-script.js`
- `injected.js`
- popup 页面资源
- options 页面资源
- icons

### 在 Chrome 加载扩展

1. 打开 `chrome://extensions/`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择项目构建后的 `dist/` 目录
5. 打开任意页面，点击扩展图标或进入扩展选项页配置规则

## 使用指南

### 新建规则

1. 打开扩展选项页。
2. 点击「新建规则」。
3. 填写规则名称和优先级。
4. 配置 URL、请求方法、query、header 或 body 匹配条件。
5. 选择响应修改类型。
6. 点击保存。

### 启用和停用

- popup 中可以控制全局启用/停用。
- 规则管理页的每张规则卡片右上角可以单独启用/停用规则。
- 停用规则不会参与匹配。

### 优先级

规则命中时会先过滤启用状态，再按 `priority` 从小到大排序。

例如：

| 规则 | Priority | 结果 |
| --- | --- | --- |
| A | `0` | 优先匹配 |
| B | `10` | A 不命中时才继续匹配 |

如果多条规则都能命中同一个请求，只会使用第一条命中的规则。

### 导入和导出

规则导出格式如下：

```json
{
  "version": 1,
  "rules": []
}
```

导入时会把文件中的规则追加到当前规则列表后面，不会覆盖已有规则。

## 项目结构

```text
mock-tool/
├── manifest.json              # 开发态扩展 manifest
├── manifest.dist.json         # 构建后复制到 dist 的 manifest
├── vite.config.ts             # 多目标构建配置
├── public/icons/              # 扩展图标
└── src/
    ├── background/
    │   └── service-worker.ts  # MV3 service worker，规则读取、badge、消息转发
    ├── content/
    │   └── content-script.ts  # 注入 injected.js，并在页面和扩展之间转发消息
    ├── injected/
    │   ├── index.ts           # 页面主世界入口，安装 fetch/XHR 拦截器
    │   ├── fetch-interceptor.ts
    │   ├── xhr-interceptor.ts
    │   └── rule-executor.ts   # 请求标准化与响应修改执行
    ├── options/
    │   ├── App.tsx            # 规则管理页
    │   └── RuleEditor.tsx     # 规则编辑器
    ├── popup/
    │   └── App.tsx            # 扩展弹窗
    ├── shared/
    │   ├── types.ts           # 规则、消息、请求类型定义
    │   ├── storage.ts         # chrome.storage.local 读写
    │   ├── rule-matcher.ts    # 请求匹配逻辑
    │   ├── response-modifier.ts
    │   ├── messaging.ts
    │   └── constants.ts
    └── styles/
        └── globals.css        # Tailwind 入口与少量动画
```

## 工作原理

Mock Tool 分为四层：

1. Options / Popup

   用户在 UI 中创建、编辑、启停、导入、导出规则。规则存储在 `chrome.storage.local` 中。

2. Service Worker

   负责响应 `GET_RULES` 消息、监听 storage 变化、向所有 tab 广播规则更新，并维护当前 tab 的命中 badge 计数。

3. Content Script

   在 `document_start` 运行，向页面注入 `injected.js`。由于页面请求 API 需要在页面主世界中 monkey patch，真正的拦截逻辑不直接放在 content script 中执行。

4. Injected Script

   运行在页面主世界，替换 `window.fetch` 和 `XMLHttpRequest.prototype` 相关方法。每次请求发生时：

   - 标准化请求 URL、method、headers、query、body。
   - 按优先级查找第一条命中规则。
   - 如果命中，执行响应修改。
   - 向 content script 发送命中日志。
   - 页面右上角显示命中 toast。

消息链路：

```text
Options / Popup
  -> chrome.storage.local
  -> Service Worker storage listener
  -> Content Script
  -> window.postMessage
  -> Injected Script
```

命中日志链路：

```text
Injected Script
  -> window.postMessage
  -> Content Script
  -> chrome.runtime.sendMessage
  -> Service Worker / Popup
```

## 构建说明

`pnpm build` 会连续执行多个 Vite 构建目标：

```bash
vite build
cross-env BUILD_TARGET=service-worker vite build
cross-env BUILD_TARGET=content-script vite build
cross-env BUILD_TARGET=injected vite build
```

默认构建目标输出 React 页面资源，并通过 `copyAssetsPlugin` 复制：

- `manifest.dist.json` 到 `dist/manifest.json`
- `public/icons` 到 `dist/icons`

脚本构建目标输出：

- `service-worker.js`
- `content-script.js`
- `injected.js`

这些文件名需要和 `manifest.dist.json` 保持一致。

## 数据结构

核心规则结构定义在 `src/shared/types.ts`。

简化示例：

```ts
interface MockRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  matchCondition: MatchCondition
  modifications: ResponseModification[]
  createdAt: number
  updatedAt: number
}
```

完整规则示例：

```json
{
  "id": "rule-1",
  "name": "Mock 用户接口",
  "enabled": true,
  "priority": 0,
  "matchCondition": {
    "url": {
      "type": "contains",
      "value": "/api/user"
    },
    "methods": ["GET"],
    "queryParams": [
      {
        "key": "id",
        "operator": "equals",
        "value": "1"
      }
    ]
  },
  "modifications": [
    {
      "type": "replaceBody",
      "body": "{\"code\":0,\"data\":{\"id\":1,\"name\":\"Mock User\"}}",
      "contentType": "application/json"
    },
    {
      "type": "statusCode",
      "code": 200
    }
  ],
  "createdAt": 1710000000000,
  "updatedAt": 1710000000000
}
```

## 常见问题

### 构建时报 Node 版本错误

确认 Node.js 版本：

```bash
node --version
```

如果低于 Vite 要求，请切换到 Node.js `20.19+` 或 `22.12+`。

### 页面请求没有被拦截

可以按以下顺序检查：

1. popup 中全局开关是否启用。
2. 对应规则是否启用。
3. URL 匹配类型和值是否正确。
4. 请求方法是否被限制。
5. query、header、body 条件是否全部满足。
6. 扩展是否加载的是最新 `dist/`。
7. 页面是否刷新过。content script 需要在页面加载时注入。

### 修改 JSON 字段没有生效

`modifyJsonFields` 会先发起真实请求，再尝试解析响应为 JSON。以下情况不会修改：

- 真实响应不是 JSON。
- JSONPath 路径写错。
- 请求没有命中规则。
- 响应体被业务代码以非 JSON 方式读取且不可重复消费。

### 替换响应体和修改 JSON 字段有什么区别

- 替换响应体：不发真实请求，直接返回配置内容。
- 修改 JSON 字段：先发真实请求，再在真实响应基础上局部修改。

### 为什么需要 injected script

Chrome content script 运行在隔离世界，直接覆盖 `window.fetch` 不一定影响页面自身代码。Mock Tool 通过 content script 把 `injected.js` 注入页面主世界，从而拦截页面真实调用的 `fetch` 和 `XMLHttpRequest`。

## 开发建议

- 修改规则类型时，优先更新 `src/shared/types.ts`。
- 修改匹配能力时，同步更新 `src/shared/rule-matcher.ts` 和 README。
- 修改响应修改能力时，同步更新 `src/shared/response-modifier.ts`、`src/injected/rule-executor.ts`、`src/injected/xhr-interceptor.ts`。
- 修改构建输出文件名时，同步更新 `vite.config.ts` 和 `manifest.dist.json`。
- UI 改动主要集中在 `src/options` 和 `src/popup`。

## 已知限制

- 只拦截页面中的 `fetch` 和 `XMLHttpRequest`。
- 不拦截浏览器地址栏导航、图片标签、script 标签、link 标签等由浏览器发起的资源加载。
- 简易 JSONPath 只支持基础对象路径和数组下标。
- `modifyJsonFields` 依赖真实响应可被解析为 JSON。
- XHR 拦截通过重写实例属性模拟响应，复杂场景下可能受浏览器只读属性限制影响。

## License

MIT
