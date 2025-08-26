const getInitialData = () => ({
  version: "1.0",
  config: {
    tabs: [
      {
        id: `tab-${Date.now()}`,
        name: "主页",
        order: 0,
        icons: [],
      },
    ],
  },
  // 更新统计数据结构
  statistics: {
    iconStats: {},
  },
});

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === "install") {
    const data = await chrome.storage.local.get("smartNavData");
    if (!data.smartNavData) {
      console.log("Initializing default data for Smart Navigation Homepage.");
      await chrome.storage.local.set({ smartNavData: getInitialData() });
    }
  }
});
