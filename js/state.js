import { debounce } from "./utils.js";

// 确保引入 debounce

// 创建一个防抖的同步触发器，避免短时间内频繁操作导致多次网络请求
// 延迟 2 秒执行，给用户连续操作留出缓冲
// 此触发器现在仅用于配置变更 (Config)，统计变更不触发此逻辑
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
  currentSearchEngine: "google", // 'google', 'bing', or 'sogou'
  importedData: null,
};

export const loadData = async () => {
  const result = await chrome.storage.local.get(["smartNavData", "searchEngine", "activeTabId"]);
  // Handle main app data
  if (result.smartNavData) {
    state.appData = result.smartNavData;

    // 兜底：确保核心结构存在，兼容老版本 / 损坏数据，避免直接崩溃白屏
    if (!state.appData.config || typeof state.appData.config !== "object") {
      state.appData.config = { tabs: [] };
    }
    if (!Array.isArray(state.appData.config.tabs)) {
      state.appData.config.tabs = [];
    }
    if (!state.appData.statistics || typeof state.appData.statistics !== "object") {
      state.appData.statistics = { iconStats: {} };
    }
    if (!state.appData.statistics.iconStats) {
      state.appData.statistics.iconStats = {};
    }

    // 初始化新的统计时间戳，如果不存在则同步当前主时间戳或置0
    if (!state.appData.stats_timestamp) {
      state.appData.stats_timestamp = state.appData.update_timestamp || 0;
    }

    // 若标签页为空（异常数据），补一个默认主页，保证界面可用
    if (state.appData.config.tabs.length === 0) {
      state.appData.config.tabs.push({ id: `tab-${Date.now()}`, name: "主页", order: 0, icons: [] });
    }
    // 恢复上次选中的标签页（本地设置，不参与同步）；若已失效则回退到第一个
    const tabs = state.appData.config.tabs;
    state.activeTabId = tabs.some((t) => t.id === result.activeTabId)
      ? result.activeTabId
      : tabs[0].id;
  } else {
    // 全新/空配置的时间戳必须为 0，确保首次同步走"拉取云端"而非"推送空数据覆盖云端"
    state.appData = {
      version: "1.0",
      config: { tabs: [{ id: `tab-${Date.now()}`, name: "主页", order: 0, icons: [] }] },
      statistics: { iconStats: {} },
      update_timestamp: 0, // Config timestamp
      stats_timestamp: 0, // Stats timestamp
    };
    state.activeTabId = state.appData.config.tabs[0].id;
    // 直接落盘，绕过 saveData（它会把时间戳自增为 now，导致空数据被判为"最新"）
    await chrome.storage.local.set({ smartNavData: state.appData });
  }

  // Handle search engine preference
  if (result.searchEngine) {
    state.currentSearchEngine = result.searchEngine;
  }
};

/**
 * 保存数据到本地存储
 * @param {string} type - 'config' (配置变更) 或 'stats' (统计/点击变更)。默认为 'config' 以兼容旧调用。
 */
export const saveData = async (type = "config") => {
  const now = Date.now();

  // 根据变更类型更新对应的时间戳
  if (type === "config") {
    state.appData.update_timestamp = now;
  } else if (type === "stats") {
    state.appData.stats_timestamp = now;
  } else {
    // Fallback: 如果未指定类型，默认视为配置变更
    state.appData.update_timestamp = now;
  }

  await chrome.storage.local.set({ smartNavData: state.appData });

  // --- MODIFIED: Trigger auto-sync logic ---
  // 仅当配置 (config) 变更时触发自动同步防抖
  // 统计数据 (stats) 变更不触发自动同步，仅依赖定时任务、浏览器启动或手动触发
  if (type === "config") {
    chrome.storage.local.get("sync_settings").then(({ sync_settings }) => {
      if (sync_settings && sync_settings.enabled) {
        console.log("Config saved, triggering auto-sync...");
        debouncedAutoSync();
      }
    });
  }
};

export const saveSearchEnginePreference = async () => {
  await chrome.storage.local.set({ searchEngine: state.currentSearchEngine });
};

// 记住当前选中的标签页（本地设置，独立键，不参与同步）
export const saveActiveTabPreference = async () => {
  await chrome.storage.local.set({ activeTabId: state.activeTabId });
};
