import * as DOM from "./dom.js";
import { state, saveData } from "./state.js";
import { DEFAULT_FAVICON } from "./constants.js";
import { showEditIconModal, recordClick } from "./handlers.js";

// 获取实际的图标 URL
export const getFaviconUrl = (faviconCache) => {
  if (faviconCache === "default48") {
    return "icons/icon48.png";
  }
  return faviconCache || "icons/icon48.png";
};

export const render = () => {
  renderTabs();
  renderTabContents();
  initTooltips();
  initSortable();
};

export const renderTabs = () => {
  DOM.tabContainer.innerHTML = "";
  state.appData.config.tabs.sort((a, b) => a.order - b.order);
  state.appData.config.tabs.forEach((tab) => {
    const li = document.createElement("li");
    li.className = "nav-item";
    li.innerHTML = `
              <button class="nav-link ${
                tab.id === state.activeTabId ? "active" : ""
              }" data-bs-toggle="tab" data-tab-id="${tab.id}" type="button">${tab.name}</button>
          `;
    DOM.tabContainer.appendChild(li);
  });
};

export const renderTabContents = () => {
  DOM.tabContentContainer.innerHTML = "";
  state.appData.config.tabs.forEach((tab) => {
    const pane = document.createElement("div");
    pane.className = `tab-pane fade ${tab.id === state.activeTabId ? "show active" : ""}`;
    pane.id = `pane-${tab.id}`;
    pane.dataset.tabId = tab.id;

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
              <div class="icon-image-wrapper">
                <img src="${getFaviconUrl(icon.faviconCache)}" alt="${icon.name} favicon">
              </div>
              <span class="icon-item-name">${icon.name}</span>
          `;

      if (icon.borderColor && icon.borderColor !== "transparent") {
        const wrapper = item.querySelector(".icon-image-wrapper");
        wrapper.style.borderColor = icon.borderColor;
      }

      grid.appendChild(item);
    });

    // --- NEW: Append "Fake Add Button" at the end of the grid ---
    const addBtn = document.createElement("div"); // Use div, not 'a' to prevent navigation
    addBtn.className = "icon-item add-icon-button";
    addBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="currentColor" class="bi bi-plus-lg" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
        </svg>
    `;
    // Add logic to identify it's an add button for event delegation
    addBtn.dataset.action = "add-new-icon";
    grid.appendChild(addBtn);
    // -----------------------------------------------------------

    pane.appendChild(grid);
    DOM.tabContentContainer.appendChild(pane);
  });
};

const initTooltips = () => {
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(function (tooltipTriggerEl) {
    const tooltip = bootstrap.Tooltip.getInstance(tooltipTriggerEl);
    if (tooltip) {
      tooltip.dispose();
    }
    return new bootstrap.Tooltip(tooltipTriggerEl);
  });
};

export const initSortable = () => {
  state.sortableInstances.forEach((si) => si.destroy());
  state.sortableInstances = [];
  const grids = document.querySelectorAll(".icon-grid");
  grids.forEach((grid) => {
    const sortable = new Sortable(grid, {
      animation: 150,
      ghostClass: "sortable-ghost",
      disabled: !DOM.editModeSwitch.checked,
      filter: ".add-icon-button", // <--- ADD THIS: Ignore the add button
      onEnd: (evt) => {
        const tabId = grid.id.replace("grid-", "");
        const tab = state.appData.config.tabs.find((t) => t.id === tabId);
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
    state.sortableInstances.push(sortable);
  });
};
