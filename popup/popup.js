// Chrome AdBlock - Popup JavaScript
// Handles user interface interactions and communication with background script

(function() {
    'use strict';

    // DOM elements
    let elements = {};

    // State variables
    let currentTab = null;
    let extensionStatus = {
        enabled: true,
        statistics: {
            blockedToday: 0,
            blockedTotal: 0
        }
    };

    // Initialize popup
    function initialize() {
        console.log('Chrome AdBlock: Popup initializing...');

        // Get DOM elements
        getElements();

        // Set up event listeners
        setupEventListeners();

        // Load current state
        loadExtensionState();

        // Get current tab info
        getCurrentTab();

        console.log('Chrome AdBlock: Popup initialized');
    }

    // Get DOM elements
    function getElements() {
        elements = {
            // Status elements
            statusIndicator: document.getElementById('statusIndicator'),
            statusDot: document.getElementById('statusDot'),

            // Toggle elements
            mainToggle: document.getElementById('mainToggle'),
            extensionToggle: document.getElementById('extensionToggle'),
            toggleLabel: document.getElementById('toggleLabel'),
            toggleSubtitle: document.getElementById('toggleSubtitle'),

            // Statistics elements
            blockedToday: document.getElementById('blockedToday'),
            blockedTotal: document.getElementById('blockedTotal'),

            // Site info elements
            siteInfo: document.getElementById('siteInfo'),
            siteUrl: document.getElementById('siteUrl'),
            siteStatus: document.getElementById('siteStatus'),
            siteStatusIcon: document.getElementById('siteStatusIcon'),
            siteStatusText: document.getElementById('siteStatusText'),

            // Action buttons
            whitelistBtn: document.getElementById('whitelistBtn'),
            whitelistText: document.getElementById('whitelistText'),

            // Quick action buttons
            settingsBtn: document.getElementById('settingsBtn'),
            statisticsBtn: document.getElementById('statisticsBtn'),
            refreshBtn: document.getElementById('refreshBtn'),

            // Messages and overlays
            loadingOverlay: document.getElementById('loadingOverlay'),
            errorMessage: document.getElementById('errorMessage'),
            errorText: document.getElementById('errorText'),
            errorClose: document.getElementById('errorClose'),
            successMessage: document.getElementById('successMessage'),
            successText: document.getElementById('successText'),
            successClose: document.getElementById('successClose'),

            // Context menu
            contextMenu: document.getElementById('contextMenu'),
            copyUrlBtn: document.getElementById('copyUrlBtn'),
            reportSiteBtn: document.getElementById('reportSiteBtn'),
            debugModeBtn: document.getElementById('debugModeBtn'),

            // Footer
            helpLink: document.getElementById('helpLink')
        };
    }

    // Set up event listeners
    function setupEventListeners() {
        // Main toggle
        elements.mainToggle.addEventListener('click', handleMainToggle);
        elements.extensionToggle.addEventListener('change', handleExtensionToggle);

        // Action buttons
        elements.whitelistBtn.addEventListener('click', handleWhitelistToggle);

        // Quick action buttons
        elements.settingsBtn.addEventListener('click', openSettings);
        elements.statisticsBtn.addEventListener('click', showStatistics);
        elements.refreshBtn.addEventListener('click', refreshFilters);

        // Message close buttons
        elements.errorClose.addEventListener('click', hideErrorMessage);
        elements.successClose.addEventListener('click', hideSuccessMessage);

        // Context menu
        elements.siteInfo.addEventListener('contextmenu', showContextMenu);
        elements.copyUrlBtn.addEventListener('click', copyCurrentUrl);
        elements.reportSiteBtn.addEventListener('click', reportSite);
        elements.debugModeBtn.addEventListener('click', toggleDebugMode);

        // Help link
        elements.helpLink.addEventListener('click', openHelp);

        // Hide context menu on click outside
        document.addEventListener('click', hideContextMenu);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeydown);
    }

    // Load extension state from background
    function loadExtensionState() {
        showLoading(true);

        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
            showLoading(false);

            if (chrome.runtime.lastError) {
                showError('Failed to load extension status');
                return;
            }

            if (response) {
                extensionStatus = response;
                updateUI();
            }
        });
    }

    // Get current tab information
    function getCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (chrome.runtime.lastError) {
                console.error('Error getting current tab:', chrome.runtime.lastError);
                return;
            }

            if (tabs && tabs[0]) {
                currentTab = tabs[0];
                updateSiteInfo();
                checkWhitelistStatus();
            }
        });
    }

    // Update UI based on current state
    function updateUI() {
        // Update status indicator
        updateStatusIndicator();

        // Update toggle state
        updateToggleState();

        // Update statistics
        updateStatistics();

        // Update site status
        updateSiteStatus();
    }

    // Update status indicator
    function updateStatusIndicator() {
        if (extensionStatus.enabled) {
            elements.statusDot.classList.remove('disabled');
        } else {
            elements.statusDot.classList.add('disabled');
        }
    }

    // Update toggle state
    function updateToggleState() {
        elements.extensionToggle.checked = extensionStatus.enabled;

        if (extensionStatus.enabled) {
            elements.toggleLabel.textContent = 'Enabled on this site';
            elements.toggleSubtitle.textContent = 'Blocking ads and trackers';
            document.querySelector('.popup-container').classList.remove('disabled');
        } else {
            elements.toggleLabel.textContent = 'Disabled on this site';
            elements.toggleSubtitle.textContent = 'Ads and trackers not blocked';
            document.querySelector('.popup-container').classList.add('disabled');
        }
    }

    // Update statistics display
    function updateStatistics() {
        const stats = extensionStatus.statistics || {};

        elements.blockedToday.textContent = formatNumber(stats.blockedToday || 0);
        elements.blockedTotal.textContent = formatNumber(stats.blockedTotal || 0);
    }

    // Update site information
    function updateSiteInfo() {
        if (!currentTab) return;

        try {
            const url = new URL(currentTab.url);
            elements.siteUrl.textContent = url.hostname;
        } catch (error) {
            elements.siteUrl.textContent = 'Invalid URL';
        }
    }

    // Update site status
    function updateSiteStatus() {
        if (!extensionStatus.enabled) {
            elements.siteStatus.className = 'site-status disabled';
            elements.siteStatusIcon.textContent = '⚠️';
            elements.siteStatusText.textContent = 'Disabled';
        } else {
            elements.siteStatus.className = 'site-status protected';
            elements.siteStatusIcon.textContent = '🛡️';
            elements.siteStatusText.textContent = 'Protected';
        }
    }

    // Check whitelist status for current site
    function checkWhitelistStatus() {
        if (!currentTab) return;

        chrome.runtime.sendMessage({
            type: 'GET_TAB_INFO',
            tabId: currentTab.id
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Error getting tab info:', chrome.runtime.lastError);
                return;
            }

            if (response && response.success) {
                updateWhitelistButton(response.isWhitelisted);
                if (response.isWhitelisted) {
                    elements.siteStatus.className = 'site-status whitelisted';
                    elements.siteStatusIcon.textContent = '⭐';
                    elements.siteStatusText.textContent = 'Whitelisted';
                }
            }
        });
    }

    // Update whitelist button state
    function updateWhitelistButton(isWhitelisted) {
        if (isWhitelisted) {
            elements.whitelistBtn.classList.add('active');
            elements.whitelistText.textContent = 'Remove from whitelist';
        } else {
            elements.whitelistBtn.classList.remove('active');
            elements.whitelistText.textContent = 'Whitelist this site';
        }
    }

    // Handle main toggle click
    function handleMainToggle(event) {
        // Toggle if clicked on the container but not on the switch itself
        if (!event.target.closest('.toggle-switch')) {
            elements.extensionToggle.checked = !elements.extensionToggle.checked;
            handleExtensionToggle();
        }
    }

    // Handle extension toggle
    function handleExtensionToggle() {
        const enabled = elements.extensionToggle.checked;

        showLoading(true);

        chrome.runtime.sendMessage({
            type: 'TOGGLE_EXTENSION',
            enabled: enabled
        }, (response) => {
            showLoading(false);

            if (chrome.runtime.lastError) {
                showError('Failed to update extension state');
                // Revert toggle state
                elements.extensionToggle.checked = !enabled;
                return;
            }

            if (response && response.success) {
                extensionStatus.enabled = enabled;
                updateUI();
                showSuccess(enabled ? 'Extension enabled' : 'Extension disabled');
            } else {
                showError(response?.error || 'Failed to update extension state');
                elements.extensionToggle.checked = !enabled;
            }
        });
    }

    // Handle whitelist toggle
    function handleWhitelistToggle() {
        if (!currentTab) return;

        const isCurrentlyWhitelisted = elements.whitelistBtn.classList.contains('active');
        const action = isCurrentlyWhitelisted ? 'REMOVE_FROM_WHITELIST' : 'WHITELIST_SITE';

        showLoading(true);

        chrome.runtime.sendMessage({
            type: 'GET_TAB_INFO',
            tabId: currentTab.id
        }, (response) => {
            if (response && response.success) {
                chrome.runtime.sendMessage({
                    type: action,
                    hostname: response.hostname
                }, (actionResponse) => {
                    showLoading(false);

                    if (chrome.runtime.lastError) {
                        showError('Failed to update whitelist');
                        return;
                    }

                    if (actionResponse && actionResponse.success) {
                        updateWhitelistButton(!isCurrentlyWhitelisted);
                        updateSiteStatus();
                        const message = isCurrentlyWhitelisted
                            ? 'Site removed from whitelist'
                            : 'Site added to whitelist';
                        showSuccess(message);
                    } else {
                        showError(actionResponse?.error || 'Failed to update whitelist');
                    }
                });
            } else {
                showLoading(false);
                showError('Failed to get site information');
            }
        });
    }

    // Open settings page
    function openSettings() {
        chrome.runtime.openOptionsPage();
        window.close();
    }

    // Show statistics (could open a detailed view)
    function showStatistics() {
        // For now, just show current stats in a message
        const stats = extensionStatus.statistics || {};
        const message = `Today: ${formatNumber(stats.blockedToday)}\nTotal: ${formatNumber(stats.blockedTotal)}`;
        showSuccess(message);
    }

    // Refresh filters
    function refreshFilters() {
        showLoading(true);

        chrome.runtime.sendMessage({ type: 'REFRESH_FILTERS' }, (response) => {
            showLoading(false);

            if (chrome.runtime.lastError) {
                showError('Failed to refresh filters');
                return;
            }

            showSuccess('Filters refreshed successfully');

            // Reload extension state
            setTimeout(loadExtensionState, 500);
        });
    }

    // Show context menu
    function showContextMenu(event) {
        event.preventDefault();

        const menu = elements.contextMenu;
        const rect = elements.siteInfo.getBoundingClientRect();

        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.left = `${rect.left}px`;
        menu.classList.add('show');
    }

    // Hide context menu
    function hideContextMenu() {
        elements.contextMenu.classList.remove('show');
    }

    // Copy current URL
    function copyCurrentUrl() {
        if (currentTab && currentTab.url) {
            navigator.clipboard.writeText(currentTab.url).then(() => {
                showSuccess('URL copied to clipboard');
            }).catch(() => {
                showError('Failed to copy URL');
            });
        }
        hideContextMenu();
    }

    // Report site issues
    function reportSite() {
        if (currentTab && currentTab.url) {
            const reportUrl = `https://github.com/your-repo/chrome-adblock/issues/new?title=Site Issue: ${encodeURIComponent(currentTab.url)}`;
            chrome.tabs.create({ url: reportUrl });
        }
        hideContextMenu();
    }

    // Toggle debug mode
    function toggleDebugMode() {
        chrome.runtime.sendMessage({ type: 'TOGGLE_DEBUG_MODE' }, (response) => {
            if (response && response.success) {
                showSuccess(response.enabled ? 'Debug mode enabled' : 'Debug mode disabled');
            }
        });
        hideContextMenu();
    }

    // Open help page
    function openHelp(event) {
        event.preventDefault();
        chrome.tabs.create({ url: 'https://github.com/your-repo/chrome-adblock/wiki' });
        window.close();
    }

    // Handle keyboard shortcuts
    function handleKeydown(event) {
        switch (event.key) {
            case 'Escape':
                hideContextMenu();
                hideErrorMessage();
                hideSuccessMessage();
                break;
            case ' ':
            case 'Enter':
                if (event.target === elements.mainToggle) {
                    event.preventDefault();
                    handleMainToggle(event);
                }
                break;
            case 'w':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    window.close();
                }
                break;
            case 's':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    openSettings();
                }
                break;
        }
    }

    // Show loading overlay
    function showLoading(show) {
        if (show) {
            elements.loadingOverlay.classList.add('show');
        } else {
            elements.loadingOverlay.classList.remove('show');
        }
    }

    // Show error message
    function showError(message) {
        elements.errorText.textContent = message;
        elements.errorMessage.classList.add('show');

        // Auto-hide after 5 seconds
        setTimeout(hideErrorMessage, 5000);
    }

    // Hide error message
    function hideErrorMessage() {
        elements.errorMessage.classList.remove('show');
    }

    // Show success message
    function showSuccess(message) {
        elements.successText.textContent = message;
        elements.successMessage.classList.add('show');

        // Auto-hide after 3 seconds
        setTimeout(hideSuccessMessage, 3000);
    }

    // Hide success message
    function hideSuccessMessage() {
        elements.successMessage.classList.remove('show');
    }

    // Format numbers for display
    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    // Listen for background script messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.type) {
            case 'EXTENSION_TOGGLED':
                extensionStatus.enabled = message.enabled;
                updateUI();
                break;

            case 'STATISTICS_UPDATED':
                extensionStatus.statistics = message.statistics;
                updateStatistics();
                break;

            case 'FILTER_UPDATE_COMPLETE':
                if (message.success) {
                    showSuccess(`Filter list updated: ${message.listName}`);
                } else {
                    showError(`Failed to update ${message.listName}: ${message.error}`);
                }
                break;

            default:
                break;
        }
    });

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
