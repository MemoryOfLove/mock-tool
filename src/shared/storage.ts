import type { GlobalState, MockRule } from './types'
import { STORAGE_KEY } from './constants'

const DEFAULT_STATE: GlobalState = { enabled: true, rules: [] }

export async function getState(): Promise<GlobalState> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as GlobalState | undefined) ?? DEFAULT_STATE
}

export async function setState(state: GlobalState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
}

export async function updateRule(rule: MockRule): Promise<void> {
  const state = await getState()
  const idx = state.rules.findIndex(r => r.id === rule.id)
  if (idx >= 0) {
    state.rules[idx] = rule
  } else {
    state.rules.push(rule)
  }
  await setState(state)
}

export async function deleteRule(ruleId: string): Promise<void> {
  const state = await getState()
  state.rules = state.rules.filter(r => r.id !== ruleId)
  await setState(state)
}

export async function toggleRule(ruleId: string): Promise<void> {
  const state = await getState()
  const rule = state.rules.find(r => r.id === ruleId)
  if (rule) {
    rule.enabled = !rule.enabled
    rule.updatedAt = Date.now()
    await setState(state)
  }
}

export async function setGlobalEnabled(enabled: boolean): Promise<void> {
  const state = await getState()
  state.enabled = enabled
  await setState(state)
}

export function exportRules(rules: MockRule[]): string {
  return JSON.stringify({ version: 1, rules }, null, 2)
}

export function importRules(json: string): MockRule[] {
  const data = JSON.parse(json)
  if (!Array.isArray(data.rules)) throw new Error('Invalid format')
  return data.rules
}
