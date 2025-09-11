import * as DOM from "./dom.js";
import { state, saveData } from "./state.js";
import { DEFAULT_FAVICON } from "./constants.js";
import { showEditIconModal, recordClick } from "./handlers.js";

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
    pane.dataset.tabId = tab.id; // For event delegation

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
      grid.appendChild(item);
    });
    pane.appendChild(grid);
    DOM.tabContentContainer.appendChild(pane);
  });
};

const initTooltips = () => {
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  // Dispose of existing tooltips to prevent memory leaks
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
