import { debounce } from "./utils.js"; // 确保引入 debounce

// 创建一个防抖的同步触发器，避免短时间内频繁操作导致多次网络请求
// 延迟 2 秒执行，给用户连续操作留出缓冲
const debouncedAutoSync = debounce(() => {
  chrome.runtime.sendMessage({ action: "trigger_sync_now" }).catch(() => {
    // 忽略错误，通常是因为扩展上下文失效或后台未就绪
  });
}, 2000);

// Using an object to hold the state, so it can be mutated across modules.
export const state = {
  appData: {},
  activeTabId: null,
  sortableInstances: [],
  faviconAbortController: null,
  currentSearchEngine: "google", // 'google', 'bing', or 'sogou'
  importedData: null,
};

export const loadData = async () => {
  const result = await chrome.storage.local.get(["smartNavData", "searchEngine"]);

  // Handle main app data
  if (result.smartNavData) {
    state.appData = result.smartNavData;
    // Ensure new stats structure exists for backward compatibility
    if (!state.appData.statistics.iconStats) {
      state.appData.statistics.iconStats = {};
    }
    if (state.appData.config.tabs.length > 0) {
      state.activeTabId = state.appData.config.tabs[0].id;
    }
  } else {
    state.appData = {
      version: "1.0",
      config: { tabs: [{ id: `tab-${Date.now()}`, name: "主页", order: 0, icons: [] }] },
      statistics: { iconStats: {} },
    };
    state.activeTabId = state.appData.config.tabs[0].id;
    await saveData();
  }

  // Handle search engine preference
  if (result.searchEngine) {
    state.currentSearchEngine = result.searchEngine;
  }
};

export const saveData = async () => {
  // Update timestamp for Last-Write-Wins logic
  state.appData.update_timestamp = Date.now();
  await chrome.storage.local.set({ smartNavData: state.appData });

  // --- MODIFIED: Trigger auto-sync after save ---
  // 检查设置是否开启了同步，如果开启则触发自动推送
  chrome.storage.local.get("sync_settings").then(({ sync_settings }) => {
    if (sync_settings && sync_settings.enabled) {
      console.log("Data saved, triggering auto-sync...");
      debouncedAutoSync();
    }
  });
};

export const saveSearchEnginePreference = async () => {
  await chrome.storage.local.set({ searchEngine: state.currentSearchEngine });
};
