import { useState, useEffect, useCallback } from 'react'
import type { GlobalState, MockRule } from '../shared/types'
import { getState, setState as saveState, deleteRule, updateRule, importRules, exportRules } from '../shared/storage'
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

export default function App() {
  const [state, setLocalState] = useState<GlobalState>({ enabled: true, rules: [] })
  const [editingRule, setEditingRule] = useState<MockRule | null>(null)

  const refresh = useCallback(async () => {
    setLocalState(await getState())
  }, [])

  useEffect(() => { refresh() }, [refresh])

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
      <div className="max-w-3xl mx-auto p-6">
        <RuleEditor
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => setEditingRule(null)}
        />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">Mock Tool — 规则管理</h1>
        <div className="flex gap-2">
          <button onClick={handleImport} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
            导入
          </button>
          <button onClick={handleExport} className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
            导出
          </button>
          <button
            onClick={() => setEditingRule(createEmptyRule())}
            className="px-3 py-1.5 text-sm bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >
            + 新建规则
          </button>
        </div>
      </div>

      {state.rules.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">暂无规则</p>
          <p className="text-sm">点击「新建规则」开始配置</p>
        </div>
      ) : (
        <div className="space-y-2">
          {state.rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:shadow-sm">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-400' : 'bg-gray-300'}`} />
                  <span className="font-medium text-gray-800">{rule.name || '未命名规则'}</span>
                  <span className="text-xs text-gray-400">优先级 {rule.priority}</span>
                </div>
                <div className="text-sm text-gray-500 mt-1 truncate">
                  {rule.matchCondition.url?.type}: {rule.matchCondition.url?.value || '(无)'}
                  {rule.matchCondition.methods?.length ? ` | ${rule.matchCondition.methods.join(',')}` : ''}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {rule.modifications.map(m => m.type).join(', ')}
                </div>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => setEditingRule({ ...rule })}
                  className="px-2 py-1 text-xs text-indigo-600 hover:bg-indigo-50 rounded"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
