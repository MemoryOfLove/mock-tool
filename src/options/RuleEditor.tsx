import { useState } from 'react'
import type {
  MockRule, MatchCondition, ResponseModification,
  UrlMatchCondition, KeyValueCondition, BodyMatchCondition,
  ReplaceBodyMod, ModifyJsonFieldsMod, StatusCodeMod, DelayMod,
} from '../shared/types'

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
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 ${props.className ?? ''}`} />
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return <select {...props} className={`px-2 py-1.5 text-sm border rounded focus:ring-1 focus:ring-indigo-400 ${props.className ?? ''}`} />
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full px-2 py-1.5 text-sm border rounded font-mono focus:ring-1 focus:ring-indigo-400 ${props.className ?? ''}`} />
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
      <div className="flex items-center justify-between mb-1">
        <Label>{label}</Label>
        <button type="button" onClick={add} className="text-xs text-indigo-500 hover:underline">+ 添加</button>
      </div>
      {conditions.map((c, i) => (
        <div key={i} className="flex gap-1.5 mb-1.5">
          <Input placeholder="Key" value={c.key} onChange={e => update(i, { key: e.target.value })} className="!w-28" />
          <Select value={c.operator} onChange={e => update(i, { operator: e.target.value as KeyValueCondition['operator'] })}>
            {KV_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
          </Select>
          {c.operator !== 'exists' && (
            <Input placeholder="Value" value={c.value ?? ''} onChange={e => update(i, { value: e.target.value })} className="flex-1" />
          )}
          <button type="button" onClick={() => remove(i)} className="text-red-400 hover:text-red-600 px-1">×</button>
        </div>
      ))}
    </div>
  )
}

// ===== 主编辑器 =====

export default function RuleEditor({ rule: initial, onSave, onCancel }: Props) {
  const [rule, setRule] = useState<MockRule>(initial)
  const mc = rule.matchCondition

  const setMC = (patch: Partial<MatchCondition>) =>
    setRule(r => ({ ...r, matchCondition: { ...r.matchCondition, ...patch } }))

  const setUrl = (patch: Partial<UrlMatchCondition>) =>
    setMC({ url: { ...(mc.url ?? { type: 'contains', value: '' }), ...patch } })

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          {initial.name ? '编辑规则' : '新建规则'}
        </h2>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50">取消</button>
          <button onClick={() => onSave(rule)} className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600">保存</button>
        </div>
      </div>

      {/* 基本信息 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600 border-b pb-1">基本信息</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>规则名称</Label>
            <Input value={rule.name} onChange={e => setRule(r => ({ ...r, name: e.target.value }))} placeholder="例：Mock 用户接口" />
          </div>
          <div>
            <Label>优先级（数字越小越优先）</Label>
            <Input type="number" value={rule.priority} onChange={e => setRule(r => ({ ...r, priority: Number(e.target.value) }))} />
          </div>
        </div>
      </section>

      {/* 匹配条件 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600 border-b pb-1">匹配条件</h3>

        {/* URL */}
        <div>
          <Label>URL 匹配</Label>
          <div className="flex gap-2">
            <Select value={mc.url?.type ?? 'contains'} onChange={e => setUrl({ type: e.target.value as UrlMatchCondition['type'] })}>
              {URL_MATCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input value={mc.url?.value ?? ''} onChange={e => setUrl({ value: e.target.value })} placeholder="https://api.example.com/*" className="flex-1" />
          </div>
        </div>

        {/* Methods */}
        <div>
          <Label>请求方法（不选 = 全部）</Label>
          <div className="flex gap-2 flex-wrap">
            {HTTP_METHODS.map(m => (
              <label key={m} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={mc.methods?.includes(m) ?? false}
                  onChange={e => {
                    const current = mc.methods ?? []
                    setMC({ methods: e.target.checked ? [...current, m] : current.filter(x => x !== m) })
                  }}
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
              value={mc.requestBody?.type ?? 'contains'}
              onChange={e => setMC({ requestBody: { ...(mc.requestBody ?? { type: 'contains', expression: '' }), type: e.target.value as BodyMatchCondition['type'] } })}
            >
              {BODY_MATCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input
              value={mc.requestBody?.expression ?? ''}
              onChange={e => setMC({ requestBody: { ...(mc.requestBody ?? { type: 'contains', expression: '' }), expression: e.target.value } })}
              placeholder={mc.requestBody?.type === 'jsonpath' ? '$.data.userId' : '匹配表达式'}
              className="flex-1"
            />
          </div>
          {mc.requestBody?.type === 'jsonpath' && (
            <Input
              value={mc.requestBody?.expectedValue ?? ''}
              onChange={e => setMC({ requestBody: { ...mc.requestBody!, expectedValue: e.target.value } })}
              placeholder="期望值（可选）"
            />
          )}
        </div>
      </section>

      {/* 响应修改 */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-600 border-b pb-1">响应修改</h3>

        {/* 修改类型开关 */}
        <div className="flex gap-3 flex-wrap">
          {[
            { type: 'replaceBody', label: '替换响应体' },
            { type: 'modifyJsonFields', label: '修改 JSON 字段' },
            { type: 'statusCode', label: '状态码' },
            { type: 'delay', label: '延迟' },
          ].map(({ type, label }) => (
            <label key={type} className="flex items-center gap-1.5 text-sm">
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
              />
              {label}
            </label>
          ))}
        </div>

        {/* 替换响应体 */}
        {replaceMod && (
          <div>
            <Label>响应体内容</Label>
            <Textarea
              rows={8}
              value={replaceMod.body}
              onChange={e => setMod({ ...replaceMod, body: e.target.value })}
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
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>JSON 字段修改</Label>
              <button
                type="button"
                onClick={() => setMod({ ...modifyMod, modifications: [...modifyMod.modifications, { path: '', action: 'set', value: '' }] })}
                className="text-xs text-indigo-500 hover:underline"
              >
                + 添加
              </button>
            </div>
            {modifyMod.modifications.map((m, i) => (
              <div key={i} className="flex gap-1.5 mb-1.5">
                <Input
                  placeholder="$.data.name"
                  value={m.path}
                  onChange={e => {
                    const next = [...modifyMod.modifications]
                    next[i] = { ...next[i], path: e.target.value }
                    setMod({ ...modifyMod, modifications: next })
                  }}
                  className="!w-40"
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
                    className="flex-1"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setMod({ ...modifyMod, modifications: modifyMod.modifications.filter((_, idx) => idx !== i) })}
                  className="text-red-400 hover:text-red-600 px-1"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 状态码 */}
        {statusMod && (
          <div>
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
          <div>
            <Label>延迟（毫秒）</Label>
            <Input
              type="number"
              value={delayMod.ms}
              onChange={e => setMod({ ...delayMod, ms: Number(e.target.value) })}
              className="!w-32"
            />
          </div>
        )}
      </section>
    </div>
  )
}
