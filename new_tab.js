document.addEventListener("DOMContentLoaded", () => {
  // --- DOM Element References ---
  const tabContainer = document.getElementById("tab-container");
  const tabContentContainer = document.getElementById("tab-content-container");
  const addIconBtn = document.getElementById("addIconBtn");
  const editModeSwitch = document.getElementById("editModeSwitch");
  const manageTabsBtn = document.getElementById("manageTabsBtn");
  const showStatsBtn = document.getElementById("showStatsBtn");
  const importBtn = document.getElementById("importBtn");
  const exportBtn = document.getElementById("exportBtn");
  const importFileInput = document.getElementById("importFile");
  const importWeTabBtn = document.getElementById("importWeTabBtn");
  const importWeTabFileInput = document.getElementById("importWeTabFile");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const googleSearchBtn = document.getElementById("googleSearchBtn");
  const bingSearchBtn = document.getElementById("bingSearchBtn");

  // Modals
  const iconModalEl = document.getElementById("iconModal");
  const iconModal = new bootstrap.Modal(iconModalEl);
  const manageTabsModalEl = document.getElementById("manageTabsModal");
  const manageTabsModal = new bootstrap.Modal(manageTabsModalEl);
  const statsModalEl = document.getElementById("statsModal");
  const statsModal = new bootstrap.Modal(statsModalEl);

  // Icon Modal Form
  const iconForm = document.getElementById("iconForm");
  const iconModalLabel = document.getElementById("iconModalLabel");
  const iconIdInput = document.getElementById("iconIdInput");
  const urlInput = document.getElementById("urlInput");
  const nameInput = document.getElementById("nameInput");
  const descriptionInput = document.getElementById("descriptionInput");
  const faviconPreview = document.getElementById("faviconPreview");
  const faviconSpinner = document.getElementById("faviconSpinner");
  const deleteIconBtn = document.getElementById("deleteIconBtn");

  // --- App State ---
  let appData = {};
  let activeTabId = null;
  let sortableInstances = [];
  let faviconAbortController = null;
  let currentSearchEngine = "google"; // 'google' or 'bing'
  const SEARCH_ENGINES = {
    google: "https://www.google.com/search?q=",
    bing: "https://cn.bing.com/search?q=",
  };

  const DEFAULT_FAVICON =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktZ2xvYmUiIHZpZXdCb3g9IjAgMCAxNiAxNiI+PHBhdGggZD0iTTguNSA0LjVhLjUuNSAwIDAgMC0xIDB2My41aC0zLjVhLjUuNSAwIDAgMCAwIDFoMy41VjEyaC41YS41LjUgMCAwIDAgLjUtLjV2LTMuN0g4YTguNDcgOC40NyAwIDAgMSAzLjUgMy41My5jMTMuMjQtMy41MyAzLjU0LTEzLjI0IDAgMCAuMTQxLS4yNDEtLjU3NS0uMi0xLjUtLjU0Ny0xLjA3My0uMzkxLTEuOTktLjU0My0yLjQzLS41NDNhNC45MyA0LjkyIDAgMCAwLTMuNTMgMS40N0w0LjM0NiA0LjQ4YTEwLjUgMTAuNSAwIDAgMCAuMjggMy41M2MuMjkgMS4zOTIgMS40IDMuMDY0IDMuNTQgMy4wNjQgMi4xNCAwIDMuMjUtMS42NzIgMy41NC0zLjA2NGMuMjktMS4zOS0uMDctMi45My0xLjQ4LTMuNTNoLS4xNjd6Ii8+PC9zdmc+";

  // --- Data Management ---
  const loadData = async () => {
    const result = await chrome.storage.local.get("smartNavData");
    if (result.smartNavData) {
      appData = result.smartNavData;
      // --- MODIFIED ---: Ensure new stats structure exists for backward compatibility
      if (!appData.statistics.iconStats) {
        appData.statistics.iconStats = {};
      }
      if (appData.config.tabs.length > 0) {
        activeTabId = appData.config.tabs[0].id;
      }
    } else {
      appData = {
        version: "1.0",
        config: { tabs: [{ id: `tab-${Date.now()}`, name: "主页", order: 0, icons: [] }] },
        statistics: { iconStats: {} }, // --- MODIFIED ---
      };
      activeTabId = appData.config.tabs[0].id;
      await saveData();
    }
  };

  const saveData = async () => {
    await chrome.storage.local.set({ smartNavData: appData });
  };

  // --- Rendering ---
  const render = () => {
    renderTabs();
    renderTabContents();
    initTooltips();
    initSortable();
  };

  const renderTabs = () => {
    tabContainer.innerHTML = "";
    appData.config.tabs.sort((a, b) => a.order - b.order);
    appData.config.tabs.forEach((tab) => {
      const li = document.createElement("li");
      li.className = "nav-item";
      li.innerHTML = `
                <button class="nav-link ${
                  tab.id === activeTabId ? "active" : ""
                }" data-bs-toggle="tab" data-tab-id="${tab.id}" type="button">${tab.name}</button>
            `;
      li.querySelector("button").addEventListener("click", () => {
        activeTabId = tab.id;
        render();
      });
      tabContainer.appendChild(li);
    });
  };

  // --- Search Logic ---
  const performSearch = () => {
    const query = searchInput.value.trim();
    if (query) {
      const searchUrl = SEARCH_ENGINES[currentSearchEngine] + encodeURIComponent(query);
      // 在新标签页中打开搜索结果
      chrome.tabs.create({ url: searchUrl });
      // 可选：搜索后清空输入框
      // searchInput.value = "";
    }
  };

  const selectSearchEngine = (engine) => {
    currentSearchEngine = engine;
    if (engine === "google") {
      googleSearchBtn.classList.add("active");
      bingSearchBtn.classList.remove("active");
    } else {
      bingSearchBtn.classList.add("active");
      googleSearchBtn.classList.remove("active");
    }
  };

  /**
   * 处理从 WeTab 备份文件导入的逻辑
   * @param {Event} event - 文件输入框的 change 事件
   */
  const handleWeTabImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("从 WeTab 导入将覆盖所有现有数据，此操作不可逆，请确认。")) {
      importWeTabFileInput.value = ""; // 重置文件输入框
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
        appData = newSmartNavData;
        await saveData();
        alert("从 WeTab 导入成功！页面将刷新。");
        location.reload();
      } catch (error) {
        alert(`导入失败：${error.message}`);
        console.error("WeTab import error:", error);
      } finally {
        importWeTabFileInput.value = ""; // 无论成功失败，都重置文件输入框
      }
    };
    reader.readAsText(file);
  };

  const renderTabContents = () => {
    tabContentContainer.innerHTML = "";
    appData.config.tabs.forEach((tab) => {
      const pane = document.createElement("div");
      pane.className = `tab-pane fade ${tab.id === activeTabId ? "show active" : ""}`;
      pane.id = `pane-${tab.id}`;

      const grid = document.createElement("div");
      grid.className = "icon-grid";
      grid.id = `grid-${tab.id}`;

      tab.icons.sort((a, b) => a.order - b.order);
      tab.icons.forEach((icon) => {
        const item = document.createElement("a");
        item.href = icon.url;
        item.className = "icon-item";
        item.dataset.iconId = icon.id;
        item.dataset.bsToggle = "tooltip";
        item.dataset.bsPlacement = "bottom";
        item.title = icon.description || icon.url;
        item.innerHTML = `
                <img src="${icon.faviconCache || DEFAULT_FAVICON}" alt="${icon.name} favicon">
                <span class="icon-item-name">${icon.name}</span>
            `;

        // 监听左键点击
        item.addEventListener("click", (e) => {
          if (editModeSwitch.checked) {
            e.preventDefault(); // 在编辑模式下阻止跳转
          } else {
            recordClick(icon.id); // 正常记录点击
          }
        });

        // --- NEW: Handle middle-mouse click ---
        // 监听中键点击 (auxclick 事件)
        item.addEventListener("auxclick", (e) => {
          // 确保是鼠标中键 (button === 1)
          if (e.button === 1 && !editModeSwitch.checked) {
            e.preventDefault(); // 阻止浏览器默认的“在新标签页打开”行为
            recordClick(icon.id); // 记录点击次数
            chrome.tabs.create({ url: icon.url, active: false }); // 在新窗口中打开链接
          }
        });
        // --- END NEW ---

        // 监听右键点击
        item.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          showEditIconModal(icon.id, tab.id);
        });

        grid.appendChild(item);
      });
      pane.appendChild(grid);
      tabContentContainer.appendChild(pane);
    });
  };

  // --- UI Initialization ---
  const initTooltips = () => {
    const tooltipTriggerList = [].slice.call(
      document.querySelectorAll('[data-bs-toggle="tooltip"]')
    );
    tooltipTriggerList.map(function (tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  };

  const initSortable = () => {
    sortableInstances.forEach((si) => si.destroy());
    sortableInstances = [];
    const grids = document.querySelectorAll(".icon-grid");
    grids.forEach((grid) => {
      const sortable = new Sortable(grid, {
        animation: 150,
        ghostClass: "sortable-ghost",
        disabled: !editModeSwitch.checked,
        onEnd: (evt) => {
          const tabId = grid.id.replace("grid-", "");
          const tab = appData.config.tabs.find((t) => t.id === tabId);
          if (tab) {
            const movedItem = tab.icons.splice(evt.oldIndex, 1)[0];
            tab.icons.splice(evt.newIndex, 0, movedItem);
            tab.icons.forEach((icon, index) => {
              icon.order = index;
            });
            saveData();
          }
        },
      });
      sortableInstances.push(sortable);
    });
  };

  // --- Icon CRUD ---
  const showAddIconModal = () => {
    iconForm.reset();
    iconIdInput.value = "";
    iconModalLabel.textContent = "添加新网站";
    deleteIconBtn.classList.add("d-none");
    faviconPreview.classList.add("d-none");
    faviconSpinner.classList.add("d-none");
    iconModal.show();
  };

  const showEditIconModal = (iconId, tabId) => {
    const tab = appData.config.tabs.find((t) => t.id === tabId);
    const icon = tab.icons.find((i) => i.id === iconId);
    if (icon) {
      iconForm.reset();
      iconModalLabel.textContent = "编辑网站";
      iconIdInput.value = icon.id;
      urlInput.value = icon.url;
      nameInput.value = icon.name;
      descriptionInput.value = icon.description;
      faviconPreview.src = icon.faviconCache || DEFAULT_FAVICON;
      faviconPreview.classList.remove("d-none");
      faviconSpinner.classList.add("d-none");
      deleteIconBtn.classList.remove("d-none");
      iconModal.show();
    }
  };

  const handleIconFormSubmit = async (e) => {
    e.preventDefault();

    if (faviconAbortController) {
      faviconAbortController.abort();
    }

    const id = iconIdInput.value;
    const url = urlInput.value;
    const name = nameInput.value;
    const description = descriptionInput.value;
    const tab = appData.config.tabs.find((t) => t.id === activeTabId);

    let faviconCache = faviconPreview.src;
    if (faviconPreview.classList.contains("d-none") || faviconPreview.src.endsWith("/")) {
      faviconCache = DEFAULT_FAVICON;
    }

    if (id) {
      // Editing
      const icon = tab.icons.find((i) => i.id === id);
      icon.url = url;
      icon.name = name;
      icon.description = description;
      icon.faviconCache = faviconCache;
    } else {
      // Adding
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
    iconModal.hide();
  };

  const handleDeleteIcon = async () => {
    const id = iconIdInput.value;
    if (confirm("此操作不可恢复，是否确认删除？")) {
      const tab = appData.config.tabs.find((t) => t.id === activeTabId);
      tab.icons = tab.icons.filter((i) => i.id !== id);

      // --- MODIFIED ---: Also delete associated statistics
      delete appData.statistics.iconStats[id];

      await saveData();
      render();
      iconModal.hide();
    }
  };

  const fetchFavicon = async (url) => {
    if (faviconAbortController) {
      faviconAbortController.abort();
    }
    faviconAbortController = new AbortController();
    const signal = faviconAbortController.signal;

    faviconSpinner.classList.remove("d-none");
    faviconPreview.classList.add("d-none");

    const setFavicon = (base64data) => {
      if (!signal.aborted) {
        faviconPreview.src = base64data;
        faviconSpinner.classList.add("d-none");
        faviconPreview.classList.remove("d-none");
      }
    };

    const convertUrlToBase64 = async (imageUrl) => {
      try {
        const response = await fetch(imageUrl, { signal });
        if (!response.ok) throw new Error(`Response not OK: ${response.status}`);
        const blob = await response.blob();
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        throw error;
      }
    };

    // Normalize URL
    const normalizeUrl = (url) => {
      try {
        if (!/^https?:\/\//i.test(url)) {
          url = `https://${url}`;
        }
        return new URL(url).hostname; // Extract domain (e.g., google.com)
      } catch (error) {
        console.warn(`Invalid URL: ${url}`, error);
        return null;
      }
    };

    const domain = normalizeUrl(url);
    if (!domain) {
      console.log("Invalid URL, using default favicon");
      setFavicon(DEFAULT_FAVICON);
      return;
    }

    // Use Favicone API
    try {
      console.log(`Attempting Favicone API for domain: ${domain}`);
      const faviconUrl = `https://favicone.com/${domain}?s=64`;
      const base64 = await convertUrlToBase64(faviconUrl);
      setFavicon(base64);
      console.log("Favicone API succeeded");
    } catch (error) {
      if (error.name === "AbortError") return;
      console.warn("Favicone API failed:", error);
      console.log("Using default favicon");
      setFavicon(DEFAULT_FAVICON);
    }
  };

  // --- Tab Management ---
  const renderTabManagementList = () => {
    const list = document.getElementById("tab-management-list");
    list.innerHTML = "";
    appData.config.tabs.forEach((tab) => {
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
          const targetTab = appData.config.tabs.find((t) => t.id === tabId);
          targetTab.name = newName;
          await saveData();
          render();
        }
      });
      item.querySelector("button").addEventListener("click", async (e) => {
        if (appData.config.tabs.length <= 1) {
          alert("必须至少保留一个标签页。");
          return;
        }
        const tabId = e.currentTarget.dataset.tabId;
        const tabToDelete = appData.config.tabs.find((t) => t.id === tabId);
        if (
          confirm(`确定要删除标签页 "${tabToDelete.name}" 吗？此标签页下的所有网站也将被删除。`)
        ) {
          // --- MODIFIED ---: Also delete statistics for all icons within the deleted tab
          if (tabToDelete) {
            tabToDelete.icons.forEach((icon) => {
              delete appData.statistics.iconStats[icon.id];
            });
          }

          appData.config.tabs = appData.config.tabs.filter((t) => t.id !== tabId);
          if (activeTabId === tabId) {
            activeTabId = appData.config.tabs[0].id;
          }
          await saveData();
          render();
          renderTabManagementList();
        }
      });
      list.appendChild(item);
    });
  };

  document.getElementById("addTabBtn").addEventListener("click", async () => {
    const input = document.getElementById("newTabNameInput");
    const name = input.value.trim();
    if (name) {
      appData.config.tabs.push({
        id: `tab-${Date.now()}`,
        name: name,
        order: appData.config.tabs.length,
        icons: [],
      });
      input.value = "";
      await saveData();
      renderTabManagementList();
      render();
    }
  });

  // --- Statistics ---
  // --- MODIFIED ---: Updated recordClick function for the new data structure
  const recordClick = async (iconId) => {
    const stats = appData.statistics.iconStats;
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

  // --- MODIFIED ---: Updated generateReport function to read from the new structure
  const generateReport = () => {
    const iconStats = appData.statistics.iconStats;
    const allIcons = appData.config.tabs.flatMap((t) => t.icons);

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
    renderStatsList(document.getElementById("globalStatsList"), globalTop10);

    // Per-tab Top 10
    const statsTabSelect = document.getElementById("statsTabSelect");
    statsTabSelect.innerHTML = "";
    appData.config.tabs.forEach((tab) => {
      statsTabSelect.innerHTML += `<option value="${tab.id}">${tab.name}</option>`;
    });

    const updateTabStats = () => {
      const selectedTabId = statsTabSelect.value;
      const tab = appData.config.tabs.find((t) => t.id === selectedTabId);
      if (tab) {
        const tabIconIds = tab.icons.map((i) => i.id);
        const tabTop10 = getTop10(tabIconIds);
        renderStatsList(document.getElementById("tabStatsList"), tabTop10);
      }
    };

    statsTabSelect.removeEventListener("change", updateTabStats); // Avoid duplicate listeners
    statsTabSelect.addEventListener("change", updateTabStats);
    updateTabStats();
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

  // --- Import / Export ---
  const exportData = () => {
    const dataStr = JSON.stringify(appData, null, 2);
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

  // --- MODIFIED ---: Updated importData with validation for the new structure
  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("导入将覆盖所有现有数据，此操作不可逆，请确认。")) {
      importFileInput.value = "";
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
          appData = importedData;
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
        importFileInput.value = "";
      }
    };
    reader.readAsText(file);
  };

  // --- Event Listeners ---
  addIconBtn.addEventListener("click", showAddIconModal);
  iconForm.addEventListener("submit", handleIconFormSubmit);
  deleteIconBtn.addEventListener("click", handleDeleteIcon);
  urlInput.addEventListener("blur", () => {
    if (urlInput.value) {
      try {
        new URL(urlInput.value);
        fetchFavicon(urlInput.value);
      } catch (e) {
        // Invalid URL
      }
    }
  });

  editModeSwitch.addEventListener("change", () => {
    document.body.classList.toggle("edit-mode", editModeSwitch.checked);
    sortableInstances.forEach((si) => si.option("disabled", !editModeSwitch.checked));
  });

  manageTabsBtn.addEventListener("click", () => {
    renderTabManagementList();
    manageTabsModal.show();
  });

  showStatsBtn.addEventListener("click", () => {
    generateReport();
    statsModal.show();
  });

  exportBtn.addEventListener("click", exportData);
  importBtn.addEventListener("click", () => importFileInput.click());
  importFileInput.addEventListener("change", importData);
  importWeTabBtn.addEventListener("click", () => importWeTabFileInput.click());
  importWeTabFileInput.addEventListener("change", handleWeTabImport);

  // --- Search Event Listeners ---
  searchBtn.addEventListener("click", performSearch);

  searchInput.addEventListener("keydown", (event) => {
    // 监听 Enter 键
    if (event.key === "Enter") {
      event.preventDefault(); // 防止任何默认的表单提交行为
      performSearch();
    }
  });

  googleSearchBtn.addEventListener("click", () => selectSearchEngine("google"));
  bingSearchBtn.addEventListener("click", () => selectSearchEngine("bing"));

  // --- App Initialization ---
  const initializeApp = async () => {
    await loadData();
    render();
  };

  initializeApp();
});
