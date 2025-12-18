import * as DOM from "./dom.js";
import { state, saveData, saveSearchEnginePreference } from "./state.js";
import { render, getFaviconUrl } from "./ui.js";
import { fetchFavicon, normalizeUrl } from "./utils.js";
import { SEARCH_ENGINES, DEFAULT_FAVICON, BORDER_COLORS } from "./constants.js";

// --- UI Initialization ---
export const initializeModalUIs = () => {
  const container = DOM.borderColorSelector;
  if (container.children.length === 0) {
    BORDER_COLORS.forEach((color) => {
      const option = document.createElement("div");
      option.className = "color-option";
      option.dataset.color = color;
      if (color !== "transparent") {
        option.style.backgroundColor = color;
      }
      container.appendChild(option);
    });

    container.addEventListener("click", (e) => {
      const target = e.target;
      if (target.classList.contains("color-option")) {
        container.querySelector(".selected")?.classList.remove("selected");
        target.classList.add("selected");
        const selectedColor = target.dataset.color;
        if (selectedColor !== "transparent") {
          DOM.faviconPreview.style.border = `3px solid ${selectedColor}`;
          DOM.faviconPreview.style.borderRadius = "8px";
          DOM.faviconPreview.style.padding = "2px";
          DOM.faviconPreview.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
        } else {
          DOM.faviconPreview.style.border = "none";
          DOM.faviconPreview.style.borderRadius = "";
          DOM.faviconPreview.style.padding = "";
          DOM.faviconPreview.style.backgroundColor = "";
        }
      }
    });
  }
};

// --- Search Logic ---
export const performSearch = () => {
  const query = DOM.searchInput.value.trim();
  if (query) {
    const searchUrl = SEARCH_ENGINES[state.currentSearchEngine] + encodeURIComponent(query);
    window.open(searchUrl, "_blank");
  }
};

export const updateSearchEngineUI = (engine) => {
  DOM.googleSearchBtn.classList.toggle("active", engine === "google");
  DOM.bingSearchBtn.classList.toggle("active", engine === "bing");
  DOM.sogouSearchBtn.classList.toggle("active", engine === "sogou");
};

export const selectSearchEngine = (engine) => {
  state.currentSearchEngine = engine;
  updateSearchEngineUI(engine);
  saveSearchEnginePreference();
};

// --- Icon CRUD ---
export const showAddIconModal = () => {
  DOM.iconForm.reset();
  DOM.iconIdInput.value = "";
  DOM.iconModalLabel.textContent = "添加新网站";
  DOM.deleteIconBtn.classList.add("d-none");
  DOM.moveIconContainer.classList.add("d-none");
  DOM.faviconPreview.classList.add("d-none");
  DOM.faviconSpinner.classList.add("d-none");

  DOM.borderColorSelector.querySelector(".selected")?.classList.remove("selected");
  DOM.borderColorSelector.querySelector('[data-color="transparent"]').classList.add("selected");
  DOM.faviconPreview.style.border = "none";
  DOM.faviconPreview.style.borderRadius = "";
  DOM.faviconPreview.style.padding = "";
  DOM.faviconPreview.style.backgroundColor = "";

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
    DOM.faviconPreview.src = getFaviconUrl(icon.faviconCache);
    DOM.faviconPreview.classList.remove("d-none");
    DOM.faviconSpinner.classList.add("d-none");
    DOM.deleteIconBtn.classList.remove("d-none");
    DOM.moveIconContainer.classList.remove("d-none");
    DOM.moveIconBtn.dataset.iconId = iconId;
    DOM.moveIconBtn.dataset.sourceTabId = tabId;

    const color = icon.borderColor || "transparent";
    DOM.borderColorSelector.querySelector(".selected")?.classList.remove("selected");
    DOM.borderColorSelector.querySelector(`[data-color="${color}"]`).classList.add("selected");
    if (color !== "transparent") {
      DOM.faviconPreview.style.border = `3px solid ${color}`;
      DOM.faviconPreview.style.borderRadius = "8px";
      DOM.faviconPreview.style.padding = "2px";
      DOM.faviconPreview.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    } else {
      DOM.faviconPreview.style.border = "none";
      DOM.faviconPreview.style.borderRadius = "";
      DOM.faviconPreview.style.padding = "";
      DOM.faviconPreview.style.backgroundColor = "";
    }

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

  let faviconCache;
  if (DOM.faviconPreview.classList.contains("d-none") || !DOM.faviconPreview.src) {
    faviconCache = DEFAULT_FAVICON;
  } else if (DOM.faviconPreview.src.endsWith("icons/icon48.png")) {
    faviconCache = DEFAULT_FAVICON;
  } else {
    faviconCache = DOM.faviconPreview.src;
  }

  const selectedColorEl = DOM.borderColorSelector.querySelector(".selected");
  const borderColor = selectedColorEl ? selectedColorEl.dataset.color : "transparent";

  if (id) {
    const icon = tab.icons.find((i) => i.id === id);
    icon.url = url;
    icon.name = name;
    icon.description = description;
    icon.faviconCache = faviconCache;
    icon.borderColor = borderColor;
  } else {
    tab.icons.push({
      id: `icon-${Date.now()}`,
      url,
      name,
      description,
      faviconCache,
      borderColor,
      order: tab.icons.length,
    });
  }

  // 标识为 'config' 变更
  await saveData("config");
  render();
  DOM.iconModal.hide();
};

export const handleDeleteIcon = async () => {
  const id = DOM.iconIdInput.value;
  if (confirm("此操作不可恢复，是否确认删除？")) {
    const tab = state.appData.config.tabs.find((t) => t.id === state.activeTabId);
    tab.icons = tab.icons.filter((i) => i.id !== id);
    delete state.appData.statistics.iconStats[id];

    // 标识为 'config' 变更
    await saveData("config");
    render();
    DOM.iconModal.hide();
  }
};

export const moveIconToTab = async (iconId, sourceTabId, targetTabId) => {
  const sourceTab = state.appData.config.tabs.find((t) => t.id === sourceTabId);
  const targetTab = state.appData.config.tabs.find((t) => t.id === targetTabId);

  if (!sourceTab || !targetTab || sourceTabId === targetTabId) {
    console.error("Invalid move operation:", { sourceTabId, targetTabId });
    return;
  }

  const iconIndex = sourceTab.icons.findIndex((i) => i.id === iconId);
  if (iconIndex > -1) {
    const [movedIcon] = sourceTab.icons.splice(iconIndex, 1);

    movedIcon.order = targetTab.icons.length;
    targetTab.icons.push(movedIcon);

    sourceTab.icons.forEach((icon, index) => {
      icon.order = index;
    });

    // 标识为 'config' 变更
    await saveData("config");
    render();
    DOM.iconModal.hide();
  } else {
    console.error("Icon to move not found in source tab.");
  }
};

// --- Tab Management ---
let tabManagementSortable = null;

export const renderTabManagementList = () => {
  if (tabManagementSortable) {
    tabManagementSortable.destroy();
  }

  const list = DOM.tabManagementList;
  list.innerHTML = "";
  state.appData.config.tabs.sort((a, b) => a.order - b.order);

  state.appData.config.tabs.forEach((tab) => {
    const item = document.createElement("li");
    item.className =
      "list-group-item d-flex justify-content-between align-items-center tab-management-item";
    item.innerHTML = `<div class="d-flex align-items-center flex-grow-1"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-grip-vertical me-2" viewBox="0 0 16 16" style="cursor: grab;"><path d="M7 2a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7 5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 
0zM7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-3 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"/></svg> <input type="text" class="form-control" value="${tab.name}" data-tab-id="${tab.id}"> </div> <button class="btn btn-sm btn-outline-danger ms-2" data-tab-id="${tab.id}"> <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 
16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg> </button>`;

    item.querySelector("input").addEventListener("change", async (e) => {
      const tabId = e.target.dataset.tabId;
      const newName = e.target.value.trim();
      if (newName) {
        const targetTab = state.appData.config.tabs.find((t) => t.id === tabId);
        targetTab.name = newName;
        // 标识为 'config' 变更
        await saveData("config");
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
        // 标识为 'config' 变更
        await saveData("config");
        render();
        renderTabManagementList();
      }
    });
    list.appendChild(item);
  });

  tabManagementSortable = new Sortable(list, {
    animation: 150,
    ghostClass: "sortable-ghost",
    handle: ".bi-grip-vertical",
    onEnd: async (evt) => {
      const movedItem = state.appData.config.tabs.splice(evt.oldIndex, 1)[0];
      state.appData.config.tabs.splice(evt.newIndex, 0, movedItem);

      state.appData.config.tabs.forEach((tab, index) => {
        tab.order = index;
      });

      // 标识为 'config' 变更
      await saveData("config");
      render();
    },
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
    // 标识为 'config' 变更
    await saveData("config");
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

  // 关键修改：标识为 'stats' 变更，不会触发自动同步
  await saveData("stats");
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
    li.innerHTML = `<div> <span class="me-2">${index + 1}.</span> <img src="${getFaviconUrl(
      item.faviconCache
    )}" alt="${item.name}"> <span>${
      item.name
    }</span> </div> <span class="badge bg-primary rounded-pill">${item.count}</span>`;
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

  const globalTop10 = getTop10();
  renderStatsList(DOM.globalStatsList, globalTop10);

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

  DOM.statsTabSelect.removeEventListener("change", updateTabStats);
  DOM.statsTabSelect.addEventListener("change", updateTabStats);
  updateTabStats();
};

// --- Website Search ---

export const showWebsiteSearchModal = () => {
  DOM.websiteSearchInput.value = "";
  DOM.websiteSearchResults.innerHTML =
    '<li class="list-group-item text-muted website-search-placeholder">请输入关键词进行搜索...</li>';
  DOM.websiteSearchModal.show();
  DOM.websiteSearchModalEl.addEventListener(
    "shown.bs.modal",
    () => {
      DOM.websiteSearchInput.focus();
    },
    { once: true }
  );
};

export const performWebsiteSearch = () => {
  const PinyinMatch = window.PinyinMatch;
  const query = DOM.websiteSearchInput.value.trim(); // Do not use toLowerCase() here, let PinyinMatch handle it
  const resultsList = DOM.websiteSearchResults;
  resultsList.innerHTML = "";

  if (!query) {
    resultsList.innerHTML =
      '<li class="list-group-item text-muted website-search-placeholder">请输入关键词进行搜索...</li>';
    return;
  }

  const allIcons = state.appData.config.tabs.flatMap((t) => t.icons);

  const filteredIcons = allIcons.filter((icon) => {
    // 1. Standard string matching (Name, URL, Description)
    const basicMatch =
      icon.name.toLowerCase().includes(query.toLowerCase()) ||
      icon.url.toLowerCase().includes(query.toLowerCase()) ||
      (icon.description && icon.description.toLowerCase().includes(query.toLowerCase()));

    // 2. Pinyin matching on Name
    const pinyinMatch = PinyinMatch.match(icon.name, query);

    return basicMatch || pinyinMatch;
  });

  if (filteredIcons.length === 0) {
    resultsList.innerHTML =
      '<li class="list-group-item text-muted website-search-placeholder">未找到匹配的网站</li>';
    return;
  }

  filteredIcons.forEach((icon) => {
    const item = document.createElement("a");
    item.href = icon.url;
    item.target = "_blank";
    item.className =
      "list-group-item list-group-item-action d-flex align-items-center website-search-item";

    const safeName = document.createElement("div");
    safeName.textContent = icon.name;

    item.innerHTML = `
      <img src="${getFaviconUrl(icon.faviconCache)}" alt="${safeName.innerHTML} favicon">
      <div class="ms-2 flex-grow-1" style="min-width: 0;">
          <strong>${safeName.innerHTML}</strong>
          <div class="website-url text-truncate">${icon.url}</div>
      </div>
    `;
    item.addEventListener("click", (e) => {
      recordClick(icon.id);
      DOM.websiteSearchModal.hide();
    });

    item.addEventListener("auxclick", (e) => {
      if (e.button === 1) {
        recordClick(icon.id);
      }
    });

    resultsList.appendChild(item);
  });
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

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const importedData = JSON.parse(e.target.result);
      if (
        !importedData.version ||
        !importedData.config ||
        !importedData.statistics ||
        typeof importedData.statistics.iconStats !== "object"
      ) {
        throw new Error("无效或过时的文件格式。");
      }

      state.importedData = importedData;

      const newItems = [];
      const localUrls = new Set(
        state.appData.config.tabs.flatMap((t) => t.icons).map((i) => normalizeUrl(i.url))
      );

      importedData.config.tabs.forEach((importedTab) => {
        const localTab = state.appData.config.tabs.find((t) => t.name === importedTab.name);
        if (localTab) {
          importedTab.icons.forEach((importedIcon) => {
            if (!localUrls.has(normalizeUrl(importedIcon.url))) {
              newItems.push(
                `<li>[${localTab.name}] -> ${importedIcon.name} (${importedIcon.url})</li>`
              );
            }
          });
        } else {
          newItems.push(
            `<li>新标签页: [${importedTab.name}] (包含 ${importedTab.icons.length} 个网站)</li>`
          );
        }
      });

      const modalBody = DOM.importMergeModalEl.querySelector(".modal-body");
      const pElement = modalBody.querySelector("p");
      const h6Element = modalBody.querySelector("h6");

      if (newItems.length > 0) {
        pElement.textContent = "检测到导入的文件中有新的网站，请选择导入方式：";
        h6Element.style.display = "";
        DOM.importMergeList.innerHTML = newItems.join("");
        DOM.importMergeModal.show();
      } else {
        pElement.textContent = "导入的数据与现有配置没有差异。";
        h6Element.style.display = "none";
        DOM.importMergeList.innerHTML = "";
        DOM.importMergeModal.show();
      }
    } catch (error) {
      alert(`导入失败：${error.message}`);
      console.error(error);
      state.importedData = null;
    } finally {
      DOM.importFileInput.value = "";
    }
  };
  reader.readAsText(file);
};

export const handleMergeImport = async () => {
  if (!state.importedData) return;

  const importedData = state.importedData;
  const localData = state.appData;
  let changesMade = false;

  const localUrls = new Set(
    localData.config.tabs.flatMap((t) => t.icons).map((i) => normalizeUrl(i.url))
  );

  importedData.config.tabs.forEach((importedTab) => {
    let localTab = localData.config.tabs.find((t) => t.name === importedTab.name);

    if (!localTab) {
      localTab = {
        id: `tab-${Date.now()}-${Math.random()}`,
        name: importedTab.name,
        order: localData.config.tabs.length,
        icons: [],
      };
      localData.config.tabs.push(localTab);
      changesMade = true;
    }

    importedTab.icons.forEach((importedIcon) => {
      if (!localUrls.has(normalizeUrl(importedIcon.url))) {
        const newIcon = {
          ...importedIcon,
          id: `icon-${Date.now()}-${Math.random()}`,
          order: localTab.icons.length,
        };
        localTab.icons.push(newIcon);
        localUrls.add(newIcon.url);
        changesMade = true;
      }
    });
  });

  if (changesMade) {
    // 标识为 'config' 变更
    await saveData("config");
    alert("合并成功！页面将刷新。");
    location.reload();
  } else {
    alert("没有需要合并的新项目。");
  }

  state.importedData = null;
  DOM.importMergeModal.hide();
};

export const handleOverwriteImport = async () => {
  if (!state.importedData) return;
  // Update state
  state.appData = state.importedData;

  // CRITICAL: Force update the timestamp to now so Sync sees this as a new change
  state.appData.update_timestamp = Date.now();
  state.appData.stats_timestamp = Date.now(); // 同时也重置统计时间戳

  // 标识为 'config' 变更
  await saveData("config");
  alert("覆盖成功！页面将刷新。");
  state.importedData = null;
  DOM.importMergeModal.hide();
  location.reload();
};

export const handleCancelImport = () => {
  state.importedData = null;
  DOM.importMergeModal.hide();
};

export const handleWeTabImport = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  if (!confirm("从 WeTab 导入将覆盖所有现有数据，此操作不可逆，请确认。")) {
    DOM.importWeTabFileInput.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const wetabData = JSON.parse(e.target.result);

      if (
        !wetabData.data ||
        !wetabData.data["store-icon"] ||
        !Array.isArray(wetabData.data["store-icon"].icons)
      ) {
        throw new Error('无效的 WeTab 文件格式。未找到 "store-icon" 数据。');
      }

      const newSmartNavData = {
        version: "1.0",
        config: { tabs: [] },
        statistics: { iconStats: {} },
      };

      const wetabCategories = wetabData.data["store-icon"].icons;

      const processWetabItem = (item, targetIconsArray, targetStatsObject) => {
        if (item.type === "folder-icon" && Array.isArray(item.children)) {
          item.children.forEach((child) =>
            processWetabItem(child, targetIconsArray, targetStatsObject)
          );
        } else if (item.type === "site" && item.target) {
          const newIconId = `icon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

          targetIconsArray.push({
            id: newIconId,
            name: item.name || "未命名",
            url: item.target,
            description: "",
            faviconCache: item.bgImage || DEFAULT_FAVICON,
            borderColor: "transparent",
            order: targetIconsArray.length,
          });

          if (item.total > 0) {
            targetStatsObject[newIconId] = {
              totalClicks: item.total,
              timestamps: item.lasttime > 0 ? [item.lasttime] : [],
            };
          }
        }
      };

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

      state.appData = newSmartNavData;
      // 初始化新的时间戳
      state.appData.update_timestamp = Date.now();
      state.appData.stats_timestamp = Date.now();

      // 标识为 'config' 变更
      await saveData("config");
      alert("从 WeTab 导入成功！页面将刷新。");
      location.reload();
    } catch (error) {
      alert(`导入失败：${error.message}`);
      console.error("WeTab import error:", error);
    } finally {
      DOM.importWeTabFileInput.value = "";
    }
  };
  reader.readAsText(file);
};

// --- Sync Settings Handlers ---
export const showSyncSettingsModal = async () => {
  const { sync_settings } = await chrome.storage.local.get("sync_settings");

  // Reset display
  DOM.syncStatusMsg.className = "d-none";
  DOM.syncLastCheckMsg.textContent = "从未检查";
  DOM.syncLastSuccessMsg.textContent = "从未同步";

  if (sync_settings) {
    DOM.syncEnabledInput.checked = sync_settings.enabled || false;
    DOM.syncServerUrlInput.value = sync_settings.server_url || "";
    DOM.syncUsernameInput.value = sync_settings.username || "";
    DOM.syncPasswordInput.value = sync_settings.password || "";
    DOM.syncIntervalInput.value = sync_settings.interval || 30;

    // 显示上次检查时间
    if (sync_settings.last_check_time) {
      DOM.syncLastCheckMsg.textContent = new Date(sync_settings.last_check_time).toLocaleString();
    }

    // 显示上次成功同步时间
    if (sync_settings.last_sync_success_time) {
      DOM.syncLastSuccessMsg.textContent = new Date(
        sync_settings.last_sync_success_time
      ).toLocaleString();
    }

    // 显示当前状态/错误信息
    if (sync_settings.last_sync_status) {
      const status = sync_settings.last_sync_status;
      DOM.syncStatusMsg.classList.remove("d-none");

      if (status === "success") {
        DOM.syncStatusMsg.className = "alert alert-success mt-3";
        DOM.syncStatusMsg.textContent = "状态: 同步正常";
      } else {
        DOM.syncStatusMsg.className = "alert alert-danger mt-3";
        DOM.syncStatusMsg.textContent = `状态: ${status}`;
      }
    }
  }

  DOM.syncSettingsModal.show();
};

export const saveSyncSettings = async () => {
  const settings = {
    enabled: DOM.syncEnabledInput.checked,
    server_url: DOM.syncServerUrlInput.value.trim(),
    username: DOM.syncUsernameInput.value.trim(),
    password: DOM.syncPasswordInput.value,
    interval: parseInt(DOM.syncIntervalInput.value) || 30,
    last_sync_time: null,
    last_sync_status: null,
  };

  await chrome.storage.local.set({ sync_settings: settings });
  alert("设置已保存！自动同步将在后台运行。");
  DOM.syncSettingsModal.hide();
};

export const handleTriggerSync = async () => {
  // Save temporary settings logic remains same...
  const tempSettings = {
    enabled: DOM.syncEnabledInput.checked,
    server_url: DOM.syncServerUrlInput.value.trim(),
    username: DOM.syncUsernameInput.value.trim(),
    password: DOM.syncPasswordInput.value,
    interval: parseInt(DOM.syncIntervalInput.value) || 30,
  };
  await chrome.storage.local.set({ sync_settings: tempSettings });

  DOM.triggerSyncBtn.disabled = true;
  DOM.triggerSyncBtn.textContent = "同步中...";
  DOM.syncStatusMsg.classList.add("d-none"); // Hide previous status

  chrome.runtime.sendMessage({ action: "trigger_sync_now" }, (response) => {
    DOM.triggerSyncBtn.disabled = false;
    DOM.triggerSyncBtn.textContent = "立即同步";

    // Re-fetch settings to get updated timestamps
    chrome.storage.local.get("sync_settings").then(({ sync_settings }) => {
      if (sync_settings) {
        if (sync_settings.last_check_time)
          DOM.syncLastCheckMsg.textContent = new Date(
            sync_settings.last_check_time
          ).toLocaleString();
        if (sync_settings.last_sync_success_time)
          DOM.syncLastSuccessMsg.textContent = new Date(
            sync_settings.last_sync_success_time
          ).toLocaleString();
      }
    });

    if (response && response.success) {
      DOM.syncStatusMsg.textContent = `同步成功！`;
      DOM.syncStatusMsg.className = "alert alert-success mt-3";
      DOM.syncStatusMsg.classList.remove("d-none");
    } else {
      DOM.syncStatusMsg.textContent = `同步失败: ${response ? response.error : "未知错误"}`;
      DOM.syncStatusMsg.className = "alert alert-danger mt-3";
      DOM.syncStatusMsg.classList.remove("d-none");
    }
  });
};
