import * as DOM from "./dom.js";
import { state, saveData } from "./state.js";
import { render } from "./ui.js";
import { fetchFavicon } from "./utils.js";
import { SEARCH_ENGINES, DEFAULT_FAVICON } from "./constants.js";

// --- Search Logic ---
export const performSearch = () => {
  const query = DOM.searchInput.value.trim();
  if (query) {
    const searchUrl = SEARCH_ENGINES[state.currentSearchEngine] + encodeURIComponent(query);
    chrome.tabs.create({ url: searchUrl });
  }
};

export const selectSearchEngine = (engine) => {
  state.currentSearchEngine = engine;
  if (engine === "google") {
    DOM.googleSearchBtn.classList.add("active");
    DOM.bingSearchBtn.classList.remove("active");
  } else {
    DOM.bingSearchBtn.classList.add("active");
    DOM.googleSearchBtn.classList.remove("active");
  }
};

// --- Icon CRUD ---
export const showAddIconModal = () => {
  DOM.iconForm.reset();
  DOM.iconIdInput.value = "";
  DOM.iconModalLabel.textContent = "添加新网站";
  DOM.deleteIconBtn.classList.add("d-none");
  DOM.faviconPreview.classList.add("d-none");
  DOM.faviconSpinner.classList.add("d-none");
  DOM.iconModal.show();
};

export const showEditIconModal = (iconId, tabId) => {
  const tab = state.appData.config.tabs.find((t) => t.id === tabId);
  const icon = tab.icons.find((i) => i.id === iconId);
  if (icon) {
    DOM.iconForm.reset();
    DOM.iconModalLabel.textContent = "编辑网站";
    DOM.iconIdInput.value = icon.id;
    DOM.urlInput.value = icon.url;
    DOM.nameInput.value = icon.name;
    DOM.descriptionInput.value = icon.description;
    DOM.faviconPreview.src = icon.faviconCache || DEFAULT_FAVICON;
    DOM.faviconPreview.classList.remove("d-none");
    DOM.faviconSpinner.classList.add("d-none");
    DOM.deleteIconBtn.classList.remove("d-none");
    DOM.iconModal.show();
  }
};

export const handleIconFormSubmit = async (e) => {
  e.preventDefault();
  if (state.faviconAbortController) {
    state.faviconAbortController.abort();
  }
  const id = DOM.iconIdInput.value;
  const url = DOM.urlInput.value;
  const name = DOM.nameInput.value;
  const description = DOM.descriptionInput.value;
  const tab = state.appData.config.tabs.find((t) => t.id === state.activeTabId);
  let faviconCache = DOM.faviconPreview.src;
  if (DOM.faviconPreview.classList.contains("d-none") || DOM.faviconPreview.src.endsWith("/")) {
    faviconCache = DEFAULT_FAVICON;
  }
  if (id) {
    const icon = tab.icons.find((i) => i.id === id);
    icon.url = url;
    icon.name = name;
    icon.description = description;
    icon.faviconCache = faviconCache;
  } else {
    tab.icons.push({
      id: `icon-${Date.now()}`,
      url,
      name,
      description,
      faviconCache,
      order: tab.icons.length,
    });
  }
  await saveData();
  render();
  DOM.iconModal.hide();
};

export const handleDeleteIcon = async () => {
  const id = DOM.iconIdInput.value;
  if (confirm("此操作不可恢复，是否确认删除？")) {
    const tab = state.appData.config.tabs.find((t) => t.id === state.activeTabId);
    tab.icons = tab.icons.filter((i) => i.id !== id);
    delete state.appData.statistics.iconStats[id];
    await saveData();
    render();
    DOM.iconModal.hide();
  }
};

// --- Tab Management ---
export const renderTabManagementList = () => {
  const list = DOM.tabManagementList;
  list.innerHTML = "";
  state.appData.config.tabs.forEach((tab) => {
    const item = document.createElement("li");
    item.className =
      "list-group-item d-flex justify-content-between align-items-center tab-management-item";
    item.innerHTML = `
              <input type="text" class="form-control" value="${tab.name}" data-tab-id="${tab.id}">
              <button class="btn btn-sm btn-outline-danger" data-tab-id="${tab.id}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
              </button>
          `;
    item.querySelector("input").addEventListener("change", async (e) => {
      const tabId = e.target.dataset.tabId;
      const newName = e.target.value.trim();
      if (newName) {
        const targetTab = state.appData.config.tabs.find((t) => t.id === tabId);
        targetTab.name = newName;
        await saveData();
        render();
      }
    });
    item.querySelector("button").addEventListener("click", async (e) => {
      if (state.appData.config.tabs.length <= 1) {
        alert("必须至少保留一个标签页。");
        return;
      }
      const tabId = e.currentTarget.dataset.tabId;
      const tabToDelete = state.appData.config.tabs.find((t) => t.id === tabId);
      if (confirm(`确定要删除标签页 "${tabToDelete.name}" 吗？此标签页下的所有网站也将被删除。`)) {
        if (tabToDelete) {
          tabToDelete.icons.forEach((icon) => {
            delete state.appData.statistics.iconStats[icon.id];
          });
        }
        state.appData.config.tabs = state.appData.config.tabs.filter((t) => t.id !== tabId);
        if (state.activeTabId === tabId) {
          state.activeTabId = state.appData.config.tabs[0].id;
        }
        await saveData();
        render();
        renderTabManagementList();
      }
    });
    list.appendChild(item);
  });
};

export const handleAddTab = async () => {
  const name = DOM.newTabNameInput.value.trim();
  if (name) {
    state.appData.config.tabs.push({
      id: `tab-${Date.now()}`,
      name: name,
      order: state.appData.config.tabs.length,
      icons: [],
    });
    DOM.newTabNameInput.value = "";
    await saveData();
    renderTabManagementList();
    render();
  }
};

// --- Statistics ---
export const recordClick = async (iconId) => {
  const stats = state.appData.statistics.iconStats;
  if (!stats[iconId]) {
    stats[iconId] = {
      totalClicks: 0,
      timestamps: [],
    };
  }
  stats[iconId].totalClicks++;
  stats[iconId].timestamps.push(Date.now());
  await saveData();
};

const renderStatsList = (listElement, data) => {
  listElement.innerHTML = "";
  if (data.length === 0) {
    listElement.innerHTML = '<li class="list-group-item">暂无数据</li>';
    return;
  }
  data.forEach((item, index) => {
    const li = document.createElement("li");
    li.className =
      "list-group-item d-flex justify-content-between align-items-center stats-list-item";
    li.innerHTML = `
              <div>
                  <span class="me-2">${index + 1}.</span>
                  <img src="${item.faviconCache || DEFAULT_FAVICON}" alt="${item.name}">
                  <span>${item.name}</span>
              </div>
              <span class="badge bg-primary rounded-pill">${item.count}</span>
          `;
    listElement.appendChild(li);
  });
};

export const generateReport = () => {
  const iconStats = state.appData.statistics.iconStats;
  const allIcons = state.appData.config.tabs.flatMap((t) => t.icons);

  const getTop10 = (targetIconIds = null) => {
    let statsArray = Object.entries(iconStats);

    if (targetIconIds) {
      statsArray = statsArray.filter(([iconId, _]) => targetIconIds.includes(iconId));
    }

    return statsArray
      .map(([iconId, stats]) => {
        const icon = allIcons.find((i) => i.id === iconId);
        return icon ? { ...icon, count: stats.totalClicks } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  // Global Top 10
  const globalTop10 = getTop10();
  renderStatsList(DOM.globalStatsList, globalTop10);

  // Per-tab Top 10
  DOM.statsTabSelect.innerHTML = "";
  state.appData.config.tabs.forEach((tab) => {
    DOM.statsTabSelect.innerHTML += `<option value="${tab.id}">${tab.name}</option>`;
  });

  const updateTabStats = () => {
    const selectedTabId = DOM.statsTabSelect.value;
    const tab = state.appData.config.tabs.find((t) => t.id === selectedTabId);
    if (tab) {
      const tabIconIds = tab.icons.map((i) => i.id);
      const tabTop10 = getTop10(tabIconIds);
      renderStatsList(DOM.tabStatsList, tabTop10);
    }
  };

  DOM.statsTabSelect.removeEventListener("change", updateTabStats); // Avoid duplicate listeners
  DOM.statsTabSelect.addEventListener("change", updateTabStats);
  updateTabStats();
};

// --- Import / Export ---
export const exportData = () => {
  const dataStr = JSON.stringify(state.appData, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `smart-nav-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importData = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm("导入将覆盖所有现有数据，此操作不可逆，请确认。")) {
    DOM.importFileInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      // Basic validation for the new structure
      if (
        importedData.version &&
        importedData.config &&
        importedData.statistics &&
        typeof importedData.statistics.iconStats === "object"
      ) {
        state.appData = importedData;
        await saveData();
        alert("导入成功！页面将刷新。");
        location.reload();
      } else {
        throw new Error("Invalid or outdated file format.");
      }
    } catch (error) {
      alert(`导入失败：${error.message}`);
      console.error(error);
    } finally {
      DOM.importFileInput.value = "";
    }
  };
  reader.readAsText(file);
};

export const handleWeTabImport = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm("从 WeTab 导入将覆盖所有现有数据，此操作不可逆，请确认。")) {
    DOM.importWeTabFileInput.value = ""; // 重置文件输入框
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wetabData = JSON.parse(e.target.result);

      // 验证 WeTab 数据结构
      if (
        !wetabData.data ||
        !wetabData.data["store-icon"] ||
        !Array.isArray(wetabData.data["store-icon"].icons)
      ) {
        throw new Error('无效的 WeTab 文件格式。未找到 "store-icon" 数据。');
      }

      // 准备一个全新的、空的数据结构
      const newSmartNavData = {
        version: "1.0",
        config: { tabs: [] },
        statistics: { iconStats: {} },
      };

      const wetabCategories = wetabData.data["store-icon"].icons;

      // 辅助函数，用于递归处理图标和文件夹
      const processWetabItem = (item, targetIconsArray, targetStatsObject) => {
        // 如果是文件夹，则递归处理其子项
        if (item.type === "folder-icon" && Array.isArray(item.children)) {
          item.children.forEach((child) =>
            processWetabItem(child, targetIconsArray, targetStatsObject)
          );
        }
        // 如果是网站图标，则进行转换
        else if (item.type === "site" && item.target) {
          const newIconId = `icon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          targetIconsArray.push({
            id: newIconId,
            name: item.name || "未命名",
            url: item.target,
            description: "", // WeTab 没有简介字段
            faviconCache: item.bgImage || DEFAULT_FAVICON, // 直接使用 WeTab 的图标 URL 或默认图标
            order: targetIconsArray.length,
          });

          // 导入统计数据
          if (item.total > 0) {
            targetStatsObject[newIconId] = {
              totalClicks: item.total,
              // WeTab 只记录最后一次点击时间，我们将其作为唯一的时间戳
              timestamps: item.lasttime > 0 ? [item.lasttime] : [],
            };
          }
        }
      };

      // 遍历 WeTab 的分类（即我们的标签页）
      wetabCategories.forEach((category, index) => {
        const newTab = {
          id: `tab-${Date.now()}-${index}`,
          name: category.name || `导入标签页 ${index + 1}`,
          order: index,
          icons: [],
        };

        if (Array.isArray(category.children)) {
          category.children.forEach((item) => {
            processWetabItem(item, newTab.icons, newSmartNavData.statistics.iconStats);
          });
        }

        newSmartNavData.config.tabs.push(newTab);
      });

      // 转换完成，保存数据并刷新
      state.appData = newSmartNavData;
      await saveData();
      alert("从 WeTab 导入成功！页面将刷新。");
      location.reload();
    } catch (error) {
      alert(`导入失败：${error.message}`);
      console.error("WeTab import error:", error);
    } finally {
      DOM.importWeTabFileInput.value = ""; // 无论成功失败，都重置文件输入框
    }
  };
  reader.readAsText(file);
};