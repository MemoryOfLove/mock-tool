import type { MockRule, NormalizedRequest, DelayMod, StatusCodeMod, ReplaceBodyMod, ModifyJsonFieldsMod } from '../shared/types'
import { findMatchingRule } from '../shared/rule-matcher'
import { findMod, applyJsonModifications } from '../shared/response-modifier'
import type { RuleExecutor } from './rule-executor'

export function installXHRInterceptor(
  executor: RuleExecutor,
  getRules: () => MockRule[],
  isEnabled: () => boolean,
  onMatch: (rule: MockRule, url: string) => void,
) {
  const OriginalXHR = window.XMLHttpRequest
  const originalOpen = OriginalXHR.prototype.open
  const originalSend = OriginalXHR.prototype.send
  const originalSetRequestHeader = OriginalXHR.prototype.setRequestHeader

  OriginalXHR.prototype.open = function (method: string, url: string | URL, ...args: unknown[]) {
    let resolved: string
    try { resolved = new URL(String(url), location.href).href } catch { resolved = String(url) }
    this._mockTool = { method: method.toUpperCase(), url: resolved, headers: {} }
    return originalOpen.apply(this, [method, url, ...args] as Parameters<typeof originalOpen>)
  }

  OriginalXHR.prototype.setRequestHeader = function (name: string, value: string) {
    if (this._mockTool) {
      this._mockTool.headers[name.toLowerCase()] = value
    }
    return originalSetRequestHeader.call(this, name, value)
  }

  OriginalXHR.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    if (!isEnabled() || !this._mockTool) {
      return originalSend.call(this, body)
    }

    const info = this._mockTool
    const request: NormalizedRequest = {
      url: info.url,
      method: info.method,
      headers: info.headers,
      queryParams: executor.parseQueryParams(info.url),
      body: typeof body === 'string' ? body : undefined,
    }

    const rule = findMatchingRule(getRules(), request)

    if (rule) {
      console.debug(`[Mock Tool][XHR] ${request.method} ${request.url} → 命中规则「${rule.name}」`)
    }

    if (!rule) {
      return originalSend.call(this, body)
    }

    onMatch(rule, request.url)

    const mods = rule.modifications
    const delayMod = findMod<DelayMod>(mods, 'delay')
    const statusMod = findMod<StatusCodeMod>(mods, 'statusCode')
    const replaceMod = findMod<ReplaceBodyMod>(mods, 'replaceBody')
    const modifyMod = findMod<ModifyJsonFieldsMod>(mods, 'modifyJsonFields')

    const xhr = this

    // 完整替换
    if (replaceMod) {
      const respond = () => {
        Object.defineProperty(xhr, 'readyState', { writable: true, value: 4 })
        Object.defineProperty(xhr, 'status', { writable: true, value: statusMod?.code ?? 200 })
        Object.defineProperty(xhr, 'statusText', { writable: true, value: 'OK' })
        Object.defineProperty(xhr, 'responseText', { writable: true, value: replaceMod.body })
        Object.defineProperty(xhr, 'response', { writable: true, value: replaceMod.body })
        xhr.dispatchEvent(new Event('readystatechange'))
        xhr.dispatchEvent(new Event('load'))
        xhr.dispatchEvent(new Event('loadend'))
      }
      if (delayMod) {
        setTimeout(respond, delayMod.ms)
      } else {
        setTimeout(respond, 0)
      }
      return
    }

    // 部分修改 — 发真实请求后改响应
    const originalOnReadyStateChange = xhr.onreadystatechange
    xhr.onreadystatechange = function (ev: Event) {
      if (xhr.readyState === 4 && modifyMod) {
        try {
          const json = JSON.parse(xhr.responseText)
          applyJsonModifications(json as Record<string, unknown>, modifyMod)
          Object.defineProperty(xhr, 'responseText', { writable: true, value: JSON.stringify(json) })
          Object.defineProperty(xhr, 'response', { writable: true, value: JSON.stringify(json) })
        } catch { /* not JSON, skip */ }
      }
      if (xhr.readyState === 4 && statusMod) {
        Object.defineProperty(xhr, 'status', { writable: true, value: statusMod.code })
      }
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.call(xhr, ev)
      }
    }

    if (delayMod) {
      setTimeout(() => originalSend.call(xhr, body), delayMod.ms)
    } else {
      originalSend.call(xhr, body)
    }
  }
}

// 扩展 XMLHttpRequest 类型
declare global {
  interface XMLHttpRequest {
    _mockTool?: { method: string; url: string; headers: Record<string, string> }
  }
}
