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
};

export const saveSearchEnginePreference = async () => {
  await chrome.storage.local.set({ searchEngine: state.currentSearchEngine });
};
