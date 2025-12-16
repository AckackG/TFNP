import { performSync } from "./js/syncLogic.js";

const getInitialData = () => ({
  version: "1.0",
  config: {
    tabs: [
      { id: `tab-${Date.now()}`, name: "主页", order: 0, icons: [] },
    ],
  },
  statistics: { iconStats: {} },
  update_timestamp: Date.now()
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const data = await chrome.storage.local.get("smartNavData");
    if (!data.smartNavData) {
      await chrome.storage.local.set({ smartNavData: getInitialData() });
    }
  }
});

// Sync Scheduling Logic
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== "local" || !changes.sync_settings) return;

  const newSettings = changes.sync_settings.newValue;
  if (newSettings && newSettings.enabled) {
    chrome.alarms.create("webdav_sync", { periodInMinutes: parseInt(newSettings.interval) || 30 });
    console.log("Sync alarm created.");
  } else {
    chrome.alarms.clear("webdav_sync");
    console.log("Sync alarm cleared.");
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "webdav_sync") {
    performSync(false);
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "trigger_sync_now") {
    performSync(true)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open
  }
});