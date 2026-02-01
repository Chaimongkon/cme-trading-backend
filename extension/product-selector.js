// CME QuikStrike Product Selector - Uses executeScript to click in iframe
// Selectors provided by user for QuikStrike product selection

(function () {
    'use strict';

    if (window.__cmeProductSelectorLoaded) return;
    window.__cmeProductSelectorLoaded = true;

    console.log('[CME Product Selector] Loaded on:', window.location.href);

    // Product selector indices (nth-child for each product, 1-based)
    const PRODUCT_SELECTORS = {
        gold: {
            assetClassIndex: 7,    // Metals (1-based: Agriculture=1, Crypto=2, Energy=3, Equity=4, FX=5, Rates=6, Metals=7)
            productFamilyIndex: 1, // Precious Metals
            productIndex: 1        // Gold (OG|GC)
        },
        silver: {
            assetClassIndex: 7,
            productFamilyIndex: 1,
            productIndex: 2        // Silver (SO|SI)
        },
        platinum: {
            assetClassIndex: 7,
            productFamilyIndex: 1,
            productIndex: 3        // Platinum (PO|PL)
        },
        palladium: {
            assetClassIndex: 7,
            productFamilyIndex: 1,
            productIndex: 4        // Palladium (PAO|PA)
        },
        soybeans: {
            assetClassIndex: 1,   // Agriculture
            productFamilyIndex: 3, // Oilseed
            productIndex: 1        // Soybeans
        },
        corn: {
            assetClassIndex: 1,
            productFamilyIndex: 2, // Grains
            productIndex: 1        // Corn
        }
    };

    // View selectors - actual IDs from the page
    const VIEW_SELECTORS = {
        intraday: {
            selector: '#MainContent_ucViewControl_IntegratedV2VExpectedRange_lbIntradayVolume',
            fallbackText: 'Intraday'
        },
        eod: {
            selector: '#MainContent_ucViewControl_IntegratedV2VExpectedRange_lbEODVolume',
            fallbackText: 'EOD'
        },
        oi: {
            selector: '#MainContent_ucViewControl_IntegratedV2VExpectedRange_lbOI',
            fallbackText: 'OI'
        },
        oichange: {
            selector: '#MainContent_ucViewControl_IntegratedV2VExpectedRange_lbOIChange',
            fallbackText: 'OI Change'
        },
        churn: {
            selector: '#MainContent_ucViewControl_IntegratedV2VExpectedRange_lbChurn',
            fallbackText: 'Churn'
        }
    };

    // Check for pending product selection
    async function checkPendingProduct() {
        try {
            const result = await chrome.storage.local.get('pendingProduct');
            if (result.pendingProduct) {
                const { key, view, timestamp } = result.pendingProduct;
                
                // Check if the pending request is still fresh (within 60 seconds)
                if (Date.now() - timestamp > 60000) {
                    console.log('[CME Product Selector] Pending product expired, clearing...');
                    await chrome.storage.local.remove('pendingProduct');
                    return;
                }

                console.log('[CME Product Selector] Found pending product:', key, 'view:', view);

                // Wait for QuikStrike iframe to load (can't check cross-origin, so use fixed delay)
                console.log('[CME Product Selector] Waiting for QuikStrike to load...');
                await new Promise(r => setTimeout(r, 3000));

                // Execute the click sequence for product selection
                await selectProductSequence(key);

                // Wait for product dropdown selection to complete
                await new Promise(r => setTimeout(r, 2500));

                // If a view is specified, click on that menu item
                if (view) {
                    console.log('[CME Product Selector] Selecting view:', view);
                    await selectViewSequence(view);
                }

                // Select expiration for today's date
                console.log('[CME Product Selector] Selecting expiration for today...');
                await new Promise(r => setTimeout(r, 1000));
                await selectTodayExpiration();

                // Clear the pending product
                await chrome.storage.local.remove('pendingProduct');
                console.log('[CME Product Selector] Selection complete!');
            }
        } catch (e) {
            console.log('[CME Product Selector] Error:', e.message);
        }
    }

    // Select expiration that matches today's date
    async function selectTodayExpiration() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'SELECT_TODAY_EXPIRATION'
            }, (response) => {
                console.log('[CME Product Selector] Expiration selection response:', response);
                resolve(response);
            });
        });
    }

    // Execute click sequence to select a view (Intraday, OI, OI Change)
    async function selectViewSequence(viewKey) {
        const viewConfig = VIEW_SELECTORS[viewKey];
        if (!viewConfig) {
            console.log('[CME Product Selector] Unknown view:', viewKey);
            return;
        }

        console.log('[CME Product Selector] Selecting view:', viewKey);

        // Use the specific selector for the view
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'CLICK_VIEW_IN_IFRAME',
                viewKey: viewKey,
                selector: viewConfig.selector,
                fallbackText: viewConfig.fallbackText
            }, (response) => {
                console.log('[CME Product Selector] View selection response:', response);
                resolve(response);
            });
        });
    }

    // Wait for an element to appear
    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const check = () => {
                // Check in main document
                let el = document.querySelector(selector);

                // Check in iframes
                if (!el) {
                    const iframes = document.querySelectorAll('iframe');
                    for (const iframe of iframes) {
                        try {
                            el = iframe.contentDocument?.querySelector(selector);
                            if (el) break;
                        } catch (e) {
                            // Cross-origin, can't access
                        }
                    }
                }

                if (el) {
                    resolve(el);
                } else if (Date.now() - startTime > timeout) {
                    reject(new Error('Element not found: ' + selector));
                } else {
                    setTimeout(check, 200);
                }
            };

            check();
        });
    }

    // Execute the click sequence to select a product
    async function selectProductSequence(productKey) {
        const selectors = PRODUCT_SELECTORS[productKey];
        if (!selectors) {
            console.log('[CME Product Selector] Unknown product:', productKey);
            return;
        }

        console.log('[CME Product Selector] Starting selection for:', productKey);

        // Build fallback texts based on product
        const fallbackTexts = {
            gold: { asset: 'Metals', family: 'Precious Metals', product: 'Gold' },
            silver: { asset: 'Metals', family: 'Precious Metals', product: 'Silver' },
            platinum: { asset: 'Metals', family: 'Precious Metals', product: 'Platinum' },
            palladium: { asset: 'Metals', family: 'Precious Metals', product: 'Palladium' },
            soybeans: { asset: 'Agriculture', family: 'Oilseed', product: 'Soybeans' },
            corn: { asset: 'Agriculture', family: 'Grains', product: 'Corn' }
        };
        const texts = fallbackTexts[productKey] || fallbackTexts.gold;

        // Need to use background script to executeScript in iframe
        // The dropdown has 3 columns: Asset Class → Product Family → Product
        console.log('[CME Product Selector] Sending CLICK_IN_IFRAME message to background...');
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({
                type: 'CLICK_IN_IFRAME',
                sequence: [
                    {
                        selector: '#ctl11_hlProductArrow',
                        delay: 800,
                        description: 'Open product dropdown'
                    },
                    {
                        // Asset Class column (e.g., Metals)
                        selector: `#ctl11_ucProductSelectorPopup_pnlProductSelectorPopup .groups a:nth-child(${selectors.assetClassIndex})`,
                        fallbackText: texts.asset,
                        delay: 600,
                        description: `Select asset class (${texts.asset})`
                    },
                    {
                        // Product Family column (e.g., Precious Metals)
                        selector: `#ctl11_ucProductSelectorPopup_pnlProductSelectorPopup .families a:nth-child(${selectors.productFamilyIndex})`,
                        fallbackText: texts.family,
                        delay: 600,
                        description: `Select product family (${texts.family})`
                    },
                    {
                        // Product column (e.g., Gold)
                        selector: `#ctl11_ucProductSelectorPopup_pnlProductSelectorPopup .products a:nth-child(${selectors.productIndex})`,
                        fallbackText: texts.product,
                        delay: 500,
                        description: `Select product (${texts.product})`
                    }
                ]
            }, (response) => {
                console.log('[CME Product Selector] Background response:', response);
                resolve(response);
            });
        });
    }

    // Listen for messages from sidepanel
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'SELECT_PRODUCT_NOW') {
            // Select product and optionally view
            (async () => {
                try {
                    await selectProductSequence(message.productKey);
                    
                    // Wait for product to load
                    await new Promise(r => setTimeout(r, 1500));
                    
                    // If a view is specified, select it
                    if (message.view) {
                        await selectViewSequence(message.view);
                    }
                    
                    sendResponse({ success: true });
                } catch (e) {
                    sendResponse({ success: false, error: e.message });
                }
            })();
            return true; // Keep channel open for async response
        }
        return true;
    });

    // Check on page load
    if (document.readyState === 'complete') {
        setTimeout(checkPendingProduct, 2000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(checkPendingProduct, 2000);
        });
    }

})();
