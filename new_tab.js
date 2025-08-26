// new_tab.js

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

  const DEFAULT_FAVICON =
    "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgZmlsbD0iY3VycmVudENvbG9yIiBjbGFzcz0iYmkgYmktZ2xvYmUiIHZpZXdCb3g9IjAgMCAxNiAxNiI+PHBhdGggZD0iTTguNSA0LjVhLjUuNSAwIDAgMC0xIDB2My41aC0zLjVhLjUuNSAwIDAgMCAwIDFoMy41VjEyaC41YS41LjUgMCAwIDAgLjUtLjV2LTMuN0g4YTguNDcgOC40NyAwIDAgMSAzLjUgMy41My5jMTMuMjQtMy41MyAzLjU0LTEzLjI0IDAgMCAuMTQxLS4yNDEtLjU3NS0uMi0xLjUtLjU0Ny0xLjA3My0uMzkxLTEuOTktLjU0My0yLjQzLS41NDNhNC45MyA0LjkyIDAgMCAwLTMuNTMgMS40N0w0LjM0NiA0LjQ4YTEwLjUgMTAuNSAwIDAgMCAuMjggMy41M2MuMjkgMS4zOTIgMS40IDMuMDY0IDMuNTQgMy4wNjQgMi4xNCAwIDMuMjUtMS42NzIgMy41NC0zLjA2NGMuMjktMS4zOS0uMDctMi45My0xLjQ4LTMuNTNoLS4xNjd6Ii8+PC9zdmc+";

  // --- Data Management ---
  const loadData = async () => {
    const result = await chrome.storage.local.get("smartNavData");
    if (result.smartNavData) {
      appData = result.smartNavData;
      if (appData.config.tabs.length > 0) {
        activeTabId = appData.config.tabs[0].id;
      }
    } else {
      // This should be handled by background.js, but as a fallback:
      appData = {
        version: "1.0",
        config: { tabs: [{ id: `tab-${Date.now()}`, name: "主页", order: 0, icons: [] }] },
        statistics: { clicks: [] },
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
        item.title = icon.description || icon.name;
        item.innerHTML = `
                    <img src="${icon.faviconCache || DEFAULT_FAVICON}" alt="${icon.name} favicon">
                    <span class="icon-item-name">${icon.name}</span>
                `;
        item.addEventListener("click", (e) => {
          if (!editModeSwitch.checked) {
            recordClick(icon.id);
          } else {
            e.preventDefault();
          }
        });
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

    // Abort any ongoing favicon fetch
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

    try {
      // Using Google's favicon service as a reliable fallback.
      // The `favicon` permission can be less reliable for some sites.
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;
      const response = await fetch(faviconUrl, { signal });
      if (!response.ok) throw new Error("Favicon not found");

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        if (!signal.aborted) {
          faviconPreview.src = reader.result;
          faviconSpinner.classList.add("d-none");
          faviconPreview.classList.remove("d-none");
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Favicon fetch error:", error);
        faviconPreview.src = DEFAULT_FAVICON;
        faviconSpinner.classList.add("d-none");
        faviconPreview.classList.remove("d-none");
      }
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
          render(); // Re-render main tabs
        }
      });
      item.querySelector("button").addEventListener("click", async (e) => {
        if (appData.config.tabs.length <= 1) {
          alert("必须至少保留一个标签页。");
          return;
        }
        if (confirm(`确定要删除标签页吗？此标签页下的所有网站也将被删除。`)) {
          const tabId = e.currentTarget.dataset.tabId;
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
  const recordClick = async (iconId) => {
    appData.statistics.clicks.push({
      iconId: iconId,
      timestamp: Date.now(),
    });
    await saveData();
  };

  const generateReport = () => {
    const clicks = appData.statistics.clicks;
    const allIcons = appData.config.tabs.flatMap((t) => t.icons);

    const getTop10 = (iconIds) => {
      const counts = iconIds.reduce((acc, id) => {
        acc[id] = (acc[id] || 0) + 1;
        return acc;
      }, {});

      return Object.entries(counts)
        .map(([iconId, count]) => {
          const icon = allIcons.find((i) => i.id === iconId);
          return icon ? { ...icon, count } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    };

    // Global Top 10
    const globalTop10 = getTop10(clicks.map((c) => c.iconId));
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
        const tabClicks = clicks.filter((c) => tabIconIds.includes(c.iconId)).map((c) => c.iconId);
        const tabTop10 = getTop10(tabClicks);
        renderStatsList(document.getElementById("tabStatsList"), tabTop10);
      }
    };

    statsTabSelect.addEventListener("change", updateTabStats);
    updateTabStats(); // Initial call
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

  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm("导入将覆盖所有现有数据，此操作不可逆，请确认。")) {
      importFileInput.value = ""; // Reset file input
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        // Basic validation
        if (importedData.version && importedData.config && importedData.statistics) {
          appData = importedData;
          await saveData();
          alert("导入成功！页面将刷新。");
          location.reload();
        } else {
          throw new Error("Invalid file format.");
        }
      } catch (error) {
        alert("导入失败：文件格式错误或已损坏。");
        console.error(error);
      } finally {
        importFileInput.value = ""; // Reset file input
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
        new URL(urlInput.value); // Validate URL
        fetchFavicon(urlInput.value);
      } catch (e) {
        // Invalid URL, do nothing
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

  // --- App Initialization ---
  const initializeApp = async () => {
    await loadData();
    render();
  };

  initializeApp();
});
