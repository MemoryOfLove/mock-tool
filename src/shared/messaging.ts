import type { GlobalState } from './types'
import { STORAGE_KEY } from './constants'

/** 监听 storage 变化，广播给所有 tab */
export function broadcastOnStorageChange(): void {
  chrome.storage.onChanged.addListener(async (changes) => {
    if (!changes[STORAGE_KEY]) return
    const newState = changes[STORAGE_KEY].newValue as GlobalState
    const tabs = await chrome.tabs.query({})
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'RULES_UPDATED',
          payload: newState,
        }).catch(() => {})
      }
    }
  })
}
