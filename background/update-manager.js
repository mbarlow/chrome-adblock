// Chrome AdBlock - Update Manager
// Handles automatic filter list updates and management

class UpdateManager {
  constructor() {
    this.updateIntervals = {
      easylist: 24 * 60 * 60 * 1000,        // 24 hours
      easyprivacy: 24 * 60 * 60 * 1000,     // 24 hours
      malware: 6 * 60 * 60 * 1000,          // 6 hours
      custom: 0                              // Manual only
    };

    this.lastUpdates = {};
    this.updateTimeouts = {};
    this.isUpdating = false;
    this.updateQueue = [];
  }

  async initialize() {
    console.log('UpdateManager: Initializing...');

    // Load last update times
    await this.loadUpdateHistory();

    // Check for needed updates
    await this.checkForUpdates();

    console.log('UpdateManager: Initialization complete');
  }

  async loadUpdateHistory() {
    try {
      const result = await chrome.storage.local.get(['filterUpdates']);
      this.lastUpdates = result.filterUpdates || {};
      console.log('UpdateManager: Loaded update history:', this.lastUpdates);
    } catch (error) {
      console.error('UpdateManager: Error loading update history:', error);
      this.lastUpdates = {};
    }
  }

  async saveUpdateHistory() {
    try {
      await chrome.storage.local.set({ filterUpdates: this.lastUpdates });
    } catch (error) {
      console.error('UpdateManager: Error saving update history:', error);
    }
  }

  async checkForUpdates() {
    const now = Date.now();
    const sources = await this.getFilterSources();

    for (const [name, config] of Object.entries(sources)) {
      const lastUpdate = this.lastUpdates[name] || 0;
      const interval = this.updateIntervals[name] || this.updateIntervals.easylist;

      if (interval > 0 && (now - lastUpdate) > interval) {
        console.log(`UpdateManager: ${name} filter list needs update`);
        this.queueUpdate(name, config);
      }
    }

    // Process update queue
    this.processUpdateQueue();
  }

  async getFilterSources() {
    try {
      const response = await fetch(chrome.runtime.getURL('assets/blocklist-sources.json'));
      return await response.json();
    } catch (error) {
      console.error('UpdateManager: Error loading filter sources:', error);
      return {
        easylist: {
          url: 'https://easylist.to/easylist/easylist.txt',
          name: 'EasyList',
          description: 'Primary ad blocking filter list'
        },
        easyprivacy: {
          url: 'https://easylist.to/easylist/easyprivacy.txt',
          name: 'EasyPrivacy',
          description: 'Privacy protection filter list'
        }
      };
    }
  }

  queueUpdate(listName, config) {
    if (!this.updateQueue.find(item => item.name === listName)) {
      this.updateQueue.push({ name: listName, config });
    }
  }

  async processUpdateQueue() {
    if (this.isUpdating || this.updateQueue.length === 0) {
      return;
    }

    this.isUpdating = true;
    console.log(`UpdateManager: Processing ${this.updateQueue.length} updates`);

    while (this.updateQueue.length > 0) {
      const { name, config } = this.updateQueue.shift();
      await this.updateFilterList(name, config);

      // Small delay between updates to avoid overwhelming servers
      await this.delay(1000);
    }

    this.isUpdating = false;
    console.log('UpdateManager: Update queue processed');
  }

  async updateFilterList(listName, config) {
    console.log(`UpdateManager: Updating ${listName} from ${config.url}`);

    try {
      // Download the filter list
      const response = await fetch(config.url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Chrome AdBlock Extension 1.0',
          'Accept': 'text/plain'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const filterText = await response.text();
      console.log(`UpdateManager: Downloaded ${filterText.length} characters for ${listName}`);

      // Validate the content
      if (!this.validateFilterList(filterText, listName)) {
        throw new Error('Invalid filter list format');
      }

      // Compile the rules
      const rules = await window.ruleCompiler.compileFilterList(filterText, listName);
      console.log(`UpdateManager: Compiled ${rules.length} rules for ${listName}`);

      // Store the compiled rules
      await this.storeCompiledRules(listName, rules, filterText);

      // Update last update time
      this.lastUpdates[listName] = Date.now();
      await this.saveUpdateHistory();

      // Trigger filter engine refresh
      if (window.filterEngine && window.filterEngine.isInitialized) {
        await window.filterEngine.refreshRules();
      }

      console.log(`UpdateManager: Successfully updated ${listName}`);

      // Notify about successful update
      this.notifyUpdateComplete(listName, true, rules.length);

    } catch (error) {
      console.error(`UpdateManager: Failed to update ${listName}:`, error);

      // Notify about failed update
      this.notifyUpdateComplete(listName, false, 0, error.message);

      // Schedule retry
      this.scheduleRetry(listName, config);
    }
  }

  validateFilterList(content, listName) {
    // Basic validation
    if (!content || content.length < 100) {
      console.warn(`UpdateManager: ${listName} content too short`);
      return false;
    }

    // Check for expected patterns
    const lines = content.split('\n');
    let validLines = 0;

    for (const line of lines.slice(0, 100)) { // Check first 100 lines
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('!') && !trimmed.startsWith('[')) {
        if (trimmed.includes('.') || trimmed.includes('##') || trimmed.includes('||')) {
          validLines++;
        }
      }
    }

    const isValid = validLines > 5; // At least 5 valid filter lines
    console.log(`UpdateManager: ${listName} validation: ${validLines} valid lines, ${isValid ? 'PASS' : 'FAIL'}`);

    return isValid;
  }

  async storeCompiledRules(listName, rules, originalText) {
    try {
      const data = {
        rules: rules,
        originalText: originalText,
        lastUpdated: Date.now(),
        ruleCount: rules.length
      };

      await chrome.storage.local.set({ [`filterList_${listName}`]: data });
      console.log(`UpdateManager: Stored ${rules.length} rules for ${listName}`);
    } catch (error) {
      console.error(`UpdateManager: Error storing rules for ${listName}:`, error);
    }
  }

  scheduleRetry(listName, config, retryCount = 1) {
    if (retryCount > 3) {
      console.log(`UpdateManager: Max retries reached for ${listName}`);
      return;
    }

    const delay = Math.min(300000 * retryCount, 1800000); // 5min, 10min, 15min, max 30min
    console.log(`UpdateManager: Scheduling retry ${retryCount} for ${listName} in ${delay/1000}s`);

    setTimeout(() => {
      console.log(`UpdateManager: Retrying update for ${listName} (attempt ${retryCount + 1})`);
      this.updateFilterList(listName, config).catch(() => {
        this.scheduleRetry(listName, config, retryCount + 1);
      });
    }, delay);
  }

  notifyUpdateComplete(listName, success, ruleCount, error = null) {
    const notification = {
      type: 'filter_update',
      listName,
      success,
      ruleCount,
      error,
      timestamp: Date.now()
    };

    // Send to popup if open
    chrome.runtime.sendMessage(notification).catch(() => {
      // Popup not open, ignore error
    });

    // Store notification for later retrieval
    this.storeNotification(notification);
  }

  async storeNotification(notification) {
    try {
      const result = await chrome.storage.local.get(['updateNotifications']);
      const notifications = result.updateNotifications || [];

      notifications.unshift(notification);

      // Keep only last 10 notifications
      if (notifications.length > 10) {
        notifications.splice(10);
      }

      await chrome.storage.local.set({ updateNotifications: notifications });
    } catch (error) {
      console.error('UpdateManager: Error storing notification:', error);
    }
  }

  async getUpdateStatus() {
    try {
      const sources = await this.getFilterSources();
      const status = {};

      for (const listName of Object.keys(sources)) {
        const lastUpdate = this.lastUpdates[listName] || 0;
        const interval = this.updateIntervals[listName] || this.updateIntervals.easylist;
        const nextUpdate = lastUpdate + interval;

        status[listName] = {
          lastUpdate: new Date(lastUpdate),
          nextUpdate: new Date(nextUpdate),
          overdue: interval > 0 && Date.now() > nextUpdate
        };
      }

      return status;
    } catch (error) {
      console.error('UpdateManager: Error getting update status:', error);
      return {};
    }
  }

  async getRecentNotifications() {
    try {
      const result = await chrome.storage.local.get(['updateNotifications']);
      return result.updateNotifications || [];
    } catch (error) {
      console.error('UpdateManager: Error getting notifications:', error);
      return [];
    }
  }

  async forceUpdate(listName) {
    console.log(`UpdateManager: Forcing update for ${listName}`);

    const sources = await this.getFilterSources();
    const config = sources[listName];

    if (!config) {
      throw new Error(`Unknown filter list: ${listName}`);
    }

    this.queueUpdate(listName, config);
    this.processUpdateQueue();
  }

  async forceUpdateAll() {
    console.log('UpdateManager: Forcing update for all filter lists');

    const sources = await this.getFilterSources();

    for (const [name, config] of Object.entries(sources)) {
      this.queueUpdate(name, config);
    }

    this.processUpdateQueue();
  }

  startPeriodicUpdates() {
    console.log('UpdateManager: Starting periodic updates');

    // Check for updates every hour
    setInterval(() => {
      this.checkForUpdates();
    }, 60 * 60 * 1000);

    // Initial check after 30 seconds
    setTimeout(() => {
      this.checkForUpdates();
    }, 30000);
  }

  async setUpdateInterval(listName, intervalMs) {
    this.updateIntervals[listName] = intervalMs;

    // Save to storage
    try {
      await chrome.storage.sync.set({ updateIntervals: this.updateIntervals });
      console.log(`UpdateManager: Updated interval for ${listName} to ${intervalMs}ms`);
    } catch (error) {
      console.error('UpdateManager: Error saving update intervals:', error);
    }
  }

  async loadUpdateIntervals() {
    try {
      const result = await chrome.storage.sync.get(['updateIntervals']);
      if (result.updateIntervals) {
        this.updateIntervals = { ...this.updateIntervals, ...result.updateIntervals };
      }
    } catch (error) {
      console.error('UpdateManager: Error loading update intervals:', error);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get statistics about updates
  async getUpdateStatistics() {
    const sources = await this.getFilterSources();
    const notifications = await this.getRecentNotifications();

    const stats = {
      totalLists: Object.keys(sources).length,
      successfulUpdates: notifications.filter(n => n.success).length,
      failedUpdates: notifications.filter(n => !n.success).length,
      lastUpdateCheck: Math.max(...Object.values(this.lastUpdates), 0),
      isUpdating: this.isUpdating,
      queueLength: this.updateQueue.length
    };

    return stats;
  }

  // Clean up old data
  async cleanupOldData() {
    try {
      const result = await chrome.storage.local.get();
      const keysToRemove = [];

      // Find old filter list data (older than 7 days)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

      for (const [key, value] of Object.entries(result)) {
        if (key.startsWith('filterList_') && value.lastUpdated < sevenDaysAgo) {
          keysToRemove.push(key);
        }
      }

      if (keysToRemove.length > 0) {
        await chrome.storage.local.remove(keysToRemove);
        console.log(`UpdateManager: Cleaned up ${keysToRemove.length} old filter lists`);
      }
    } catch (error) {
      console.error('UpdateManager: Error during cleanup:', error);
    }
  }
}

// Export as global for service worker
window.updateManager = new UpdateManager();
