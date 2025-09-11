import * as DOM from "./dom.js";
import { state, loadData } from "./state.js";
import { render, renderTabs, renderTabContents } from "./ui.js";
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

  // File Inputs
  DOM.importFileInput.addEventListener("change", Handlers.importData);
  DOM.importWeTabFileInput.addEventListener("change", Handlers.handleWeTabImport);

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

  // Tab Management Modal
  DOM.addTabBtn.addEventListener("click", Handlers.handleAddTab);

  // --- Event Delegation for Dynamic Content ---

  // Tab switching
  DOM.tabContainer.addEventListener("click", (e) => {
    const tabButton = e.target.closest("button[data-tab-id]");
    if (tabButton) {
      state.activeTabId = tabButton.dataset.tabId;
      // Re-render only the tabs and content, not everything
      renderTabs();
      renderTabContents();
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
  Handlers.initializeModalUIs(); // Initialize dynamic UI elements in modals
  render();
  setupEventListeners();
};

// Start the app
document.addEventListener("DOMContentLoaded", initializeApp);
