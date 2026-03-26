import type { MockRule } from '../shared/types'
import { findMatchingRule } from '../shared/rule-matcher'
import type { RuleExecutor } from './rule-executor'

export function installFetchInterceptor(
  executor: RuleExecutor,
  getRules: () => MockRule[],
  isEnabled: () => boolean,
  onMatch: (rule: MockRule, url: string) => void,
) {
  const originalFetch = window.fetch.bind(window)

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    if (!isEnabled()) return originalFetch(input, init)

    const request = executor.normalizeRequest(input, init)
    const rules = getRules()
    const rule = findMatchingRule(rules, request)

    if (rule) {
      console.debug(`[Mock Tool][Fetch] ${request.method} ${request.url} → 命中规则「${rule.name}」`)
    }

    if (!rule) return originalFetch(input, init)

    onMatch(rule, request.url)
    return executor.handleFetchMatch(rule, originalFetch, input, init)
  }
}
