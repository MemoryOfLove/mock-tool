import { getState } from '../shared/storage'
import { broadcastOnStorageChange } from '../shared/messaging'
import type { ExtMessage } from '../shared/types'

// 每个 tab 的命中计数
const matchCounts = new Map<number, number>()

// 监听来自 content script / popup / options 的消息
chrome.runtime.onMessage.addListener((message: ExtMessage, sender, sendResponse) => {
  if (message.type === 'GET_RULES') {
    getState().then(state => sendResponse(state))
    return true
  }

  if (message.type === 'RULE_MATCHED' && sender.tab?.id != null) {
    const tabId = sender.tab.id
    const count = (matchCounts.get(tabId) ?? 0) + 1
    matchCounts.set(tabId, count)
    chrome.action.setBadgeText({ text: String(count), tabId })
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1', tabId })
  }
})

// tab 导航时重置计数
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    matchCounts.delete(tabId)
    chrome.action.setBadgeText({ text: '', tabId })
  }
})

chrome.tabs.onRemoved.addListener((tabId) => {
  matchCounts.delete(tabId)
})

// 监听 storage 变化，广播给所有 tab
broadcastOnStorageChange()

// 监听安装事件
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Mock Tool] Extension installed')
})
