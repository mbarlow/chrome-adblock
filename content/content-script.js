// Chrome AdBlock - Main Content Script
// Handles DOM manipulation and communication with background script

(function() {
    'use strict';

    // Prevent multiple injections
    if (window.chromeAdBlockInjected) {
        return;
    }
    window.chromeAdBlockInjected = true;

    // Content script state
    let isEnabled = true;
    let blockedElements = 0;
    let hiddenElements = 0;
    let observerActive = false;

    // DOM observer for dynamic content
    let mutationObserver = null;

    // Initialize content script
    function initialize() {
        console.log('Chrome AdBlock: Content script initializing...');

        // Get extension status
        getExtensionStatus();

        // Start monitoring DOM changes
        startDOMObserver();

        // Process existing elements
        processExistingElements();

        // Set up message listener
        setupMessageListener();

        console.log('Chrome AdBlock: Content script initialized');
    }

    // Get extension status from background
    function getExtensionStatus() {
        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Chrome AdBlock: Error getting status:', chrome.runtime.lastError);
                return;
            }

            if (response) {
                isEnabled = response.enabled;
                updateContentFiltering();
            }
        });
    }

    // Set up message listener for background communication
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'EXTENSION_TOGGLED':
                    isEnabled = message.enabled;
                    updateContentFiltering();
                    break;

                case 'REFRESH_FILTERS':
                    refreshContentFilters();
                    break;

                case 'GET_PAGE_STATS':
                    sendResponse({
                        blockedElements: blockedElements,
                        hiddenElements: hiddenElements,
                        url: window.location.href
                    });
                    break;

                default:
                    break;
            }
        });
    }

    // Update content filtering based on extension state
    function updateContentFiltering() {
        if (isEnabled) {
            startContentFiltering();
        } else {
            stopContentFiltering();
        }
    }

    // Start content filtering
    function startContentFiltering() {
        if (!observerActive) {
            startDOMObserver();
        }
        processExistingElements();
    }

    // Stop content filtering
    function stopContentFiltering() {
        if (mutationObserver) {
            mutationObserver.disconnect();
            observerActive = false;
        }
        restoreHiddenElements();
    }

    // Start DOM mutation observer
    function startDOMObserver() {
        if (mutationObserver) {
            mutationObserver.disconnect();
        }

        mutationObserver = new MutationObserver((mutations) => {
            if (!isEnabled) return;

            let shouldProcess = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            shouldProcess = true;
                            break;
                        }
                    }
                }
            });

            if (shouldProcess) {
                // Debounce processing to avoid excessive calls
                clearTimeout(window.adBlockProcessTimeout);
                window.adBlockProcessTimeout = setTimeout(() => {
                    processNewElements();
                }, 100);
            }
        });

        mutationObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        observerActive = true;
    }

    // Process existing elements on page
    function processExistingElements() {
        if (!isEnabled) return;

        // Process common ad containers
        processAdContainers();

        // Process iframes
        processIframes();

        // Process scripts
        processScripts();

        // Process images
        processImages();

        // Process links
        processLinks();
    }

    // Process newly added elements
    function processNewElements() {
        if (!isEnabled) return;

        // Find recently added elements that might be ads
        const recentElements = document.querySelectorAll(
            '[data-ad], [id*="ad"], [class*="ad"], [id*="banner"], [class*="banner"]'
        );

        recentElements.forEach(element => {
            if (!element.dataset.adBlockProcessed) {
                processElement(element);
            }
        });
    }

    // Process ad containers
    function processAdContainers() {
        const adSelectors = [
            '[id*="advertisement"]',
            '[class*="advertisement"]',
            '[id*="google_ads"]',
            '[class*="google_ads"]',
            '[id*="adsystem"]',
            '[class*="adsystem"]',
            '.ad-container',
            '.ad-wrapper',
            '.ad-banner',
            '.ad-block',
            '.sponsored',
            '.promoted',
            '[data-ad-client]',
            '[data-ad-slot]'
        ];

        adSelectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => processElement(element));
        });
    }

    // Process iframes
    function processIframes() {
        const iframes = document.querySelectorAll('iframe');

        iframes.forEach(iframe => {
            if (isAdFrame(iframe)) {
                processElement(iframe);
            }
        });
    }

    // Check if iframe is likely an ad
    function isAdFrame(iframe) {
        const src = iframe.src || '';
        const id = iframe.id || '';
        const className = iframe.className || '';

        // Common ad frame patterns
        const adPatterns = [
            'doubleclick',
            'googleadservices',
            'googlesyndication',
            'amazon-adsystem',
            'facebook.com/tr',
            'google.com/ads',
            'ads.yahoo.com',
            'advertising.com',
            'adsense'
        ];

        return adPatterns.some(pattern =>
            src.includes(pattern) ||
            id.includes(pattern) ||
            className.includes(pattern)
        );
    }

    // Process script elements
    function processScripts() {
        const scripts = document.querySelectorAll('script[src]');

        scripts.forEach(script => {
            if (isAdScript(script)) {
                processElement(script);
            }
        });
    }

    // Check if script is likely an ad script
    function isAdScript(script) {
        const src = script.src || '';

        const adScriptPatterns = [
            'doubleclick.net',
            'googleadservices.com',
            'googlesyndication.com',
            'amazon-adsystem.com',
            'facebook.net/en_US/fbevents.js',
            'google-analytics.com/analytics.js',
            'googletagmanager.com/gtag'
        ];

        return adScriptPatterns.some(pattern => src.includes(pattern));
    }

    // Process image elements
    function processImages() {
        const images = document.querySelectorAll('img');

        images.forEach(image => {
            if (isAdImage(image)) {
                processElement(image);
            }
        });
    }

    // Check if image is likely an ad
    function isAdImage(image) {
        const src = image.src || '';
        const alt = image.alt || '';
        const className = image.className || '';

        const adImagePatterns = [
            'advertisement',
            'google_ads',
            'doubleclick',
            'adsystem',
            'sponsored',
            'promo'
        ];

        return adImagePatterns.some(pattern =>
            src.includes(pattern) ||
            alt.includes(pattern) ||
            className.includes(pattern)
        );
    }

    // Process link elements
    function processLinks() {
        const links = document.querySelectorAll('a[href]');

        links.forEach(link => {
            if (isAdLink(link)) {
                processElement(link);
            }
        });
    }

    // Check if link is likely an ad
    function isAdLink(link) {
        const href = link.href || '';
        const className = link.className || '';
        const text = link.textContent || '';

        const adLinkPatterns = [
            'doubleclick.net',
            'googleadservices.com',
            'amazon.com/gp/product/ads',
            'facebook.com/tr',
            'outbrain.com',
            'taboola.com'
        ];

        const adTextPatterns = [
            'sponsored',
            'advertisement',
            'promoted',
            'ad'
        ];

        return adLinkPatterns.some(pattern => href.includes(pattern)) ||
               adTextPatterns.some(pattern =>
                   text.toLowerCase().includes(pattern) ||
                   className.toLowerCase().includes(pattern)
               );
    }

    // Process individual element
    function processElement(element) {
        if (!element || element.dataset.adBlockProcessed) {
            return;
        }

        // Mark as processed
        element.dataset.adBlockProcessed = 'true';

        // Hide element
        hideElement(element);

        // Increment counter
        hiddenElements++;

        // Notify background script
        notifyElementBlocked(element);
    }

    // Hide element
    function hideElement(element) {
        if (element.dataset.adBlockHidden === 'true') {
            return;
        }

        // Store original display style
        element.dataset.adBlockOriginalDisplay = element.style.display || '';
        element.dataset.adBlockHidden = 'true';

        // Hide element
        element.style.display = 'none !important';
        element.style.visibility = 'hidden !important';
        element.style.opacity = '0 !important';
        element.style.height = '0 !important';
        element.style.width = '0 !important';
    }

    // Restore hidden elements
    function restoreHiddenElements() {
        const hiddenElements = document.querySelectorAll('[data-ad-block-hidden="true"]');

        hiddenElements.forEach(element => {
            const originalDisplay = element.dataset.adBlockOriginalDisplay || '';
            element.style.display = originalDisplay;
            element.style.visibility = '';
            element.style.opacity = '';
            element.style.height = '';
            element.style.width = '';

            element.removeAttribute('data-ad-block-hidden');
            element.removeAttribute('data-ad-block-original-display');
        });

        hiddenElements = 0;
    }

    // Notify background script about blocked element
    function notifyElementBlocked(element) {
        const details = {
            tagName: element.tagName,
            className: element.className,
            id: element.id,
            src: element.src || '',
            href: element.href || '',
            url: window.location.href
        };

        chrome.runtime.sendMessage({
            type: 'BLOCKED_REQUEST',
            details: details
        }).catch(() => {
            // Ignore errors if background script is not available
        });
    }

    // Refresh content filters
    function refreshContentFilters() {
        // Reset counters
        blockedElements = 0;
        hiddenElements = 0;

        // Clear processed flags
        const processedElements = document.querySelectorAll('[data-ad-block-processed]');
        processedElements.forEach(element => {
            element.removeAttribute('data-ad-block-processed');
        });

        // Reprocess elements
        processExistingElements();
    }

    // Clean up empty ad containers
    function cleanupEmptyContainers() {
        const containers = document.querySelectorAll(
            '.ad-container, .ad-wrapper, [id*="ad-"], [class*="ad-"]'
        );

        containers.forEach(container => {
            if (container.children.length === 0 ||
                container.textContent.trim() === '') {
                hideElement(container);
            }
        });
    }

    // Periodically clean up empty containers
    setInterval(cleanupEmptyContainers, 5000);

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Re-initialize on navigation for single-page apps
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(initialize, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

})();
