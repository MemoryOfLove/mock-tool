import type { MockRule, GlobalState } from '../shared/types'
import { MSG_SOURCE_CONTENT, MSG_SOURCE_INJECTED } from '../shared/constants'
import { createRuleExecutor } from './rule-executor'
import { installFetchInterceptor } from './fetch-interceptor'
import { installXHRInterceptor } from './xhr-interceptor'

let rules: MockRule[] = []
let globalEnabled = false

const getRules = () => rules
const isEnabled = () => globalEnabled

const executor = createRuleExecutor()

function showToast(ruleName: string) {
  const el = document.createElement('div')
  el.textContent = `Mock Tool 命中规则「${ruleName}」`
  Object.assign(el.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '2147483647',
    background: '#6366f1',
    color: '#fff',
    padding: '8px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    fontFamily: 'sans-serif',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    opacity: '1',
    transition: 'opacity 0.4s ease',
    pointerEvents: 'none',
  })
  document.documentElement.appendChild(el)
  setTimeout(() => { el.style.opacity = '0' }, 2000)
  setTimeout(() => { el.remove() }, 2400)
}

function onMatch(rule: MockRule, url: string) {
  const modTypes = rule.modifications.map(m => m.type).join(', ')
  console.log(
    `%c[Mock Tool]%c 拦截 %c${rule.name}%c → ${url}\n修改: ${modTypes}`,
    'background:#6366f1;color:#fff;padding:1px 6px;border-radius:3px;font-weight:bold',
    'color:#6b7280',
    'color:#6366f1;font-weight:bold',
    'color:#6b7280',
  )
  showToast(rule.name)
  window.postMessage({
    source: MSG_SOURCE_INJECTED,
    type: 'RULE_MATCHED',
    payload: { ruleId: rule.id, ruleName: rule.name, url, timestamp: Date.now() },
  }, '*')
}

installFetchInterceptor(executor, getRules, isEnabled, onMatch)
installXHRInterceptor(executor, getRules, isEnabled, onMatch)

console.log('[Mock Tool][Injected] 脚本已注入，等待规则...')

// 通知 Content Script 已准备好
window.postMessage({ source: MSG_SOURCE_INJECTED, type: 'READY' }, '*')

// 监听来自 Content Script 的规则更新
window.addEventListener('message', (event) => {
  if (event.data?.source !== MSG_SOURCE_CONTENT) return

  if (event.data.type === 'INIT_RULES' || event.data.type === 'RULES_UPDATED') {
    const payload = event.data.payload as GlobalState
    rules = payload.rules
    globalEnabled = payload.enabled
    const enabledCount = rules.filter(r => r.enabled).length
    console.log(
      `%c[Mock Tool]%c 规则已加载: ${rules.length} 条 (${enabledCount} 条启用), 全局开关: ${globalEnabled ? '开' : '关'}`,
      'background:#6366f1;color:#fff;padding:1px 6px;border-radius:3px;font-weight:bold',
      'color:#6b7280',
    )
  }
})
