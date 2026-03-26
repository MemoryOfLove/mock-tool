import type { MockRule, NormalizedRequest, ReplaceBodyMod, ModifyJsonFieldsMod, StatusCodeMod, DelayMod } from '../shared/types'
import { applyJsonModifications, sleep, findMod } from '../shared/response-modifier'

export function createRuleExecutor() {

  function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
    const result: Record<string, string> = {}
    if (!headers) return result
    if (headers instanceof Headers) {
      headers.forEach((v, k) => { result[k.toLowerCase()] = v })
    } else if (Array.isArray(headers)) {
      headers.forEach(([k, v]) => { result[k.toLowerCase()] = v })
    } else {
      Object.entries(headers).forEach(([k, v]) => { result[k.toLowerCase()] = v })
    }
    return result
  }

  function parseQueryParams(url: string): Record<string, string> {
    const result: Record<string, string> = {}
    try {
      const u = new URL(url)
      u.searchParams.forEach((v, k) => { result[k.toLowerCase()] = v })
    } catch { /* ignore */ }
    return result
  }

  function resolveUrl(raw: string): string {
    try {
      return new URL(raw, location.href).href
    } catch {
      return raw
    }
  }

  function normalizeRequest(input: RequestInfo | URL, init?: RequestInit): NormalizedRequest {
    let url: string, method: string, headers: Record<string, string>, body: string | undefined

    if (input instanceof Request) {
      url = input.url // Request.url 已经是绝对路径
      method = (init?.method ?? input.method).toUpperCase()
      headers = normalizeHeaders(init?.headers ?? input.headers)
      body = init?.body as string | undefined ?? undefined
    } else {
      url = resolveUrl(typeof input === 'string' ? input : input.toString())
      method = (init?.method ?? 'GET').toUpperCase()
      headers = normalizeHeaders(init?.headers)
      body = init?.body as string | undefined ?? undefined
    }

    return { url, method, headers, queryParams: parseQueryParams(url), body }
  }

  async function handleFetchMatch(
    rule: MockRule,
    originalFetch: typeof fetch,
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const mods = rule.modifications
    const delayMod = findMod<DelayMod>(mods, 'delay')
    const statusMod = findMod<StatusCodeMod>(mods, 'statusCode')
    const replaceMod = findMod<ReplaceBodyMod>(mods, 'replaceBody')
    const modifyMod = findMod<ModifyJsonFieldsMod>(mods, 'modifyJsonFields')

    if (delayMod) await sleep(delayMod.ms)

    // 完整替换 — 不发真实请求
    if (replaceMod) {
      return new Response(replaceMod.body, {
        status: statusMod?.code ?? 200,
        headers: { 'Content-Type': replaceMod.contentType ?? 'application/json' },
      })
    }

    // 部分修改 — 先发真实请求
    const realResponse = await originalFetch(input, init)

    if (modifyMod) {
      try {
        const json = await realResponse.json()
        applyJsonModifications(json as Record<string, unknown>, modifyMod)
        return new Response(JSON.stringify(json), {
          status: statusMod?.code ?? realResponse.status,
          statusText: realResponse.statusText,
          headers: realResponse.headers,
        })
      } catch {
        return realResponse
      }
    }

    if (statusMod) {
      const body = await realResponse.blob()
      return new Response(body, {
        status: statusMod.code,
        statusText: realResponse.statusText,
        headers: realResponse.headers,
      })
    }

    return realResponse
  }

  return { normalizeRequest, handleFetchMatch, normalizeHeaders, parseQueryParams }
}

export type RuleExecutor = ReturnType<typeof createRuleExecutor>
