// CME QuikStrike Data Extractor - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
    // Elements
    const productNameEl = document.getElementById('productName');
    const lastUpdateEl = document.getElementById('lastUpdate');
    const connectionStatusEl = document.getElementById('connectionStatus');
    const tableBodyEl = document.getElementById('tableBody');
    const autoRefreshToggle = document.getElementById('autoRefreshToggle');
    const refreshIntervalEl = document.getElementById('refreshInterval');

    // Buttons
    const refreshBtn = document.getElementById('refreshBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const syncBackendBtn = document.getElementById('syncBackendBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    // Settings elements
    const settingsPanel = document.getElementById('settingsPanel');
    const backendUrlInput = document.getElementById('backendUrl');
    const refreshIntervalInput = document.getElementById('refreshIntervalInput');
    const autoSyncToggle = document.getElementById('autoSyncToggle');

    let currentData = null;
    let settings = {};

    // Initialize
    await loadSettings();
    await loadData();
    await checkConnection();

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
                chrome.tabs.sendMessage(tab.id, { type: 'PING' }, (response) => {
                    if (chrome.runtime.lastError) {
                        setConnectionStatus(false, 'Content script not loaded - refresh page');
                    } else if (response?.pong) {
                        setConnectionStatus(true, response.hasHighcharts ? 'Connected to QuikStrike' : 'QuikStrike chart not found');
                    }
                });
            } else {
                setConnectionStatus(false, 'กรุณาเปิดหน้า CME QuikStrike');
            }
        } catch (error) {
            setConnectionStatus(false, 'Error checking connection');
        }
    }

    // Set connection status UI
    function setConnectionStatus(connected, message) {
        connectionStatusEl.className = `connection-status ${connected ? 'connected' : 'disconnected'}`;
        connectionStatusEl.querySelector('.text').textContent = message;
    }

    // Render data to table
    function renderData(data) {
        if (!data?.success || !data.data?.length) {
            tableBodyEl.innerHTML = '<tr><td colspan="5" class="no-data">ไม่มีข้อมูล - กดปุ่ม Refresh</td></tr>';
            return;
        }

        const chartData = data.data[0];
        productNameEl.textContent = chartData.title || '-';
        lastUpdateEl.textContent = formatTime(data.extractedAt);

        const tableData = chartData.tableData || [];

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

    // Refresh data
    async function refreshData() {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳ Loading...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (tab?.url?.includes('cmegroup.com')) {
                chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_DATA' }, (response) => {
                    if (chrome.runtime.lastError) {
                        alert('ไม่สามารถดึงข้อมูลได้ - กรุณา refresh หน้า QuikStrike');
                    } else if (response?.success) {
                        currentData = response;
                        renderData(currentData);
                        // Save to background
                        chrome.runtime.sendMessage({ type: 'CHART_DATA', payload: response });
                        setConnectionStatus(true, 'Data refreshed');
                    } else {
                        alert(response?.error || 'ไม่พบข้อมูล Highcharts');
                    }

                    refreshBtn.disabled = false;
                    refreshBtn.textContent = '🔄 Refresh Now';
                });
            } else {
                alert('กรุณาเปิดหน้า CME QuikStrike ก่อน');
                refreshBtn.disabled = false;
                refreshBtn.textContent = '🔄 Refresh Now';
            }
        } catch (error) {
            console.error('Refresh error:', error);
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄 Refresh Now';
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

        if (!currentData) {
            alert('ไม่มีข้อมูลให้ sync');
            return;
        }

        syncBackendBtn.disabled = true;
        syncBackendBtn.textContent = '⏳ Syncing...';

        try {
            const response = await fetch(settings.backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentData)
            });

            if (response.ok) {
                alert('✅ Sync สำเร็จ!');
            } else {
                alert(`❌ Sync ล้มเหลว: ${response.status}`);
            }
        } catch (error) {
            alert(`❌ Error: ${error.message}`);
        }

        syncBackendBtn.disabled = false;
        syncBackendBtn.textContent = '☁️ Sync';
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

    // Event Listeners
    refreshBtn.addEventListener('click', refreshData);
    exportCsvBtn.addEventListener('click', exportToCsv);
    exportJsonBtn.addEventListener('click', exportToJson);
    syncBackendBtn.addEventListener('click', syncToBackend);

    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
    });

    saveSettingsBtn.addEventListener('click', saveSettings);

    autoRefreshToggle.addEventListener('change', () => {
        settings.autoRefresh = autoRefreshToggle.checked;
        chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', payload: settings });
    });
});
