// ===== 规则匹配条件 =====

export interface UrlMatchCondition {
  type: 'contains' | 'equals' | 'wildcard' | 'regex'
  value: string
}

export interface KeyValueCondition {
  key: string
  operator: 'exists' | 'equals' | 'contains' | 'regex'
  value?: string
}

export interface BodyMatchCondition {
  type: 'contains' | 'jsonpath' | 'regex'
  expression: string
  expectedValue?: string
}

export interface MatchCondition {
  url?: UrlMatchCondition
  methods?: string[]
  queryParams?: KeyValueCondition[]
  requestHeaders?: KeyValueCondition[]
  requestBody?: BodyMatchCondition
}

// ===== 响应修改 =====

export interface ReplaceBodyMod {
  type: 'replaceBody'
  body: string
  contentType?: string
}

export interface ModifyJsonFieldsMod {
  type: 'modifyJsonFields'
  modifications: Array<{
    path: string
    action: 'set' | 'delete'
    value?: unknown
  }>
}

export interface StatusCodeMod {
  type: 'statusCode'
  code: number
}

export interface DelayMod {
  type: 'delay'
  ms: number
}

export interface HeadersMod {
  type: 'headers'
  set?: Record<string, string>
  remove?: string[]
}

export type ResponseModification =
  | ReplaceBodyMod
  | ModifyJsonFieldsMod
  | StatusCodeMod
  | DelayMod
  | HeadersMod

// ===== 规则 =====

export interface MockRule {
  id: string
  name: string
  enabled: boolean
  priority: number
  matchCondition: MatchCondition
  modifications: ResponseModification[]
  createdAt: number
  updatedAt: number
}

// ===== 全局状态 =====

export interface GlobalState {
  enabled: boolean
  rules: MockRule[]
}

// ===== 消息协议 =====

export type ExtMessage =
  | { type: 'GET_RULES' }
  | { type: 'RULES_UPDATED'; payload: GlobalState }
  | { type: 'RULE_MATCHED'; payload: { ruleId: string; ruleName: string; url: string; timestamp: number } }

export type WindowMessage =
  | { source: string; type: 'INIT_RULES'; payload: GlobalState }
  | { source: string; type: 'RULES_UPDATED'; payload: GlobalState }
  | { source: string; type: 'RULE_MATCHED'; payload: { ruleId: string; ruleName: string; url: string; timestamp: number } }

// ===== 请求标准化 =====

export interface NormalizedRequest {
  url: string
  method: string
  headers: Record<string, string>
  queryParams: Record<string, string>
  body?: string
}
