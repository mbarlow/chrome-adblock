// Chrome AdBlock - Background Service Worker
// Main background script for the ad blocking extension

// Import scripts using importScripts for service workers
importScripts("filter-engine.js", "rule-compiler.js", "update-manager.js");

// Extension state
let extensionEnabled = true;
let statistics = {
  blockedToday: 0,
  blockedTotal: 0,
  lastResetDate: new Date().toDateString(),
};

// Initialize extension on startup
chrome.runtime.onStartup.addListener(initialize);
chrome.runtime.onInstalled.addListener(initialize);

async function initialize() {
  console.log("Chrome AdBlock: Initializing...");

  // Load saved settings
  await loadSettings();

  // Initialize filter engine
  await window.filterEngine.initialize();

  // Set up daily statistics reset
  setupDailyReset();

  // Start filter list update manager
  window.updateManager.startPeriodicUpdates();

  console.log("Chrome AdBlock: Initialization complete");
}

// Load settings from storage
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get([
      "extensionEnabled",
      "statistics",
      "whitelist",
      "customRules",
    ]);

    extensionEnabled = result.extensionEnabled !== false; // Default to true
    statistics = result.statistics || statistics;

    // Check if we need to reset daily stats
    const today = new Date().toDateString();
    if (statistics.lastResetDate !== today) {
      statistics.blockedToday = 0;
      statistics.lastResetDate = today;
      await saveStatistics();
    }
  } catch (error) {
    console.error("Chrome AdBlock: Error loading settings:", error);
  }
}

// Save statistics to storage
async function saveStatistics() {
  try {
    await chrome.storage.sync.set({ statistics });
  } catch (error) {
    console.error("Chrome AdBlock: Error saving statistics:", error);
  }
}

// Setup daily statistics reset
function setupDailyReset() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const msUntilTomorrow = tomorrow.getTime() - now.getTime();

  setTimeout(() => {
    statistics.blockedToday = 0;
    statistics.lastResetDate = new Date().toDateString();
    saveStatistics();

    // Set up daily interval
    setInterval(
      () => {
        statistics.blockedToday = 0;
        statistics.lastResetDate = new Date().toDateString();
        saveStatistics();
      },
      24 * 60 * 60 * 1000,
    ); // 24 hours
  }, msUntilTomorrow);
}

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "GET_STATUS":
      sendResponse({
        enabled: extensionEnabled,
        statistics: statistics,
        tabId: sender.tab?.id,
      });
      break;

    case "TOGGLE_EXTENSION":
      toggleExtension(message.enabled, sendResponse);
      return true; // Keep message channel open for async response

    case "GET_TAB_INFO":
      getTabInfo(message.tabId, sendResponse);
      return true;

    case "WHITELIST_SITE":
      whitelistSite(message.hostname, sendResponse);
      return true;

    case "REMOVE_FROM_WHITELIST":
      removeFromWhitelist(message.hostname, sendResponse);
      return true;

    case "GET_WHITELIST":
      getWhitelist(sendResponse);
      return true;

    case "UPDATE_CUSTOM_RULES":
      updateCustomRules(message.rules, sendResponse);
      return true;

    case "BLOCKED_REQUEST":
      handleBlockedRequest(message.details);
      break;

    default:
      console.warn("Chrome AdBlock: Unknown message type:", message.type);
  }
});

// Toggle extension on/off
async function toggleExtension(enabled, sendResponse) {
  try {
    extensionEnabled = enabled;
    await chrome.storage.sync.set({ extensionEnabled });

    // Update declarative rules based on state
    if (enabled) {
      await window.filterEngine.enableRules();
    } else {
      await window.filterEngine.disableRules();
    }

    // Update icon
    updateExtensionIcon(enabled);

    sendResponse({ success: true, enabled });
  } catch (error) {
    console.error("Chrome AdBlock: Error toggling extension:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get tab-specific information
async function getTabInfo(tabId, sendResponse) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = new URL(tab.url);
    const hostname = url.hostname;

    // Check if site is whitelisted
    const result = await chrome.storage.sync.get(["whitelist"]);
    const whitelist = result.whitelist || [];
    const isWhitelisted = whitelist.includes(hostname);

    sendResponse({
      success: true,
      hostname,
      isWhitelisted,
      url: tab.url,
    });
  } catch (error) {
    console.error("Chrome AdBlock: Error getting tab info:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Add site to whitelist
async function whitelistSite(hostname, sendResponse) {
  try {
    const result = await chrome.storage.sync.get(["whitelist"]);
    const whitelist = result.whitelist || [];

    if (!whitelist.includes(hostname)) {
      whitelist.push(hostname);
      await chrome.storage.sync.set({ whitelist });

      // Update filter rules to exclude this hostname
      await window.filterEngine.updateWhitelist(whitelist);
    }

    sendResponse({ success: true, whitelist });
  } catch (error) {
    console.error("Chrome AdBlock: Error whitelisting site:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Remove site from whitelist
async function removeFromWhitelist(hostname, sendResponse) {
  try {
    const result = await chrome.storage.sync.get(["whitelist"]);
    const whitelist = result.whitelist || [];

    const index = whitelist.indexOf(hostname);
    if (index > -1) {
      whitelist.splice(index, 1);
      await chrome.storage.sync.set({ whitelist });

      // Update filter rules
      await window.filterEngine.updateWhitelist(whitelist);
    }

    sendResponse({ success: true, whitelist });
  } catch (error) {
    console.error("Chrome AdBlock: Error removing from whitelist:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Get current whitelist
async function getWhitelist(sendResponse) {
  try {
    const result = await chrome.storage.sync.get(["whitelist"]);
    sendResponse({ success: true, whitelist: result.whitelist || [] });
  } catch (error) {
    console.error("Chrome AdBlock: Error getting whitelist:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Update custom rules
async function updateCustomRules(rules, sendResponse) {
  try {
    await chrome.storage.sync.set({ customRules: rules });
    await window.filterEngine.updateCustomRules(rules);

    sendResponse({ success: true });
  } catch (error) {
    console.error("Chrome AdBlock: Error updating custom rules:", error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle blocked request notification
function handleBlockedRequest(details) {
  if (!extensionEnabled) return;

  // Update statistics
  statistics.blockedToday++;
  statistics.blockedTotal++;

  // Save statistics (debounced)
  clearTimeout(window.statsTimeout);
  window.statsTimeout = setTimeout(saveStatistics, 1000);

  // Update badge
  updateBadge();
}

// Update extension icon based on state
function updateExtensionIcon(enabled) {
  const iconPath = enabled
    ? {
        16: "assets/icons/icon16.png",
        32: "assets/icons/icon32.png",
        48: "assets/icons/icon48.png",
        128: "assets/icons/icon128.png",
      }
    : {
        16: "assets/icons/icon16-disabled.png",
        32: "assets/icons/icon32-disabled.png",
        48: "assets/icons/icon48-disabled.png",
        128: "assets/icons/icon128-disabled.png",
      };

  chrome.action.setIcon({ path: iconPath }).catch(console.error);
}

// Update badge with blocked count
function updateBadge() {
  const text =
    statistics.blockedToday > 999 ? "999+" : statistics.blockedToday.toString();
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  // This will open the popup, but we can also handle direct clicks here
  console.log("Chrome AdBlock: Extension icon clicked for tab:", tab.id);
});

// Handle tab updates to refresh context
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    // Inject content scripts if needed
    injectContentScripts(tabId, tab.url);
  }
});

// Inject content scripts for dynamic content
async function injectContentScripts(tabId, url) {
  try {
    // Skip chrome:// and extension pages
    if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
      return;
    }

    // Inject our content scripts
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        "content/content-script.js",
        "content/element-hider.js",
        "content/script-blocker.js",
      ],
    });
  } catch (error) {
    // Ignore injection errors for protected pages
    if (!error.message.includes("Cannot access")) {
      console.error("Chrome AdBlock: Error injecting content scripts:", error);
    }
  }
}

// Initialize badge on startup
updateBadge();
updateExtensionIcon(extensionEnabled);

console.log("Chrome AdBlock: Service worker loaded");
