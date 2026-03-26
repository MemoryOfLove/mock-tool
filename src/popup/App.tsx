import { useState, useEffect } from 'react'
import type { GlobalState, MockRule } from '../shared/types'
import { getState, setGlobalEnabled, toggleRule } from '../shared/storage'

export default function App() {
  const [state, setState] = useState<GlobalState>({ enabled: true, rules: [] })
  const [matchLog, setMatchLog] = useState<Array<{ ruleName: string; url: string; time: string }>>([])

  useEffect(() => {
    getState().then(setState)

    const listener = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'RULE_MATCHED') {
        const p = message.payload as { ruleName: string; url: string; timestamp: number }
        setMatchLog(prev => [
          { ruleName: p.ruleName, url: p.url, time: new Date(p.timestamp).toLocaleTimeString() },
          ...prev.slice(0, 49),
        ])
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  const handleGlobalToggle = async () => {
    const next = !state.enabled
    await setGlobalEnabled(next)
    setState(s => ({ ...s, enabled: next }))
  }

  const handleToggleRule = async (id: string) => {
    await toggleRule(id)
    const fresh = await getState()
    setState(fresh)
  }

  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="w-80 p-4 bg-white text-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-base font-semibold text-gray-800">Mock Tool</h1>
        <button
          onClick={handleGlobalToggle}
          className={`relative w-10 h-5 rounded-full transition-colors ${state.enabled ? 'bg-indigo-500' : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${state.enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {!state.enabled && (
        <div className="text-xs text-gray-400 mb-3">已暂停拦截</div>
      )}

      {/* Rules */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {state.rules.length === 0 ? (
          <div className="text-gray-400 text-center py-4">暂无规则</div>
        ) : (
          state.rules.map(rule => (
            <div key={rule.id} className="flex items-center justify-between p-2 rounded bg-gray-50 hover:bg-gray-100">
              <div className="flex-1 min-w-0 mr-2">
                <div className="font-medium text-gray-700 truncate">{rule.name}</div>
                <div className="text-xs text-gray-400 truncate">
                  {rule.matchCondition.url?.value ?? '(无 URL 条件)'}
                </div>
              </div>
              <button
                onClick={() => handleToggleRule(rule.id)}
                className={`shrink-0 w-8 h-4 rounded-full transition-colors ${rule.enabled ? 'bg-indigo-400' : 'bg-gray-300'}`}
              >
                <span className={`block w-3 h-3 bg-white rounded-full shadow transition-transform ml-0.5 ${rule.enabled ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Match Log */}
      {matchLog.length > 0 && (
        <div className="mt-3 border-t pt-2">
          <div className="text-xs font-medium text-gray-500 mb-1">命中日志</div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {matchLog.slice(0, 5).map((log, i) => (
              <div key={i} className="text-xs text-gray-500">
                <span className="text-indigo-500">{log.time}</span>{' '}
                <span className="font-medium">{log.ruleName}</span>{' '}
                <span className="text-gray-400 truncate block">{log.url}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <button
        onClick={openOptions}
        className="mt-3 w-full py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
      >
        管理规则 →
      </button>
    </div>
  )
}
