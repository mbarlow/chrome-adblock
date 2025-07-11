// Chrome AdBlock - Options Page JavaScript
// Handles settings interface and configuration management

(function() {
    'use strict';

    // DOM elements
    let elements = {};

    // State variables
    let settings = {
        extensionEnabled: true,
        showBadge: true,
        blockInlineScripts: true,
        cosmeticFiltering: true,
        blockTracking: true,
        blockSocial: false,
        blockCookieNotices: false,
        updateFrequency: 86400000, // 24 hours
        debugMode: false,
        strictBlocking: false,
        maxRules: 30000
    };

    let filterLists = {};
    let customRules = [];
    let whitelistedSites = [];
    let statistics = {};

    // Initialize options page
    function initialize() {
        console.log('Chrome AdBlock: Options page initializing...');

        // Get DOM elements
        getElements();

        // Set up event listeners
        setupEventListeners();

        // Load current settings
        loadSettings();

        // Load filter lists
        loadFilterLists();

        // Load custom rules
        loadCustomRules();

        // Load whitelist
        loadWhitelist();

        // Load statistics
        loadStatistics();

        console.log('Chrome AdBlock: Options page initialized');
    }

    // Get DOM elements
    function getElements() {
        elements = {
            // Navigation
            navTabs: document.querySelectorAll('.nav-tab'),
            tabContents: document.querySelectorAll('.tab-content'),

            // Settings
            extensionEnabled: document.getElementById('extensionEnabled'),
            showBadge: document.getElementById('showBadge'),
            blockInlineScripts: document.getElementById('blockInlineScripts'),
            cosmeticFiltering: document.getElementById('cosmeticFiltering'),
            blockTracking: document.getElementById('blockTracking'),
            blockSocial: document.getElementById('blockSocial'),
            blockCookieNotices: document.getElementById('blockCookieNotices'),
            updateFrequency: document.getElementById('updateFrequency'),
            debugMode: document.getElementById('debugMode'),
            strictBlocking: document.getElementById('strictBlocking'),
            maxRules: document.getElementById('maxRules'),

            // Filter lists
            updateAllFilters: document.getElementById('updateAllFilters'),
            addCustomFilter: document.getElementById('addCustomFilter'),
            essentialFilters: document.getElementById('essentialFilters'),
            privacyFilters: document.getElementById('privacyFilters'),
            annoyanceFilters: document.getElementById('annoyanceFilters'),
            regionalFilters: document.getElementById('regionalFilters'),

            // Custom rules
            newRule: document.getElementById('newRule'),
            addRuleBtn: document.getElementById('addRuleBtn'),
            customRulesList: document.getElementById('customRulesList'),
            addRule: document.getElementById('addRule'),
            importRules: document.getElementById('importRules'),
            exportRules: document.getElementById('exportRules'),
            validateRules: document.getElementById('validateRules'),

            // Whitelist
            newWhitelistSite: document.getElementById('newWhitelistSite'),
            addWhitelistSite: document.getElementById('addWhitelistSite'),
            whitelistList: document.getElementById('whitelistList'),

            // Statistics
            totalBlocked: document.getElementById('totalBlocked'),
            todayBlocked: document.getElementById('todayBlocked'),
            averageDaily: document.getElementById('averageDaily'),
            filterRules: document.getElementById('filterRules'),
            blockingChart: document.getElementById('blockingChart'),
            resetStats: document.getElementById('resetStats'),
            exportStats: document.getElementById('exportStats'),

            // Advanced
            backupSettings: document.getElementById('backupSettings'),
            restoreSettings: document.getElementById('restoreSettings'),
            restoreFile: document.getElementById('restoreFile'),
            resetFilters: document.getElementById('resetFilters'),
            resetCustomRules: document.getElementById('resetCustomRules'),
            resetAll: document.getElementById('resetAll'),

            // Import/Export
            exportBtn: document.getElementById('exportBtn'),
            importBtn: document.getElementById('importBtn'),
            importFile: document.getElementById('importFile'),

            // Footer
            saveSettings: document.getElementById('saveSettings'),
            helpLink: document.getElementById('helpLink'),
            reportBugLink: document.getElementById('reportBugLink'),
            githubLink: document.getElementById('githubLink'),

            // Modal
            customFilterModal: document.getElementById('customFilterModal'),
            filterName: document.getElementById('filterName'),
            filterUrl: document.getElementById('filterUrl'),
            filterDescription: document.getElementById('filterDescription'),
            addCustomFilterList: document.getElementById('addCustomFilterList'),
            cancelCustomFilter: document.getElementById('cancelCustomFilter'),

            // Messages
            successMessage: document.getElementById('successMessage'),
            successText: document.getElementById('successText'),
            errorMessage: document.getElementById('errorMessage'),
            errorText: document.getElementById('errorText')
        };
    }

    // Set up event listeners
    function setupEventListeners() {
        // Navigation tabs
        elements.navTabs.forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });

        // Settings toggles
        Object.keys(settings).forEach(key => {
            if (elements[key]) {
                elements[key].addEventListener('change', () => {
                    settings[key] = elements[key].type === 'checkbox'
                        ? elements[key].checked
                        : elements[key].value;
                    debouncedSaveSettings();
                });
            }
        });

        // Filter list actions
        if (elements.updateAllFilters) {
            elements.updateAllFilters.addEventListener('click', updateAllFilterLists);
        }
        if (elements.addCustomFilter) {
            elements.addCustomFilter.addEventListener('click', showCustomFilterModal);
        }

        // Custom rules
        if (elements.addRuleBtn) {
            elements.addRuleBtn.addEventListener('click', addCustomRule);
        }
        if (elements.newRule) {
            elements.newRule.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addCustomRule();
            });
        }
        if (elements.importRules) {
            elements.importRules.addEventListener('click', importCustomRules);
        }
        if (elements.exportRules) {
            elements.exportRules.addEventListener('click', exportCustomRules);
        }
        if (elements.validateRules) {
            elements.validateRules.addEventListener('click', validateCustomRules);
        }

        // Whitelist
        if (elements.addWhitelistSite) {
            elements.addWhitelistSite.addEventListener('click', addWhitelistSite);
        }
        if (elements.newWhitelistSite) {
            elements.newWhitelistSite.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') addWhitelistSite();
            });
        }

        // Statistics
        if (elements.resetStats) {
            elements.resetStats.addEventListener('click', resetStatistics);
        }
        if (elements.exportStats) {
            elements.exportStats.addEventListener('click', exportStatistics);
        }

        // Advanced actions
        if (elements.backupSettings) {
            elements.backupSettings.addEventListener('click', backupSettings);
        }
        if (elements.restoreSettings) {
            elements.restoreSettings.addEventListener('click', () => elements.restoreFile.click());
        }
        if (elements.restoreFile) {
            elements.restoreFile.addEventListener('change', restoreSettings);
        }
        if (elements.resetFilters) {
            elements.resetFilters.addEventListener('click', resetFilterLists);
        }
        if (elements.resetCustomRules) {
            elements.resetCustomRules.addEventListener('click', resetCustomRules);
        }
        if (elements.resetAll) {
            elements.resetAll.addEventListener('click', resetAllSettings);
        }

        // Import/Export
        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', exportAllSettings);
        }
        if (elements.importBtn) {
            elements.importBtn.addEventListener('click', () => elements.importFile.click());
        }
        if (elements.importFile) {
            elements.importFile.addEventListener('change', importAllSettings);
        }

        // Footer
        if (elements.saveSettings) {
            elements.saveSettings.addEventListener('click', saveAllSettings);
        }
        if (elements.helpLink) {
            elements.helpLink.addEventListener('click', openHelp);
        }
        if (elements.reportBugLink) {
            elements.reportBugLink.addEventListener('click', reportBug);
        }
        if (elements.githubLink) {
            elements.githubLink.addEventListener('click', openGitHub);
        }

        // Modal
        if (elements.addCustomFilterList) {
            elements.addCustomFilterList.addEventListener('click', addCustomFilterList);
        }
        if (elements.cancelCustomFilter) {
            elements.cancelCustomFilter.addEventListener('click', hideCustomFilterModal);
        }

        // Message close buttons
        document.querySelectorAll('.message-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.message').classList.remove('show');
            });
        });

        // Modal close
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('show');
            });
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }

    // Switch tabs
    function switchTab(tabName) {
        // Update navigation
        elements.navTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update content
        elements.tabContents.forEach(content => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });

        // Load tab-specific data
        switch (tabName) {
            case 'filters':
                refreshFilterLists();
                break;
            case 'statistics':
                refreshStatistics();
                break;
        }
    }

    // Load settings from storage
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get(Object.keys(settings));

            Object.keys(settings).forEach(key => {
                if (result[key] !== undefined) {
                    settings[key] = result[key];
                }
            });

            updateSettingsUI();
        } catch (error) {
            console.error('Error loading settings:', error);
            showError('Failed to load settings');
        }
    }

    // Update settings UI
    function updateSettingsUI() {
        Object.keys(settings).forEach(key => {
            if (elements[key]) {
                if (elements[key].type === 'checkbox') {
                    elements[key].checked = settings[key];
                } else {
                    elements[key].value = settings[key];
                }
            }
        });
    }

    // Debounced save settings
    const debouncedSaveSettings = debounce(saveSettings, 1000);

    // Save settings to storage
    async function saveSettings() {
        try {
            await chrome.storage.sync.set(settings);

            // Notify background script
            chrome.runtime.sendMessage({
                type: 'SETTINGS_UPDATED',
                settings: settings
            });

        } catch (error) {
            console.error('Error saving settings:', error);
            showError('Failed to save settings');
        }
    }

    // Save all settings with confirmation
    async function saveAllSettings() {
        try {
            await saveSettings();
            showSuccess('Settings saved successfully');
        } catch (error) {
            showError('Failed to save settings');
        }
    }

    // Load filter lists
    async function loadFilterLists() {
        try {
            const response = await fetch(chrome.runtime.getURL('assets/blocklist-sources.json'));
            const sources = await response.json();

            // Get enabled filter lists from storage
            const result = await chrome.storage.sync.get(['enabledFilters']);
            const enabledFilters = result.enabledFilters || {};

            // Merge sources with enabled status
            filterLists = Object.keys(sources).reduce((acc, key) => {
                acc[key] = {
                    ...sources[key],
                    enabled: enabledFilters[key] !== false && sources[key].enabled
                };
                return acc;
            }, {});

            renderFilterLists();
        } catch (error) {
            console.error('Error loading filter lists:', error);
            showError('Failed to load filter lists');
        }
    }

    // Render filter lists
    function renderFilterLists() {
        const categories = {
            essential: ['easylist', 'easyprivacy', 'ublock-unbreak', 'ublock-badware'],
            privacy: ['ublock-privacy', 'disconnect-tracking', 'adguard-tracking'],
            annoyance: ['fanboy-annoyance', 'adguard-annoyances', 'adguard-social'],
            regional: Object.keys(filterLists).filter(key => filterLists[key].category === 'regional')
        };

        Object.keys(categories).forEach(category => {
            const container = elements[`${category}Filters`];
            if (container) {
                container.innerHTML = '';

                categories[category].forEach(filterId => {
                    const filter = filterLists[filterId];
                    if (filter) {
                        const filterElement = createFilterListElement(filterId, filter);
                        container.appendChild(filterElement);
                    }
                });
            }
        });
    }

    // Create filter list element
    function createFilterListElement(id, filter) {
        const div = document.createElement('div');
        div.className = 'filter-item';
        div.innerHTML = `
            <div class="filter-info">
                <div class="filter-name">${filter.name}</div>
                <div class="filter-description">${filter.description}</div>
                <div class="filter-meta">
                    <span>Rules: ${filter.ruleCount || 0}</span>
                    <span>Updated: ${filter.lastModified ? new Date(filter.lastModified).toLocaleDateString() : 'Never'}</span>
                </div>
            </div>
            <div class="filter-controls">
                <div class="filter-status ${filter.enabled ? 'enabled' : 'disabled'}">
                    ${filter.enabled ? 'Enabled' : 'Disabled'}
                </div>
                <div class="toggle-switch">
                    <input type="checkbox" id="filter-${id}" ${filter.enabled ? 'checked' : ''}>
                    <label for="filter-${id}" class="switch"></label>
                </div>
            </div>
        `;

        // Add toggle listener
        const toggle = div.querySelector('input[type="checkbox"]');
        toggle.addEventListener('change', () => {
            toggleFilterList(id, toggle.checked);
        });

        return div;
    }

    // Toggle filter list
    async function toggleFilterList(filterId, enabled) {
        try {
            filterLists[filterId].enabled = enabled;

            // Save to storage
            const enabledFilters = Object.keys(filterLists).reduce((acc, key) => {
                acc[key] = filterLists[key].enabled;
                return acc;
            }, {});

            await chrome.storage.sync.set({ enabledFilters });

            // Notify background script
            chrome.runtime.sendMessage({
                type: 'FILTER_LIST_TOGGLED',
                filterId: filterId,
                enabled: enabled
            });

            // Update UI
            renderFilterLists();

            showSuccess(`Filter list ${enabled ? 'enabled' : 'disabled'}`);
        } catch (error) {
            console.error('Error toggling filter list:', error);
            showError('Failed to update filter list');
        }
    }

    // Update all filter lists
    async function updateAllFilterLists() {
        try {
            showSuccess('Updating filter lists...');

            chrome.runtime.sendMessage({ type: 'UPDATE_ALL_FILTERS' }, (response) => {
                if (response && response.success) {
                    showSuccess('Filter lists updated successfully');
                    refreshFilterLists();
                } else {
                    showError('Failed to update filter lists');
                }
            });
        } catch (error) {
            console.error('Error updating filter lists:', error);
            showError('Failed to update filter lists');
        }
    }

    // Refresh filter lists
    function refreshFilterLists() {
        loadFilterLists();
    }

    // Show custom filter modal
    function showCustomFilterModal() {
        elements.customFilterModal.classList.add('show');
    }

    // Hide custom filter modal
    function hideCustomFilterModal() {
        elements.customFilterModal.classList.remove('show');
        elements.filterName.value = '';
        elements.filterUrl.value = '';
        elements.filterDescription.value = '';
    }

    // Add custom filter list
    async function addCustomFilterList() {
        const name = elements.filterName.value.trim();
        const url = elements.filterUrl.value.trim();
        const description = elements.filterDescription.value.trim();

        if (!name || !url) {
            showError('Name and URL are required');
            return;
        }

        try {
            // Validate URL
            new URL(url);

            // Add to filter lists
            const customId = `custom-${Date.now()}`;
            filterLists[customId] = {
                name: name,
                description: description,
                url: url,
                enabled: true,
                category: 'custom',
                custom: true
            };

            // Save to storage
            const result = await chrome.storage.sync.get(['customFilterLists']);
            const customLists = result.customFilterLists || {};
            customLists[customId] = filterLists[customId];

            await chrome.storage.sync.set({ customFilterLists: customLists });

            hideCustomFilterModal();
            refreshFilterLists();
            showSuccess('Custom filter list added');
        } catch (error) {
            console.error('Error adding custom filter list:', error);
            showError('Invalid URL or failed to add filter list');
        }
    }

    // Load custom rules
    async function loadCustomRules() {
        try {
            const result = await chrome.storage.sync.get(['customRules']);
            customRules = result.customRules || [];
            renderCustomRules();
        } catch (error) {
            console.error('Error loading custom rules:', error);
        }
    }

    // Render custom rules
    function renderCustomRules() {
        if (!elements.customRulesList) return;

        elements.customRulesList.innerHTML = '';

        if (customRules.length === 0) {
            elements.customRulesList.innerHTML = '<div class="rule-item">No custom rules defined</div>';
            return;
        }

        customRules.forEach((rule, index) => {
            const div = document.createElement('div');
            div.className = 'rule-item';
            div.innerHTML = `
                <div class="rule-text">${escapeHtml(rule)}</div>
                <div class="rule-actions">
                    <button class="btn btn-secondary" onclick="editCustomRule(${index})">Edit</button>
                    <button class="btn btn-danger" onclick="removeCustomRule(${index})">Remove</button>
                </div>
            `;
            elements.customRulesList.appendChild(div);
        });
    }

    // Add custom rule
    function addCustomRule() {
        const rule = elements.newRule.value.trim();

        if (!rule) {
            showError('Please enter a rule');
            return;
        }

        if (customRules.includes(rule)) {
            showError('Rule already exists');
            return;
        }

        customRules.push(rule);
        saveCustomRules();
        elements.newRule.value = '';
        renderCustomRules();
        showSuccess('Rule added');
    }

    // Remove custom rule
    window.removeCustomRule = function(index) {
        if (confirm('Are you sure you want to remove this rule?')) {
            customRules.splice(index, 1);
            saveCustomRules();
            renderCustomRules();
            showSuccess('Rule removed');
        }
    };

    // Edit custom rule
    window.editCustomRule = function(index) {
        const newRule = prompt('Edit rule:', customRules[index]);
        if (newRule !== null && newRule.trim() !== '') {
            customRules[index] = newRule.trim();
            saveCustomRules();
            renderCustomRules();
            showSuccess('Rule updated');
        }
    };

    // Save custom rules
    async function saveCustomRules() {
        try {
            await chrome.storage.sync.set({ customRules });

            chrome.runtime.sendMessage({
                type: 'CUSTOM_RULES_UPDATED',
                rules: customRules
            });
        } catch (error) {
            console.error('Error saving custom rules:', error);
            showError('Failed to save custom rules');
        }
    }

    // Import custom rules
    function importCustomRules() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.json';

        input.onchange = async (event) => {
            const file = event.target.files[0];
            if (!file) return;

            try {
                const text = await file.text();
                const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('!'));

                customRules.push(...lines);
                saveCustomRules();
                renderCustomRules();
                showSuccess(`Imported ${lines.length} rules`);
            } catch (error) {
                showError('Failed to import rules');
            }
        };

        input.click();
    }

    // Export custom rules
    function exportCustomRules() {
        const content = customRules.join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'chrome-adblock-custom-rules.txt';
        a.click();

        URL.revokeObjectURL(url);
        showSuccess('Rules exported');
    }

    // Validate custom rules
    function validateCustomRules() {
        const invalid = [];

        customRules.forEach((rule, index) => {
            if (!isValidRule(rule)) {
                invalid.push(`Line ${index + 1}: ${rule}`);
            }
        });

        if (invalid.length === 0) {
            showSuccess('All rules are valid');
        } else {
            showError(`Found ${invalid.length} invalid rules`);
        }
    }

    // Check if rule is valid
    function isValidRule(rule) {
        // Basic validation - can be enhanced
        if (rule.startsWith('##') || rule.startsWith('#@#')) {
            return true; // Cosmetic rule
        }

        if (rule.startsWith('@@')) {
            return true; // Exception rule
        }

        if (rule.includes('||') || rule.includes('*') || rule.includes('.')) {
            return true; // Network rule
        }

        return false;
    }

    // Load whitelist
    async function loadWhitelist() {
        try {
            const result = await chrome.storage.sync.get(['whitelist']);
            whitelistedSites = result.whitelist || [];
            renderWhitelist();
        } catch (error) {
            console.error('Error loading whitelist:', error);
        }
    }

    // Render whitelist
    function renderWhitelist() {
        if (!elements.whitelistList) return;

        elements.whitelistList.innerHTML = '';

        if (whitelistedSites.length === 0) {
            elements.whitelistList.innerHTML = '<div class="whitelist-item">No whitelisted sites</div>';
            return;
        }

        whitelistedSites.forEach((site, index) => {
            const div = document.createElement('div');
            div.className = 'whitelist-item';
            div.innerHTML = `
                <div class="whitelist-domain">${escapeHtml(site)}</div>
                <div class="whitelist-actions">
                    <button class="btn btn-danger" onclick="removeWhitelistSite(${index})">Remove</button>
                </div>
            `;
            elements.whitelistList.appendChild(div);
        });
    }

    // Add whitelist site
    function addWhitelistSite() {
        const site = elements.newWhitelistSite.value.trim();

        if (!site) {
            showError('Please enter a domain');
            return;
        }

        if (whitelistedSites.includes(site)) {
            showError('Domain already whitelisted');
            return;
        }

        whitelistedSites.push(site);
        saveWhitelist();
        elements.newWhitelistSite.value = '';
        renderWhitelist();
        showSuccess('Site whitelisted');
    }

    // Remove whitelist site
    window.removeWhitelistSite = function(index) {
        if (confirm('Are you sure you want to remove this site from the whitelist?')) {
            whitelistedSites.splice(index, 1);
            saveWhitelist();
            renderWhitelist();
            showSuccess('Site removed from whitelist');
        }
    };

    // Save whitelist
    async function saveWhitelist() {
        try {
            await chrome.storage.sync.set({ whitelist: whitelistedSites });

            chrome.runtime.sendMessage({
                type: 'WHITELIST_UPDATED',
                whitelist: whitelistedSites
            });
        } catch (error) {
            console.error('Error saving whitelist:', error);
            showError('Failed to save whitelist');
        }
    }

    // Load statistics
    async function loadStatistics() {
        try {
            const result = await chrome.storage.sync.get(['statistics']);
            statistics = result.statistics || {
                blockedToday: 0,
                blockedTotal: 0
            };
            updateStatisticsUI();
        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    // Update statistics UI
    function updateStatisticsUI() {
        if (elements.totalBlocked) {
            elements.totalBlocked.textContent = formatNumber(statistics.blockedTotal || 0);
        }
        if (elements.todayBlocked) {
            elements.todayBlocked.textContent = formatNumber(statistics.blockedToday || 0);
        }
        if (elements.averageDaily) {
            elements.averageDaily.textContent = formatNumber(Math.round((statistics.blockedTotal || 0) / 30));
        }
        if (elements.filterRules) {
            elements.filterRules.textContent = formatNumber(Object.keys(filterLists).length);
        }
    }

    // Refresh statistics
    function refreshStatistics() {
        loadStatistics();
    }

    // Reset statistics
    function resetStatistics() {
        if (confirm('Are you sure you want to reset all statistics?')) {
            chrome.runtime.sendMessage({ type: 'RESET_STATISTICS' }, (response) => {
                if (response && response.success) {
                    loadStatistics();
                    showSuccess('Statistics reset');
                } else {
                    showError('Failed to reset statistics');
                }
            });
        }
    }

    // Export statistics
    function exportStatistics() {
        const data = {
            statistics: statistics,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'chrome-adblock-statistics.json';
        a.click();

        URL.revokeObjectURL(url);
        showSuccess('Statistics exported');
    }

    // Backup settings
    function backupSettings() {
        const data = {
            settings: settings,
            filterLists: filterLists,
            customRules: customRules,
            whitelistedSites: whitelistedSites,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'chrome-adblock-backup.json';
        a.click();

        URL.revokeObjectURL(url);
        showSuccess('Settings backed up');
    }

    // Restore settings
    function restoreSettings(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (data.settings) settings = data.settings;
                if (data.customRules) customRules = data.customRules;
                if (data.whitelistedSites) whitelistedSites = data.whitelistedSites;

                await saveSettings();
                await saveCustomRules();
                await saveWhitelist();

                updateSettingsUI();
                renderCustomRules();
                renderWhitelist();

                showSuccess('Settings restored');
            } catch (error) {
                showError('Invalid backup file');
            }
        };
        reader.readAsText(file);
    }

    // Export all settings
    function exportAllSettings() {
        backupSettings();
    }

    // Import all settings
    function importAllSettings(event) {
        restoreSettings(event);
    }

    // Reset functions
    function resetFilterLists() {
        if (confirm('Are you sure you want to reset all filter lists to defaults?')) {
            chrome.runtime.sendMessage({ type: 'RESET_FILTER_LISTS' }, (response) => {
                if (response && response.success) {
                    loadFilterLists();
                    showSuccess('Filter lists reset');
                } else {
                    showError('Failed to reset filter lists');
                }
            });
        }
    }

    function resetCustomRules() {
        if (confirm('Are you sure you want to remove all custom rules?')) {
            customRules = [];
            saveCustomRules();
            renderCustomRules();
            showSuccess('Custom rules reset');
        }
    }

    function resetAllSettings() {
        if (confirm('Are you sure you want to reset ALL settings to defaults? This cannot be undone.')) {
            chrome.storage.sync.clear(() => {
                chrome.storage.local.clear(() => {
                    showSuccess('All settings reset. Please reload the page.');
                    setTimeout(() => location.reload(), 2000);
                });
            });
        }
    }

    // External links
    function openHelp(event) {
        event.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/your-repo/chrome-adblock/wiki' });
    }

    function reportBug(event) {
        event.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/your-repo/chrome-adblock/issues' });
    }

    function openGitHub(event) {
        event.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/your-repo/chrome-adblock' });
    }

    // Utility functions
    function showSuccess(message) {
        if (elements.successText) {
            elements.successText.textContent = message;
            elements.successMessage.classList.add('show');
            setTimeout(() => {
                elements.successMessage.classList.remove('show');
            }, 3000);
        }
    }

    function showError(message) {
        if (elements.errorText) {
            elements.errorText.textContent = message;
            elements.errorMessage.classList.add('show');
            setTimeout(() => {
                elements.errorMessage.classList.remove('show');
            }, 5000);
        }
    }

    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
