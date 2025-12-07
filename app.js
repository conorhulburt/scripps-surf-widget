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

function computeRating(heightFt, periodSec, windKts) {
  if (heightFt == null || periodSec == null) {
    return { stars: 1, text: "Data incomplete" };
  }

  let score = 0;

  // Size: Scripps is fun 2–6 ft, really good 3–5 ft
  if (heightFt >= 1 && heightFt <= 6) score += 2;
  if (heightFt >= 3 && heightFt <= 5) score += 2;

  // Period
  if (periodSec >= 10 && periodSec <= 18) score += 2;
  if (periodSec >= 14) score += 1;

  const w = windKts ?? 0;
  if (w <= 5) score += 2;
  else if (w <= 12) score += 1;

  let stars = Math.max(1, Math.min(5, Math.round(score / 2)));
  let text;
  if (stars <= 2) text = "Small / weak";
  else if (stars === 3) text = "Rideable";
  else if (stars === 4) text = "Fun Scripps conditions";
  else text = "Pumping (for Scripps)";

  return { stars, text };
}

function setStars(num) {
  const el = document.getElementById("surf-stars");
  if (!el) return;
  const full = "★";
  const empty = "☆";
  const n = Math.max(0, Math.min(5, num || 0));
  el.textContent = full.repeat(n) + empty.repeat(5 - n);
}

function setError(msg) {
  const box = document.getElementById("error-box");
  if (!box) return;
  box.textContent = msg;
  box.style.display = "block";
}

function setStat(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
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

function describeFromBuoy(heightFt, periodSec, windKts, swellDirDeg) {
  const out = [];

  if (heightFt != null) {
    if (heightFt < 1) out.push("Nearly flat");
    else if (heightFt < 2) out.push("Small, longboard waves");
    else if (heightFt < 3) out.push("Waist high, playful");
    else if (heightFt < 5) out.push("Chest to head high, fun");
    else out.push("Overhead, more powerful");
  }

  if (periodSec != null) {
    if (periodSec < 8) out.push("short-period wind swell");
    else if (periodSec < 12) out.push("mid-period mix");
    else out.push("decent groundswell energy");
  }

  if (swellDirDeg != null) {
    const dir = degToCompass(swellDirDeg);
    // For Scripps, SW/WNW are typically best directions
    if (dir === "SW" || dir === "WSW" || dir === "W" || dir === "WNW" || dir === "NW") {
      out.push(`${dir} swell direction (favorable)`);
    } else {
      out.push(`${dir} swell direction`);
    }
  }

  if (windKts != null) {
    if (windKts <= 5) out.push("light winds");
    else if (windKts <= 12) out.push("moderate wind");
    else out.push("stronger winds, more texture");
  }

  return out.join(". ") || "No description available.";
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
    setStat("stat-height", heightText);

    // Rating
    const rating = computeRating(waveFt, period, windKts);
    setStars(rating.stars);
    const qualityEl = document.getElementById("surf-quality-text");
    if (qualityEl) qualityEl.textContent = rating.text;
    setStat("stat-quality", `${rating.stars}★ – ${rating.text}`);

    // Swell / period
    const swellStr =
      waveFt != null && period != null
        ? `${waveFt.toFixed(1)} ft @ ${period.toFixed(0)} s`
        : "-- ft @ -- s";
    const swellEl = document.getElementById("meta-swell");
    if (swellEl) swellEl.textContent = swellStr;
    setStat("stat-period", period != null ? `${period.toFixed(0)} s` : "-- s");

    // Swell direction
    const swellDirTxt = swellDirDeg != null && swellDirDeg !== undefined ? degToCompass(swellDirDeg) : "---";
    const swellDirEl = document.getElementById("meta-swell-dir");
    if (swellDirEl) {
      swellDirEl.textContent = swellDirTxt;
      console.log("Setting swell direction:", swellDirDeg, "->", swellDirTxt);
    } else {
      console.error("Swell direction element not found!");
    }
    setStat("stat-direction", swellDirTxt);

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
    setStat("stat-water", waterF != null ? `${waterF.toFixed(1)} °F` : "-- °F");

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

    // Quick read table
    const tbody = document.getElementById("quick-table-body");
    if (tbody) {
      tbody.innerHTML = "";

      const desc = describeFromBuoy(waveFt, period, windKts, swellDirDeg);
      const waterText = waterF != null ? `${waterF.toFixed(1)} °F` : "-- °F";
      const swellDirText = swellDirDeg != null ? degToCompass(swellDirDeg) : "---";
      const rows = [
        ["Overall", desc],
        ["Buoy height", swellStr],
        ["Swell direction", swellDirText],
        ["Wind", windStr],
        ["Water", waterText]
      ];

      rows.forEach(([label, val]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${label}</td><td>${val}</td>`;
        tbody.appendChild(tr);
      });
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

