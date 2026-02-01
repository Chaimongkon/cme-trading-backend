// Forex Factory Calendar Scraper

console.log("Forex Factory Scraper Loaded");

function scrapeCalendar() {
    const events = [];
    const rows = document.querySelectorAll("tr.calendar_row");

    rows.forEach((row) => {
        try {
            const id = row.getAttribute("data-eventid");
            if (!id) return;

            const dateElement = row.closest("table").querySelector("tr.calendar_row.newday"); // This logic is tricky on FF
            // FF structure: Date is in a separate row spanning multiple event rows.
            // Actually, FF has a 'date' class on the first row of the day.

            // Let's look for the date in the row or previous rows
            let dateStr = "";
            let currentRow = row;
            while (currentRow) {
                const dateCell = currentRow.querySelector("td.calendar__date");
                if (dateCell && dateCell.innerText.trim()) {
                    // Format: "SunJan 26"
                    dateStr = dateCell.innerText.trim();
                    break;
                }
                currentRow = currentRow.previousElementSibling;
                if (!currentRow || !currentRow.classList.contains("calendar_row")) break;
            }

            // If we still don't have a date, maybe it's today?
            // Better approach: Parse the full date from the header or use current year.
            // For simplicity, let's assume the user is looking at the current week.

            const time = row.querySelector("td.calendar__time")?.innerText.trim();
            const currency = row.querySelector("td.calendar__currency")?.innerText.trim();
            const impactElement = row.querySelector("td.calendar__impact span");
            const title = row.querySelector("td.calendar__event span")?.innerText.trim();
            const actual = row.querySelector("td.calendar__actual")?.innerText.trim();
            const forecast = row.querySelector("td.calendar__forecast")?.innerText.trim();
            const previous = row.querySelector("td.calendar__previous")?.innerText.trim();

            let impact = "LOW";
            if (impactElement) {
                const className = impactElement.className;
                if (className.includes("high")) impact = "HIGH";
                else if (className.includes("medium")) impact = "MEDIUM";
            }

            // Convert dateStr to real date
            // This is hard without year. Let's assume current year.
            // "SunJan 26" -> "Jan 26 2026"
            const currentYear = new Date().getFullYear();
            // Remove day name "Sun"
            const cleanDateStr = dateStr.replace(/^[A-Za-z]{3}/, "").trim();
            const fullDateStr = `${cleanDateStr} ${currentYear}`;

            if (title && currency) {
                events.push({
                    id: `ff-${id}`,
                    title,
                    date: fullDateStr, // Backend will parse this
                    time,
                    currency,
                    impact,
                    actual,
                    forecast,
                    previous
                });
            }
        } catch (e) {
            console.error("Error parsing row", e);
        }
    });

    return events;
}

// Send data to background script
function sendData() {
    const events = scrapeCalendar();
    if (events.length > 0) {
        console.log(`Scraped ${events.length} events, sending to background...`);
        chrome.runtime.sendMessage({
            action: "SYNC_CALENDAR",
            events: events
        });
    }
}

// Run on load and periodically
setTimeout(sendData, 3000); // Wait for dynamic content
setInterval(sendData, 5 * 60 * 1000); // Every 5 minutes
