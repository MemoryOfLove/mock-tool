import type { ResponseModification, ModifyJsonFieldsMod } from './types'
import { getByPath } from './rule-matcher'

/** 按 JSONPath 设置值 */
function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1').split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (current[part] == null || typeof current[part] !== 'object') {
      current[part] = /^\d+$/.test(parts[i + 1]) ? [] : {}
    }
    current = current[part] as Record<string, unknown>
  }
  current[parts[parts.length - 1]] = value
}

/** 按 JSONPath 删除值 */
function deleteByPath(obj: Record<string, unknown>, path: string): void {
  const parts = path.replace(/^\$\.?/, '').replace(/\[(\d+)\]/g, '.$1').split('.')
  let current: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (current[part] == null || typeof current[part] !== 'object') return
    current = current[part] as Record<string, unknown>
  }
  delete current[parts[parts.length - 1]]
}

export function applyJsonModifications(json: Record<string, unknown>, mod: ModifyJsonFieldsMod): void {
  for (const m of mod.modifications) {
    switch (m.action) {
      case 'set':
        setByPath(json, m.path, m.value)
        break
      case 'delete':
        deleteByPath(json, m.path)
        break
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** 从 modifications 数组中提取特定类型 */
export function findMod<T extends ResponseModification>(
  mods: ResponseModification[],
  type: T['type'],
): T | undefined {
  return mods.find(m => m.type === type) as T | undefined
}

export { getByPath }
