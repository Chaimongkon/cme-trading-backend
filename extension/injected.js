// Injected script - runs in page context to access Highcharts
(function () {
    'use strict';

    // Extract Highcharts data
    function extractData() {
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
                extractedAt: new Date().toISOString()
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
            pageUrl: window.location.href,
            extractedAt: new Date().toISOString()
        };
    }

    // Send result back via custom event
    const result = extractData();
    window.postMessage({ type: 'CME_EXTRACTOR_RESULT', payload: result }, '*');
})();
