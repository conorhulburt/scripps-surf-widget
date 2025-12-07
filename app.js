// app.js - Surf forecast widget logic

// Configuration
const API_ENDPOINT = "/api/surf/scripps";
const REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // 1 second

// Utility functions
function degToCompass(deg) {
  if (deg == null) return "---";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const i = Math.round(deg / 22.5) % 16;
  return dirs[i];
}

function formatTime(iso) {
  if (!iso) return "Time unavailable";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function formatRelativeTime(iso) {
  if (!iso) return "Time unavailable";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return formatTime(iso);
}

function setError(msg) {
  const box = document.getElementById("error-box");
  if (!box) return;
  box.textContent = msg;
  box.style.display = "block";
}

function clearError() {
  const box = document.getElementById("error-box");
  if (!box) return;
  box.textContent = "";
  box.style.display = "none";
}

function setLoading(isLoading) {
  const card = document.querySelector(".surf-card");
  if (!card) return;
  if (isLoading) {
    card.classList.add("loading");
  } else {
    card.classList.remove("loading");
  }
}

// Retry logic with exponential backoff
async function fetchWithRetry(url, retries = MAX_RETRIES, delay = INITIAL_RETRY_DELAY) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      return await resp.json();
    } catch (error) {
      if (i === retries - 1) {
        throw error; // Last retry failed
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffDelay = delay * Math.pow(2, i);
      console.warn(`Fetch attempt ${i + 1} failed, retrying in ${backoffDelay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

// Check if data is stale (> 1 hour old)
function isDataStale(updatedIso) {
  if (!updatedIso) return true;
  const dataTime = new Date(updatedIso);
  const now = new Date();
  const diffHours = (now - dataTime) / 3600000;
  return diffHours > 1;
}

async function loadBuoy(showLoading = true) {
  if (showLoading) {
    clearError();
    setLoading(true);
    const statusEl = document.getElementById("header-status");
    const timeEl = document.getElementById("header-time");
    if (statusEl) statusEl.textContent = "Loading...";
    if (timeEl) timeEl.textContent = "Requesting buoy data";
  }

  try {
    const data = await fetchWithRetry(API_ENDPOINT);

    if (data.error) {
      throw new Error(data.error);
    }

    const waveFt = data.waveHeightFt;
    const period = data.dominantPeriodSec ?? data.averagePeriodSec;
    const swellDirDeg = data.swellDirDeg;
    const windKts = data.windKts;
    const windDirDeg = data.windDirDeg;
    const waterF = data.waterTempF;

    // Debug logging
    console.log("API Response data:", {
      swellDirDeg: swellDirDeg,
      waterTempF: waterF,
      meta: data.meta
    });

    // Check if data is stale
    const stale = isDataStale(data.updatedIso);
    if (stale) {
      console.warn("Data is more than 1 hour old");
    }

    // Height range display (~20% band)
    let heightText = "-- ft";
    if (waveFt != null) {
      const min = Math.max(0, waveFt * 0.8);
      const max = waveFt * 1.2;
      heightText = `${min.toFixed(1)}–${max.toFixed(1)} ft`;
    }
    const heightEl = document.getElementById("surf-height");
    if (heightEl) heightEl.textContent = heightText;

    // Swell / period
    const swellStr =
      waveFt != null && period != null
        ? `${waveFt.toFixed(1)} ft @ ${period.toFixed(0)} s`
        : "-- ft @ -- s";
    const swellEl = document.getElementById("meta-swell");
    if (swellEl) swellEl.textContent = swellStr;

    // Swell direction
    const swellDirTxt = swellDirDeg != null && swellDirDeg !== undefined ? degToCompass(swellDirDeg) : "---";
    const swellDirEl = document.getElementById("meta-swell-dir");
    if (swellDirEl) {
      swellDirEl.textContent = swellDirTxt;
      console.log("Setting swell direction:", swellDirDeg, "->", swellDirTxt);
    } else {
      console.error("Swell direction element not found!");
    }

    // Wind
    const windDirTxt = windDirDeg != null ? degToCompass(windDirDeg) : "---";
    const windStr =
      windKts != null
        ? `${windKts.toFixed(1)} kts (${windDirTxt})`
        : "-- kts";
    const windEl = document.getElementById("meta-wind");
    if (windEl) windEl.textContent = windStr;

    // Water temperature
    const waterEl = document.getElementById("meta-water");
    if (waterEl) {
      const waterText = waterF != null && waterF !== undefined ? `${waterF.toFixed(1)} °F` : "-- °F";
      waterEl.textContent = waterText;
      console.log("Setting water temp:", waterF, "->", waterText);
    } else {
      console.error("Water temperature element not found!");
    }

    // Header
    const statusEl = document.getElementById("header-status");
    const timeEl = document.getElementById("header-time");
    if (statusEl) {
      statusEl.textContent = stale ? "Buoy conditions (stale)" : "Buoy conditions";
    }
    if (timeEl) {
      const relativeTime = formatRelativeTime(data.updatedIso);
      timeEl.textContent = `Updated ${relativeTime}`;
      timeEl.title = formatTime(data.updatedIso); // Full time on hover
    }

    setLoading(false);
    return true; // Success

  } catch (err) {
    console.error("Error loading buoy data:", err);
    setError("Could not load Scripps Pier buoy data from NOAA. Check later or refresh.");
    const statusEl = document.getElementById("header-status");
    const timeEl = document.getElementById("header-time");
    if (statusEl) statusEl.textContent = "Error";
    if (timeEl) timeEl.textContent = "No recent buoy data";
    setLoading(false);
    throw err; // Re-throw so caller can handle
  }
}

// Refresh button handler
function setupRefreshButton() {
  const refreshBtn = document.getElementById("refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.disabled = true;
      refreshBtn.classList.add("spinning");
      loadBuoy(true).finally(() => {
        refreshBtn.disabled = false;
        refreshBtn.classList.remove("spinning");
      });
    });
  }
}

// Check online status
function checkOnlineStatus() {
  if (!navigator.onLine) {
    setError("You are currently offline. Please check your internet connection.");
    const statusEl = document.getElementById("header-status");
    if (statusEl) statusEl.textContent = "Offline";
    return false;
  }
  return true;
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupRefreshButton();
  
  // Check online status
  window.addEventListener("online", () => {
    clearError();
    loadBuoy(true);
  });
  
  window.addEventListener("offline", () => {
    checkOnlineStatus();
  });

  // Initial load
  if (checkOnlineStatus()) {
    loadBuoy(true);
  }

  // Auto-refresh
  setInterval(() => {
    if (checkOnlineStatus()) {
      loadBuoy(false); // Don't show loading state on auto-refresh
    }
  }, REFRESH_INTERVAL);
});

// Export for manual refresh if needed
window.refreshSurfData = () => loadBuoy(true);

