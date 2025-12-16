import { WebDAVClient } from "./WebDAVClient.js";

// 防止并发同步的简单锁
let isSyncing = false;

/**
 * 执行同步的主要逻辑
 * @param {boolean} force - 是否强制同步（即使用户未启用自动同步，用于"立即同步"按钮）
 */
export async function performSync(force = false) {
  if (isSyncing) {
    console.log("WebVideoNote: 同步正在进行中，跳过本次请求");
    return;
  }

  isSyncing = true;
  const dataFileName = "data.json.gz";
  const metaFileName = "meta.json";

  try {
    // 1. 获取配置
    const { sync_settings, data: localData } = await chrome.storage.local.get([
      "sync_settings",
      "data",
    ]);

    // 检查开关 (强制同步模式下跳过此检查)
    if (!force && (!sync_settings || !sync_settings.enabled)) {
      isSyncing = false;
      return;
    }

    // 完整性校验
    if (!sync_settings) {
      throw new Error("未找到同步配置");
    }
    if (!sync_settings.server_url?.trim()) {
      throw new Error("服务器地址不能为空");
    }
    if (!sync_settings.username?.trim()) {
      throw new Error("用户名不能为空");
    }
    if (!sync_settings.password) {
      throw new Error("密码不能为空");
    }

    const client = new WebDAVClient(
      sync_settings.server_url,
      sync_settings.username,
      sync_settings.password
    );

    // 2. 获取本地时间戳 (T_local)
    const localTs = localData && localData.update_timestamp ? localData.update_timestamp : 0;

    // 3. 获取远程时间戳 (T_remote) - 优先检查 meta.json
    let remoteTs = 0;
    let metaData = null;

    try {
      metaData = await client.getFile(metaFileName);
    } catch (e) {
      console.warn("WebDAV: meta.json 读取失败，尝试读取完整数据以确认版本", e);
    }

    if (metaData && metaData.update_timestamp) {
      remoteTs = metaData.update_timestamp;
    } else {
      // 如果 meta 不存在，兜底检查 data.json.gz (兼容旧版本或首次运行)
      const remoteDataFile = await client.getFile(dataFileName);
      if (remoteDataFile && remoteDataFile.update_timestamp) {
        remoteTs = remoteDataFile.update_timestamp;
      }
    }

    console.log(`WebVideoNote Sync: Local TS=${localTs}, Remote TS=${remoteTs}`);

    // 4. 比较决策
    if (remoteTs === 0 && localTs > 0) {
      // 情况 A: 远程不存在 (或为空) -> 上传 (Push)
      console.log("WebVideoNote Sync: 初始化远程文件");
      await client.putFile(dataFileName, localData);
      await client.putFileJson(metaFileName, { update_timestamp: localTs });
    } else if (localTs > remoteTs) {
      // 情况 B: 本地较新 -> 上传 (Push)
      console.log("WebVideoNote Sync: 本地较新，覆盖远程");
      await client.putFile(dataFileName, localData);
      await client.putFileJson(metaFileName, { update_timestamp: localTs });
    } else if (localTs < remoteTs) {
      // 情况 C: 远程较新 -> 下载应用 (Pull)
      console.log("WebVideoNote Sync: 远程较新，覆盖本地");

      // 必须下载完整数据文件
      const remoteData = await client.getFile(dataFileName);
      if (!remoteData) {
        throw new Error("检测到新版本但无法下载数据文件");
      }

      // 4.1 备份本地数据
      if (localData) {
        await chrome.storage.local.set({ data_backup_pre_sync: localData });
      }

      // 4.2 写入新数据
      await chrome.storage.local.set({ data: remoteData });

      // 4.3 计算统计信息
      const oldNotesCount = countTotalNotes(localData);
      const newNotesCount = countTotalNotes(remoteData);

      // 4.4 通知前端页面刷新
      notifyTabs(oldNotesCount, newNotesCount);
    } else {
      console.log("WebVideoNote Sync: 数据已是最新，跳过");
    }

    // 5. 更新同步状态
    const now = new Date().toISOString();
    await updateSyncStatus(sync_settings, now, "success");
  } catch (error) {
    console.error("WebVideoNote Sync Error:", error);
    // 更新错误状态
    const { sync_settings } = await chrome.storage.local.get(["sync_settings"]);
    if (sync_settings) {
      await updateSyncStatus(sync_settings, new Date().toISOString(), `error: ${error.message}`);
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * 辅助：更新 storage 中的 sync_settings 状态
 */
async function updateSyncStatus(currentSettings, time, status) {
  const newSettings = {
    ...currentSettings,
    last_sync_time: time,
    last_sync_status: status,
  };
  await chrome.storage.local.set({ sync_settings: newSettings });
}

/**
 * 辅助：统计笔记总数
 */
function countTotalNotes(dataObj) {
  if (!dataObj) return 0;
  let count = 0;
  // 遍历 Adapter Keys (e.g., "Bilibili Adapter")
  for (const key in dataObj) {
    if (key !== "update_timestamp" && typeof dataObj[key] === "object") {
      count += Object.keys(dataObj[key]).length;
    }
  }
  return count;
}

/**
 * 辅助：通知所有 Tab 刷新
 */
function notifyTabs(oldCount, newCount) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      // 过滤掉 chrome:// 协议的页面，防止报错
      if (tab.url && tab.url.startsWith("http")) {
        chrome.tabs
          .sendMessage(tab.id, {
            action: "sync_completed_refresh",
            message: `同步完成！本地笔记已更新。(${oldCount} -> ${newCount})`,
          })
          .catch(() => {
            // 忽略无法接收消息的标签页（可能是未注入 content script 的页面）
          });
      }
    });
  });
}
