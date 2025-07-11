// Chrome AdBlock - Script Blocker
// Prevents execution of ad-related JavaScript and tracking scripts

(function() {
    'use strict';

    // Prevent multiple injections
    if (window.chromeAdBlockScriptBlocker) {
        return;
    }
    window.chromeAdBlockScriptBlocker = true;

    // Script blocker state
    let isEnabled = true;
    let blockedScripts = 0;
    let allowedScripts = 0;

    // Known ad and tracking script patterns
    const blockedScriptPatterns = [
        // Google Ads and Analytics
        'googleadservices.com',
        'googlesyndication.com',
        'doubleclick.net',
        'google-analytics.com/analytics.js',
        'googletagmanager.com/gtag',
        'googletagservices.com',

        // Facebook tracking
        'facebook.net/en_US/fbevents.js',
        'facebook.com/tr',
        'connect.facebook.net',

        // Amazon ads
        'amazon-adsystem.com',
        'amazonadaptive.com',

        // Other ad networks
        'outbrain.com',
        'taboola.com',
        'criteo.com',
        'adsystem.com',
        'advertising.com',
        'adsense.com',
        'ads.yahoo.com',
        'scorecardresearch.com',
        'quantserve.com',
        'addthis.com',
        'sharethis.com',

        // Analytics and tracking
        'hotjar.com',
        'mixpanel.com',
        'segment.io',
        'intercom.io',
        'zendesk.com/embeds',
        'mouseflow.com',
        'crazyegg.com',
        'optimizely.com',

        // Ad blockers detection
        'blockadblock',
        'adblock-detector',
        'anti-adblock',

        // Crypto miners
        'coinhive.com',
        'crypto-loot.com',
        'coin-hive.com',
        'jsecoin.com',
        'webminepool.com',

        // Pop-up and redirect scripts
        'popads.net',
        'popcash.net',
        'propellerads.com',
        'revcontent.com',
        'mgid.com'
    ];

    // Inline script patterns to block
    const inlineScriptPatterns = [
        /googletag\s*\.\s*cmd/,
        /google_ad_client/,
        /googleAdSlot/,
        /adsense/i,
        /doubleclick/i,
        /facebook\.com\/tr/,
        /fbevents/,
        /gtag\s*\(/,
        /ga\s*\(/,
        /adsbygoogle/,
        /_gaq/,
        /dataLayer/,
        /outbrain/i,
        /taboola/i,
        /coinhive/i,
        /crypto-loot/i
    ];

    // Initialize script blocker
    function initialize() {
        console.log('Chrome AdBlock: Script blocker initializing...');

        // Block external scripts
        blockExternalScripts();

        // Block inline scripts
        blockInlineScripts();

        // Monitor dynamic script injection
        monitorDynamicScripts();

        // Override script creation methods
        overrideScriptMethods();

        // Set up message listener
        setupMessageListener();

        console.log('Chrome AdBlock: Script blocker initialized');
    }

    // Block external scripts by intercepting requests
    function blockExternalScripts() {
        // Override createElement to intercept script creation
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
            const element = originalCreateElement.call(this, tagName);

            if (tagName.toLowerCase() === 'script') {
                // Add property setter to intercept src assignment
                let originalSrc = '';
                Object.defineProperty(element, 'src', {
                    get: function() {
                        return originalSrc;
                    },
                    set: function(value) {
                        if (isEnabled && shouldBlockScript(value)) {
                            console.log('Chrome AdBlock: Blocked external script:', value);
                            blockedScripts++;
                            notifyScriptBlocked(value, 'external');
                            return; // Don't set the src
                        }
                        originalSrc = value;
                        element.setAttribute('src', value);
                        allowedScripts++;
                    }
                });
            }

            return element;
        };
    }

    // Block inline scripts
    function blockInlineScripts() {
        // Override innerHTML and textContent setters for script elements
        const originalInnerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
        const originalTextContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');

        if (originalInnerHTMLDescriptor) {
            Object.defineProperty(Element.prototype, 'innerHTML', {
                get: originalInnerHTMLDescriptor.get,
                set: function(value) {
                    if (this.tagName === 'SCRIPT' && isEnabled && shouldBlockInlineScript(value)) {
                        console.log('Chrome AdBlock: Blocked inline script via innerHTML');
                        blockedScripts++;
                        notifyScriptBlocked(value.substring(0, 100), 'inline');
                        return;
                    }
                    originalInnerHTMLDescriptor.set.call(this, value);
                }
            });
        }

        if (originalTextContentDescriptor) {
            Object.defineProperty(Node.prototype, 'textContent', {
                get: originalTextContentDescriptor.get,
                set: function(value) {
                    if (this.tagName === 'SCRIPT' && isEnabled && shouldBlockInlineScript(value)) {
                        console.log('Chrome AdBlock: Blocked inline script via textContent');
                        blockedScripts++;
                        notifyScriptBlocked(value.substring(0, 100), 'inline');
                        return;
                    }
                    originalTextContentDescriptor.set.call(this, value);
                }
            });
        }
    }

    // Monitor dynamic script injection
    function monitorDynamicScripts() {
        const observer = new MutationObserver((mutations) => {
            if (!isEnabled) return;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check for script elements
                            if (node.tagName === 'SCRIPT') {
                                handleDynamicScript(node);
                            }

                            // Check for script elements within added nodes
                            const scripts = node.querySelectorAll ? node.querySelectorAll('script') : [];
                            scripts.forEach(handleDynamicScript);
                        }
                    });
                }
            });
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // Handle dynamically added script elements
    function handleDynamicScript(scriptElement) {
        const src = scriptElement.src;
        const content = scriptElement.textContent || scriptElement.innerHTML;

        if (src && shouldBlockScript(src)) {
            console.log('Chrome AdBlock: Blocked dynamic external script:', src);
            scriptElement.remove();
            blockedScripts++;
            notifyScriptBlocked(src, 'dynamic-external');
        } else if (content && shouldBlockInlineScript(content)) {
            console.log('Chrome AdBlock: Blocked dynamic inline script');
            scriptElement.remove();
            blockedScripts++;
            notifyScriptBlocked(content.substring(0, 100), 'dynamic-inline');
        } else if (src || content) {
            allowedScripts++;
        }
    }

    // Override script creation methods
    function overrideScriptMethods() {
        // Override appendChild
        const originalAppendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function(child) {
            if (child.tagName === 'SCRIPT' && isEnabled) {
                const src = child.src;
                const content = child.textContent || child.innerHTML;

                if (src && shouldBlockScript(src)) {
                    console.log('Chrome AdBlock: Blocked script appendChild:', src);
                    blockedScripts++;
                    notifyScriptBlocked(src, 'appendChild');
                    return child; // Return without appending
                } else if (content && shouldBlockInlineScript(content)) {
                    console.log('Chrome AdBlock: Blocked inline script appendChild');
                    blockedScripts++;
                    notifyScriptBlocked(content.substring(0, 100), 'appendChild');
                    return child;
                }
            }
            return originalAppendChild.call(this, child);
        };

        // Override insertBefore
        const originalInsertBefore = Node.prototype.insertBefore;
        Node.prototype.insertBefore = function(newNode, referenceNode) {
            if (newNode.tagName === 'SCRIPT' && isEnabled) {
                const src = newNode.src;
                const content = newNode.textContent || newNode.innerHTML;

                if (src && shouldBlockScript(src)) {
                    console.log('Chrome AdBlock: Blocked script insertBefore:', src);
                    blockedScripts++;
                    notifyScriptBlocked(src, 'insertBefore');
                    return newNode;
                } else if (content && shouldBlockInlineScript(content)) {
                    console.log('Chrome AdBlock: Blocked inline script insertBefore');
                    blockedScripts++;
                    notifyScriptBlocked(content.substring(0, 100), 'insertBefore');
                    return newNode;
                }
            }
            return originalInsertBefore.call(this, newNode, referenceNode);
        };

        // Override eval (optional - can break legitimate functionality)
        /*
        const originalEval = window.eval;
        window.eval = function(code) {
            if (isEnabled && shouldBlockInlineScript(code)) {
                console.log('Chrome AdBlock: Blocked eval script');
                blockedScripts++;
                notifyScriptBlocked(code.substring(0, 100), 'eval');
                return;
            }
            return originalEval.call(this, code);
        };
        */

        // Override Function constructor
        const originalFunction = window.Function;
        window.Function = function(...args) {
            const code = args[args.length - 1];
            if (isEnabled && shouldBlockInlineScript(code)) {
                console.log('Chrome AdBlock: Blocked Function constructor script');
                blockedScripts++;
                notifyScriptBlocked(code.substring(0, 100), 'Function');
                return function() {}; // Return dummy function
            }
            return originalFunction.apply(this, args);
        };
    }

    // Check if external script should be blocked
    function shouldBlockScript(src) {
        if (!src) return false;

        return blockedScriptPatterns.some(pattern => {
            return src.toLowerCase().includes(pattern.toLowerCase());
        });
    }

    // Check if inline script should be blocked
    function shouldBlockInlineScript(content) {
        if (!content || content.trim().length === 0) return false;

        return inlineScriptPatterns.some(pattern => {
            return pattern.test(content);
        });
    }

    // Set up message listener
    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'TOGGLE_SCRIPT_BLOCKING':
                    isEnabled = message.enabled;
                    break;

                case 'GET_SCRIPT_STATS':
                    sendResponse({
                        blockedScripts: blockedScripts,
                        allowedScripts: allowedScripts
                    });
                    break;

                case 'ADD_SCRIPT_PATTERN':
                    if (message.pattern) {
                        blockedScriptPatterns.push(message.pattern);
                    }
                    break;

                case 'REMOVE_SCRIPT_PATTERN':
                    if (message.pattern) {
                        const index = blockedScriptPatterns.indexOf(message.pattern);
                        if (index > -1) {
                            blockedScriptPatterns.splice(index, 1);
                        }
                    }
                    break;

                default:
                    break;
            }
        });
    }

    // Notify background script about blocked script
    function notifyScriptBlocked(script, type) {
        const details = {
            script: script,
            type: type,
            url: window.location.href,
            timestamp: Date.now()
        };

        chrome.runtime.sendMessage({
            type: 'SCRIPT_BLOCKED',
            details: details
        }).catch(() => {
            // Ignore errors if background script is not available
        });
    }

    // Block specific tracking functions
    function blockTrackingFunctions() {
        // Block Google Analytics
        window.ga = window.ga || function() {};
        window.gtag = window.gtag || function() {};
        window._gaq = window._gaq || [];

        // Block Facebook Pixel
        window.fbq = window.fbq || function() {};

        // Block Google Tag Manager
        window.dataLayer = window.dataLayer || [];

        // Block common tracking objects
        window._gat = window._gat || {};
        window.__gaTracker = window.__gaTracker || function() {};

        // Block AdSense
        window.adsbygoogle = window.adsbygoogle || [];

        // Block OutBrain
        window.obApi = window.obApi || function() {};

        // Block Taboola
        window._taboola = window._taboola || [];

        console.log('Chrome AdBlock: Blocked tracking functions');
    }

    // Block web beacon (tracking pixel) requests
    function blockWebBeacons() {
        // Override Image constructor to block tracking pixels
        const originalImage = window.Image;
        window.Image = function() {
            const img = new originalImage();

            // Override src setter
            let originalSrc = '';
            Object.defineProperty(img, 'src', {
                get: function() {
                    return originalSrc;
                },
                set: function(value) {
                    if (isEnabled && shouldBlockScript(value)) {
                        console.log('Chrome AdBlock: Blocked tracking pixel:', value);
                        blockedScripts++;
                        notifyScriptBlocked(value, 'tracking-pixel');
                        return;
                    }
                    originalSrc = value;
                    img.setAttribute('src', value);
                }
            });

            return img;
        };

        // Copy static methods
        Object.setPrototypeOf(window.Image, originalImage);
        Object.setPrototypeOf(window.Image.prototype, originalImage.prototype);
    }

    // Block WebSocket connections to ad servers
    function blockAdWebSockets() {
        const originalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            if (isEnabled && shouldBlockScript(url)) {
                console.log('Chrome AdBlock: Blocked WebSocket connection:', url);
                blockedScripts++;
                notifyScriptBlocked(url, 'websocket');
                throw new Error('Connection blocked by Chrome AdBlock');
            }
            return new originalWebSocket(url, protocols);
        };

        // Copy static properties
        Object.setPrototypeOf(window.WebSocket, originalWebSocket);
        Object.setPrototypeOf(window.WebSocket.prototype, originalWebSocket.prototype);
    }

    // Initialize immediately to catch early scripts
    initialize();

    // Block tracking functions
    blockTrackingFunctions();

    // Block web beacons
    blockWebBeacons();

    // Block ad WebSockets
    blockAdWebSockets();

    // Re-initialize when DOM is ready to catch any missed scripts
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Chrome AdBlock: Script blocker re-initializing after DOM ready');
            // Additional initialization if needed
        });
    }

})();
