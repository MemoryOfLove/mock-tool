import { MSG_SOURCE_CONTENT, MSG_SOURCE_INJECTED } from '../shared/constants'
import type { ExtMessage, WindowMessage, GlobalState } from '../shared/types'

let pendingState: GlobalState | null = null

// 注入拦截脚本到页面主世界
function injectScript() {
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('injected.js')
  script.onload = () => script.remove()
  ;(document.head || document.documentElement).appendChild(script)
}

function sendRulesToInjected(state: GlobalState) {
  window.postMessage({
    source: MSG_SOURCE_CONTENT,
    type: 'INIT_RULES',
    payload: state,
  } satisfies WindowMessage, '*')
}

// 初始化
async function init() {
  injectScript()

  try {
    const state = await chrome.runtime.sendMessage({ type: 'GET_RULES' } satisfies ExtMessage)
    console.log('[Mock Tool][Content] 收到规则:', state?.rules?.length ?? 0, '条, 全局开关:', state?.enabled)
    // 先缓存，等 injected 准备好再发
    pendingState = state
    // 也立即发一次，如果 injected 已经加载好了就能收到
    sendRulesToInjected(state)
  } catch (e) {
    console.warn('[Mock Tool][Content] 获取规则失败:', e)
  }
}

// 监听来自 injected 的消息
window.addEventListener('message', (event) => {
  const data = event.data
  if (data?.source !== MSG_SOURCE_INJECTED) return

  // injected 脚本准备好了，发送缓存的规则
  if (data.type === 'READY' && pendingState) {
    console.log('[Mock Tool][Content] Injected 已就绪，发送规则')
    sendRulesToInjected(pendingState)
    pendingState = null
  }

  // 规则命中日志转发给 service worker
  if (data.type === 'RULE_MATCHED') {
    chrome.runtime.sendMessage(data).catch(() => {})
  }
})

// 监听来自 Service Worker 的规则更新
chrome.runtime.onMessage.addListener((message: ExtMessage) => {
  if (message.type === 'RULES_UPDATED') {
    console.log('[Mock Tool][Content] 规则已更新:', message.payload.rules.length, '条')
    window.postMessage({
      source: MSG_SOURCE_CONTENT,
      type: 'RULES_UPDATED',
      payload: message.payload,
    } satisfies WindowMessage, '*')
  }
})

init()
