import { useState, useEffect, useCallback } from 'react'
import type { GlobalState, MockRule } from '../shared/types'
import { getState, setState as saveState, deleteRule, updateRule, toggleRule, importRules, exportRules } from '../shared/storage'
import RuleEditor from './RuleEditor'

function createEmptyRule(): MockRule {
  return {
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    priority: 0,
    matchCondition: { url: { type: 'contains', value: '' } },
    modifications: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

const modificationLabels: Record<string, string> = {
  replaceBody: '替换响应',
  modifyJsonFields: '修改 JSON',
  statusCode: '状态码',
  delay: '延迟',
  headers: '响应头',
}

function getModificationSummary(rule: MockRule) {
  if (!rule.modifications.length) return '暂无修改'
  return rule.modifications.map(mod => modificationLabels[mod.type] ?? mod.type).join(' / ')
}

function getMethodSummary(rule: MockRule) {
  return rule.matchCondition.methods?.length ? rule.matchCondition.methods.join(', ') : 'ALL'
}

export default function App() {
  const [state, setLocalState] = useState<GlobalState>({ enabled: true, rules: [] })
  const [editingRule, setEditingRule] = useState<MockRule | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [draggingRuleId, setDraggingRuleId] = useState<string | null>(null)
  const [dragOverRuleId, setDragOverRuleId] = useState<string | null>(null)

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const refresh = useCallback(async () => {
    setLocalState(await getState())
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const reorderRules = useCallback(async (fromId: string, toId: string) => {
    if (fromId === toId) return

    const fromIndex = state.rules.findIndex(rule => rule.id === fromId)
    const toIndex = state.rules.findIndex(rule => rule.id === toId)
    if (fromIndex < 0 || toIndex < 0) return

    const nextRules = [...state.rules]
    const [movedRule] = nextRules.splice(fromIndex, 1)
    nextRules.splice(toIndex, 0, movedRule)

    const nextState: GlobalState = { ...state, rules: nextRules }
    setLocalState(nextState)
    await saveState(nextState)
  }, [state])

  const handleSaveRule = async (rule: MockRule) => {
    rule.updatedAt = Date.now()
    await updateRule(rule)
    setEditingRule(null)
    await refresh()
  }

  const handleDeleteRule = async (id: string) => {
    await deleteRule(id)
    await refresh()
  }

  const handleToggleRule = async (id: string) => {
    await toggleRule(id)
    await refresh()
  }

  const handleExport = () => {
    const json = exportRules(state.rules)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mock-tool-rules.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const rules = importRules(text)
        const newState: GlobalState = { ...state, rules: [...state.rules, ...rules] }
        await saveState(newState)
        await refresh()
      } catch {
        alert('导入失败：文件格式不正确')
      }
    }
    input.click()
  }

  if (editingRule) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <RuleEditor
            rule={editingRule}
            onSave={handleSaveRule}
            onCancel={() => setEditingRule(null)}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-indigo-500">Mock Tool</p>
            <h1 className="text-3xl font-semibold text-slate-950">规则管理</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleImport} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 3a1 1 0 011 1v7.6l2.3-2.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L9 11.6V4a1 1 0 011-1z" />
                <path d="M4 15a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
              </svg>
              导入
            </button>
            <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50">
              <svg className="h-4 w-4 rotate-180" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 3a1 1 0 011 1v7.6l2.3-2.3a1 1 0 111.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L9 11.6V4a1 1 0 011-1z" />
                <path d="M4 15a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z" />
              </svg>
              导出
            </button>
            <button
              onClick={() => setEditingRule(createEmptyRule())}
              className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 4a1 1 0 011 1v4h4a1 1 0 110 2h-4v4a1 1 0 11-2 0v-4H5a1 1 0 110-2h4V5a1 1 0 011-1z" />
              </svg>
              新建规则
            </button>
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-medium text-slate-500">规则总数</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{state.rules.length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-medium text-slate-500">启用中</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">{state.rules.filter(rule => rule.enabled).length}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-xs font-medium text-slate-500">已暂停</div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">{state.rules.filter(rule => !rule.enabled).length}</div>
          </div>
        </div>

        {state.rules.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">暂无规则</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
            {state.rules.map(rule => {
              const isCollapsed = collapsed.has(rule.id)
              const isDragging = draggingRuleId === rule.id
              const isDragOver = dragOverRuleId === rule.id && draggingRuleId !== rule.id
              const urlCondition = rule.matchCondition.url
              return (
                <div
                  key={rule.id}
                  onDragOver={(e) => {
                    if (!draggingRuleId || draggingRuleId === rule.id) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverRuleId(rule.id)
                  }}
                  onDrop={async (e) => {
                    e.preventDefault()
                    const sourceId = draggingRuleId ?? e.dataTransfer.getData('text/plain')
                    setDragOverRuleId(null)
                    setDraggingRuleId(null)
                    if (sourceId) {
                      await reorderRules(sourceId, rule.id)
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverRuleId === rule.id) {
                      setDragOverRuleId(null)
                    }
                  }}
                  className={`group flex min-h-[248px] flex-col overflow-hidden rounded-xl border bg-white shadow-sm transition-all ${
                    isDragging ? 'scale-[0.99] opacity-60' : 'hover:-translate-y-0.5 hover:shadow-md'
                  } ${
                    isDragOver ? 'border-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.16)]' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div
                        draggable
                        onDragStart={(e) => {
                          setDraggingRuleId(rule.id)
                          setDragOverRuleId(rule.id)
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', rule.id)
                        }}
                        onDragEnd={() => {
                          setDraggingRuleId(null)
                          setDragOverRuleId(null)
                        }}
                        className="mt-0.5 shrink-0 cursor-grab rounded-md p-1.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing"
                        title="拖拽调整顺序"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path d="M7 4.25a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm6 0a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm-6 4.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm6 0a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm-6 4.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5zm6 0a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                          <h2 className="max-w-full truncate text-base font-semibold text-slate-950">{rule.name || '未命名规则'}</h2>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">P{rule.priority}</span>
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${rule.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {rule.enabled ? '启用' : '暂停'}
                          </span>
                          <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{getMethodSummary(rule)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rule.enabled}
                        onClick={() => handleToggleRule(rule.id)}
                        className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 ${
                          rule.enabled ? 'bg-emerald-500' : 'bg-slate-300'
                        }`}
                        title={rule.enabled ? '停用规则' : '启用规则'}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                            rule.enabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCollapse(rule.id)}
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        title={isCollapsed ? '展开详情' : '收起详情'}
                      >
                        <svg
                          className={`h-4 w-4 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                          viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"
                        >
                          <path d="M6 8.5L1.5 4h9L6 8.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col px-4 py-4">
                    <div className="space-y-3">
                      <div>
                        <div className="mb-1 text-xs font-medium text-slate-400">URL 匹配</div>
                        <div className="flex items-start gap-2 rounded-md bg-slate-50 px-3 py-2">
                          <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
                            {urlCondition?.type ?? 'none'}
                          </span>
                          <span className="min-w-0 break-all text-sm text-slate-700">
                            {urlCondition?.value || '(无 URL 条件)'}
                          </span>
                        </div>
                      </div>

                      <div className={`overflow-hidden transition-all duration-200 ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-28 opacity-100'}`}>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="mb-1 text-xs font-medium text-slate-400">响应修改</div>
                            <p className="line-clamp-2 text-sm text-slate-700">{getModificationSummary(rule)}</p>
                          </div>
                          <div>
                            <div className="mb-1 text-xs font-medium text-slate-400">更新时间</div>
                            <p className="text-sm text-slate-700">{new Date(rule.updatedAt).toLocaleString()}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-4">
                      <button
                        onClick={() => setEditingRule({ ...rule })}
                        className="rounded-md bg-slate-950 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
