# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Extension (Manifest V3) called "CME QuikStrike Data Extractor" that extracts options data (Put, Call, Vol Settle, Ranges) from CME Group's QuikStrike charts. The extension uses Highcharts data extraction from embedded iframes.

## Architecture

### Core Components

- **background.js** - Service worker handling:
  - Chrome alarms for auto-refresh (minimum 1 minute intervals)
  - Cross-frame data extraction via `chrome.scripting.executeScript`
  - Message routing between content scripts and UI
  - Optional backend sync via POST requests
  - Storage management for settings and latest data

- **content.js** - Content script injected into CME/QuikStrike pages:
  - Attempts direct Highcharts access first
  - Falls back to injecting `injected.js` for cross-origin access
  - Communicates via `window.postMessage` with injected script
  - Auto-extracts data 2 seconds after page load

- **injected.js** - Page context script for Highcharts access:
  - Runs in MAIN world to access page's Highcharts object
  - Extracts Put, Call, Vol Settle, and Ranges series data
  - Returns results via `window.postMessage`

- **product-selector.js** - Automates product selection in QuikStrike:
  - Uses stored `pendingProduct` to auto-select on page load
  - Sends click sequences to background for iframe execution

- **sidepanel.js / popup.js** - UI controllers:
  - Display extracted data in table format
  - Export to CSV/JSON
  - Settings management (refresh interval, backend URL)
  - Product quick-launch buttons

### Data Flow

1. User opens CME QuikStrike page
2. Content script auto-extracts or user clicks Refresh
3. Background service worker coordinates iframe access via `chrome.webNavigation.getAllFrames`
4. Highcharts data extracted using `executeScript` with `world: 'MAIN'`
5. Data stored in `chrome.storage.local` and optionally synced to backend

### Key Selectors (QuikStrike iframe)

- Refresh button: `#refreshButton`, `input[title="Refresh the current view"]`
- Product dropdown: `#ctl11_hlProductArrow`
- Asset class items: `#ctl11_ucProductSelectorPopup_pnlProductSelectorPopup > div > div > div.groups.left > div.items > a`

## Development

### Loading the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension/` folder

### Testing Changes

- Reload the extension from `chrome://extensions/` after modifying JS files
- Use Chrome DevTools to inspect:
  - Service worker: Click "service worker" link in extension card
  - Side panel: Right-click side panel → Inspect
  - Content scripts: DevTools on CME page → Sources → Content scripts

### Target Sites

- `https://*.cmegroup.com/*` - Main CME pages
- `https://*.quikstrike.net/*` - QuikStrike iframe content

## Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `CHART_DATA` | content → background | Send extracted chart data |
| `GET_DATA` | UI → background | Retrieve latest data |
| `GET_SETTINGS` | UI → background | Retrieve settings |
| `UPDATE_SETTINGS` | UI → background | Save settings |
| `EXTRACT_FROM_ALL_FRAMES` | UI → background | Trigger extraction |
| `CLICK_IN_IFRAME` | content → background | Execute click sequence |
| `DATA_UPDATED` | background → UI | Notify of new data |
| `PING` | UI → content | Check connection status |
