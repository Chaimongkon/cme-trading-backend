// CME QuikStrike Data Extractor - Side Panel Script

document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const productNameEl = document.getElementById('productName');
    const volumeTypeEl = document.getElementById('volumeType');
    const lastUpdateEl = document.getElementById('lastUpdate');
    const connectionStatusEl = document.getElementById('connectionStatus');
    const tableBodyEl = document.getElementById('tableBody');
    const autoRefreshToggle = document.getElementById('autoRefreshToggle');
    const refreshIntervalEl = document.getElementById('refreshInterval');

    // Summary elements
    const summaryFutureEl = document.getElementById('summaryFuture');
    const summaryPutEl = document.getElementById('summaryPut');
    const summaryCallEl = document.getElementById('summaryCall');
    const summaryVolEl = document.getElementById('summaryVol');
    const summaryVolChgEl = document.getElementById('summaryVolChg');
    const summaryFutureChgEl = document.getElementById('summaryFutureChg');

    // Analysis elements
    const analysisSignalEl = document.getElementById('analysisSignal');
    const signalTypeEl = document.getElementById('signalType');
    const pcrValueEl = document.getElementById('pcrValue');
    const strengthFillEl = document.getElementById('strengthFill');
    const strengthPercentEl = document.getElementById('strengthPercent');
    const analysisDetailsEl = document.getElementById('analysisDetails');

    // Footer datetime
    const footerDatetimeEl = document.getElementById('footerDatetime');

    // Modal elements
    const customModal = document.getElementById('customModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const modalStatusList = document.getElementById('modalStatusList');
    const modalMessage = document.getElementById('modalMessage');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const toastContainer = document.getElementById('toastContainer');

    // Data Source Tabs
    const tabVolume = document.getElementById('tabVolume');
    const tabOI = document.getElementById('tabOI');
    const tabOIChange = document.getElementById('tabOIChange');
    const volIndicator = document.getElementById('volIndicator');
    const oiIndicator = document.getElementById('oiIndicator');
    const oiChgIndicator = document.getElementById('oiChgIndicator');

    // Buttons
    const refreshBtn = document.getElementById('refreshBtn');
    const refreshAllBtn = document.getElementById('refreshAllBtn');
    const helpBtn = document.getElementById('helpBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const syncBackendBtn = document.getElementById('syncBackendBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    // Trade Recommendation elements
    const tradeRecommendation = document.getElementById('tradeRecommendation');
    const tradeAction = document.getElementById('tradeAction');
    const tradeDetails = document.getElementById('tradeDetails');

    // Settings elements
    const settingsPanel = document.getElementById('settingsPanel');
    const backendUrlInput = document.getElementById('backendUrl');
    const refreshIntervalInput = document.getElementById('refreshIntervalInput');
    const autoSyncToggle = document.getElementById('autoSyncToggle');

    let currentData = null;
    let settings = {};

    // Data storage for Volume, OI, and OI Change
    let volumeData = null;
    let oiData = null;
    let oiChangeData = null;
    let activeSource = 'volume'; // 'volume', 'oi', or 'oichange'
    let lastFuturePrice = null; // Store last future price for S/R comparison

    // Product presets - navigate to CME page and auto-select
    const PRODUCTS = {
        gold: {
            name: 'Gold (OG|GC)',
            assetClass: 'Metals',
            productFamily: 'Precious Metals',
            product: 'Gold (OG|GC)'
        },
        silver: {
            name: 'Silver (SO|SI)',
            assetClass: 'Metals',
            productFamily: 'Precious Metals',
            product: 'Silver (SO|SI)'
        },
        soybeans: {
            name: 'Soybeans (OZS|ZS)',
            assetClass: 'Agriculture',
            productFamily: 'Oilseed',
            product: 'Soybeans (OZS|ZS)'
        },
        corn: {
            name: 'Corn (OZC|ZC)',
            assetClass: 'Agriculture',
            productFamily: 'Grains',
            product: 'Corn (OZC|ZC)'
        }
    };

    const CME_QUIKSTRIKE_URL = 'https://www.cmegroup.com/tools-information/quikstrike/vol2vol-expected-range.html';

    // Quick Open CME Buttons
    const openGoldBtn = document.getElementById('openGoldBtn');
    const openGoldOIBtn = document.getElementById('openGoldOIBtn');
    const openGoldOIChgBtn = document.getElementById('openGoldOIChgBtn');

    // Initialize
    await loadSettings();
    await loadData();
    await checkConnection();
    setupProductButtons();
    setupQuickOpenButtons();
    setupAnalysisToggle();
    setupDataSourceTabs();
    updateFooterTime();
    loadStoredData();

    // Reset analysis panel to expanded on first load (one-time)
    chrome.storage.local.get(['analysisDefaultSet'], (result) => {
        if (!result.analysisDefaultSet) {
            chrome.storage.local.set({
                analysisCollapsed: false,
                analysisDefaultSet: true
            });
        }
    });

    // Auto-refresh connection check every 5 seconds
    setInterval(checkConnection, 5000);
    // Update footer time every second
    setInterval(updateFooterTime, 1000);

    // Load stored Volume/OI/OI Change data from storage
    function loadStoredData() {
        chrome.storage.local.get(['volumeData', 'oiData', 'oiChangeData'], (result) => {
            if (result.volumeData) {
                volumeData = result.volumeData;
                updateTabIndicator('volume', volumeData);
            }
            if (result.oiData) {
                oiData = result.oiData;
                updateTabIndicator('oi', oiData);
            }
            if (result.oiChangeData) {
                oiChangeData = result.oiChangeData;
                updateTabIndicator('oichange', oiChangeData);
            }
            // Display active source data
            displayActiveSourceData();
        });
    }

    // Setup Data Source Tabs (Volume/OI/OI Change)
    function setupDataSourceTabs() {
        if (tabVolume) {
            tabVolume.addEventListener('click', () => switchDataSource('volume'));
        }
        if (tabOI) {
            tabOI.addEventListener('click', () => switchDataSource('oi'));
        }
        if (tabOIChange) {
            tabOIChange.addEventListener('click', () => switchDataSource('oichange'));
        }
    }

    // Switch between Volume, OI, and OI Change data
    function switchDataSource(source, skipRender = false) {
        activeSource = source;

        // Update tab styles
        tabVolume?.classList.toggle('active', source === 'volume');
        tabOI?.classList.toggle('active', source === 'oi');
        tabOIChange?.classList.toggle('active', source === 'oichange');

        // Display data for selected source (unless skipped to avoid recursion)
        if (!skipRender) {
            displayActiveSourceData();
        }
    }

    // Display data based on active source
    function displayActiveSourceData() {
        let data = null;
        let sourceName = '';

        if (activeSource === 'volume') {
            data = volumeData;
            sourceName = 'Intraday Volume';
        } else if (activeSource === 'oi') {
            data = oiData;
            sourceName = 'Open Interest (OI)';
        } else if (activeSource === 'oichange') {
            data = oiChangeData;
            sourceName = 'OI Change';
        }

        if (data) {
            currentData = data;
            renderData(data, false, true); // skipSwitch = true to prevent recursion
        } else {
            // Show message to switch to CME page and refresh
            tableBodyEl.innerHTML = `<tr><td colspan="5" class="no-data">
                กรุณาเปิดหน้า ${sourceName} แล้วกด Refresh
            </td></tr>`;
        }
    }

    // Update tab indicator with data summary
    function updateTabIndicator(source, data) {
        let indicator, tab;

        if (source === 'volume') {
            indicator = volIndicator;
            tab = tabVolume;
        } else if (source === 'oi') {
            indicator = oiIndicator;
            tab = tabOI;
        } else if (source === 'oichange') {
            indicator = oiChgIndicator;
            tab = tabOIChange;
        }

        if (indicator && data?.data?.[0]) {
            const chartData = data.data[0];
            const subtitle = chartData.subtitle || '';
            const summary = parseSummary(subtitle);

            // Show Put/Call ratio indicator
            const put = parseNumber(summary.put);
            const call = parseNumber(summary.call);
            if (put && call && call > 0) {
                const pcr = (put / call).toFixed(2);
                indicator.textContent = `${pcr}`;
            } else {
                indicator.textContent = '✓';
            }

            tab?.classList.add('has-data');
        }
    }

    // Update footer datetime
    function updateFooterTime() {
        if (footerDatetimeEl) {
            const now = new Date();
            footerDatetimeEl.textContent = now.toLocaleString('th-TH', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }
    }

    // Setup collapsible analysis panel
    function setupAnalysisToggle() {
        const analysisToggle = document.getElementById('analysisToggle');
        const analysisPanel = document.getElementById('analysisPanel');

        if (analysisToggle && analysisPanel) {
            // Default: expanded (not collapsed)
            // Only collapse if user explicitly set it before
            chrome.storage.local.get(['analysisCollapsed'], (result) => {
                // Default to expanded (false), only collapse if explicitly true
                if (result.analysisCollapsed === true) {
                    analysisPanel.classList.add('collapsed');
                } else {
                    analysisPanel.classList.remove('collapsed');
                }
            });

            analysisToggle.addEventListener('click', () => {
                analysisPanel.classList.toggle('collapsed');
                // Save state
                chrome.storage.local.set({
                    analysisCollapsed: analysisPanel.classList.contains('collapsed')
                });
            });
        }
    }

    // Setup product quick launch buttons - just opens CME QuikStrike page
    function setupProductButtons() {
        document.querySelectorAll('.product-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Just open the CME QuikStrike page
                chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                    if (!tab.url.includes('quikstrike') && !tab.url.includes('cmegroup.com/tools')) {
                        chrome.tabs.update(tab.id, { url: CME_QUIKSTRIKE_URL });
                    }
                });
                // Show message
                setConnectionStatus(false, 'เปิดหน้า QuikStrike แล้ว - เลือก product แล้วกด Refresh');
            });
        });
    }

    // Setup Quick Open CME buttons for Gold
    function setupQuickOpenButtons() {
        // Quick open Gold Intraday Volume
        openGoldBtn?.addEventListener('click', () => {
            openCMEWithProduct('gold', 'intraday');
        });

        // Quick open Gold Open Interest
        openGoldOIBtn?.addEventListener('click', () => {
            openCMEWithProduct('gold', 'oi');
        });

        // Quick open Gold OI Change
        openGoldOIChgBtn?.addEventListener('click', () => {
            openCMEWithProduct('gold', 'oichange');
        });
    }

    // Open CME QuikStrike page with specific product and view
    async function openCMEWithProduct(productKey, viewType) {
        // Store pending selection in chrome.storage
        await chrome.storage.local.set({
            pendingProduct: {
                key: productKey,
                view: viewType,
                timestamp: Date.now()
            }
        });

        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Check if already on CME page
        if (tab?.url?.includes('cmegroup.com/tools-information/quikstrike')) {
            // Already on QuikStrike - just send message to select product
            setConnectionStatus(false, `กำลังเลือก Gold - ${viewType}...`);

            // Send message to content script to select product
            chrome.tabs.sendMessage(tab.id, {
                type: 'SELECT_PRODUCT_NOW',
                productKey: productKey,
                view: viewType
            }, (response) => {
                if (chrome.runtime.lastError) {
                    // Fallback: reload the page
                    chrome.tabs.update(tab.id, { url: CME_QUIKSTRIKE_URL });
                    setConnectionStatus(false, 'กำลังโหลดหน้า QuikStrike...');
                }
            });
        } else {
            // Open the CME QuikStrike page
            chrome.tabs.update(tab.id, { url: CME_QUIKSTRIKE_URL });
            setConnectionStatus(false, `กำลังเปิด Gold - ${viewType}...`);
        }

        // Show toast notification
        showToast('info', '🥇 เปิด Gold', `กำลังโหลด ${viewType === 'intraday' ? 'Intraday Volume' : viewType === 'oi' ? 'Open Interest' : 'OI Change'}...`);
    }

    // Load settings from background
    async function loadSettings() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
                if (response?.settings) {
                    settings = response.settings;
                    autoRefreshToggle.checked = settings.autoRefresh;
                    refreshIntervalEl.textContent = `${settings.refreshInterval} min`;
                    backendUrlInput.value = settings.backendUrl || '';
                    refreshIntervalInput.value = settings.refreshInterval;
                    autoSyncToggle.checked = settings.syncToBackend;
                }
                resolve();
            });
        });
    }

    // Load data from background
    async function loadData() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_DATA' }, (response) => {
                if (response?.data) {
                    currentData = response.data;
                    renderData(currentData);
                }
                resolve();
            });
        });
    }

    // Check connection to QuikStrike page
    async function checkConnection() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (tab?.url?.includes('cmegroup.com')) {
                // Try to send message to all frames
                chrome.tabs.sendMessage(tab.id, { type: 'PING' }, { frameId: 0 }, (response) => {
                    if (chrome.runtime.lastError) {
                        // Try sending to all frames
                        chrome.runtime.sendMessage({ type: 'CHECK_FRAMES', tabId: tab.id }, (bgResponse) => {
                            if (bgResponse?.hasHighcharts) {
                                setConnectionStatus(true, 'Connected (via iframe)');
                            } else {
                                setConnectionStatus(false, 'Content script loading... refresh page');
                            }
                        });
                    } else if (response?.pong) {
                        if (response.hasHighcharts) {
                            setConnectionStatus(true, 'Connected to QuikStrike');
                        } else {
                            setConnectionStatus(false, 'QuikStrike chart not found');
                        }
                    }
                });
            } else {
                setConnectionStatus(false, 'กรุณาเปิดหน้า CME QuikStrike');
            }
        } catch (error) {
            setConnectionStatus(false, 'Error checking connection');
        }
    }

    // ========== Custom Modal & Toast Functions ==========

    function showModal(options) {
        const {
            icon = '🎉',
            title = 'สำเร็จ!',
            statusItems = [],
            message = '',
            buttonText = 'ตกลง',
            buttonClass = 'modal-btn-primary'
        } = options;

        modalIcon.textContent = icon;
        modalTitle.textContent = title;

        // Build status list
        modalStatusList.innerHTML = '';
        if (statusItems.length > 0) {
            modalBody.style.display = 'block';
            statusItems.forEach(item => {
                const li = document.createElement('li');
                li.className = `modal-status-item ${item.status || ''}`;
                li.innerHTML = `
                    <span class="status-icon">${item.icon || ''}</span>
                    <span>${item.text}</span>
                `;
                modalStatusList.appendChild(li);
            });
        } else {
            modalBody.style.display = 'none';
        }

        modalMessage.innerHTML = message;
        modalMessage.style.display = message ? 'block' : 'none';

        modalCloseBtn.textContent = buttonText;
        modalCloseBtn.className = `modal-btn ${buttonClass}`;

        customModal.classList.add('show');
    }

    function hideModal() {
        customModal.classList.remove('show');
    }

    // Modal close handlers
    modalCloseBtn?.addEventListener('click', hideModal);
    customModal?.addEventListener('click', (e) => {
        if (e.target === customModal) hideModal();
    });

    function showToast(type, title, message, duration = 4000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `
            <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        toastContainer.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // Set connection status UI
    function setConnectionStatus(connected, message) {
        connectionStatusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        connectionStatusEl.querySelector('.text').textContent = message;
    }

    // Parse subtitle to extract summary values
    // Format can be HTML: "<span>Put:</span> 3,739&nbsp;&nbsp;<span>Call:</span> 2,536..."
    // Or plain text: "Put: 3,739  Call: 2,536..."
    function parseSummary(subtitle) {
        const summary = {
            put: '-',
            call: '-',
            vol: '-',
            volChg: '-',
            futureChg: '-'
        };

        if (!subtitle) return summary;

        // Strip HTML tags and convert &nbsp; to space
        const plainText = subtitle
            .replace(/<[^>]*>/g, '')  // Remove HTML tags
            .replace(/&nbsp;/g, ' ')   // Convert &nbsp; to space
            .replace(/\s+/g, ' ')      // Normalize whitespace
            .trim();



        // Match patterns like "Put: 123,456" or "Vol Chg: -0.25"
        const putMatch = plainText.match(/Put:\s*([\d,.-]+)/i);
        const callMatch = plainText.match(/Call:\s*([\d,.-]+)/i);
        const volMatch = plainText.match(/Vol:\s*([\d,.-]+)/i);
        const volChgMatch = plainText.match(/Vol Chg:\s*([+-]?[\d,.-]+)/i);
        const futureChgMatch = plainText.match(/Future Chg:\s*([+-]?[\d,.-]+)/i);

        if (putMatch) summary.put = putMatch[1];
        if (callMatch) summary.call = callMatch[1];
        if (volMatch) summary.vol = volMatch[1];
        if (volChgMatch) summary.volChg = volChgMatch[1];
        if (futureChgMatch) summary.futureChg = futureChgMatch[1];

        return summary;
    }

    // Update summary bar display
    function updateSummaryBar(subtitle, futurePrice) {
        const summary = parseSummary(subtitle);

        // Store future price globally for S/R comparison
        if (futurePrice && !isNaN(Number(futurePrice))) {
            lastFuturePrice = Number(futurePrice);
        }

        // Display Future price (with null check)
        if (summaryFutureEl) {
            if (futurePrice && !isNaN(Number(futurePrice))) {
                summaryFutureEl.textContent = Number(futurePrice).toLocaleString('en-US', { maximumFractionDigits: 1 });
            } else {
                summaryFutureEl.textContent = '-';
            }
        }

        summaryPutEl.textContent = summary.put;
        summaryCallEl.textContent = summary.call;
        summaryVolEl.textContent = summary.vol;
        summaryVolChgEl.textContent = summary.volChg;
        summaryFutureChgEl.textContent = summary.futureChg;

        // Add color classes for change values
        summaryVolChgEl.className = 'change-value';
        summaryFutureChgEl.className = 'change-value';

        if (summary.volChg !== '-') {
            if (summary.volChg.startsWith('-')) {
                summaryVolChgEl.classList.add('negative');
            } else if (summary.volChg.startsWith('+') || parseFloat(summary.volChg) > 0) {
                summaryVolChgEl.classList.add('positive');
            }
        }

        if (summary.futureChg !== '-') {
            if (summary.futureChg.startsWith('-')) {
                summaryFutureChgEl.classList.add('negative');
            } else if (summary.futureChg.startsWith('+') || parseFloat(summary.futureChg) > 0) {
                summaryFutureChgEl.classList.add('positive');
            }
        }

        // Return summary for analysis
        return summary;
    }

    // Get current trading session and weight multiplier
    // Based on Thai time (UTC+7) for Gold trading
    function getTimeSession() {
        const now = new Date();
        const hour = now.getHours();

        // Time ranges (Thai time UTC+7):
        // Asia: 07:00 - 14:00 (signals often fake)
        // London: 14:00 - 19:00 (normal weight)
        // New York: 19:00 - 02:00 (most accurate - CME market makers active)
        // Off-hours: 02:00 - 07:00 (very low activity)

        if (hour >= 7 && hour < 14) {
            return {
                name: 'Asia',
                icon: '🌏',
                multiplier: 0.5,
                warning: 'ช่วงเอเชีย - สัญญาณอาจหลอก',
                color: 'asia'
            };
        } else if (hour >= 14 && hour < 19) {
            return {
                name: 'London',
                icon: '🇬🇧',
                multiplier: 1.0,
                warning: null,
                color: 'london'
            };
        } else if (hour >= 19 || hour < 2) {
            return {
                name: 'New York',
                icon: '🇺🇸',
                multiplier: 1.2,
                warning: null,
                color: 'newyork'
            };
        } else {
            // 02:00 - 07:00 Off-hours
            return {
                name: 'Off-Hours',
                icon: '🌙',
                multiplier: 0.3,
                warning: 'นอกเวลาเทรด - Volume ต่ำมาก',
                color: 'offhours'
            };
        }
    }

    // Analyze market data and determine signal
    // Enhanced Formula v2.0 with OI support and improved weights
    function analyzeMarket(summary, tableData, oiChange = null) {
        // Liquidity Threshold - minimum volume required for reliable signals
        const MIN_VOLUME_THRESHOLD = 500;

        // Get current session for time-based weighting
        const session = getTimeSession();

        const analysis = {
            signal: 'neutral',      // call, put, swing, neutral, reversal, low_volume
            signalText: 'รอข้อมูล',
            pcr: null,
            pcrText: '-',
            strength: 0,
            slTpAdvice: 'normal',   // tight, normal, wide
            isReversalZone: false,
            isLowVolume: false,     // New: flag for low volume
            oiSignal: null,
            totalVolume: 0,         // New: store total volume
            session: session,       // New: current trading session
            details: [],
            warnings: []
        };

        // Parse values
        const putVol = parseNumber(summary.put);
        const callVol = parseNumber(summary.call);
        const volChg = parseNumber(summary.volChg);
        const futureChg = parseNumber(summary.futureChg);

        if (putVol === null || callVol === null) {
            analysis.details.push('⚠️ ไม่มีข้อมูล Volume เพียงพอ');
            return analysis;
        }

        const totalVol = putVol + callVol;
        analysis.totalVolume = totalVol;

        // Calculate Put/Call Ratio (show even if low volume, but warn)
        if (callVol > 0) {
            analysis.pcr = putVol / callVol;
            analysis.pcrText = analysis.pcr.toFixed(2);
        }

        // ========================================
        // LIQUIDITY CHECK - Must pass before scoring
        // ========================================
        if (totalVol < MIN_VOLUME_THRESHOLD) {
            analysis.isLowVolume = true;
            analysis.signal = 'low_volume';
            analysis.signalText = 'รอ Volume';
            analysis.strength = 0;
            analysis.warnings.push(`⏳ Volume ต่ำ (${formatNumber(totalVol)}) - รอให้ถึง ${formatNumber(MIN_VOLUME_THRESHOLD)}+`);
            analysis.details.push(`📊 Put: ${formatNumber(putVol)} | Call: ${formatNumber(callVol)}`);
            analysis.details.push(`⚠️ PCR ${analysis.pcrText} อาจไม่น่าเชื่อถือ (Volume น้อย)`);

            // Still calculate S/R from OI if available
            if (oiData && oiData.data?.[0]?.tableData?.length > 0) {
                const oiTableData = oiData.data[0].tableData;
                const maxPutOI = oiTableData.reduce((max, row) =>
                    (row.put > (max?.put || 0)) ? row : max, null);
                const maxCallOI = oiTableData.reduce((max, row) =>
                    (row.call > (max?.call || 0)) ? row : max, null);
                if (maxPutOI && maxPutOI.put > 0) analysis.support = maxPutOI.strike;
                if (maxCallOI && maxCallOI.call > 0) analysis.resistance = maxCallOI.strike;
                if (analysis.support && analysis.resistance) {
                    analysis.details.push(`📍 แนวรับ: ${formatNumber(analysis.support)} | แนวต้าน: ${formatNumber(analysis.resistance)}`);
                }
            }

            return analysis;
        }

        let score = 0; // Positive = Call bias, Negative = Put bias
        const maxScore = 100;
        const volDiff = ((callVol - putVol) / totalVol) * 100;

        // ========================================
        // CIRCUIT BREAKER: PCR Extreme Check (HARD STOP)
        // ========================================
        if (analysis.pcr !== null) {
            if (analysis.pcr < 0.4 || analysis.pcr > 1.6) {
                // HARD STOP - Do not calculate any score, force stop immediately
                analysis.isReversalZone = true;
                analysis.signal = 'reversal';
                analysis.strength = 0; // No signal strength
                analysis.session = session;

                if (analysis.pcr < 0.4) {
                    analysis.signalText = '🔥 ห้ามเทรด!';
                    analysis.warnings.push('🛑 CIRCUIT BREAKER: PCR ต่ำมาก (Overbought)');
                    analysis.details.push(`⛔ PCR ${analysis.pcrText} < 0.4 = ตลาดร้อนแรงเกินไป`);
                    analysis.details.push(`📈 Call มากกว่า Put เกือบ 3 เท่า!`);
                } else {
                    analysis.signalText = '🔥 ห้ามเทรด!';
                    analysis.warnings.push('🛑 CIRCUIT BREAKER: PCR สูงมาก (Oversold)');
                    analysis.details.push(`⛔ PCR ${analysis.pcrText} > 1.6 = ตลาดกลัวเกินไป`);
                    analysis.details.push(`📉 Put มากกว่า Call เกือบ 2 เท่า!`);
                }

                analysis.warnings.push('❌ ห้ามเปิด Order ใหม่ - รอให้ PCR กลับสู่ปกติ');
                analysis.details.push(`${session.icon} ช่วง ${session.name}`);
                analysis.details.push(`⏳ รอ PCR อยู่ในช่วง 0.6 - 1.4 ก่อนเทรด`);

                // Still calculate S/R for reference
                if (oiData && oiData.data?.[0]?.tableData?.length > 0) {
                    const oiTableData = oiData.data[0].tableData;
                    const maxPutOI = oiTableData.reduce((max, row) =>
                        (row.put > (max?.put || 0)) ? row : max, null);
                    const maxCallOI = oiTableData.reduce((max, row) =>
                        (row.call > (max?.call || 0)) ? row : max, null);
                    if (maxPutOI && maxPutOI.put > 0) analysis.support = maxPutOI.strike;
                    if (maxCallOI && maxCallOI.call > 0) analysis.resistance = maxCallOI.strike;
                    if (analysis.support && analysis.resistance) {
                        analysis.details.push(`📍 แนวรับ: ${formatNumber(analysis.support)} | แนวต้าน: ${formatNumber(analysis.resistance)}`);
                    }
                }

                // HARD STOP - Return immediately, no further calculation
                return analysis;
            }
        }

        // ========================================
        // 1. SENTIMENT FLOW: PCR (30%) + Vol Diff (10%) = 40%
        // ========================================

        // 1a. PCR Analysis (30% weight) - Normal range only (0.4 - 1.6)
        if (analysis.pcr !== null) {
            if (analysis.pcr < 0.6) {
                score += 30;
                analysis.details.push(`📈 PCR ต่ำ (${analysis.pcrText}) - Bullish`);
            } else if (analysis.pcr < 0.8) {
                score += 20;
                analysis.details.push(`📈 PCR ค่อนข้าง Bullish (${analysis.pcrText})`);
            } else if (analysis.pcr < 0.95) {
                score += 10;
                analysis.details.push(`📊 PCR เอียง Bullish (${analysis.pcrText})`);
            } else if (analysis.pcr <= 1.05) {
                analysis.details.push(`⚖️ PCR สมดุล (${analysis.pcrText})`);
            } else if (analysis.pcr <= 1.2) {
                score -= 10;
                analysis.details.push(`📊 PCR เอียง Bearish (${analysis.pcrText})`);
            } else if (analysis.pcr <= 1.4) {
                score -= 20;
                analysis.details.push(`📉 PCR ค่อนข้าง Bearish (${analysis.pcrText})`);
            } else {
                // PCR 1.4 - 1.6 (approaching danger zone)
                score -= 30;
                analysis.details.push(`📉 PCR สูง (${analysis.pcrText}) - Bearish`);
                analysis.warnings.push(`⚠️ PCR ใกล้ถึงโซนอันตราย (1.6)`);
            }
        }

        // 1b. Volume Difference (10% weight) - Reduced to avoid double counting
        if (volDiff > 25) {
            score += 10;
        } else if (volDiff > 10) {
            score += 5;
        } else if (volDiff < -25) {
            score -= 10;
        } else if (volDiff < -10) {
            score -= 5;
        }
        // Don't add detail to avoid clutter, PCR already covers this

        // ========================================
        // 2. PRICE ACTION: Future Change (30%)
        // ========================================
        if (futureChg !== null) {
            if (futureChg > 1.5) {
                score += 30;
                analysis.details.push(`🚀 Future ขึ้นแรง (+${futureChg.toFixed(2)})`);
            } else if (futureChg > 0.5) {
                score += 20;
                analysis.details.push(`📈 Future ขึ้น (+${futureChg.toFixed(2)})`);
            } else if (futureChg > 0.2) {
                score += 10;
                analysis.details.push(`📈 Future ขึ้นเล็กน้อย (+${futureChg.toFixed(2)})`);
            } else if (futureChg >= -0.2) {
                analysis.details.push(`➡️ Future ทรงตัว (${futureChg.toFixed(2)})`);
            } else if (futureChg >= -0.5) {
                score -= 10;
                analysis.details.push(`📉 Future ลงเล็กน้อย (${futureChg.toFixed(2)})`);
            } else if (futureChg >= -1.5) {
                score -= 20;
                analysis.details.push(`📉 Future ลง (${futureChg.toFixed(2)})`);
            } else {
                score -= 30;
                analysis.details.push(`🔻 Future ลงแรง (${futureChg.toFixed(2)})`);
            }
        }

        // ========================================
        // 3. SMART MONEY: Open Interest Change (20%)
        // Using RELATIVE % change instead of absolute
        // ========================================

        // Calculate Relative OI Change % if we have both OI and OI Change data
        let oiChangePercent = null;
        let oiChangeAbsolute = oiChange;
        let totalOI = null;

        // Get current OI from oiData for calculating %
        if (oiData && oiData.data?.[0]) {
            const oiChartData = oiData.data[0];
            const oiSummary = parseSummary(oiChartData.subtitle || '');
            const oiPut = parseNumber(oiSummary.put);
            const oiCall = parseNumber(oiSummary.call);

            if (oiPut !== null && oiCall !== null) {
                totalOI = oiPut + oiCall;

                // Calculate % if we have OI Change
                if (oiChangeAbsolute !== null && totalOI > 0) {
                    // % Change relative to current OI
                    // Note: Previous OI = Current OI - Change
                    const previousOI = totalOI - oiChangeAbsolute;
                    if (previousOI > 0) {
                        oiChangePercent = (oiChangeAbsolute / previousOI) * 100;
                    }
                }
            }
        }

        // Price action context
        const priceUp = futureChg !== null && futureChg > 0.2;
        const priceDown = futureChg !== null && futureChg < -0.2;

        if (oiChangeAbsolute !== null) {
            const oiUp = oiChangeAbsolute > 0;
            const oiDown = oiChangeAbsolute < 0;

            // Determine significance based on % change (if available)
            // Thresholds: >5% = notable, >10% = significant, >20% = very significant
            let significance = 'normal';
            let scoreMultiplier = 1.0;

            if (oiChangePercent !== null) {
                const absPercent = Math.abs(oiChangePercent);
                if (absPercent > 20) {
                    significance = 'extreme';
                    scoreMultiplier = 1.5;
                } else if (absPercent > 10) {
                    significance = 'high';
                    scoreMultiplier = 1.2;
                } else if (absPercent > 5) {
                    significance = 'notable';
                    scoreMultiplier = 1.0;
                } else {
                    significance = 'low';
                    scoreMultiplier = 0.5; // Low significance = reduce impact
                }
            }

            // Format display text
            const changeText = oiChangePercent !== null
                ? `${oiChangeAbsolute > 0 ? '+' : ''}${oiChangePercent.toFixed(1)}%`
                : `${oiChangeAbsolute > 0 ? '+' : ''}${formatNumber(oiChangeAbsolute)}`;

            const significanceEmoji = significance === 'extreme' ? '🔥' :
                significance === 'high' ? '💪' :
                    significance === 'notable' ? '📊' : '📉';

            if (priceUp && oiUp) {
                // Strong Bullish - New money flowing in
                const baseScore = 20;
                score += Math.round(baseScore * scoreMultiplier);
                analysis.oiSignal = 'bullish';
                if (significance === 'extreme' || significance === 'high') {
                    analysis.details.push(`${significanceEmoji} OI ${changeText} + ราคาขึ้น = 💰 เงินใหม่ไหลเข้าแรง!`);
                } else if (significance === 'low') {
                    analysis.details.push(`📊 OI ${changeText} + ราคาขึ้น = เงินใหม่ไหลเข้า (น้อย)`);
                } else {
                    analysis.details.push(`💰 OI ${changeText} + ราคาขึ้น = เงินใหม่ไหลเข้า (Strong Buy)`);
                }
            } else if (priceUp && oiDown) {
                // Short Covering - Not real buying
                const baseScore = -5;
                score += Math.round(baseScore * scoreMultiplier);
                analysis.oiSignal = 'covering';
                if (significance === 'extreme' || significance === 'high') {
                    analysis.warnings.push(`⚠️ OI ${changeText} + ราคาขึ้น = Short Covering หนัก! (ระวังกับดัก)`);
                } else {
                    analysis.warnings.push(`⚠️ OI ${changeText} + ราคาขึ้น = Short Covering (ระวังกับดัก)`);
                }
            } else if (priceDown && oiUp) {
                // Strong Bearish - New shorts entering
                const baseScore = -20;
                score += Math.round(baseScore * scoreMultiplier);
                analysis.oiSignal = 'bearish';
                if (significance === 'extreme' || significance === 'high') {
                    analysis.details.push(`${significanceEmoji} OI ${changeText} + ราคาลง = 💰 Short เข้าใหม่หนัก!`);
                } else if (significance === 'low') {
                    analysis.details.push(`📊 OI ${changeText} + ราคาลง = Short เข้าใหม่ (น้อย)`);
                } else {
                    analysis.details.push(`💰 OI ${changeText} + ราคาลง = Short เข้าใหม่ (Strong Sell)`);
                }
            } else if (priceDown && oiDown) {
                // Long Liquidation - Not real selling
                const baseScore = 5;
                score += Math.round(baseScore * scoreMultiplier);
                analysis.oiSignal = 'liquidation';
                if (significance === 'extreme' || significance === 'high') {
                    analysis.warnings.push(`⚠️ OI ${changeText} + ราคาลง = Long Liquidation หนัก! (ใกล้จบรอบ)`);
                } else {
                    analysis.warnings.push(`⚠️ OI ${changeText} + ราคาลง = Long Liquidation (ใกล้จบรอบขาลง)`);
                }
            } else if (oiUp) {
                analysis.details.push(`${significanceEmoji} OI เพิ่ม ${changeText} - มี Position ใหม่`);
            } else if (oiDown) {
                analysis.details.push(`${significanceEmoji} OI ลด ${changeText} - มีการปิด Position`);
            }

            // Add total OI context if available
            if (totalOI !== null) {
                analysis.details.push(`📈 Total OI: ${formatNumber(totalOI)}`);
            }
        } else {
            // No OI Change data - show OI info if available
            if (oiData && oiData.data?.[0]) {
                const oiChartData = oiData.data[0];
                const oiSummary = parseSummary(oiChartData.subtitle || '');
                const oiPut = parseNumber(oiSummary.put);
                const oiCall = parseNumber(oiSummary.call);

                if (oiPut !== null && oiCall !== null) {
                    const oiPcr = oiCall > 0 ? (oiPut / oiCall).toFixed(2) : '-';
                    analysis.details.push(`📊 OI: Put ${formatNumber(oiPut)}, Call ${formatNumber(oiCall)} (PCR ${oiPcr})`);
                    analysis.details.push(`📈 เปิดหน้า OI Change เพื่อดูการเปลี่ยนแปลง`);
                }
            } else {
                analysis.details.push(`📊 OI: เปิดหน้า OI หรือ OI Change แล้ว Refresh`);
            }
        }

        // ========================================
        // 4. VOLATILITY: SL/TP Guidance (10%) - No score impact
        // ========================================
        if (volChg !== null) {
            const absVolChg = Math.abs(volChg);
            if (absVolChg > 1.5) {
                analysis.slTpAdvice = 'wide';
                analysis.details.push(`⚡ Vol สูง (${volChg > 0 ? '+' : ''}${volChg.toFixed(2)}) → ขยาย SL/TP`);
            } else if (absVolChg > 0.8) {
                analysis.slTpAdvice = 'normal';
                analysis.details.push(`📊 Vol ปานกลาง → SL/TP ปกติ`);
            } else if (absVolChg < 0.3) {
                analysis.slTpAdvice = 'tight';
                analysis.details.push(`🎯 Vol ต่ำ → บีบ SL/TP แคบ`);
            }
        }

        // ========================================
        // 5. Support/Resistance from OI Data
        // ========================================
        analysis.support = null;
        analysis.resistance = null;

        // Use OI data for Support/Resistance (more reliable than volume)
        if (oiData && oiData.data?.[0]?.tableData?.length > 0) {
            const oiTableData = oiData.data[0].tableData;

            // Max Put OI = Support (floor), Max Call OI = Resistance (ceiling)
            const maxPutOI = oiTableData.reduce((max, row) =>
                (row.put > (max?.put || 0)) ? row : max, null);
            const maxCallOI = oiTableData.reduce((max, row) =>
                (row.call > (max?.call || 0)) ? row : max, null);

            if (maxPutOI && maxPutOI.put > 0) {
                analysis.support = maxPutOI.strike;
            }
            if (maxCallOI && maxCallOI.call > 0) {
                analysis.resistance = maxCallOI.strike;
            }

            if (analysis.support && analysis.resistance) {
                analysis.details.push(`📍 แนวรับ: ${formatNumber(analysis.support)} | แนวต้าน: ${formatNumber(analysis.resistance)}`);
            }
        } else {
            // Fallback: use volume data for concentration
            if (tableData && tableData.length > 0) {
                const maxCallRow = tableData.reduce((max, row) =>
                    (row.call > (max?.call || 0)) ? row : max, null);
                const maxPutRow = tableData.reduce((max, row) =>
                    (row.put > (max?.put || 0)) ? row : max, null);

                if (maxCallRow && maxPutRow && maxCallRow.call > 0 && maxPutRow.put > 0) {
                    analysis.details.push(`🎯 Vol กระจุก: Put ${maxPutRow.strike}, Call ${maxCallRow.strike}`);
                    analysis.details.push(`📍 เปิดหน้า OI เพื่อดูแนวรับ/ต้านที่แม่นยำ`);
                }
            }
        }

        // ========================================
        // TIME SESSION WEIGHTING
        // ========================================
        const rawScore = score;
        const adjustedScore = Math.round(score * session.multiplier);

        // Add session info to details
        if (session.multiplier !== 1.0) {
            const multiplierText = session.multiplier < 1
                ? `ลด ${Math.round((1 - session.multiplier) * 100)}%`
                : `เพิ่ม ${Math.round((session.multiplier - 1) * 100)}%`;
            analysis.details.unshift(`${session.icon} ช่วง ${session.name} (${multiplierText})`);
        } else {
            analysis.details.unshift(`${session.icon} ช่วง ${session.name}`);
        }

        // Add session warning if applicable
        if (session.warning) {
            analysis.warnings.push(`⚠️ ${session.warning}`);
        }

        // ========================================
        // FINAL SIGNAL DETERMINATION
        // ========================================
        // Note: Reversal Zone (PCR extreme) already returned above with HARD STOP
        analysis.strength = Math.min(Math.abs(adjustedScore), maxScore);
        analysis.rawScore = rawScore;
        analysis.adjustedScore = adjustedScore;

        if (adjustedScore > 40) {
            analysis.signal = 'call';
            analysis.signalText = 'ซื้อ (แข็งแกร่ง)';
        } else if (adjustedScore > 20) {
            analysis.signal = 'call';
            analysis.signalText = 'ซื้อ (อ่อน)';
        } else if (adjustedScore < -40) {
            analysis.signal = 'put';
            analysis.signalText = 'ขาย (แข็งแกร่ง)';
        } else if (adjustedScore < -20) {
            analysis.signal = 'put';
            analysis.signalText = 'ขาย (อ่อน)';
        } else {
            analysis.signal = 'swing';
            analysis.signalText = 'ไซด์เวย์';
            analysis.details.push('🔄 ตลาดไซด์เวย์ - พิจารณา Range trade');
        }

        return analysis;
    }

    // Parse number from string (handles commas)
    function parseNumber(str) {
        if (!str || str === '-') return null;
        const cleaned = str.replace(/,/g, '').replace(/[+]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }

    // Update analysis display
    function updateAnalysisDisplay(analysis) {
        // Update signal badge
        analysisSignalEl.className = `analysis-signal ${analysis.signal}`;
        analysisSignalEl.textContent = analysis.signalText;

        // Update signal type
        signalTypeEl.className = `indicator-value signal-${analysis.signal}`;
        signalTypeEl.textContent = analysis.signalText;

        // Update PCR with extreme warning
        pcrValueEl.textContent = analysis.pcrText;
        if (analysis.pcr !== null) {
            if (analysis.isReversalZone) {
                pcrValueEl.className = 'indicator-value signal-reversal';
            } else if (analysis.pcr < 0.9) {
                pcrValueEl.className = 'indicator-value call-value';
            } else if (analysis.pcr > 1.1) {
                pcrValueEl.className = 'indicator-value put-value';
            } else {
                pcrValueEl.className = 'indicator-value vol-value';
            }
        }

        // Update strength bar with reversal support
        strengthFillEl.style.width = `${analysis.strength}%`;
        let strengthClass = 'strength-fill ';
        if (analysis.signal === 'call') strengthClass += 'strong-call';
        else if (analysis.signal === 'put') strengthClass += 'strong-put';
        else if (analysis.signal === 'reversal') strengthClass += 'swing'; // Use yellow for reversal
        else strengthClass += 'swing';
        strengthFillEl.className = strengthClass;
        strengthPercentEl.textContent = `${analysis.strength}%`;

        // Build details HTML with warnings first
        let detailsHtml = '';

        // Add warnings box if any
        if (analysis.warnings && analysis.warnings.length > 0) {
            detailsHtml += '<div class="analysis-warnings">';
            detailsHtml += analysis.warnings.map(w => `<p class="warning-item">${w}</p>`).join('');
            detailsHtml += '</div>';
        }

        // Add SL/TP advice
        if (analysis.slTpAdvice && analysis.slTpAdvice !== 'normal') {
            const adviceText = analysis.slTpAdvice === 'wide' ? 'SL/TP กว้าง' : 'SL/TP แคบ';
            detailsHtml += `<span class="sltp-advice ${analysis.slTpAdvice}">${adviceText}</span>`;
        }

        // Add details
        if (analysis.details.length > 0) {
            detailsHtml += analysis.details
                .map(d => `<p class="detail-bullet">${d}</p>`)
                .join('');
        }

        if (detailsHtml) {
            analysisDetailsEl.innerHTML = detailsHtml;
        } else {
            analysisDetailsEl.innerHTML = '<p class="detail-text">กด Refresh เพื่อดึงข้อมูลและวิเคราะห์</p>';
        }

        // Update Trade Recommendation
        updateTradeRecommendation(analysis);
    }

    // Update Trade Recommendation display
    function updateTradeRecommendation(analysis) {
        if (!tradeAction || !tradeDetails) return;

        // Check data availability
        const hasVolume = volumeData !== null;
        const hasOI = oiData !== null;
        const hasOIChange = oiChangeData !== null;

        let actionClass = 'wait';
        let actionIcon = '⏳';
        let actionText = 'รอข้อมูล';
        let detailText = '';

        // Build session text
        let sessionText = '';
        if (analysis.session) {
            const s = analysis.session;
            if (s.multiplier < 1) {
                sessionText = `<br><span class="session-${s.color}">${s.icon} ${s.name} (ลด ${Math.round((1 - s.multiplier) * 100)}%)</span>`;
            } else if (s.multiplier > 1) {
                sessionText = `<br><span class="session-${s.color}">${s.icon} ${s.name} (เพิ่ม ${Math.round((s.multiplier - 1) * 100)}%)</span>`;
            } else {
                sessionText = `<br><span class="session-${s.color}">${s.icon} ${s.name}</span>`;
            }
        }

        // Build support/resistance text with price position
        let srText = '';
        let pricePosition = '';
        if (analysis.support && analysis.resistance) {
            const S = analysis.support;
            const R = analysis.resistance;
            const price = lastFuturePrice;

            if (price && price > 0) {
                if (price > R) {
                    pricePosition = `<br>⚡ <span class="highlight-green">Breakout!</span> ราคา ${formatNumber(price)} > แนวต้าน ${formatNumber(R)}`;
                } else if (price < S) {
                    pricePosition = `<br>⬇️ <span class="highlight-red">Breakdown!</span> ราคา ${formatNumber(price)} < แนวรับ ${formatNumber(S)}`;
                } else {
                    pricePosition = `<br>📊 ราคา ${formatNumber(price)} อยู่ใน Range (${formatNumber(S)} - ${formatNumber(R)})`;
                }
            }
            srText = `<br>📍 แนวรับ: ${formatNumber(S)} | แนวต้าน: ${formatNumber(R)}${pricePosition}`;
        }

        // Combine session and S/R
        srText = sessionText + srText;

        // Volume is primary - must have it
        if (!hasVolume) {
            actionClass = 'wait';
            actionIcon = '📊';
            actionText = 'ขาด Volume';
            detailText = `เปิดหน้า Intraday Volume แล้ว Refresh<br><span class="highlight">Volume = สัญญาณหลักในการเทรด</span>`;
        }
        // Low Volume - Wait for liquidity
        else if (analysis.isLowVolume) {
            actionClass = 'low-volume';
            actionIcon = '⏳';
            actionText = 'รอ Volume';
            const volText = analysis.totalVolume ? formatNumber(analysis.totalVolume) : '-';
            detailText = `Volume ต่ำเกินไป (${volText})<br><span class="highlight">⏳ รอให้ Volume ถึง 500+ ก่อนเทรด</span>${srText}`;
        }
        // CIRCUIT BREAKER - PCR Extreme (HARD STOP)
        else if (analysis.isReversalZone) {
            actionClass = 'circuit-breaker';
            actionIcon = '🛑';
            actionText = 'ห้ามเทรด!';
            const zone = analysis.pcr < 0.4 ? 'Overbought' : 'Oversold';
            detailText = `<span class="highlight-red">🔥 CIRCUIT BREAKER</span><br>PCR ${analysis.pcrText} (${zone})<br><span class="highlight">❌ ห้ามเปิด Order ใหม่!</span>${srText}`;
        }
        // Strong Call Signal (BUY)
        else if (analysis.signal === 'call' && analysis.strength >= 40) {
            const sltp = analysis.slTpAdvice === 'wide' ? 'SL/TP กว้าง' : analysis.slTpAdvice === 'tight' ? 'SL/TP แคบ' : 'SL/TP ปกติ';

            if (analysis.oiSignal === 'bullish') {
                actionClass = 'buy';
                actionIcon = '🚀';
                actionText = 'ซื้อ (แข็งแกร่ง)';
                detailText = `สัญญาณแข็งแกร่ง + เงินใหม่ไหลเข้า<br><span class="highlight">✅ เข้าได้! ${sltp}</span>${srText}`;
            } else if (analysis.oiSignal === 'covering') {
                actionClass = 'wait';
                actionIcon = '⚠️';
                actionText = 'รอดูก่อน';
                detailText = `สัญญาณซื้อ แต่เป็น Short Covering<br><span class="highlight">⚠️ อาจเป็นกับดัก - รอ confirm</span>${srText}`;
            } else {
                actionClass = 'buy';
                actionIcon = '📈';
                actionText = 'ซื้อ';
                const extra = !hasOIChange ? ' (รอ OI Chg ยืนยัน)' : '';
                detailText = `สัญญาณซื้อ (${analysis.strength}%)${extra}<br><span class="highlight">✅ ${sltp}</span>${srText}`;
            }
        }
        // Weak Call Signal (BUY weak)
        else if (analysis.signal === 'call' && analysis.strength < 40) {
            actionClass = 'wait';
            actionIcon = '📈';
            actionText = 'ซื้อ (อ่อน)';
            detailText = `สัญญาณไม่แข็งแรงพอ (${analysis.strength}%)<br><span class="highlight">รอสัญญาณชัดขึ้น หรือ position เล็ก</span>${srText}`;
        }
        // Strong Put Signal (SELL)
        else if (analysis.signal === 'put' && analysis.strength >= 40) {
            const sltp = analysis.slTpAdvice === 'wide' ? 'SL/TP กว้าง' : analysis.slTpAdvice === 'tight' ? 'SL/TP แคบ' : 'SL/TP ปกติ';

            if (analysis.oiSignal === 'bearish') {
                actionClass = 'sell';
                actionIcon = '🔻';
                actionText = 'ขาย (แข็งแกร่ง)';
                detailText = `สัญญาณแข็งแกร่ง + Short เข้าใหม่<br><span class="highlight">✅ เข้าได้! ${sltp}</span>${srText}`;
            } else if (analysis.oiSignal === 'liquidation') {
                actionClass = 'wait';
                actionIcon = '⚠️';
                actionText = 'ใกล้จบขาลง';
                detailText = `เห็น Long Liquidation<br><span class="highlight">ขาลงอาจใกล้จบ - ระวัง กลับตัว</span>${srText}`;
            } else {
                actionClass = 'sell';
                actionIcon = '📉';
                actionText = 'ขาย';
                const extra = !hasOIChange ? ' (รอ OI Chg ยืนยัน)' : '';
                detailText = `สัญญาณขาย (${analysis.strength}%)${extra}<br><span class="highlight">✅ ${sltp}</span>${srText}`;
            }
        }
        // Weak Put Signal (SELL weak)
        else if (analysis.signal === 'put' && analysis.strength < 40) {
            actionClass = 'wait';
            actionIcon = '📉';
            actionText = 'ขาย (อ่อน)';
            detailText = `สัญญาณไม่แข็งแรงพอ (${analysis.strength}%)<br><span class="highlight">รอสัญญาณชัดขึ้น หรือ position เล็ก</span>${srText}`;
        }
        // Sideways / Swing
        else if (analysis.signal === 'swing') {
            actionClass = 'wait';
            actionIcon = '↔️';
            actionText = 'ไซด์เวย์';
            detailText = `ตลาดไม่มีทิศทาง<br><span class="highlight">พิจารณา Range Trade หรือรอ Breakout</span>${srText}`;
        }
        // Default
        else {
            actionClass = 'wait';
            actionIcon = '⏳';
            actionText = 'รอสัญญาณ';
            detailText = 'Refresh Volume เพื่อดูสัญญาณเทรด' + srText;
        }

        // Apply to DOM
        tradeAction.className = `trade-action ${actionClass}`;
        tradeAction.innerHTML = `<span class="trade-icon">${actionIcon}</span><span class="trade-text">${actionText}</span>`;
        tradeDetails.innerHTML = detailText;
    }

    // Reset Trade Recommendation
    function resetTradeRecommendation() {
        if (!tradeAction || !tradeDetails) return;
        tradeAction.className = 'trade-action wait';
        tradeAction.innerHTML = '<span class="trade-icon">⏳</span><span class="trade-text">รอข้อมูล</span>';
        tradeDetails.innerHTML = 'Refresh <b>Volume</b> (สัญญาณเทรด) + <b>OI</b> (แนวรับ/ต้าน)';
    }

    // Detect data type from chart title
    function detectDataType(title) {
        if (!title) return 'Volume';
        const lowerTitle = title.toLowerCase().trim();

        // Check for OI Change first (most specific)
        if (lowerTitle.includes('oi change') ||
            lowerTitle.includes('oi chg') ||
            lowerTitle.includes('open interest change')) {
            return 'OIChange';
        }
        // Check for OI (but not OI Change)
        else if (lowerTitle.includes('open interest') ||
            lowerTitle.startsWith('oi ') ||           // "OI Gold..."
            lowerTitle.includes(' oi ') ||            // "... OI ..."
            /\boi\b/.test(lowerTitle)) {              // word boundary match
            return 'OI';
        }
        // Check for Volume types
        else if (lowerTitle.includes('intraday') || lowerTitle.includes('volume')) {
            return 'Volume';
        }
        else if (lowerTitle.includes('eod')) {
            return 'EOD';
        }
        return 'Volume';
    }

    // Reset analysis display to default state
    function resetAnalysisDisplay() {
        analysisSignalEl.className = 'analysis-signal neutral';
        analysisSignalEl.textContent = '-';
        signalTypeEl.className = 'indicator-value signal-neutral';
        signalTypeEl.textContent = 'รอข้อมูล';
        pcrValueEl.textContent = '-';
        pcrValueEl.className = 'indicator-value';
        strengthFillEl.style.width = '0%';
        strengthFillEl.className = 'strength-fill';
        strengthPercentEl.textContent = '0%';
        analysisDetailsEl.innerHTML = '<p class="detail-text">กด Refresh เพื่อดึงข้อมูลและวิเคราะห์</p>';
        resetTradeRecommendation();
    }

    // Render data to table
    function renderData(data, skipAnalysis = false, skipSwitch = false) {
        if (!data?.success || !data.data?.length) {
            tableBodyEl.innerHTML = '<tr><td colspan="5" class="no-data">ไม่มีข้อมูล - กดปุ่ม Refresh</td></tr>';
            updateSummaryBar(null);
            resetAnalysisDisplay();
            return;
        }

        const chartData = data.data[0];
        const title = chartData.title || '';
        const subtitle = chartData.subtitle || '';
        const futurePrice = chartData.futurePrice || null;
        const tableData = chartData.tableData || [];

        // Detect chart type from title
        const dataType = detectDataType(title);

        // Update summary bar from subtitle and get parsed summary
        const summary = updateSummaryBar(subtitle, futurePrice);

        // Get OI Change from stored OI Change data
        let oiChange = null;

        // Calculate OI Change from oiChangeData if available
        if (oiChangeData && oiChangeData.data?.[0]) {
            const oiChgSummary = parseSummary(oiChangeData.data[0].subtitle || '');
            const oiChgPut = parseNumber(oiChgSummary.put);
            const oiChgCall = parseNumber(oiChgSummary.call);
            if (oiChgPut !== null && oiChgCall !== null) {
                // Calculate net OI change (Call OI change - Put OI change)
                // Positive = more new calls, Negative = more new puts
                oiChange = oiChgCall - oiChgPut;
            }
        }

        // Perform market analysis with OI data
        if (!skipAnalysis) {
            const analysis = analyzeMarket(summary, tableData, oiChange);
            updateAnalysisDisplay(analysis);
        }

        // Parse title to extract product name
        let productName = title;

        if (title.includes('Intraday')) {
            productName = title.replace('Intraday Volume', '').trim();
        } else if (title.includes('EOD')) {
            productName = title.replace('EOD Volume', '').trim();
        } else if (title.includes('Open Interest')) {
            productName = title.replace('Open Interest', '').trim();
        }

        // Try to get product from URL params if available
        if (data.pageUrl) {
            const urlMatch = data.pageUrl.match(/pid=(\d+)/);
            if (urlMatch) {
                const pidMap = {
                    '40': 'Gold (OG|GC)',
                    '48': 'Silver (SO|SI)',
                    '116': 'Soybeans (OZS|ZS)',
                    '115': 'Corn (OZC|ZC)'
                };
                const mappedProduct = pidMap[urlMatch[1]];
                if (mappedProduct) {
                    productName = `${mappedProduct} ${productName}`;
                }
            }
        }

        productNameEl.textContent = productName || '-';

        // Set volume type based on data type
        let volumeTypeText = 'Volume';
        if (dataType === 'OI') {
            volumeTypeText = 'Open Interest';
        } else if (dataType === 'OIChange') {
            volumeTypeText = 'OI Change';
        } else if (title.includes('Intraday')) {
            volumeTypeText = 'Intraday Vol';
        } else if (title.includes('EOD')) {
            volumeTypeText = 'EOD Vol';
        }
        volumeTypeEl.textContent = volumeTypeText;

        lastUpdateEl.textContent = formatTime(data.extractedAt);

        // Store data based on type (only if not from displayActiveSourceData to avoid recursion)
        if (!skipSwitch) {
            if (dataType === 'OIChange') {
                oiChangeData = data;
                chrome.storage.local.set({ oiChangeData: data });
                updateTabIndicator('oichange', data);
                switchDataSource('oichange', true);
            } else if (dataType === 'OI') {
                oiData = data;
                chrome.storage.local.set({ oiData: data });
                updateTabIndicator('oi', data);
                switchDataSource('oi', true);
            } else {
                volumeData = data;
                chrome.storage.local.set({ volumeData: data });
                updateTabIndicator('volume', data);
                switchDataSource('volume', true);
            }
        }

        if (tableData.length === 0) {
            tableBodyEl.innerHTML = '<tr><td colspan="5" class="no-data">ไม่มีข้อมูลใน chart</td></tr>';
            return;
        }

        tableBodyEl.innerHTML = tableData.map(row => `
      <tr>
        <td>${row.strike}</td>
        <td class="put-value">${formatNumber(row.put)}</td>
        <td class="call-value">${formatNumber(row.call)}</td>
        <td class="vol-value">${formatNumber(row.volSettle, 2)}</td>
        <td>${row.range !== null ? formatNumber(row.range, 2) : '-'}</td>
      </tr>
    `).join('');
    }

    // Format number
    function formatNumber(value, decimals = 0) {
        if (value === null || value === undefined) return '-';
        return Number(value).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    // Format time
    function formatTime(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // Refresh data - sends to all frames
    async function refreshData() {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '⏳ Loading...';

        try {
            // Request background to extract from all frames
            chrome.runtime.sendMessage({ type: 'EXTRACT_FROM_ALL_FRAMES' }, (response) => {
                if (response?.success) {
                    currentData = response.data;
                    renderData(currentData);
                    setConnectionStatus(true, 'Data refreshed');
                } else {
                    // Fallback: Try direct message
                    tryDirectExtract();
                }

                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '🔄 Refresh';
            });
        } catch (error) {

            refreshBtn.disabled = false;
            refreshBtn.innerHTML = '🔄 Refresh';
        }
    }

    // Try direct extraction from active tab
    async function tryDirectExtract() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url?.includes('cmegroup.com')) {
            chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_DATA' }, (response) => {
                if (response?.success) {
                    currentData = response;
                    renderData(currentData);
                    chrome.runtime.sendMessage({ type: 'CHART_DATA', payload: response });
                    setConnectionStatus(true, 'Data refreshed');
                } else {
                    setConnectionStatus(false, response?.error || 'ไม่พบข้อมูล Highcharts');
                }
            });
        }
    }

    // Refresh All - Fetch from ALL open CME tabs using same method as Refresh
    async function refreshAll() {
        if (!refreshAllBtn) return;

        refreshAllBtn.disabled = true;
        refreshAllBtn.innerHTML = '⏳ กำลังดึงจากทุก Tab...';

        try {
            // Find ALL CME QuikStrike tabs
            const allTabs = await chrome.tabs.query({ url: '*://*.cmegroup.com/*' });
            console.log(`[Refresh All] Found ${allTabs.length} CME tabs`);

            if (allTabs.length === 0) {
                showModal({
                    icon: '🔍',
                    title: 'ไม่พบ CME Tab',
                    statusItems: [],
                    message: 'กรุณาเปิดหน้า <strong>CME QuikStrike</strong> ก่อน<br>แล้วกด Refresh All อีกครั้ง',
                    buttonText: 'ตกลง',
                    buttonClass: 'modal-btn-primary'
                });
                refreshAllBtn.disabled = false;
                refreshAllBtn.innerHTML = '⚡ Refresh All';
                return;
            }

            let successCount = 0;
            const results = [];

            // Extract from each tab using executeScript to quikstrike frame (same as Refresh)
            for (let i = 0; i < allTabs.length; i++) {
                const tab = allTabs[i];
                refreshAllBtn.innerHTML = `⏳ Tab ${i + 1}/${allTabs.length}...`;
                console.log(`[Refresh All] Processing tab ${tab.id}: ${tab.url?.substring(0, 60)}`);

                try {
                    // Get all frames in this tab
                    const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
                    // Find iframe with quikstrike.net domain (not just path containing 'quikstrike')
                    const qsFrame = frames?.find(f => f.url?.includes('quikstrike.net'));

                    if (!qsFrame) {
                        console.log(`[Refresh All] Tab ${tab.id} - No quikstrike.net iframe found. Frames:`, frames?.map(f => f.url?.substring(0, 50)));
                        results.push({
                            tabId: tab.id,
                            url: tab.url?.substring(0, 40),
                            success: false,
                            error: 'No QuikStrike iframe'
                        });
                        continue;
                    }

                    console.log(`[Refresh All] Tab ${tab.id} - Found quikstrike frame: ${qsFrame.frameId}`);

                    // Step 1: Click refresh button in the page (same as background.js)
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
                            if (clickResult?.[0]?.result?.success) {
                                console.log(`[Refresh All] Tab ${tab.id} - Clicked refresh button`);
                                refreshClicked = true;
                                break;
                            }
                        } catch (e) { /* Skip inaccessible frames */ }
                    }

                    // Wait for chart to refresh if button was clicked
                    if (refreshClicked) {
                        console.log(`[Refresh All] Tab ${tab.id} - Waiting for chart to refresh...`);
                        await new Promise(r => setTimeout(r, 2500));
                    }

                    // Step 2: Execute extraction in quikstrike frame (SAME logic as background.js extractHighchartsData)
                    const extractResults = await chrome.scripting.executeScript({
                        target: { tabId: tab.id, frameIds: [qsFrame.frameId] },
                        func: () => {
                            // This runs in page context of quikstrike frame
                            // EXACT SAME LOGIC as background.js extractHighchartsData()
                            try {
                                if (typeof Highcharts === 'undefined') {
                                    return { success: false, error: 'No Highcharts' };
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

                                // Get Ranges data from dataLabel (NOT from y value!)
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
                                        volSettle: volValue != null ? (volValue * 100) : null,  // Multiply by 100!
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
                        },
                        world: 'MAIN'  // Run in page context to access Highcharts
                    });

                    const response = extractResults?.[0]?.result;

                    if (response?.success && response?.data?.length > 0) {
                        const title = response.data[0]?.title || '';
                        console.log(`[Refresh All] Tab ${tab.id} success:`, title);

                        // Process this data
                        currentData = response;
                        renderData(response, false, false);

                        successCount++;
                        results.push({
                            tabId: tab.id,
                            title: title,
                            success: true
                        });
                    } else {
                        console.log(`[Refresh All] Tab ${tab.id} - extraction failed:`, response?.error);
                        results.push({
                            tabId: tab.id,
                            url: tab.url?.substring(0, 40),
                            success: false,
                            error: response?.error || 'No data'
                        });
                    }
                } catch (error) {
                    console.error(`[Refresh All] Tab ${tab.id} error:`, error);
                    results.push({
                        tabId: tab.id,
                        success: false,
                        error: error.message
                    });
                }

                // Small delay between tabs
                if (i < allTabs.length - 1) {
                    await new Promise(r => setTimeout(r, 300));
                }
            }

            console.log(`[Refresh All] Results:`, results);

            // Show results
            refreshAllBtn.disabled = false;
            refreshAllBtn.innerHTML = '⚡ Refresh All';

            // Check what we have now
            const have = [];
            const missing = [];

            if (volumeData) have.push('✅ Volume');
            else missing.push('Intraday Volume');

            if (oiData) have.push('✅ OI');
            else missing.push('Open Interest');

            if (oiChangeData) have.push('✅ OI Change');
            else missing.push('OI Change');

            if (missing.length === 0) {
                // All complete!
                setConnectionStatus(true, '✅ ข้อมูลครบ!');
                switchDataSource('volume');
                if (volumeData) {
                    currentData = volumeData;
                    renderData(volumeData);
                }

                showModal({
                    icon: '🎉',
                    title: 'ดึงข้อมูลสำเร็จ!',
                    statusItems: [
                        { icon: '✅', text: 'Volume', status: 'success' },
                        { icon: '✅', text: 'Open Interest', status: 'success' },
                        { icon: '✅', text: 'OI Change', status: 'success' }
                    ],
                    message: `ดึงข้อมูลจาก <strong>${successCount} tabs</strong> สำเร็จ<br>ระบบวิเคราะห์และแสดงคำแนะนำให้แล้ว`,
                    buttonText: '🎯 ดูผลวิเคราะห์',
                    buttonClass: 'modal-btn-success'
                });
            } else if (successCount > 0) {
                setConnectionStatus(true, `⚠️ ได้ ${have.length}/3`);

                const statusItems = [
                    { icon: volumeData ? '✅' : '❌', text: 'Volume', status: volumeData ? 'success' : 'error' },
                    { icon: oiData ? '✅' : '❌', text: 'Open Interest', status: oiData ? 'success' : 'error' },
                    { icon: oiChangeData ? '✅' : '❌', text: 'OI Change', status: oiChangeData ? 'success' : 'error' }
                ];

                showModal({
                    icon: '⚠️',
                    title: `ดึงได้ ${have.length}/3 รายการ`,
                    statusItems: statusItems,
                    message: `<strong>💡 วิธีแก้:</strong><br>
                        1. เปิด tab ที่มีข้อมูลที่ขาด<br>
                        2. รอ Chart โหลดเสร็จ<br>
                        3. กด Refresh All อีกครั้ง`,
                    buttonText: 'ตกลง',
                    buttonClass: 'modal-btn-primary'
                });
            } else {
                setConnectionStatus(false, '❌ ดึงไม่ได้');

                showModal({
                    icon: '❌',
                    title: 'ไม่สามารถดึงข้อมูลได้',
                    statusItems: results.map(r => ({
                        icon: '❌',
                        text: r.error || 'ไม่พบข้อมูล',
                        status: 'error'
                    })),
                    message: `<strong>💡 วิธีแก้:</strong><br>
                        1. ตรวจสอบว่าเปิดหน้า CME QuikStrike<br>
                        2. รอ Chart โหลดเสร็จ<br>
                        3. กด Refresh All อีกครั้ง`,
                    buttonText: 'ตกลง',
                    buttonClass: 'modal-btn-primary'
                });
            }

        } catch (error) {
            console.error('[Refresh All] Error:', error);
            refreshAllBtn.disabled = false;
            refreshAllBtn.innerHTML = '⚡ Refresh All';

            showModal({
                icon: '💥',
                title: 'เกิดข้อผิดพลาด',
                statusItems: [],
                message: error.message,
                buttonText: 'ตกลง',
                buttonClass: 'modal-btn-primary'
            });
        }
    }

    // Export to CSV
    function exportToCsv() {
        if (!currentData?.data?.[0]?.tableData) {
            alert('ไม่มีข้อมูลให้ export');
            return;
        }

        const tableData = currentData.data[0].tableData;
        const title = currentData.data[0].title || 'QuikStrike_Data';

        const headers = ['Strike', 'Put_Volume', 'Call_Volume', 'Vol_Settle', 'Range'];
        const rows = tableData.map(row => [
            row.strike,
            row.put ?? '',
            row.call ?? '',
            row.volSettle ?? '',
            row.range ?? ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        downloadFile(csvContent, `${sanitizeFilename(title)}_${getDateString()}.csv`, 'text/csv');
    }

    // Export to JSON
    function exportToJson() {
        if (!currentData?.data) {
            alert('ไม่มีข้อมูลให้ export');
            return;
        }

        const title = currentData.data[0]?.title || 'QuikStrike_Data';
        const jsonContent = JSON.stringify(currentData, null, 2);

        downloadFile(jsonContent, `${sanitizeFilename(title)}_${getDateString()}.json`, 'application/json');
    }

    // Sync to backend
    async function syncToBackend() {
        if (!settings.backendUrl) {
            alert('กรุณาตั้งค่า Backend URL ก่อน');
            settingsPanel.classList.remove('hidden');
            return;
        }

        // Check if we have any data to sync
        if (!volumeData && !oiData && !oiChangeData) {
            alert('ไม่มีข้อมูลให้ sync\nกรุณา Refresh All เพื่อดึงข้อมูลก่อน');
            return;
        }

        syncBackendBtn.disabled = true;
        syncBackendBtn.innerHTML = '⏳ Syncing...';

        try {
            // Build comprehensive payload with all data sources
            const payload = {
                success: true,
                syncedAt: new Date().toISOString(),
                volumeData: volumeData || null,
                oiData: oiData || null,
                oiChangeData: oiChangeData || null,
                // For backward compatibility, also send as 'data' array
                data: []
            };

            // Add volume data (primary for trading signals)
            if (volumeData?.data?.[0]) {
                payload.data.push({
                    ...volumeData.data[0],
                    dataType: 'volume'
                });
            }

            // Add OI data
            if (oiData?.data?.[0]) {
                payload.data.push({
                    ...oiData.data[0],
                    dataType: 'oi'
                });
            }

            // Add OI Change data
            if (oiChangeData?.data?.[0]) {
                payload.data.push({
                    ...oiChangeData.data[0],
                    dataType: 'oichange'
                });
            }

            // Debug: log what we're sending
            console.log('[Sync] Payload summary:', {
                hasVolumeData: !!payload.volumeData?.data?.[0],
                volumeTitle: payload.volumeData?.data?.[0]?.title,
                hasOiData: !!payload.oiData?.data?.[0],
                oiTitle: payload.oiData?.data?.[0]?.title,
                hasOiChangeData: !!payload.oiChangeData?.data?.[0],
                oiChangeTitle: payload.oiChangeData?.data?.[0]?.title,
                dataArrayLength: payload.data.length
            });

            const response = await fetch(settings.backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                const synced = [];
                if (volumeData) synced.push('Volume');
                if (oiData) synced.push('OI');
                if (oiChangeData) synced.push('OI Change');
                alert(`✅ Sync สำเร็จ!\n\nข้อมูลที่ส่ง: ${synced.join(', ')}`);
            } else {
                const errorText = await response.text();
                alert(`❌ Sync ล้มเหลว: ${response.status}\n${errorText}`);
            }
        } catch (error) {
            alert(`❌ Error: ${error.message}`);
        }

        syncBackendBtn.disabled = false;
        syncBackendBtn.innerHTML = '☁️ Sync to Backend';
    }

    // Save settings
    function saveSettings() {
        settings = {
            autoRefresh: autoRefreshToggle.checked,
            refreshInterval: parseInt(refreshIntervalInput.value) || 5,
            backendUrl: backendUrlInput.value.trim(),
            syncToBackend: autoSyncToggle.checked
        };

        chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: settings }, () => {
            refreshIntervalEl.textContent = `${settings.refreshInterval} min`;
            alert('✅ Settings saved!');
            settingsPanel.classList.add('hidden');
        });
    }

    // Helper: Download file
    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Helper: Sanitize filename
    function sanitizeFilename(name) {
        return name.replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    // Helper: Get date string
    function getDateString() {
        const now = new Date();
        return now.toISOString().slice(0, 10).replace(/-/g, '');
    }

    // Listen for data updates from background
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'DATA_UPDATED') {
            currentData = message.payload;
            renderData(currentData);
        }
    });

    // Show Help/Guide
    function showHelp() {
        const guide = `
📖 วิธีใช้งาน CME QuikStrike Extractor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 ขั้นตอนการดึงข้อมูล (3 ประเภท):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Intraday Volume (สัญญาณหลัก)
   • ที่ CME เลือก "Intraday Volume"
   • กลับมากด Refresh

2️⃣ Open Interest (แนวรับ/ต้าน)
   • ที่ CME เลือก "Open Interest"
   • กลับมากด Refresh

3️⃣ OI Change (ยืนยันเงินไหล)
   • ที่ CME เลือก "OI Change"
   • กลับมากด Refresh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 การอ่านสัญญาณ:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• ซื้อ (แข็งแกร่ง) = เข้าได้!
• ซื้อ (อ่อน) = รอ confirm
• ไซด์เวย์ = Range Trade
• ขาย (อ่อน) = รอ confirm
• ขาย (แข็งแกร่ง) = เข้าได้!
• ห้ามเทรด! = PCR สุดขั้ว

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏰ ช่วงเวลาที่ดีที่สุด:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🇺🇸 New York (19:00-02:00) = แม่นที่สุด
🇬🇧 London (14:00-19:00) = ปกติ
🌏 Asia (07:00-14:00) = ระวัง สัญญาณอาจหลอก
        `.trim();

        alert(guide);
    }

    // ============================================
    // Remote Sync Listener (SSE from Backend)
    // ============================================

    let syncEventSource = null;
    let syncPollInterval = null;

    /**
     * Connect to backend sync stream (SSE)
     */
    function connectToSyncStream() {
        if (!settings.backendUrl) {
            console.log('[Remote Sync] No backend URL configured');
            return;
        }

        const syncUrl = settings.backendUrl.replace('/api/data', '/api/sync');
        console.log('[Remote Sync] Connecting to:', syncUrl);

        // Close existing connection if any
        if (syncEventSource) {
            syncEventSource.close();
            syncEventSource = null;
        }

        try {
            syncEventSource = new EventSource(syncUrl);

            syncEventSource.onopen = () => {
                console.log('[Remote Sync] Connected to sync stream');
                showToast('success', '🔗 เชื่อมต่อสำเร็จ', 'พร้อมรับคำสั่งจาก Dashboard');
            };

            syncEventSource.onmessage = async (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('[Remote Sync] Received:', data);

                    if (data.type === 'SYNC_COMMAND') {
                        await handleRemoteSyncCommand(data.command);
                    } else if (data.type === 'PENDING_COMMANDS') {
                        // Handle any pending commands from before connection
                        for (const cmd of data.commands) {
                            await handleRemoteSyncCommand(cmd);
                        }
                    } else if (data.type === 'PING') {
                        // Keep-alive, do nothing
                    }
                } catch (e) {
                    console.error('[Remote Sync] Error parsing message:', e);
                }
            };

            syncEventSource.onerror = (error) => {
                console.error('[Remote Sync] SSE error:', error);
                syncEventSource.close();
                syncEventSource = null;

                // Fall back to polling
                console.log('[Remote Sync] Falling back to polling mode');
                startSyncPolling();
            };

        } catch (e) {
            console.error('[Remote Sync] Failed to connect SSE:', e);
            // Fall back to polling
            startSyncPolling();
        }
    }

    /**
     * Fallback: Poll for sync commands
     */
    function startSyncPolling() {
        if (syncPollInterval) {
            clearInterval(syncPollInterval);
        }

        if (!settings.backendUrl) return;

        const pollUrl = settings.backendUrl.replace('/api/data', '/api/sync') + '?mode=poll';

        syncPollInterval = setInterval(async () => {
            try {
                const response = await fetch(pollUrl);
                const data = await response.json();

                if (data.success && data.commands?.length > 0) {
                    for (const cmd of data.commands) {
                        await handleRemoteSyncCommand(cmd);
                    }
                }
            } catch (e) {
                console.error('[Remote Sync] Poll error:', e);
            }
        }, 10000); // Poll every 10 seconds
    }

    /**
     * Handle remote sync command
     */
    async function handleRemoteSyncCommand(command) {
        console.log('[Remote Sync] Handling command:', command.type);

        // Show receiving command notification
        showToast('info', '📡 คำสั่งจาก Dashboard', `กำลังรับคำสั่ง: ${getCommandLabel(command.type)}`);

        const startTime = Date.now();
        let refreshResult = { success: false, have: [], missing: [] };
        let syncResult = { success: false };

        try {
            switch (command.type) {
                case 'REFRESH_ALL':
                    // NEW: Collect all data from Gold (Intraday, OI, OI Change) then sync
                    refreshResult = await collectAllGoldData();

                    // Sync all collected data to backend
                    if (settings.syncToBackend && refreshResult.success) {
                        await syncToBackend();
                        syncResult = { success: true };
                    }
                    break;

                case 'REFRESH_VOLUME':
                    setActiveSource('volume');
                    await refreshData();
                    refreshResult = { success: true, have: ['Volume'], missing: ['OI', 'OI Change'] };
                    if (settings.syncToBackend) {
                        await syncToBackend();
                        syncResult = { success: true };
                    }
                    break;

                case 'REFRESH_OI':
                    setActiveSource('oi');
                    await refreshData();
                    refreshResult = { success: true, have: ['OI'], missing: ['Volume', 'OI Change'] };
                    if (settings.syncToBackend) {
                        await syncToBackend();
                        syncResult = { success: true };
                    }
                    break;

                case 'REFRESH_OI_CHANGE':
                    setActiveSource('oichange');
                    await refreshData();
                    refreshResult = { success: true, have: ['OI Change'], missing: ['Volume', 'OI'] };
                    if (settings.syncToBackend) {
                        await syncToBackend();
                        syncResult = { success: true };
                    }
                    break;
            }

            // Acknowledge command
            await acknowledgeCommand(command.id);

            const duration = ((Date.now() - startTime) / 1000).toFixed(1);

            // Show success modal
            showRemoteSyncSuccessModal(command, refreshResult, syncResult, duration);

        } catch (error) {
            console.error('[Remote Sync] Error handling command:', error);

            // Show error modal
            showModal({
                icon: '❌',
                title: 'Remote Sync ล้มเหลว',
                statusItems: [
                    { icon: '❌', text: error.message || 'Unknown error', status: 'error' }
                ],
                message: `<strong>คำสั่งจาก Dashboard:</strong> ${getCommandLabel(command.type)}<br><br>
                    <strong>💡 วิธีแก้:</strong><br>
                    1. ตรวจสอบว่าเปิดหน้า CME QuikStrike<br>
                    2. รอ Chart โหลดเสร็จ<br>
                    3. ลองใหม่อีกครั้ง`,
                buttonText: 'ตกลง',
                buttonClass: 'modal-btn-primary'
            });
        }
    }

    /**
     * Collect all Gold data by opening 3 separate tabs (Intraday, OI, OI Change)
     * If tabs already exist, just refreshAll(). Otherwise open new tabs first.
     */
    async function collectAllGoldData() {
        console.log('[Remote Sync] Starting collectAllGoldData...');

        try {
            // Step 1: Check if CME tabs already exist
            const existingTabs = await chrome.tabs.query({ url: '*://*.cmegroup.com/*quikstrike*' });
            console.log(`[Remote Sync] Found ${existingTabs.length} existing CME tabs`);

            if (existingTabs.length >= 3) {
                // Already have enough tabs, just refresh
                showToast('info', '📊 Refresh All', 'มี CME tabs อยู่แล้ว กำลัง refresh...');
                console.log('[Remote Sync] Using existing tabs, calling refreshAll()...');

            } else {
                // Need to open new tabs
                const views = [
                    { key: 'intraday', label: 'Intraday Volume' },
                    { key: 'oi', label: 'Open Interest' },
                    { key: 'oichange', label: 'OI Change' }
                ];

                // Calculate how many more tabs needed
                const tabsNeeded = 3 - existingTabs.length;
                const viewsToOpen = views.slice(existingTabs.length);

                showToast('info', '🌐 เปิด CME', `กำลังเปิด ${tabsNeeded} tabs สำหรับ Gold...`);
                console.log(`[Remote Sync] Need to open ${tabsNeeded} more tabs`);

                for (let i = 0; i < viewsToOpen.length; i++) {
                    const view = viewsToOpen[i];
                    showToast('info', '🌐 เปิด Tab', `${i + 1}/${tabsNeeded}: ${view.label}...`);
                    console.log(`[Remote Sync] Opening tab: ${view.key}`);

                    // Store pending product for this tab
                    await chrome.storage.local.set({
                        pendingProduct: {
                            key: 'gold',
                            view: view.key,
                            timestamp: Date.now()
                        }
                    });

                    // Open new tab
                    const tab = await chrome.tabs.create({
                        url: CME_QUIKSTRIKE_URL,
                        active: false
                    });

                    console.log(`[Remote Sync] Tab created:`, tab.id);

                    // Wait for tab to fully load
                    await waitForTabLoad(tab.id, 20000);
                    console.log(`[Remote Sync] Tab loaded`);

                    // Wait for product-selector.js to process and clear pendingProduct
                    let attempts = 0;
                    while (attempts < 15) {
                        const storage = await chrome.storage.local.get('pendingProduct');
                        if (!storage.pendingProduct) {
                            console.log(`[Remote Sync] Product selection complete`);
                            break;
                        }
                        await new Promise(r => setTimeout(r, 1000));
                        attempts++;
                    }

                    // Extra wait for chart to render
                    await new Promise(r => setTimeout(r, 2000));
                }

                // Wait for all charts to stabilize
                showToast('info', '⏳ รอ Charts', 'รอ charts โหลดเสร็จ...');
                await new Promise(r => setTimeout(r, 3000));
            }

            // Step 2: Call refreshAll() to extract data from all tabs
            showToast('info', '📊 Refresh All', 'กำลังดึงข้อมูลจากทุก tabs...');
            console.log('[Remote Sync] Calling refreshAll()...');
            await refreshAll();

            console.log('[Remote Sync] refreshAll() complete');

            return {
                success: true,
                have: ['Volume', 'OI', 'OI Change'],
                missing: []
            };

        } catch (e) {
            console.error('[Remote Sync] collectAllGoldData error:', e);
            return { success: false, have: [], missing: ['Volume', 'OI', 'OI Change'], error: e.message };
        }
    }

    /**
     * Wait for chart to be ready in the tab
     */
    async function waitForChartReady(tabId, maxAttempts = 10) {
        console.log('[Remote Sync] waitForChartReady:', tabId);

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            try {
                const frames = await chrome.webNavigation.getAllFrames({ tabId });
                const qsFrame = frames?.find(f => f.url?.includes('quikstrike.net'));

                if (!qsFrame) {
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                const result = await chrome.scripting.executeScript({
                    target: { tabId, frameIds: [qsFrame.frameId] },
                    func: () => {
                        // Check if Highcharts is ready and has data
                        if (typeof Highcharts === 'undefined' || !Highcharts.charts) {
                            return { ready: false, reason: 'No Highcharts' };
                        }

                        const chart = Highcharts.charts.find(c => c && c.series && c.series.length > 0);
                        if (!chart) {
                            return { ready: false, reason: 'No chart' };
                        }

                        // Check if chart has data
                        const hasData = chart.series.some(s => s.data && s.data.length > 0);
                        if (!hasData) {
                            return { ready: false, reason: 'No data' };
                        }

                        return { ready: true };
                    },
                    world: 'MAIN'
                });

                if (result?.[0]?.result?.ready) {
                    console.log('[Remote Sync] Chart is ready');
                    return true;
                }

                console.log('[Remote Sync] Chart not ready:', result?.[0]?.result?.reason);
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.log('[Remote Sync] waitForChartReady error:', e.message);
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        console.log('[Remote Sync] Chart ready timeout, proceeding anyway');
        return false;
    }

    /**
     * Wait for tab to complete loading
     */
    function waitForTabLoad(tabId, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const checkTab = async () => {
                try {
                    const tab = await chrome.tabs.get(tabId);
                    if (tab.status === 'complete') {
                        // Wait additional time for iframe to load
                        setTimeout(resolve, 3000);
                        return;
                    }

                    if (Date.now() - startTime > timeout) {
                        reject(new Error('Tab load timeout'));
                        return;
                    }

                    setTimeout(checkTab, 500);
                } catch (e) {
                    reject(e);
                }
            };

            checkTab();
        });
    }

    /**
     * Select product and view in a specific tab
     */
    async function selectProductAndView(tabId, productKey, viewType) {
        console.log('[Remote Sync] selectProductAndView:', tabId, productKey, viewType);

        // Store pending selection
        await chrome.storage.local.set({
            pendingProduct: {
                key: productKey,
                view: viewType,
                timestamp: Date.now()
            }
        });

        // Send message to content script to trigger selection
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, {
                type: 'SELECT_PRODUCT_NOW',
                productKey: productKey,
                view: viewType
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('[Remote Sync] SELECT_PRODUCT_NOW failed, waiting for product-selector...');
                    // Let the product-selector.js handle it via pendingProduct storage
                    setTimeout(resolve, 5000); // Wait for automatic selection
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Select view (Intraday, OI, OI Change) in a specific tab
     */
    async function selectViewInTab(tabId, viewType) {
        console.log('[Remote Sync] selectViewInTab:', tabId, viewType);

        const VIEW_SELECTORS = {
            intraday: {
                selector: '#MainContent_ucViewControl_IntegratedV2VExpectedRange_lbIntradayVolume',
                fallbackText: 'Intraday'
            },
            oi: {
                selector: '#MainContent_ucViewControl_IntegratedV2VExpectedRange_lbOpenInterest',
                fallbackText: 'Open Interest'
            },
            oichange: {
                selector: '#MainContent_ucViewControl_IntegratedV2VExpectedRange_lbOIChange',
                fallbackText: 'OI Change'
            }
        };

        const view = VIEW_SELECTORS[viewType];
        if (!view) {
            throw new Error(`Unknown view type: ${viewType}`);
        }

        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'CLICK_VIEW_IN_TAB',
                tabId: tabId,
                viewKey: viewType,
                selector: view.selector,
                fallbackText: view.fallbackText
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Extract data from a specific tab's QuikStrike iframe
     */
    async function extractDataFromTab(tabId) {
        console.log('[Remote Sync] extractDataFromTab:', tabId);

        try {
            const frames = await chrome.webNavigation.getAllFrames({ tabId });
            const qsFrame = frames?.find(f => f.url?.includes('quikstrike.net'));

            if (!qsFrame) {
                console.log('[Remote Sync] No quikstrike iframe found');
                return null;
            }

            // Execute extraction script
            const result = await chrome.scripting.executeScript({
                target: { tabId, frameIds: [qsFrame.frameId] },
                func: () => {
                    // Same extraction logic as content.js
                    if (typeof Highcharts === 'undefined' || !Highcharts.charts) {
                        return null;
                    }

                    const chart = Highcharts.charts.find(c => c && c.series && c.series.length > 0);
                    if (!chart) return null;

                    const data = [];
                    chart.series.forEach(series => {
                        if (series.data && series.data.length > 0) {
                            series.data.forEach(point => {
                                if (point && point.category !== undefined && point.y !== undefined) {
                                    data.push({
                                        strike: point.category,
                                        value: point.y,
                                        series: series.name || 'Unknown',
                                        color: point.color || series.color
                                    });
                                }
                            });
                        }
                    });

                    // Get title
                    const titleEl = document.querySelector('.chart-title, .highcharts-title, h1, h2');
                    const title = titleEl?.textContent?.trim() ||
                        document.querySelector('#ctl00_ucSelector_lblExpiration')?.textContent?.trim() ||
                        'CME Data';

                    return {
                        title: title,
                        data: data,
                        timestamp: Date.now(),
                        source: window.location.href
                    };
                },
                world: 'MAIN'
            });

            return result?.[0]?.result || null;
        } catch (e) {
            console.error('[Remote Sync] extractDataFromTab error:', e);
            return null;
        }
    }

    /**
     * Get command label in Thai
     */
    function getCommandLabel(type) {
        const labels = {
            'REFRESH_ALL': 'ดึงข้อมูลทั้งหมด',
            'REFRESH_VOLUME': 'ดึง Volume',
            'REFRESH_OI': 'ดึง Open Interest',
            'REFRESH_OI_CHANGE': 'ดึง OI Change'
        };
        return labels[type] || type;
    }

    /**
     * Show success modal for remote sync
     */
    function showRemoteSyncSuccessModal(command, refreshResult, syncResult, duration) {
        const statusItems = [];

        // Add refresh status
        statusItems.push({
            icon: '📥',
            text: `ดึงข้อมูล: ${getCommandLabel(command.type)}`,
            status: 'success'
        });

        // Add what we have
        if (refreshResult.have.length > 0) {
            refreshResult.have.forEach(item => {
                statusItems.push({
                    icon: '✅',
                    text: item,
                    status: 'success'
                });
            });
        }

        // Add sync status
        if (syncResult.success) {
            statusItems.push({
                icon: '☁️',
                text: 'อัพโหลดไป Backend',
                status: 'success'
            });
        }

        // Add timing
        statusItems.push({
            icon: '⏱️',
            text: `เวลา: ${duration} วินาที`,
            status: 'info'
        });

        showModal({
            icon: '🎉',
            title: 'Remote Sync สำเร็จ!',
            statusItems: statusItems,
            message: `<div style="text-align: center; padding: 10px; background: linear-gradient(135deg, rgba(34,197,94,0.1), rgba(59,130,246,0.1)); border-radius: 8px; margin-top: 10px;">
                <span style="font-size: 24px;">📡</span>
                <p style="margin: 8px 0 0 0; color: #10b981; font-weight: 500;">คำสั่งจาก Dashboard ดำเนินการสำเร็จ</p>
                <p style="margin: 4px 0 0 0; font-size: 12px; color: #6b7280;">ข้อมูลถูกส่งไป Backend เรียบร้อยแล้ว</p>
            </div>`,
            buttonText: '🎯 ดูผลวิเคราะห์',
            buttonClass: 'modal-btn-success'
        });
    }

    /**
     * Acknowledge command completion
     */
    async function acknowledgeCommand(commandId) {
        if (!settings.backendUrl) return;

        const ackUrl = settings.backendUrl.replace('/api/data', '/api/sync');

        try {
            await fetch(ackUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'acknowledge',
                    commandId
                })
            });
        } catch (e) {
            console.error('[Remote Sync] Failed to acknowledge:', e);
        }
    }

    /**
     * Set active data source tab
     */
    function setActiveSource(source) {
        activeSource = source;

        // Update tab UI
        [tabVolume, tabOI, tabOIChange].forEach(tab => tab?.classList.remove('active'));
        [volIndicator, oiIndicator, oiChgIndicator].forEach(ind => ind?.classList.remove('has-data'));

        if (source === 'volume' && tabVolume) {
            tabVolume.classList.add('active');
        } else if (source === 'oi' && tabOI) {
            tabOI.classList.add('active');
        } else if (source === 'oichange' && tabOIChange) {
            tabOIChange.classList.add('active');
        }
    }

    // Start remote sync connection after settings loaded
    setTimeout(() => {
        if (settings.backendUrl) {
            connectToSyncStream();
        }
    }, 2000);

    // Event Listeners
    refreshBtn.addEventListener('click', refreshData);
    refreshAllBtn?.addEventListener('click', refreshAll);
    helpBtn?.addEventListener('click', showHelp);
    exportCsvBtn.addEventListener('click', exportToCsv);
    exportJsonBtn.addEventListener('click', exportToJson);
    syncBackendBtn.addEventListener('click', syncToBackend);

    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });

    saveSettingsBtn.addEventListener('click', () => {
        saveSettings();
        // Reconnect to sync stream with new URL
        if (settings.backendUrl) {
            connectToSyncStream();
        }
    });

    autoRefreshToggle.addEventListener('change', () => {
        settings.autoRefresh = autoRefreshToggle.checked;
        chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: settings });
    });
});
