import { WebDAVClient } from "./WebDAVClient.js";

let isSyncing = false;

export async function performSync(force = false) {
  if (isSyncing) {
    console.log("Sync in progress, skipping.");
    return;
  }

  isSyncing = true;
  const dataFileName = "smartNavData.json.gz"; // Adapted filename
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
      throw new Error("Missing WebDAV configuration.");
    }

    const client = new WebDAVClient(
      sync_settings.server_url,
      sync_settings.username,
      sync_settings.password
    );

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
      const remoteDataFile = await client.getFile(dataFileName);
      if (remoteDataFile && remoteDataFile.update_timestamp) {
        remoteTs = remoteDataFile.update_timestamp;
      }
    }

    console.log(`Sync Check: Local TS=${localTs}, Remote TS=${remoteTs}`);

    if (remoteTs === 0 && localTs > 0) {
      // Push local to remote
      console.log("Pushing initial data to server...");
      await client.putFile(dataFileName, localData);
      await client.putFileJson(metaFileName, { update_timestamp: localTs });
    } else if (localTs > remoteTs) {
      // Push local to remote
      console.log("Local is newer. Pushing to server...");
      await client.putFile(dataFileName, localData);
      await client.putFileJson(metaFileName, { update_timestamp: localTs });
    } else if (localTs < remoteTs) {
      // Pull remote to local
      console.log("Remote is newer. Pulling from server...");
      const remoteData = await client.getFile(dataFileName);
      if (!remoteData) throw new Error("Failed to download remote data.");

      await chrome.storage.local.set({ smartNavData: remoteData });

      // Notify UI
      notifyTabs("Data updated from cloud.");
    } else {
      console.log("Data is up to date.");
    }

    await updateSyncStatus(sync_settings, new Date().toISOString(), "success");
  } catch (error) {
    console.error("Sync Error:", error);
    const { sync_settings } = await chrome.storage.local.get(["sync_settings"]);
    if (sync_settings) {
      await updateSyncStatus(sync_settings, new Date().toISOString(), `error: ${error.message}`);
    }
    throw error; // Re-throw for UI handling
  } finally {
    isSyncing = false;
  }
}

async function updateSyncStatus(currentSettings, time, status) {
  const newSettings = {
    ...currentSettings,
    last_sync_time: time,
    last_sync_status: status,
  };
  await chrome.storage.local.set({ sync_settings: newSettings });
}

function notifyTabs(msg) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if ((tab.url && tab.url.startsWith("http")) || tab.url.startsWith("chrome-extension")) {
        chrome.tabs
          .sendMessage(tab.id, {
            action: "sync_completed_refresh",
            message: msg,
          })
          .catch(() => {});
      }
    });
  });
}
