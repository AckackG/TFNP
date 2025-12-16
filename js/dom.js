// Main containers
export const tabContainer = document.getElementById("tab-container");
export const tabContentContainer = document.getElementById("tab-content-container");

// Header buttons
export const editModeSwitch = document.getElementById("editModeSwitch");
export const manageTabsBtn = document.getElementById("manageTabsBtn");
export const showStatsBtn = document.getElementById("showStatsBtn");
export const importBtn = document.getElementById("importBtn");
export const exportBtn = document.getElementById("exportBtn");
export const importWeTabBtn = document.getElementById("importWeTabBtn");

// File inputs
export const importFileInput = document.getElementById("importFile");
export const importWeTabFileInput = document.getElementById("importWeTabFile");

// Search elements
export const searchInput = document.getElementById("searchInput");
export const searchBtn = document.getElementById("searchBtn");
export const googleSearchBtn = document.getElementById("googleSearchBtn");
export const bingSearchBtn = document.getElementById("bingSearchBtn");
export const sogouSearchBtn = document.getElementById("sogouSearchBtn");

// Modals
export const iconModalEl = document.getElementById("iconModal");
export const iconModal = new bootstrap.Modal(iconModalEl);
export const manageTabsModalEl = document.getElementById("manageTabsModal");
export const manageTabsModal = new bootstrap.Modal(manageTabsModalEl);
export const statsModalEl = document.getElementById("statsModal");
export const statsModal = new bootstrap.Modal(statsModalEl);
export const importMergeModalEl = document.getElementById("importMergeModal");
export const importMergeModal = new bootstrap.Modal(importMergeModalEl);

// Import Merge Modal elements
export const importMergeList = document.getElementById("importMergeList");
export const mergeImportBtn = document.getElementById("mergeImportBtn");
export const overwriteImportBtn = document.getElementById("overwriteImportBtn");
export const cancelImportBtn = document.getElementById("cancelImportBtn");


// Icon Modal Form elements
export const iconForm = document.getElementById("iconForm");
export const iconModalLabel = document.getElementById("iconModalLabel");
export const iconIdInput = document.getElementById("iconIdInput");
export const urlInput = document.getElementById("urlInput");
export const nameInput = document.getElementById("nameInput");
export const descriptionInput = document.getElementById("descriptionInput");
export const faviconPreview = document.getElementById("faviconPreview");
export const faviconSpinner = document.getElementById("faviconSpinner");
export const deleteIconBtn = document.getElementById("deleteIconBtn");
export const borderColorSelector = document.getElementById("borderColorSelector");
export const moveIconContainer = document.getElementById("moveIconContainer");
export const moveIconBtn = document.getElementById("moveIconBtn");
export const moveIconTabsList = document.getElementById("moveIconTabsList");

// Tab Management Modal elements
export const tabManagementList = document.getElementById("tab-management-list");
export const addTabBtn = document.getElementById("addTabBtn");
export const newTabNameInput = document.getElementById("newTabNameInput");

// Statistics Modal elements
export const globalStatsList = document.getElementById("globalStatsList");
export const statsTabSelect = document.getElementById("statsTabSelect");
export const tabStatsList = document.getElementById("tabStatsList");

// Website Search Modal elements
export const websiteSearchBtn = document.getElementById("websiteSearchBtn");
export const websiteSearchModalEl = document.getElementById("websiteSearchModal");
export const websiteSearchModal = new bootstrap.Modal(websiteSearchModalEl);
export const websiteSearchInput = document.getElementById("websiteSearchInput");
export const websiteSearchResults = document.getElementById("websiteSearchResults");

// Sync Settings Elements
export const openSyncSettingsBtn = document.getElementById("openSyncSettingsBtn");
export const syncSettingsModalEl = document.getElementById("syncSettingsModal");
export const syncSettingsModal = new bootstrap.Modal(syncSettingsModalEl);
export const syncEnabledInput = document.getElementById("syncEnabled");
export const syncServerUrlInput = document.getElementById("syncServerUrl");
export const syncUsernameInput = document.getElementById("syncUsername");
export const syncPasswordInput = document.getElementById("syncPassword");
export const syncIntervalInput = document.getElementById("syncInterval");
export const syncStatusMsg = document.getElementById("syncStatusMsg");
export const triggerSyncBtn = document.getElementById("triggerSyncBtn");
export const saveSyncSettingsBtn = document.getElementById("saveSyncSettingsBtn");
