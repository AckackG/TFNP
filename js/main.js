import * as DOM from "./dom.js";
import { state, loadData } from "./state.js";
import { render } from "./ui.js";
import * as Handlers from "./handlers.js";
import { fetchFavicon } from "./utils.js";

// --- Event Listeners Setup ---
const setupEventListeners = () => {
  // Header Buttons
  DOM.addIconBtn.addEventListener("click", Handlers.showAddIconModal);
  DOM.manageTabsBtn.addEventListener("click", () => {
    Handlers.renderTabManagementList();
    DOM.manageTabsModal.show();
  });
  DOM.showStatsBtn.addEventListener("click", () => {
    Handlers.generateReport();
    DOM.statsModal.show();
  });
  DOM.exportBtn.addEventListener("click", Handlers.exportData);
  DOM.importBtn.addEventListener("click", () => DOM.importFileInput.click());
  DOM.importWeTabBtn.addEventListener("click", () => DOM.importWeTabFileInput.click());

  // Sync Settings
  if (DOM.openSyncSettingsBtn) {
      DOM.openSyncSettingsBtn.addEventListener("click", Handlers.showSyncSettingsModal);
  }
  if (DOM.saveSyncSettingsBtn) {
      DOM.saveSyncSettingsBtn.addEventListener("click", Handlers.saveSyncSettings);
  }
  if (DOM.triggerSyncBtn) {
      DOM.triggerSyncBtn.addEventListener("click", Handlers.handleTriggerSync);
  }

  // File Inputs
  DOM.importFileInput.addEventListener("change", Handlers.importData);
  DOM.importWeTabFileInput.addEventListener("change", Handlers.handleWeTabImport);

  // Import Merge Modal
  DOM.mergeImportBtn.addEventListener("click", Handlers.handleMergeImport);
  DOM.overwriteImportBtn.addEventListener("click", Handlers.handleOverwriteImport);
  DOM.cancelImportBtn.addEventListener("click", Handlers.handleCancelImport);

  // Edit Mode
  DOM.editModeSwitch.addEventListener("change", () => {
    document.body.classList.toggle("edit-mode", DOM.editModeSwitch.checked);
    state.sortableInstances.forEach((si) => si.option("disabled", !DOM.editModeSwitch.checked));
  });

  // Search
  DOM.searchBtn.addEventListener("click", Handlers.performSearch);
  DOM.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      Handlers.performSearch();
    }
  });
  DOM.googleSearchBtn.addEventListener("click", () => Handlers.selectSearchEngine("google"));
  DOM.bingSearchBtn.addEventListener("click", () => Handlers.selectSearchEngine("bing"));
  DOM.sogouSearchBtn.addEventListener("click", () => Handlers.selectSearchEngine("sogou"));

  // Icon Modal
  DOM.iconForm.addEventListener("submit", Handlers.handleIconFormSubmit);
  DOM.deleteIconBtn.addEventListener("click", Handlers.handleDeleteIcon);
  DOM.urlInput.addEventListener("blur", () => {
    if (DOM.urlInput.value) {
      try {
        // Basic validation, doesn't need to be a full URL object
        if (DOM.urlInput.value.includes(".")) {
          fetchFavicon(DOM.urlInput.value);
        }
      } catch (e) {
        // Invalid URL, do nothing
      }
    }
  });

  // Move Icon Logic
  DOM.moveIconBtn.addEventListener("mouseenter", () => {
    const sourceTabId = DOM.moveIconBtn.dataset.sourceTabId;
    const otherTabs = state.appData.config.tabs.filter((t) => t.id !== sourceTabId);

    DOM.moveIconTabsList.innerHTML = ""; // Clear previous list

    if (otherTabs.length > 0) {
      otherTabs.sort((a, b) => a.order - b.order);
      otherTabs.forEach((tab) => {
        const item = document.createElement("a");
        item.href = "#";
        item.className = "list-group-item list-group-item-action";
        item.dataset.tabId = tab.id;
        item.textContent = tab.name;
        DOM.moveIconTabsList.appendChild(item);
      });
      DOM.moveIconTabsList.classList.remove("d-none");
    }
  });

  // Hide move tabs list when clicking away
  document.addEventListener("click", (e) => {
    if (!DOM.moveIconTabsList.classList.contains("d-none")) {
      if (!DOM.moveIconContainer.contains(e.target)) {
        DOM.moveIconTabsList.classList.add("d-none");
      }
    }
  });

  // Handle clicking on a tab in the move list
  DOM.moveIconTabsList.addEventListener("click", (e) => {
    e.preventDefault();
    const targetTabItem = e.target.closest(".list-group-item");
    if (targetTabItem) {
      const targetTabId = targetTabItem.dataset.tabId;
      const { iconId, sourceTabId } = DOM.moveIconBtn.dataset;
      Handlers.moveIconToTab(iconId, sourceTabId, targetTabId);
    }
  });

  // Tab Management Modal
  DOM.addTabBtn.addEventListener("click", Handlers.handleAddTab);

  // Website Search
  DOM.websiteSearchBtn.addEventListener("click", Handlers.showWebsiteSearchModal);
  DOM.websiteSearchInput.addEventListener("input", Handlers.performWebsiteSearch);

  document.addEventListener("keydown", (event) => {
    // Open website search on HOME key, but not when typing in an input/textarea
    if (event.key === "Home" && !["INPUT", "TEXTAREA"].includes(event.target.tagName)) {
      event.preventDefault();
      Handlers.showWebsiteSearchModal();
    }
  });

  // --- Event Delegation for Dynamic Content ---

  // Tab switching
  DOM.tabContainer.addEventListener("click", (e) => {
    const tabButton = e.target.closest("button[data-tab-id]");
    if (tabButton) {
      state.activeTabId = tabButton.dataset.tabId;
      // Call the main render function to ensure everything, including SortableJS, is re-initialized.
      render();
    }
  });

  // Icon clicks (left, middle, right)
  DOM.tabContentContainer.addEventListener("click", (e) => {
    const iconItem = e.target.closest(".icon-item");
    if (!iconItem) return;

    if (DOM.editModeSwitch.checked) {
      e.preventDefault(); // Prevent navigation in edit mode
      return;
    }
    // Normal left-click is handled by the <a> tag, just record it
    Handlers.recordClick(iconItem.dataset.iconId);
  });

  DOM.tabContentContainer.addEventListener("auxclick", (e) => {
    const iconItem = e.target.closest(".icon-item");
    if (!iconItem) return;

    if (e.button === 1 && !DOM.editModeSwitch.checked) {
      e.preventDefault();
      Handlers.recordClick(iconItem.dataset.iconId);
      window.open(iconItem.href, "_blank");
    }
  });

  DOM.tabContentContainer.addEventListener("contextmenu", (e) => {
    const iconItem = e.target.closest(".icon-item");
    if (!iconItem) return;

    e.preventDefault();
    const tabId = iconItem.closest(".tab-pane").dataset.tabId;
    Handlers.showEditIconModal(iconItem.dataset.iconId, tabId);
  });
};

// --- App Initialization ---
const initializeApp = async () => {
  await loadData();
  Handlers.updateSearchEngineUI(state.currentSearchEngine); // Set initial search engine UI
  Handlers.initializeModalUIs(); // Initialize dynamic UI elements in modals
  render();
  setupEventListeners();
};

// Start the app
document.addEventListener("DOMContentLoaded", initializeApp);

// Listener for Sync Updates (Soft Refresh)
chrome.runtime.onMessage.addListener(async (request) => {
  if (request.action === "sync_completed_refresh") {
    console.log("Sync finished, updating UI...");
    // 1. Reload data from storage into state
    await loadData();
    // 2. Re-render the UI grid
    render();
    console.log("UI Updated.");
  }
});
