// Chrome AdBlock - Element Hider
// CSS-based cosmetic filtering for hiding ad elements

(function() {
    'use strict';

    // Prevent multiple injections
    if (window.chromeAdBlockElementHider) {
        return;
    }
    window.chromeAdBlockElementHider = true;

    // Element hider state
    let cosmeticRules = [];
    let injectedStyles = new Set();
    let styleElement = null;
    let isEnabled = true;

    // Common ad selectors that work across most sites
    const defaultSelectors = [
        // Generic ad containers
        '[id*="advertisement"]',
        '[class*="advertisement"]',
        '[id*="google_ads"]',
        '[class*="google_ads"]',
        '[id*="adsense"]',
        '[class*="adsense"]',
        '[data-ad-client]',
        '[data-ad-slot]',

        // Ad wrapper classes
        '.ad-container',
        '.ad-wrapper',
        '.ad-banner',
        '.ad-block',
        '.ad-content',
        '.ad-placeholder',
        '.ads-container',
        '.ads-wrapper',

        // Sponsored content
        '.sponsored',
        '.sponsored-content',
        '.promoted',
        '.promoted-content',
        '.promo',
        '.promotion',

        // Social media ads
        '[data-testid*="ad"]',
        '[aria-label*="Sponsored"]',
        '[aria-label*="Promoted"]',

        // Video ads
        '.video-ads',
        '.preroll-ads',
        '.midroll-ads',
        '.overlay-ads',

        // Sidebar and banner ads
        '.sidebar-ad',
        '.banner-ad',
        '.header-ad',
        '.footer-ad',
        '.content-ad',

        // Popup and modal ads
        '.popup-ad',
        '.modal-ad',
        '.overlay-ad',
        '.interstitial-ad',

        // Newsletter and subscription prompts
        '.newsletter-signup[class*="popup"]',
        '.subscription-popup',
        '.email-signup-modal',

        // Cookie banners (optional)
        // '.cookie-banner',
        // '.cookie-notice',
        // '.gdpr-banner',

        // Tracking pixels
        'img[width="1"][height="1"]',
        'img[style*="width:1px"][style*="height:1px"]',

        // Common ad network selectors
        'iframe[src*="doubleclick"]',
        'iframe[src*="googleadservices"]',
        'iframe[src*="googlesyndication"]',
        'iframe[src*="amazon-adsystem"]',
        'div[id*="dfp-"]',
        'div[class*="dfp-"]'
    ];

    // Site-specific selectors for popular websites
    const siteSpecificSelectors = {
        'youtube.com': [
            '#player-ads',
            '.video-ads',
            '.ytp-ad-module',
            '.ytp-ad-overlay-container',
            '.ytd-promoted-sparkles-web-renderer',
            '.ytd-ad-slot-renderer',
            '.ytd-compact-promoted-video-renderer'
        ],
        'facebook.com': [
            '[data-pagelet="RightRail"]',
            '[aria-label*="Sponsored"]',
            'div[data-testid="fbfeed_story"]:has([aria-label*="Sponsored"])'
        ],
        'twitter.com': [
            '[data-testid="trend"] [role="button"]:has-text("Promoted")',
            '[data-testid="tweet"]:has([dir="auto"]:text-matches("Promoted"))'
        ],
        'reddit.com': [
            '.promotedlink',
            '.promoted',
            '[data-promoted="true"]'
        ],
        'instagram.com': [
            'article:has(span:text-matches("Sponsored"))',
            '[aria-label*="Sponsored"]'
        ]
    };

    // Initialize element hider
    function initialize() {
        console.log('Chrome AdBlock: Element hider initializing...');

        // Create style element for CSS injection
        createStyleElement();

        // Apply default cosmetic filters
        applyDefaultFilters();

        // Apply site-specific filters
        applySiteSpecificFilters();

        // Load custom cosmetic rules
        loadCustomRules();

        // Set up message listener
        setupMessageListener();

        console.log('Chrome AdBlock: Element hider initialized');
    }

    // Create style element for CSS injection
    function createStyleElement() {
        styleElement = document.createElement('style');
        styleElement.type = 'text/css';
        styleElement.id = 'chrome-adblock-cosmetic-filters';

        // Insert at the beginning of head to ensure high specificity
        if (document.head) {
            document.head.insertBefore(styleElement, document.head.firstChild);
        } else {
            // Fallback if head doesn't exist yet
            document.addEventListener('DOMContentLoaded', () => {
                if (document.head && !document.getElementById('chrome-adblock-cosmetic-filters')) {
                    document.head.insertBefore(styleElement, document.head.firstChild);
                }
            });
        }
    }

    // Apply default cosmetic filters
    function applyDefaultFilters() {
        const css = defaultSelectors.map(selector => `${selector} { display: none !important; }`).join('\n');
        injectCSS(css, 'default');
    }

    // Apply site-specific filters
    function applySiteSpecificFilters() {
        const hostname = window.location.hostname;
        const domain = hostname.replace(/^www\./, '');

        if (siteSpecificSelectors[domain]) {
            const css = siteSpecificSelectors[domain]
                .map(selector => `${selector} { display: none !important; }`)
                .join('\n');
            injectCSS(css, `site-${domain}`);
        }
    }

    // Load custom cosmetic rules from storage
    function loadCustomRules() {
        chrome.runtime.sendMessage({ type: 'GET_COSMETIC_RULES' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error('Chrome AdBlock: Error loading cosmetic rules:', chrome.runtime.lastError);
                return;
            }

            if (response && response.success) {
                cosmeticRules = response.rules || [];
                applyCustomRules();
            }
        });
    }

    // Apply custom cosmetic rules
    function applyCustomRules() {
        const hostname = window.location.hostname;
        const domain = hostname.replace(/^www\./, '');

        cosmeticRules.forEach(rule => {
            if (rule.type === 'cosmetic') {
                // Check if rule applies to current domain
                if (rule.domains.length === 0 ||
                    rule.domains.includes(domain) ||
                    rule.domains.includes(hostname)) {

                    if (rule.action === 'hide') {
                        const css = `${rule.selector} { display: none !important; }`;
                        injectCSS(css, `custom-${rule.id}`);
                    } else if (rule.action === 'unhide') {
                        const css = `${rule.selector} { display: initial !important; }`;
                        injectCSS(css, `unhide-${rule.id}`);
                    }
                }
            }
        });
    }

    // Inject CSS into the page
    function injectCSS(css, ruleId) {
        if (!isEnabled || injectedStyles.has(ruleId)) {
            return;
        }

        if (styleElement) {
            styleElement.textContent += css + '\n';
            injectedStyles.add(ruleId);
        }
    }

    // Remove injected CSS
    function removeCSS(ruleId) {
        if (injectedStyles.has(ruleId)) {
            injectedStyles.delete(ruleId);
            // Rebuild style element
            rebuildStyleElement();
        }
    }

    // Rebuild style element from active rules
    function rebuildStyleElement() {
        if (!styleElement) return;

        let css = '';

        // Add default filters
        if (injectedStyles.has('default')) {
            css += defaultSelectors.map(selector => `${selector} { display: none !important; }`).join('\n') + '\n';
        }

        // Add site-specific filters
        const hostname = window.location.hostname;
        const domain = hostname.replace(/^www\./, '');
        const siteKey = `site-${domain}`;

        if (injectedStyles.has(siteKey) && siteSpecificSelectors[domain]) {
            css += siteSpecificSelectors[domain]
                .map(selector => `${selector} { display: none !important; }`)
                .join('\n') + '\n';
        }

        // Add custom rules
        cosmeticRules.forEach(rule => {
            const ruleKey = rule.action === 'hide' ? `custom-${rule.id}` : `unhide-${rule.id}`;

            if (injectedStyles.has(ruleKey) && rule.type === 'cosmetic') {
                if (rule.domains.length === 0 ||
                    rule.domains.includes(domain) ||
                    rule.domains.includes(hostname)) {

                    if (rule.action === 'hide') {
                        css += `${rule.selector} { display: none !important; }\n`;
                    } else if (rule.action === 'unhide') {
                        css += `${rule.selector} { display: initial !important; }\n`;
                    }
                }
            }
        });

        styleElement.textContent = css;
    }

    // Set up message listener
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'TOGGLE_COSMETIC_FILTERING':
                    isEnabled = message.enabled;
                    toggleCosmeticFiltering(message.enabled);
                    break;

                case 'UPDATE_COSMETIC_RULES':
                    cosmeticRules = message.rules || [];
                    refreshCosmeticFilters();
                    break;

                case 'ADD_COSMETIC_RULE':
                    addCosmeticRule(message.rule);
                    break;

                case 'REMOVE_COSMETIC_RULE':
                    removeCosmeticRule(message.ruleId);
                    break;

                case 'HIDE_ELEMENT':
                    if (message.selector) {
                        hideElementBySelector(message.selector);
                    }
                    break;

                case 'UNHIDE_ELEMENT':
                    if (message.selector) {
                        unhideElementBySelector(message.selector);
                    }
                    break;

                default:
                    break;
            }
        });
    }

    // Toggle cosmetic filtering
    function toggleCosmeticFiltering(enabled) {
        isEnabled = enabled;

        if (enabled) {
            // Re-apply all filters
            rebuildStyleElement();
        } else {
            // Remove all cosmetic filters
            if (styleElement) {
                styleElement.textContent = '';
            }
        }
    }

    // Refresh cosmetic filters
    function refreshCosmeticFilters() {
        injectedStyles.clear();
        if (styleElement) {
            styleElement.textContent = '';
        }

        if (isEnabled) {
            applyDefaultFilters();
            applySiteSpecificFilters();
            applyCustomRules();
        }
    }

    // Add new cosmetic rule
    function addCosmeticRule(rule) {
        cosmeticRules.push(rule);

        const hostname = window.location.hostname;
        const domain = hostname.replace(/^www\./, '');

        // Apply rule if it matches current domain
        if (rule.domains.length === 0 ||
            rule.domains.includes(domain) ||
            rule.domains.includes(hostname)) {

            if (rule.action === 'hide') {
                const css = `${rule.selector} { display: none !important; }`;
                injectCSS(css, `custom-${rule.id}`);
            } else if (rule.action === 'unhide') {
                const css = `${rule.selector} { display: initial !important; }`;
                injectCSS(css, `unhide-${rule.id}`);
            }
        }
    }

    // Remove cosmetic rule
    function removeCosmeticRule(ruleId) {
        cosmeticRules = cosmeticRules.filter(rule => rule.id !== ruleId);
        removeCSS(`custom-${ruleId}`);
        removeCSS(`unhide-${ruleId}`);
    }

    // Hide element by selector
    function hideElementBySelector(selector) {
        const css = `${selector} { display: none !important; }`;
        const ruleId = `manual-${Date.now()}`;
        injectCSS(css, ruleId);
    }

    // Unhide element by selector
    function unhideElementBySelector(selector) {
        const css = `${selector} { display: initial !important; }`;
        const ruleId = `manual-unhide-${Date.now()}`;
        injectCSS(css, ruleId);
    }

    // Advanced element hiding with procedural filters
    function applyProceduralFilters() {
        // :has() pseudo-selector polyfill for browsers that don't support it
        const hasElements = document.querySelectorAll('[class*="ad"]:has(img)');
        hasElements.forEach(element => {
            if (element.querySelector('img')) {
                element.style.display = 'none';
            }
        });

        // Text-based filtering
        const textAdElements = document.querySelectorAll('*');
        textAdElements.forEach(element => {
            const text = element.textContent;
            if (text && (text.includes('Sponsored') || text.includes('Advertisement'))) {
                // Find the ad container
                let adContainer = element;
                while (adContainer && adContainer !== document.body) {
                    if (adContainer.classList.contains('ad') ||
                        adContainer.id.includes('ad') ||
                        adContainer.getAttribute('data-testid')?.includes('ad')) {
                        adContainer.style.display = 'none';
                        break;
                    }
                    adContainer = adContainer.parentElement;
                }
            }
        });
    }

    // Monitor for dynamic content changes
    function startDynamicFiltering() {
        const observer = new MutationObserver((mutations) => {
            if (!isEnabled) return;

            let shouldReapply = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if new element contains ads
                            if (containsAdIndicators(node)) {
                                shouldReapply = true;
                                break;
                            }
                        }
                    }
                }
            });

            if (shouldReapply) {
                // Debounce re-application
                clearTimeout(window.cosmeticFilterTimeout);
                window.cosmeticFilterTimeout = setTimeout(() => {
                    applyProceduralFilters();
                }, 500);
            }
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // Check if element contains ad indicators
    function containsAdIndicators(element) {
        const adIndicators = ['ad', 'advertisement', 'sponsored', 'promo'];
        const className = element.className || '';
        const id = element.id || '';

        return adIndicators.some(indicator =>
            className.toLowerCase().includes(indicator) ||
            id.toLowerCase().includes(indicator)
        );
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initialize();
            startDynamicFiltering();
        });
    } else {
        initialize();
        startDynamicFiltering();
    }

    // Apply procedural filters after a short delay
    setTimeout(applyProceduralFilters, 1000);

})();
