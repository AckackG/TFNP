import { WebDAVClient } from "./WebDAVClient.js";

let isSyncing = false;

export async function performSync(force = false) {
  if (isSyncing) {
    console.log("Sync in progress, skipping.");
    return;
  }

  isSyncing = true;
  const dataFileName = "smartNavData.json.gz";
  const metaFileName = "meta.json";

  try {
    const { sync_settings, smartNavData: localData } = await chrome.storage.local.get([
      "sync_settings",
      "smartNavData",
    ]);

    if (!force && (!sync_settings || !sync_settings.enabled)) {
      isSyncing = false;
      return;
    }

    if (
      !sync_settings ||
      !sync_settings.server_url ||
      !sync_settings.username ||
      !sync_settings.password
    ) {
      throw new Error("配置缺失：请检查服务器地址、用户名和密码。");
    }

    const client = new WebDAVClient(
      sync_settings.server_url,
      sync_settings.username,
      sync_settings.password
    );

    // 1. 记录检查开始时间
    await updateSyncStatus(sync_settings, { checkTime: Date.now() });

    // 2. 检查连接
    const canConnect = await client.checkConnection();
    if (!canConnect) {
      throw new Error("无法连接到 WebDAV 服务器，请检查网络或配置。");
    }

    const localTs = localData && localData.update_timestamp ? localData.update_timestamp : 0;
    let remoteTs = 0;
    let metaData = null;

    try {
      metaData = await client.getFile(metaFileName);
    } catch (e) {
      console.warn("Could not read meta.json", e);
    }

    if (metaData && metaData.update_timestamp) {
      remoteTs = metaData.update_timestamp;
    } else {
      try {
        const remoteDataFile = await client.getFile(dataFileName);
        if (remoteDataFile && remoteDataFile.update_timestamp) {
          remoteTs = remoteDataFile.update_timestamp;
        }
      } catch (e) {
        // 如果文件不存在，remoteTs 保持 0，视为新初始化
        console.log("Remote data file check failed or not found:", e);
      }
    }

    console.log(`Sync Check: Local TS=${localTs}, Remote TS=${remoteTs}`);

    let syncAction = "none"; // none, push, pull

    if (remoteTs === 0 && localTs > 0) {
      syncAction = "push";
    } else if (localTs > remoteTs) {
      syncAction = "push";
    } else if (localTs < remoteTs) {
      syncAction = "pull";
    }

    if (syncAction === "push") {
      console.log("Pushing local data to server...");
      await client.putFile(dataFileName, localData);
      await client.putFileJson(metaFileName, { update_timestamp: localTs });
      await updateSyncStatus(sync_settings, { syncTime: Date.now(), status: "success" });
      notifyFrontend("toast", "TFNP 本地配置已成功推送到云端。");
    } else if (syncAction === "pull") {
      console.log("Pulling remote data from server...");
      const remoteData = await client.getFile(dataFileName);
      if (!remoteData) throw new Error("TFNP 下载远程数据失败，文件可能为空。");

      await chrome.storage.local.set({ smartNavData: remoteData });

      await updateSyncStatus(sync_settings, { syncTime: Date.now(), status: "success" });
      notifyFrontend("refresh", "TFNP 检测到云端更新，已同步到本地。");
      notifyFrontend("toast", "TFNP 已从云端拉取最新配置。");
    } else {
      console.log("Data is up to date.");
      // 即使没有数据传输，也算作一次成功的“检查”
      await updateSyncStatus(sync_settings, { status: "success" });
    }
  } catch (error) {
    console.error("Sync Error:", error);
    // 获取最新的 settings 以避免覆盖
    const { sync_settings } = await chrome.storage.local.get(["sync_settings"]);
    if (sync_settings) {
      const errorMsg = error.message || "未知网络错误";
      await updateSyncStatus(sync_settings, { status: `error: ${errorMsg}` });
    }
    // 向前端抛出异常以便 Modal 显示
    throw error;
  } finally {
    isSyncing = false;
  }
}

// 辅助函数：更新状态，支持部分更新
async function updateSyncStatus(currentSettings, { checkTime, syncTime, status } = {}) {
  // 重新读取一次以防止并发覆盖
  const { sync_settings: latestSettings } = await chrome.storage.local.get("sync_settings");
  const baseSettings = latestSettings || currentSettings;

  const newSettings = { ...baseSettings };

  if (checkTime) newSettings.last_check_time = checkTime;
  if (syncTime) newSettings.last_sync_success_time = syncTime;
  if (status) newSettings.last_sync_status = status;

  await chrome.storage.local.set({ sync_settings: newSettings });
}

function notifyFrontend(type, message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      const action = type === "refresh" ? "sync_completed_refresh" : "show_toast";
      chrome.tabs.sendMessage(tab.id, { action: action, message: message }).catch(() => {});
    });
  });
}
