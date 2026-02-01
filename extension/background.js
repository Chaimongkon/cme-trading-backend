// CME QuikStrike Data Extractor - Background Service Worker
console.log('[Background] Service Worker loaded at', new Date().toISOString());

let latestData = null;
let settings = {
    autoRefresh: true,
    refreshInterval: 5,
    backendUrl: '',
    syncToBackend: false
};

// Load settings
chrome.storage.local.get(['settings', 'latestData'], (result) => {
    if (result.settings) settings = { ...settings, ...result.settings };
    if (result.latestData) latestData = result.latestData;
    setupAlarm();
});

function setupAlarm() {
    chrome.alarms.clear('refreshData');
    if (settings.autoRefresh) {
        const interval = Math.max(1, settings.refreshInterval);
        chrome.alarms.create('refreshData', {
            periodInMinutes: interval,
            delayInMinutes: interval
        });
    }
}

// Side Panel
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => { });

// Messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Received message:', message.type, 'from:', sender?.tab?.url?.substring(0, 50) || 'extension');
    
    switch (message.type) {
        case 'CHART_DATA':
            handleChartData(message.payload);
            sendResponse({ success: true });
            break;
        case 'GET_DATA':
            sendResponse({ data: latestData });
            break;
        case 'GET_SETTINGS':
            sendResponse({ settings });
            break;
        case 'UPDATE_SETTINGS':
            settings = { ...settings, ...message.payload };
            chrome.storage.local.set({ settings });
            setupAlarm();
            sendResponse({ success: true });
            break;
        case 'EXTRACT_FROM_ALL_FRAMES':
            extractFromAllFrames().then(r => sendResponse(r));
            return true;
        case 'CLICK_IN_IFRAME':
            console.log('[Background] CLICK_IN_IFRAME - sequence length:', message.sequence?.length, 'from tab:', sender?.tab?.id);
            clickSequenceInIframe(message.sequence, sender?.tab?.id).then(r => {
                console.log('[Background] CLICK_IN_IFRAME result:', r);
                sendResponse(r);
            }).catch(e => {
                console.error('[Background] CLICK_IN_IFRAME error:', e);
                sendResponse({ success: false, error: e.message });
            });
            return true;
        case 'CLICK_VIEW_IN_IFRAME':
            console.log('[Background] CLICK_VIEW_IN_IFRAME - view:', message.viewKey, 'from tab:', sender?.tab?.id);
            clickViewInIframe(message.viewKey, message.selector, message.fallbackText, sender?.tab?.id).then(r => {
                console.log('[Background] CLICK_VIEW_IN_IFRAME result:', r);
                sendResponse(r);
            });
            return true;
        case 'SELECT_TODAY_EXPIRATION':
            console.log('[Background] SELECT_TODAY_EXPIRATION from tab:', sender?.tab?.id);
            selectTodayExpiration(sender?.tab?.id).then(r => {
                console.log('[Background] SELECT_TODAY_EXPIRATION result:', r);
                sendResponse(r);
            });
            return true;
        case 'CLICK_VIEW_IN_TAB':
            // Click view in a specific tab (used by remote sync)
            console.log('[Background] CLICK_VIEW_IN_TAB - tabId:', message.tabId, 'view:', message.viewKey);
            clickViewInIframe(message.viewKey, message.selector, message.fallbackText, message.tabId).then(r => {
                console.log('[Background] CLICK_VIEW_IN_TAB result:', r);
                sendResponse(r);
            });
            return true;
        case 'SYNC_CALENDAR':
            syncCalendarToBackend(message.events);
            sendResponse({ success: true });
            break;
    }
    return true;
});

async function syncCalendarToBackend(events) {
    if (!settings.syncToBackend || !settings.backendUrl) return;

    // Construct calendar sync URL (assuming backendUrl is like http://localhost:3000/api/sync)
    // We need to replace /api/sync with /api/calendar/sync
    const calendarUrl = settings.backendUrl.replace('/api/sync', '/api/calendar/sync');

    try {
        await fetch(calendarUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ events })
        });
    } catch (e) {
        console.error("Calendar sync failed", e);
    }
}

// Select expiration that matches today's date
async function selectTodayExpiration(senderTabId = null) {
    try {
        let tabId = senderTabId;
        
        if (!tabId) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            tabId = tab?.id;
        }
        
        if (!tabId) return { success: false, error: 'No tab' };

        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        let qsFrame = frames.find(f => f.url.includes('quikstrike.net'));
        if (!qsFrame) {
            return { success: false, error: 'QuikStrike iframe not found' };
        }

        console.log('[Background] Selecting today expiration in frame:', qsFrame.frameId);

        // Execute script to find and click today's expiration
        const result = await chrome.scripting.executeScript({
            target: { tabId, frameIds: [qsFrame.frameId] },
            func: () => {
                // Format today's date as "DD Mon YYYY" (e.g., "26 Jan 2026")
                const now = new Date();
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const day = now.getDate().toString().padStart(2, '0');
                const month = months[now.getMonth()];
                const year = now.getFullYear();
                const todayStr = `${day} ${month} ${year}`;
                
                console.log('[Expiration Selector] Looking for date:', todayStr);
                
                // Find expiration link that contains today's date
                const allExpirations = document.querySelectorAll('a[id*="lbExpiration"]');
                let matchedLink = null;
                
                for (const link of allExpirations) {
                    if (link.textContent.includes(todayStr)) {
                        matchedLink = link;
                        break;
                    }
                }
                
                if (matchedLink) {
                    // Check if already selected
                    if (matchedLink.classList.contains('selected')) {
                        console.log('[Expiration Selector] Already selected:', matchedLink.textContent.trim().split('\n')[0]);
                        return { success: true, message: 'Already selected', contract: matchedLink.textContent.trim().split('\n')[0] };
                    }
                    
                    // Click to select
                    console.log('[Expiration Selector] Clicking:', matchedLink.textContent.trim().split('\n')[0]);
                    matchedLink.click();
                    return { success: true, clicked: matchedLink.textContent.trim().split('\n')[0] };
                }
                
                // No exact match - try to find closest future expiration
                console.log('[Expiration Selector] No exact match for today, looking for nearest...');
                
                // Get all expirations with their dates
                const expirationData = [];
                for (const link of allExpirations) {
                    const text = link.textContent.trim();
                    // Extract date from text (format: "CODE\n\nDD Mon YYYY")
                    const dateMatch = text.match(/(\d{2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
                    if (dateMatch) {
                        const [, d, m, y] = dateMatch;
                        const monthIndex = months.indexOf(m);
                        const expDate = new Date(parseInt(y), monthIndex, parseInt(d));
                        expirationData.push({ link, date: expDate, text: text.split('\n')[0] });
                    }
                }
                
                // Sort by date and find first future expiration
                expirationData.sort((a, b) => a.date - b.date);
                const futureExp = expirationData.find(e => e.date >= now);
                
                if (futureExp) {
                    if (futureExp.link.classList.contains('selected')) {
                        return { success: true, message: 'Nearest already selected', contract: futureExp.text };
                    }
                    console.log('[Expiration Selector] Clicking nearest:', futureExp.text);
                    futureExp.link.click();
                    return { success: true, clicked: futureExp.text };
                }
                
                return { success: false, error: 'No suitable expiration found' };
            },
            world: 'MAIN'
        });

        return result[0]?.result || { success: false, error: 'Script execution failed' };
    } catch (error) {
        console.error('[Background] selectTodayExpiration error:', error);
        return { success: false, error: error.message };
    }
}

// Click on view menu (Intraday, OI, OI Change) in QuikStrike iframe
async function clickViewInIframe(viewKey, selector, fallbackText, senderTabId = null) {
    try {
        let tabId = senderTabId;
        
        if (!tabId) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            tabId = tab?.id;
        }
        
        if (!tabId) return { success: false, error: 'No tab' };

        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        // Look for quikstrike.net iframe specifically
        let qsFrame = frames.find(f => f.url.includes('quikstrike.net'));
        if (!qsFrame) {
            return { success: false, error: 'QuikStrike iframe not found' };
        }

        console.log('[Background] Clicking view:', viewKey, 'in frame:', qsFrame.frameId);

        // Execute script to click the view link
        const clickResult = await chrome.scripting.executeScript({
            target: { tabId, frameIds: [qsFrame.frameId] },
            func: (specificSelector, searchText) => {
                // Try specific selector first
                let el = document.querySelector(specificSelector);
                
                if (el) {
                    console.log('[CME View Selector] Found by selector:', specificSelector);
                    el.click();
                    return { success: true, clicked: el.textContent?.trim() || specificSelector };
                }
                
                // Fallback: search by text
                const allLinks = document.querySelectorAll('a');
                for (const link of allLinks) {
                    const text = link.textContent?.trim();
                    if (text === searchText || text?.includes(searchText)) {
                        console.log('[CME View Selector] Found by text:', text);
                        link.click();
                        return { success: true, clicked: text };
                    }
                }
                
                return { success: false, error: 'View not found: ' + specificSelector + ' / ' + searchText };
            },
            args: [selector || '', fallbackText || ''],
            world: 'MAIN'
        });

        const result = clickResult[0]?.result;
        if (result?.success) {
            console.log('[Background] Clicked view:', result.clicked);
            return { success: true };
        }

        return { success: false, error: result?.error || 'Failed to click view' };
    } catch (error) {
        console.error('[Background] clickViewInIframe error:', error);
        return { success: false, error: error.message };
    }
}

// Execute click sequence in QuikStrike iframe
async function clickSequenceInIframe(sequence, senderTabId = null) {
    try {
        let tabId = senderTabId;
        
        // If no sender tab, try to get active tab
        if (!tabId) {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            tabId = tab?.id;
        }
        
        if (!tabId) return { success: false, error: 'No tab' };
        
        console.log('[Background] Using tab:', tabId);

        const frames = await chrome.webNavigation.getAllFrames({ tabId });
        console.log('[Background] All frames:', frames.map(f => ({ id: f.frameId, url: f.url?.substring(0, 60) })));
        
        // Look for quikstrike.net iframe specifically (not just 'quikstrike' in path)
        let qsFrame = frames.find(f => f.url.includes('quikstrike.net'));
        if (!qsFrame) {
            console.log('[Background] QuikStrike iframe not found, waiting...');
            // Wait and retry
            await new Promise(r => setTimeout(r, 2000));
            const frames2 = await chrome.webNavigation.getAllFrames({ tabId });
            qsFrame = frames2.find(f => f.url.includes('quikstrike.net'));
            if (!qsFrame) {
                return { success: false, error: 'QuikStrike iframe not found after retry' };
            }
        }

        console.log('[Background] Found QuikStrike frame:', qsFrame.frameId);

        for (let i = 0; i < sequence.length; i++) {
            const step = sequence[i];
            console.log(`[Background] Step ${i + 1}/${sequence.length}: ${step.description || step.selector}`);
            
            try {
                const result = await chrome.scripting.executeScript({
                    target: { tabId, frameIds: [qsFrame.frameId] },
                    func: (selector, fallbackText) => {
                        // Try selector first
                        let el = document.querySelector(selector);
                        
                        // If not found and fallbackText provided, try text matching
                        if (!el && fallbackText) {
                            const allLinks = document.querySelectorAll('a');
                            for (const link of allLinks) {
                                if (link.textContent?.trim() === fallbackText || 
                                    link.textContent?.includes(fallbackText)) {
                                    el = link;
                                    break;
                                }
                            }
                        }
                        
                        if (el) {
                            el.click();
                            return { success: true, clicked: el.textContent?.trim() || selector };
                        }
                        return { success: false, error: 'Element not found: ' + selector };
                    },
                    args: [step.selector, step.fallbackText || null],
                    world: 'MAIN'
                });
                
                const clickResult = result[0]?.result;
                if (clickResult?.success) {
                    console.log(`[Background] Clicked: ${clickResult.clicked}`);
                } else {
                    console.log(`[Background] Click failed: ${clickResult?.error}`);
                }
            } catch (e) {
                console.error(`[Background] Step error:`, e.message);
            }

            await new Promise(r => setTimeout(r, step.delay || 500));
        }

        return { success: true };
    } catch (error) {
        console.error('[Background] clickSequenceInIframe error:', error);
        return { success: false, error: error.message };
    }
}

// Extract data from all frames
async function extractFromAllFrames() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return { success: false, error: 'No tab' };

        const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });

        const qsFrame = frames.find(f => f.url.includes('quikstrike'));
        if (!qsFrame) {
            return { success: false, error: 'QuikStrike iframe not found' };
        }

        // Click refresh button in ALL frames
        let refreshClicked = false;

        for (const frame of frames) {
            try {
                const clickResult = await chrome.scripting.executeScript({
                    target: { tabId: tab.id, frameIds: [frame.frameId] },
                    func: () => {
                        const selectors = [
                            '#refreshButton',
                            'input[id="refreshButton"]',
                            'input[title="Refresh the current view"]',
                            'input[src*="Refresh"]',
                            '#ctl00_ctl13_refreshButton',
                            'input[name*="refreshButton"]'
                        ];

                        for (const sel of selectors) {
                            const btn = document.querySelector(sel);
                            if (btn) {
                                btn.click();
                                return { success: true, selector: sel };
                            }
                        }
                        return { success: false };
                    },
                    world: 'MAIN'
                });

                if (clickResult[0]?.result?.success) {
                    refreshClicked = true;
                    break;
                }
            } catch (e) { /* Skip inaccessible frames */ }
        }

        if (refreshClicked) {
            await new Promise(r => setTimeout(r, 2500));
        }

        // Extract data from quikstrike frames
        for (const frame of frames) {
            if (!frame.url.includes('quikstrike')) continue;

            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id, frameIds: [frame.frameId] },
                    func: extractHighchartsData,
                    world: 'MAIN'
                });

                const result = results[0]?.result;
                if (result?.success) {
                    handleChartData(result);
                    return { success: true, data: result };
                }
            } catch (e) { /* ignore */ }
        }

        return { success: false, error: 'No Highcharts found in frames' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Function to inject into page context
function extractHighchartsData() {
    try {
        if (typeof Highcharts === 'undefined') {
            return { success: false, error: 'Highcharts not found' };
        }

        const c = Highcharts.charts?.find(chart => chart && chart.series?.length > 0);
        if (!c) {
            return { success: false, error: 'No chart with data' };
        }

        const put = c.series.find(s => s.name === 'Put');
        const call = c.series.find(s => s.name === 'Call');
        const vol = c.series.find(s => s.name === 'Vol Settle');
        const ranges = c.series.find(s => s.name === 'Ranges');

        if (!put && !call) {
            return { success: false, error: 'No Put/Call series found' };
        }

        const title = c.title?.textStr || c.options?.title?.text || 'QuikStrike Data';

        // Get subtitle for summary
        const subtitle = c.subtitle?.textStr ||
            document.querySelector('.highcharts-subtitle')?.textContent || '';

        // Get Future price from plotLines
        let futurePrice = null;
        try {
            const plotLines = c.xAxis[0]?.plotLinesAndBands || [];
            const futurePlotLine = plotLines.find(p =>
                p.label?.textStr?.includes('Future') ||
                p.options?.label?.text?.includes('Future')
            );
            if (futurePlotLine) {
                futurePrice = futurePlotLine.options.value;
            }
        } catch (e) { /* ignore */ }

        // Build maps for each series using strike price as key
        const putMap = {};
        const callMap = {};
        const volMap = {};

        if (put) put.data.forEach(d => { if (d.x != null) putMap[d.x] = d.y; });
        if (call) call.data.forEach(d => { if (d.x != null) callMap[d.x] = d.y; });
        if (vol) vol.data.forEach(d => { if (d.x != null) volMap[d.x] = d.y; });

        // Get Ranges data from dataLabel
        const rangesData = [];
        if (ranges) {
            ranges.data.forEach(d => {
                const label = d.dataLabel?.textStr || d.dataLabel?.element?.textContent;
                if (d.x != null && d.x2 != null && label) {
                    rangesData.push({
                        start: Math.min(d.x, d.x2),
                        end: Math.max(d.x, d.x2),
                        label: parseFloat(label) || label
                    });
                }
            });
        }

        // Function to find range for strike
        const findRangeForStrike = (strike) => {
            for (const r of rangesData) {
                if (strike >= r.start && strike <= r.end) {
                    return r.label;
                }
            }
            return null;
        };

        // Combine all strike prices
        const allStrikes = new Set([
            ...Object.keys(putMap),
            ...Object.keys(callMap),
            ...Object.keys(volMap)
        ]);

        // Build table data matching by strike price
        const tableData = [];
        allStrikes.forEach(strike => {
            const s = Number(strike);
            const volValue = volMap[s];
            tableData.push({
                strike: s,
                put: putMap[s] ?? null,
                call: callMap[s] ?? null,
                volSettle: volValue != null ? (volValue * 100) : null,
                range: findRangeForStrike(s)
            });
        });

        return {
            success: true,
            data: [{
                title: title,
                subtitle: subtitle,
                futurePrice: futurePrice,
                tableData: tableData.sort((a, b) => a.strike - b.strike),
                series: {
                    Put: put?.data.map(d => ({ strike: d.x, value: d.y })) || [],
                    Call: call?.data.map(d => ({ strike: d.x, value: d.y })) || [],
                    'Vol Settle': vol?.data.map(d => ({ strike: d.x, value: d.y })) || [],
                    Ranges: ranges?.data.map(d => ({ strike: d.x, value: d.y })) || []
                },
                extractedAt: new Date().toISOString()
            }],
            pageUrl: window.location.href,
            extractedAt: new Date().toISOString()
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function handleChartData(payload) {
    latestData = payload;
    chrome.storage.local.set({ latestData: payload });

    // Sync to backend if enabled
    if (settings.syncToBackend && settings.backendUrl) {
        syncToBackend(payload);
    }
}

async function syncToBackend(data) {
    try {
        const response = await fetch(settings.backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

// Auto-refresh alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'refreshData') {
        extractFromAllFrames();
    }
});
