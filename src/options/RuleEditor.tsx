import { useState } from 'react'
import type {
  MockRule, MatchCondition, ResponseModification,
  UrlMatchCondition, KeyValueCondition, BodyMatchCondition,
  ReplaceBodyMod, ModifyJsonFieldsMod, StatusCodeMod, DelayMod,
} from '../shared/types'
import { parseCurl } from '../shared/curl-parser'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const URL_MATCH_TYPES: UrlMatchCondition['type'][] = ['contains', 'equals', 'wildcard', 'regex']
const KV_OPERATORS: KeyValueCondition['operator'][] = ['exists', 'equals', 'contains', 'regex']
const BODY_MATCH_TYPES: BodyMatchCondition['type'][] = ['contains', 'jsonpath', 'regex']

interface Props {
  rule: MockRule
  onSave: (rule: MockRule) => void
  onCancel: () => void
}

// ===== 小组件 =====

function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-sm font-semibold text-slate-700">{children}</label>
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${props.className ?? ''}`}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className={`h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${props.className ?? ''}`}
    />
  )
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${props.className ?? ''}`}
    />
  )
}

function JsonPathTree({ value, onSelect }: { value: unknown; onSelect: (path: string, node: unknown) => void }) {
  const childPathFor = (path: string, key: string, array: boolean) => {
    if (array) return `${path}[${key}]`
    return /^[A-Za-z_$][\w$]*$/.test(key) ? `${path}.${key}` : `${path}['${key.replace(/'/g, "\\'")}']`
  }
  const render = (node: unknown, path: string, label: string): React.ReactNode => {
    const primitive = node === null || typeof node !== 'object'
    return (
      <div key={path} className="ml-3 border-l border-slate-200 pl-2">
        <button
          type="button"
          onClick={() => onSelect(path, node)}
          className="my-0.5 rounded px-1.5 py-1 text-left text-xs hover:bg-indigo-50 hover:text-indigo-700"
        >
          <span className="font-medium">{label}</span>
          <span className="ml-2 text-slate-400">{primitive ? String(node) : Array.isArray(node) ? '[ ]' : '{ }'}</span>
        </button>
        {!primitive && Object.entries(node as Record<string, unknown>).map(([key, child]) => {
          const childPath = childPathFor(path, key, Array.isArray(node))
          return render(child, childPath, key)
        })}
      </div>
    )
  }
  return <div className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-white p-2">{render(value, '$', '$')}</div>
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
      </div>
      <div className="space-y-4 px-5 py-5">{children}</div>
    </section>
  )
}

function JsonEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [jsonError, setJsonError] = useState<string | null>(null)

  const handleChange = (v: string) => {
    onChange(v)
    if (!v.trim()) { setJsonError(null); return }
    try { JSON.parse(v); setJsonError(null) } catch (e: unknown) { setJsonError((e as Error).message) }
  }

  const format = () => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2))
      setJsonError(null)
    } catch {}
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-500">JSON</span>
        <button
          type="button"
          onClick={format}
          className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 active:scale-95"
        >
          格式化
        </button>
      </div>
      <textarea
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={14}
        spellCheck={false}
        className={`min-h-[220px] w-full resize-y rounded-md border px-3 py-2.5 font-mono text-sm shadow-sm transition-colors duration-150 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${
          jsonError ? 'border-rose-400 bg-rose-50/50' : 'border-slate-300 bg-white'
        }`}
      />
      <div
        className={`overflow-hidden transition-all duration-200 ${
          jsonError ? 'max-h-10 opacity-100 mt-1' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-xs text-rose-600">JSON 解析失败：{jsonError}</p>
      </div>
    </div>
  )
}

// ===== KeyValue 条件编辑 =====

function KVConditionEditor({
  conditions, onChange, label,
}: { conditions: KeyValueCondition[]; onChange: (c: KeyValueCondition[]) => void; label: string }) {
  const add = () => onChange([...conditions, { key: '', operator: 'equals', value: '' }])
  const remove = (i: number) => onChange(conditions.filter((_, idx) => idx !== i))
  const update = (i: number, patch: Partial<KeyValueCondition>) =>
    onChange(conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label>{label}</Label>
        <button type="button" onClick={add} className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50">+ 添加</button>
      </div>
      <div className="space-y-2">
        {conditions.length === 0 && (
          <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-400">未配置</div>
        )}
        {conditions.map((c, i) => (
          <div key={i} className="grid gap-2 md:grid-cols-[9rem_10rem_minmax(0,1fr)_2.5rem]">
            <Input placeholder="Key" value={c.key} onChange={e => update(i, { key: e.target.value })} />
            <Select value={c.operator} onChange={e => update(i, { operator: e.target.value as KeyValueCondition['operator'] })}>
              {KV_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
            </Select>
            {c.operator !== 'exists' ? (
              <Input placeholder="Value" value={c.value ?? ''} onChange={e => update(i, { value: e.target.value })} />
            ) : (
              <div className="hidden md:block" />
            )}
            <button type="button" onClick={() => remove(i)} className="h-10 rounded-md text-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-600">×</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ===== 主编辑器 =====

export default function RuleEditor({ rule: initial, onSave, onCancel }: Props) {
  const [rule, setRule] = useState<MockRule>(initial)
  const [curlText, setCurlText] = useState('')
  const [curlError, setCurlError] = useState<string | null>(null)
  const [pendingHeaders, setPendingHeaders] = useState<Array<{ key: string; value: string; apply: boolean }>>([])
  const [responseSample, setResponseSample] = useState('')
  const mc = rule.matchCondition

  const setMC = (patch: Partial<MatchCondition>) =>
    setRule(r => ({ ...r, matchCondition: { ...r.matchCondition, ...patch } }))

  const setUrl = (patch: Partial<UrlMatchCondition>) =>
    setMC({ url: { ...(mc.url ?? { type: 'contains', value: '' }), ...patch } })

  const importCurl = () => {
    try {
      const parsed = parseCurl(curlText)
      let body = parsed.body
      try { if (body) body = JSON.stringify(JSON.parse(body), null, 2) } catch { /* keep form encoded/text */ }
      const urlObj = new URL(parsed.url)
      const queryParams = Array.from(urlObj.searchParams.entries()).map(([key, value]) => ({ key, operator: 'equals' as const, value }))
      setRule(r => ({
        ...r,
        name: r.name || `${parsed.method} ${urlObj.pathname}`,
        matchCondition: {
          ...r.matchCondition,
          url: { type: 'equals', value: parsed.url.split('?')[0] },
          methods: [parsed.method],
          queryParams,
          requestBody: body ? { type: 'jsonpath', expression: '', sampleJson: body } : r.matchCondition.requestBody,
        },
      }))
      setPendingHeaders(parsed.headers.map(header => ({ ...header, apply: false })))
      setCurlError(null)
    } catch (e: unknown) {
      setCurlError((e as Error).message || 'curl 解析失败')
    }
  }

  const applySelectedHeaders = () => {
    const selected = pendingHeaders.filter(h => h.apply).map(({ key, value }) => ({ key, operator: 'equals' as const, value }))
    setMC({ requestHeaders: [...(mc.requestHeaders ?? []), ...selected] })
    setPendingHeaders([])
  }

  // ===== Modifications helpers =====
  const mods = rule.modifications
  const setMods = (m: ResponseModification[]) => setRule(r => ({ ...r, modifications: m }))

  const getMod = <T extends ResponseModification>(type: T['type']): T | undefined =>
    mods.find(m => m.type === type) as T | undefined

  const setMod = (mod: ResponseModification) => {
    const idx = mods.findIndex(m => m.type === mod.type)
    if (idx >= 0) {
      setMods(mods.map((m, i) => i === idx ? mod : m))
    } else {
      setMods([...mods, mod])
    }
  }

  const removeMod = (type: string) => setMods(mods.filter(m => m.type !== type))

  const hasMod = (type: string) => mods.some(m => m.type === type)

  const replaceMod = getMod<ReplaceBodyMod>('replaceBody')
  const modifyMod = getMod<ModifyJsonFieldsMod>('modifyJsonFields')
  const statusMod = getMod<StatusCodeMod>('statusCode')
  const delayMod = getMod<DelayMod>('delay')

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-10 -mx-6 -mt-8 border-b border-slate-200 bg-slate-50/90 px-6 py-5 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold uppercase text-indigo-500">Rule Editor</p>
            <h2 className="truncate text-2xl font-semibold text-slate-950">
              {initial.name ? '编辑规则' : '新建规则'}
            </h2>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={onCancel} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50">取消</button>
            <button onClick={() => onSave(rule)} className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800">保存</button>
          </div>
        </div>
      </div>

      {/* 基本信息 */}
      <Section title="基本信息">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label>规则名称</Label>
            <Input value={rule.name} onChange={e => setRule(r => ({ ...r, name: e.target.value }))} placeholder="例：Mock 用户接口" />
          </div>
          <div>
            <Label>优先级（数字越小越优先）</Label>
            <Input type="number" value={rule.priority} onChange={e => setRule(r => ({ ...r, priority: Number(e.target.value) }))} />
          </div>
        </div>
      </Section>

      {/* curl 导入 */}
      <Section title="curl 自动导入">
        <div className="space-y-2">
          <Label>粘贴 curl 命令</Label>
          <Textarea
            rows={4}
            value={curlText}
            onChange={e => setCurlText(e.target.value)}
            placeholder={'curl \'https://api.example.com/users?id=1\' -X POST -H \'Content-Type: application/json\' -d \'{"name":"Tom"}\''}
            className="font-mono"
          />
          <div className="flex items-center gap-3">
            <button type="button" onClick={importCurl} className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">解析并填充</button>
            {curlError && <span className="text-xs text-rose-600">{curlError}</span>}
          </div>
        </div>
        {pendingHeaders.length > 0 && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <Label>选择要应用到匹配条件的请求头</Label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPendingHeaders(current => current.map(h => ({ ...h, apply: true })))} className="text-xs text-indigo-600 hover:underline">全选</button>
                <button type="button" onClick={() => setPendingHeaders(current => current.map(h => ({ ...h, apply: false })))} className="text-xs text-slate-500 hover:underline">全不选</button>
                <button type="button" onClick={applySelectedHeaders} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">添加选中</button>
              </div>
            </div>
            <div className="space-y-1.5">
              {pendingHeaders.map((header, i) => (
                <label key={`${header.key}-${i}`} className="flex cursor-pointer items-center gap-2 rounded-md bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={header.apply}
                    onChange={e => setPendingHeaders(current => current.map((h, idx) => idx === i ? { ...h, apply: e.target.checked } : h))}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                  />
                  <span className="font-medium text-slate-700">{header.key}</span>
                  <span className="min-w-0 truncate text-slate-500">{header.value}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* 匹配条件 */}
      <Section title="匹配条件">
        {/* URL */}
        <div>
          <Label>URL 匹配</Label>
          <div className="grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)]">
            <Select value={mc.url?.type ?? 'contains'} onChange={e => setUrl({ type: e.target.value as UrlMatchCondition['type'] })}>
              {URL_MATCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input value={mc.url?.value ?? ''} onChange={e => setUrl({ value: e.target.value })} placeholder="https://api.example.com/*" />
          </div>
        </div>

        {/* Methods */}
        <div>
          <Label>请求方法（不选 = 全部）</Label>
          <div className="flex flex-wrap gap-2">
            {HTTP_METHODS.map(m => (
              <label
                key={m}
                className={`inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm font-medium transition ${
                  mc.methods?.includes(m)
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={mc.methods?.includes(m) ?? false}
                  onChange={e => {
                    const current = mc.methods ?? []
                    setMC({ methods: e.target.checked ? [...current, m] : current.filter(x => x !== m) })
                  }}
                  className="sr-only"
                />
                {m}
              </label>
            ))}
          </div>
        </div>

        {/* Query Params */}
        <KVConditionEditor
          label="查询参数"
          conditions={mc.queryParams ?? []}
          onChange={c => setMC({ queryParams: c })}
        />

        {/* Request Headers */}
        <KVConditionEditor
          label="请求头"
          conditions={mc.requestHeaders ?? []}
          onChange={c => setMC({ requestHeaders: c })}
        />

        {/* Request Body */}
        <div>
          <Label>请求体匹配</Label>
          <div className="flex gap-2 mb-1.5">
            <Select
              value={mc.requestBody?.type ?? 'jsonpath'}
              onChange={e => setMC({ requestBody: { ...(mc.requestBody ?? { type: 'jsonpath', expression: '' }), type: e.target.value as BodyMatchCondition['type'] } })}
            >
              {BODY_MATCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
          </div>
          <Textarea
            rows={4}
            value={mc.requestBody?.expression ?? ''}
            onChange={e => setMC({ requestBody: { ...(mc.requestBody ?? { type: 'jsonpath', expression: '' }), expression: e.target.value } })}
            placeholder={mc.requestBody?.type === 'jsonpath' ? '$.data.userId' : '匹配表达式'}
            className="min-h-[96px] resize-y font-mono"
          />
          {mc.requestBody?.type === 'jsonpath' && (
            <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div>
                <Label>样例返回（用于图形化选择 JSONPath）</Label>
                <Textarea
                  rows={5}
                  value={mc.requestBody.sampleJson ?? ''}
                  onChange={e => setMC({ requestBody: { ...mc.requestBody!, sampleJson: e.target.value } })}
                  placeholder='粘贴原先的 JSON 样例返回，例如 {"data":{"id":1}}'
                  className="font-mono"
                />
              </div>
              {mc.requestBody.sampleJson?.trim() && (() => {
                try {
                  const sample = JSON.parse(mc.requestBody.sampleJson)
                  return (
                    <JsonPathTree
                      value={sample}
                      onSelect={(path, node) => setMC({ requestBody: { ...mc.requestBody!, expression: path, expectedValue: node !== null && typeof node !== 'object' ? String(node) : '' } })}
                    />
                  )
                } catch {
                  return <p className="text-xs text-rose-600">样例返回不是有效 JSON，无法生成路径。</p>
                }
              })()}
              <Input
                value={mc.requestBody?.expectedValue ?? ''}
                onChange={e => setMC({ requestBody: { ...mc.requestBody!, expectedValue: e.target.value } })}
                placeholder="期望值（可选；选择节点后自动填充）"
              />
            </div>
          )}
        </div>
      </Section>

      {/* 响应修改 */}
      <Section title="响应修改">
        {/* 修改类型开关 */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { type: 'replaceBody', label: '替换响应体' },
            { type: 'modifyJsonFields', label: '修改 JSON 字段' },
            { type: 'statusCode', label: '状态码' },
            { type: 'delay', label: '延迟' },
          ].map(({ type, label }) => (
            <label
              key={type}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition ${
                hasMod(type)
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={hasMod(type)}
                onChange={e => {
                  if (e.target.checked) {
                    if (type === 'replaceBody') setMod({ type: 'replaceBody', body: '{}' })
                    if (type === 'modifyJsonFields') setMod({ type: 'modifyJsonFields', modifications: [] })
                    if (type === 'statusCode') setMod({ type: 'statusCode', code: 200 })
                    if (type === 'delay') setMod({ type: 'delay', ms: 1000 })
                  } else {
                    removeMod(type)
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              {label}
            </label>
          ))}
        </div>

        {/* 替换响应体 */}
        {replaceMod && (
          <div className="animate-fade-in rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <Label>响应体内容</Label>
            <JsonEditor
              value={replaceMod.body}
              onChange={v => setMod({ ...replaceMod, body: v })}
              placeholder='{"code": 0, "data": {...}}'
            />
            <div className="mt-1.5">
              <Label>Content-Type</Label>
              <Input
                value={replaceMod.contentType ?? 'application/json'}
                onChange={e => setMod({ ...replaceMod, contentType: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* 修改 JSON 字段 */}
        {modifyMod && (
          <div className="animate-fade-in rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-4">
              <Label>样例返回（可点击节点生成 JSONPath）</Label>
              <Textarea
                rows={5}
                value={responseSample}
                onChange={e => setResponseSample(e.target.value)}
                placeholder='粘贴原先的 JSON 返回，例如 {"data":{"name":"Tom"}}'
                className="font-mono"
              />
              {responseSample.trim() && (() => {
                try {
                  return (
                    <div className="mt-2">
                      <JsonPathTree
                        value={JSON.parse(responseSample)}
                        onSelect={path => {
                          const next = [...modifyMod.modifications]
                          const emptyIndex = next.findIndex(m => !m.path)
                          const item = { path, action: 'set' as const, value: '' }
                          if (emptyIndex >= 0) next[emptyIndex] = { ...next[emptyIndex], path }
                          else next.push(item)
                          setMod({ ...modifyMod, modifications: next })
                        }}
                      />
                    </div>
                  )
                } catch {
                  return <p className="mt-1 text-xs text-rose-600">样例返回不是有效 JSON，无法生成路径。</p>
                }
              })()}
            </div>
            <div className="mb-2 flex items-center justify-between">
              <Label>JSON 字段修改</Label>
              <button
                type="button"
                onClick={() => setMod({ ...modifyMod, modifications: [...modifyMod.modifications, { path: '', action: 'set', value: '' }] })}
                className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-50"
              >
                + 添加
              </button>
            </div>
            {modifyMod.modifications.map((m, i) => (
              <div key={i} className="mb-2 grid gap-2 md:grid-cols-[12rem_9rem_minmax(0,1fr)_2.5rem]">
                <Input
                  placeholder="$.data.name"
                  value={m.path}
                  onChange={e => {
                    const next = [...modifyMod.modifications]
                    next[i] = { ...next[i], path: e.target.value }
                    setMod({ ...modifyMod, modifications: next })
                  }}
                />
                <Select
                  value={m.action}
                  onChange={e => {
                    const next = [...modifyMod.modifications]
                    next[i] = { ...next[i], action: e.target.value as 'set' | 'delete' }
                    setMod({ ...modifyMod, modifications: next })
                  }}
                >
                  <option value="set">set</option>
                  <option value="delete">delete</option>
                </Select>
                {m.action === 'set' && (
                  <Input
                    placeholder="新值（JSON 格式）"
                    value={typeof m.value === 'string' ? m.value : JSON.stringify(m.value)}
                    onChange={e => {
                      const next = [...modifyMod.modifications]
                      let val: unknown = e.target.value
                      try { val = JSON.parse(e.target.value) } catch { /* keep as string */ }
                      next[i] = { ...next[i], value: val }
                      setMod({ ...modifyMod, modifications: next })
                    }}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setMod({ ...modifyMod, modifications: modifyMod.modifications.filter((_, idx) => idx !== i) })}
                  className="h-10 rounded-md text-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 状态码 */}
        {statusMod && (
          <div className="animate-fade-in rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <Label>HTTP 状态码</Label>
            <Input
              type="number"
              value={statusMod.code}
              onChange={e => setMod({ ...statusMod, code: Number(e.target.value) })}
              className="!w-32"
            />
          </div>
        )}

        {/* 延迟 */}
        {delayMod && (
          <div className="animate-fade-in rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <Label>延迟（毫秒）</Label>
            <Input
              type="number"
              value={delayMod.ms}
              onChange={e => setMod({ ...delayMod, ms: Number(e.target.value) })}
              className="!w-32"
            />
          </div>
        )}
      </Section>
    </div>
  )
}
