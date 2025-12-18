import { WebDAVClient } from "./WebDAVClient.js";

let isSyncing = false;

// 定义云端文件名常量
const FILES = {
  CONFIG: "smartNavData.json.gz", // 保持原名以兼容 Config
  STATS: "statsData.json.gz", // 新增 Stats 文件
  META: "meta.json",
};

export async function performSync(force = false) {
  if (isSyncing) {
    console.log("Sync in progress, skipping.");
    return;
  }

  isSyncing = true;
  let syncResultMessages = [];

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

    // 3. 获取 Meta 数据
    let metaData = { update_timestamp: 0, stats_updatetime: 0 };
    try {
      const remoteMeta = await client.getFile(FILES.META);
      if (remoteMeta) {
        // 合并远程 meta 数据
        metaData = { ...metaData, ...remoteMeta };
      }
    } catch (e) {
      console.warn("Could not read meta.json", e);
    }

    // 兼容旧版 meta (没有 stats_updatetime 的情况)
    if (!metaData.stats_updatetime) {
      metaData.stats_updatetime = 0;
    }

    // 4. 准备本地时间戳
    const localConfigTs = localData.update_timestamp || 0;
    const localStatsTs = localData.stats_timestamp || 0;

    console.log(`Sync Check:
      Config: Local=${localConfigTs} vs Remote=${metaData.update_timestamp}
      Stats : Local=${localStatsTs} vs Remote=${metaData.stats_updatetime}`);

    let configChanged = false;
    let statsChanged = false;
    let newDataToSave = null;

    // --- CONFIG 同步逻辑 ---
    if (localConfigTs > metaData.update_timestamp) {
      // PUSH Config
      console.log("Pushing Config...");

      // 构造 Config 对象。
      // 注意：为了保持文件结构的向后兼容性，我们依然写入 statistics 键，但内容为空。
      // 实际的统计数据现在存放在 FILES.STATS 中。
      const configPayload = {
        version: localData.version,
        config: localData.config,
        statistics: { iconStats: {} }, // 占位符
        update_timestamp: localConfigTs,
      };

      await client.putFile(FILES.CONFIG, configPayload);
      metaData.update_timestamp = localConfigTs;
      configChanged = true;
      syncResultMessages.push("本地配置已推送");
    } else if (metaData.update_timestamp > localConfigTs) {
      // PULL Config
      console.log("Pulling Config...");
      const remoteConfig = await client.getFile(FILES.CONFIG);

      if (remoteConfig) {
        if (!newDataToSave) newDataToSave = { ...localData };

        // 仅合并 Config 部分
        newDataToSave.config = remoteConfig.config;
        newDataToSave.version = remoteConfig.version;
        newDataToSave.update_timestamp = remoteConfig.update_timestamp;

        configChanged = true;
        syncResultMessages.push("云端配置已拉取");
      }
    }

    // --- STATS 同步逻辑 ---
    if (localStatsTs > metaData.stats_updatetime) {
      // PUSH Stats
      console.log("Pushing Stats...");

      const statsPayload = {
        statistics: localData.statistics,
        stats_timestamp: localStatsTs,
      };

      await client.putFile(FILES.STATS, statsPayload);
      metaData.stats_updatetime = localStatsTs;
      statsChanged = true;
      // 仅在强制同步时提示统计推送，避免打扰
      if (force) syncResultMessages.push("本地统计已推送");
    } else if (metaData.stats_updatetime > localStatsTs) {
      // PULL Stats
      console.log("Pulling Stats...");
      const remoteStatsObj = await client.getFile(FILES.STATS);

      if (remoteStatsObj && remoteStatsObj.statistics) {
        if (!newDataToSave) newDataToSave = { ...localData };

        // 仅合并 Statistics 部分
        newDataToSave.statistics = remoteStatsObj.statistics;
        newDataToSave.stats_timestamp = remoteStatsObj.stats_timestamp;

        statsChanged = true;
        if (force) syncResultMessages.push("云端统计已拉取");
      }
    }

    // 5. 更新 Meta (如果本地向云端推送了任何数据)
    // 只有当我们是数据的"发送方"（版本更新方）时，才需要更新 meta.json
    // 如果我们只是拉取了数据，meta.json 应该由产生那个数据的客户端去写（或者已经写了）
    if (
      localConfigTs > metaData.update_timestamp ||
      localStatsTs > metaData.stats_updatetime ||
      (configChanged && !newDataToSave) ||
      (statsChanged && !newDataToSave)
    ) {
      // 注意：上面的逻辑中，如果是 Push 操作，metaData 对象已经被更新为最新的时间戳
      await client.putFileJson(FILES.META, metaData);
    }
    // 修正逻辑：只要 metaData 在内存中被更新了（意味着我们执行了 Push），就应该写入
    // 但为了保险，我们只在确实执行了 putFile 后写入。上面的 if 条件稍显复杂，简化如下：
    // 只要执行了 Push Config 或 Push Stats，我们就要更新 Meta。
    if (configChanged && localConfigTs === metaData.update_timestamp) {
      /* Push happened */
    }
    // 采用更直接的判断：
    const pushedConfig =
      localConfigTs > 0 && localConfigTs === metaData.update_timestamp && configChanged;
    const pushedStats =
      localStatsTs > 0 && localStatsTs === metaData.stats_updatetime && statsChanged;

    if (pushedConfig || pushedStats) {
      await client.putFileJson(FILES.META, metaData);
    }

    // 6. 保存到本地 Storage (如果从云端拉取了数据)
    if (newDataToSave) {
      // 确保时间戳也是最新的（虽然上面赋值了，再确认一次）
      await chrome.storage.local.set({ smartNavData: newDataToSave });

      if (configChanged) {
        // Config 变更极大可能影响界面（Tabs/Icons），需要刷新
        notifyFrontend("refresh", "云端配置已同步，页面即将刷新。");
      } else if (statsChanged) {
        // Stats 变更不需要刷新全页，如果强制同步则提示，否则静默
        if (force) notifyFrontend("toast", "统计数据已更新。");
      }
    }

    // 7. 结束状态更新
    let statusMsg = "同步成功";
    if (syncResultMessages.length > 0) {
      statusMsg = syncResultMessages.join(", ");
    } else {
      statusMsg = "数据已是最新";
    }

    // 即使没有数据传输，也算作一次成功的“检查”
    await updateSyncStatus(sync_settings, { syncTime: Date.now(), status: "success" });

    if (force) {
      notifyFrontend("toast", statusMsg);
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
