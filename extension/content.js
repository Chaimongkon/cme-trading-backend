// CME QuikStrike Data Extractor - Content Script
// ดึงข้อมูลจาก Highcharts object โดยใช้ script injection

(function () {
  'use strict';

  // ป้องกันการ inject ซ้ำ
  if (window.__cmeExtractorLoaded) return;
  window.__cmeExtractorLoaded = true;

  const currentUrl = window.location.href;
  console.log('[CME Extractor] Content script loaded in:', currentUrl);

  let pendingResolve = null;

  // Listen for results from injected script
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'CME_EXTRACTOR_RESULT') {
      console.log('[CME Extractor] Received result from page:', event.data.payload?.success);
      if (pendingResolve) {
        pendingResolve(event.data.payload);
        pendingResolve = null;
      }
      // Also send to background
      if (event.data.payload?.success) {
        try {
          chrome.runtime.sendMessage({
            type: 'CHART_DATA',
            payload: event.data.payload
          });
        } catch (e) {
          console.log('[CME Extractor] Cannot send to background:', e.message);
        }
      }
    }
  });

  // Inject script into page to access Highcharts
  function injectAndExtract() {
    return new Promise((resolve) => {
      pendingResolve = resolve;

      // Set timeout in case injection fails
      setTimeout(() => {
        if (pendingResolve) {
          pendingResolve({ success: false, error: 'Injection timeout' });
          pendingResolve = null;
        }
      }, 3000);

      // Inject the script
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      script.onload = () => script.remove();
      script.onerror = () => {
        resolve({ success: false, error: 'Script injection failed' });
        pendingResolve = null;
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }

  // Direct extraction (for same-origin)
  function extractDirect() {
    if (typeof Highcharts === 'undefined') {
      return { success: false, error: 'Highcharts not found' };
    }

    const charts = Highcharts.charts?.filter(c => c && c.series?.length > 0) || [];
    if (charts.length === 0) {
      return { success: false, error: 'No charts with data found' };
    }

    const results = [];

    charts.forEach((chart, chartIndex) => {
      const chartData = {
        chartIndex,
        title: chart.title?.textStr || chart.options?.title?.text || `Chart ${chartIndex}`,
        subtitle: chart.subtitle?.textStr || '',
        series: {},
        extractedAt: new Date().toISOString(),
        frameUrl: currentUrl
      };

      chart.series.forEach((series) => {
        const seriesName = series.name || `Series ${series.index}`;
        chartData.series[seriesName] = series.data.map(point => ({
          strike: point.x ?? point.category,
          value: point.y,
          category: point.category || null
        }));
      });

      // Create table data
      const putData = chartData.series['Put'] || [];
      const callData = chartData.series['Call'] || [];
      const volSettleData = chartData.series['Vol Settle'] || [];
      const rangesData = chartData.series['Ranges'] || [];

      const strikeMap = {};

      putData.forEach(p => {
        if (p.strike != null) {
          if (!strikeMap[p.strike]) strikeMap[p.strike] = { strike: p.strike };
          strikeMap[p.strike].put = p.value;
        }
      });

      callData.forEach(p => {
        if (p.strike != null) {
          if (!strikeMap[p.strike]) strikeMap[p.strike] = { strike: p.strike };
          strikeMap[p.strike].call = p.value;
        }
      });

      volSettleData.forEach(p => {
        if (p.strike != null) {
          if (!strikeMap[p.strike]) strikeMap[p.strike] = { strike: p.strike };
          strikeMap[p.strike].volSettle = p.value;
        }
      });

      const rangesMap = {};
      rangesData.forEach(p => {
        if (p.strike != null) rangesMap[p.strike] = p.value;
      });

      chartData.tableData = Object.values(strikeMap)
        .map(row => ({ ...row, range: rangesMap[row.strike] ?? null }))
        .sort((a, b) => a.strike - b.strike);

      results.push(chartData);
    });

    return {
      success: true,
      data: results,
      pageUrl: currentUrl,
      extractedAt: new Date().toISOString()
    };
  }

  // Main extraction function - tries both methods
  async function extract() {
    console.log('[CME Extractor] Starting extraction...');

    // Try direct first
    let result = extractDirect();
    if (result.success) {
      console.log('[CME Extractor] Direct extraction succeeded');
      return result;
    }

    // Try injection method
    console.log('[CME Extractor] Trying script injection...');
    result = await injectAndExtract();
    return result;
  }

  // Change Volume Type using ASP.NET __doPostBack (via page injection)
  async function changeVolumeType(targetType) {
    // targetType: 'volume' | 'oi' | 'oichange'
    console.log('[CME Extractor] Changing volume type to:', targetType);
    
    return new Promise((resolve) => {
      // ASP.NET PostBack targets for CME QuikStrike
      const postBackTargets = {
        'volume': 'ctl00$MainContent$ucViewControl_IntegratedV2VExpectedRange$lbIntradayVolume',
        'oi': 'ctl00$MainContent$ucViewControl_IntegratedV2VExpectedRange$lbOI',
        'oichange': 'ctl00$MainContent$ucViewControl_IntegratedV2VExpectedRange$lbOIChg'
      };
      
      const target = postBackTargets[targetType];
      if (!target) {
        console.log('[CME Extractor] Invalid target type:', targetType);
        resolve({ success: false, error: 'Invalid type' });
        return;
      }
      
      // Method 1: Try to find and click the link directly (most reliable)
      const links = document.querySelectorAll('a');
      for (const link of links) {
        const href = link.getAttribute('href') || '';
        const onclick = link.getAttribute('onclick') || '';
        const id = link.id || '';
        
        // Check if this link triggers the postback we want
        if (href.includes(target) || onclick.includes(target) || 
            id.includes('lbIntradayVolume') && targetType === 'volume' ||
            id.includes('lbOI') && targetType === 'oi' && !id.includes('lbOIChg') ||
            id.includes('lbOIChg') && targetType === 'oichange') {
          
          console.log('[CME Extractor] Found link:', link.id || link.textContent?.trim());
          
          // Set up listener for page changes
          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              resolve({ success: true, message: 'Link clicked (timeout)' });
            }
          }, 4000);
          
          // Click the link
          link.click();
          
          // Wait for chart to update
          const checkInterval = setInterval(() => {
            if (typeof Highcharts !== 'undefined' && Highcharts.charts?.some(c => c?.series?.length > 0)) {
              clearInterval(checkInterval);
              clearTimeout(timeout);
              if (!resolved) {
                resolved = true;
                console.log('[CME Extractor] Chart detected after click');
                setTimeout(() => resolve({ success: true, message: 'Chart updated' }), 1500);
              }
            }
          }, 500);
          
          return;
        }
      }
      
      // Method 2: Inject script to call __doPostBack directly
      console.log('[CME Extractor] Link not found, injecting postback script...');
      
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          try {
            if (typeof __doPostBack === 'function') {
              console.log('[CME Injected] Calling __doPostBack for: ${target}');
              __doPostBack('${target}', '');
              window.postMessage({ type: 'CME_POSTBACK_DONE', success: true }, '*');
            } else {
              console.log('[CME Injected] __doPostBack not found');
              window.postMessage({ type: 'CME_POSTBACK_DONE', success: false, error: 'No __doPostBack' }, '*');
            }
          } catch(e) {
            console.error('[CME Injected] Error:', e);
            window.postMessage({ type: 'CME_POSTBACK_DONE', success: false, error: e.message }, '*');
          }
        })();
      `;
      
      // Listen for result
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: 'PostBack timeout' });
        }
      }, 5000);
      
      const messageHandler = (event) => {
        if (event.data?.type === 'CME_POSTBACK_DONE') {
          window.removeEventListener('message', messageHandler);
          clearTimeout(timeout);
          
          if (!resolved) {
            resolved = true;
            if (event.data.success) {
              // Wait for chart to update
              setTimeout(() => {
                resolve({ success: true, message: 'PostBack executed' });
              }, 2000);
            } else {
              resolve({ success: false, error: event.data.error || 'PostBack failed' });
            }
          }
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Inject and execute
      document.head.appendChild(script);
      script.remove();
    });
  }

  // Listen for messages from popup/sidepanel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only respond if we're in quikstrike.net frame (where Highcharts lives)
    const isQuikStrikeFrame = currentUrl.includes('quikstrike.net');
    
    if (message.type === 'EXTRACT_DATA') {
      // If not in quikstrike frame, don't respond at all
      if (!isQuikStrikeFrame) {
        console.log('[CME Extractor] Not quikstrike frame, ignoring EXTRACT_DATA');
        return false;
      }
      
      console.log('[CME Extractor] Extracting data from quikstrike frame...');
      
      extract().then(result => {
        console.log('[CME Extractor] Extract result:', result.success, result.error || '');
        sendResponse(result);
      });
      return true; // Keep channel open for async
    }

    if (message.type === 'CHANGE_VOLUME_TYPE') {
      // This should only be handled by quikstrike frame
      if (!isQuikStrikeFrame) {
        console.log('[CME Extractor] Not quikstrike frame, ignoring CHANGE_VOLUME_TYPE');
        return false;
      }
      
      changeVolumeType(message.volumeType).then(async (result) => {
        console.log('[CME Extractor] Change result:', result);
        if (result.success) {
          // Wait for ASP.NET postback to complete and chart to render
          console.log('[CME Extractor] Waiting for chart to render...');
          await new Promise(r => setTimeout(r, 2500));
          
          // Try multiple times to extract
          let extractResult = null;
          for (let i = 0; i < 3; i++) {
            extractResult = await extract();
            if (extractResult.success && extractResult.data?.length > 0) {
              console.log('[CME Extractor] Extract successful on attempt', i + 1);
              break;
            }
            console.log('[CME Extractor] Extract attempt', i + 1, 'failed, retrying...');
            await new Promise(r => setTimeout(r, 1000));
          }
          sendResponse(extractResult);
        } else {
          sendResponse(result);
        }
      });
      return true;
    }

    if (message.type === 'PING') {
      // Only quikstrike frame should respond to PING
      if (!isQuikStrikeFrame) {
        return false;
      }
      
      const hasHighcharts = typeof Highcharts !== 'undefined';
      const hasCharts = hasHighcharts && Highcharts.charts?.some(c => c && c.series?.length > 0);
      sendResponse({
        pong: true,
        hasHighcharts: hasHighcharts,
        hasCharts: hasCharts,
        frameUrl: currentUrl
      });
      return true;
    }

    return false;
  });

  // Auto-extract after page load
  function autoExtract() {
    setTimeout(async () => {
      const result = await extract();
      if (result.success) {
        console.log('[CME Extractor] Auto-extract succeeded:', result.data[0]?.title);
        try {
          chrome.runtime.sendMessage({ type: 'CHART_DATA', payload: result });
        } catch (e) { }
      } else {
        console.log('[CME Extractor] Auto-extract failed:', result.error);
      }
    }, 2000);
  }

  // Wait for page to be ready
  if (document.readyState === 'complete') {
    autoExtract();
  } else {
    window.addEventListener('load', autoExtract);
  }

  console.log('[CME Extractor] Content script initialized');

})();
