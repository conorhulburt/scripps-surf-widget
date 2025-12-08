const BUOY_ID = "46254"; // Swell + water
const WIND_ID = "LJPC1"; // Wind at pier

const elements = {
  wvht: document.getElementById("wvht"),
  dpd: document.getElementById("dpd"),
  mwd: document.getElementById("mwd"),
  wtmp: document.getElementById("wtmp"),
  wspd: document.getElementById("wspd"),
  wgst: document.getElementById("wgst"),
  wdir: document.getElementById("wdir"),
  status: document.getElementById("status"),
  updated: document.getElementById("updated"),
  error: document.getElementById("error"),
};

const stationUrl = (id) => `/api/surf/scripps?station=${encodeURIComponent(id)}`;

function formatUnits(value, suffix, fractionDigits = 1) {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Number(value).toFixed(fractionDigits)} ${suffix}`;
}

function degreesToCompass(deg, fallback = "--") {
  if (deg == null || deg === "") return fallback;
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  const i = Math.round(Number(deg) / 22.5) % 16;
  return `${dirs[i]} (${deg}°)`;
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
  elements.status.textContent = "Unable to reach NOAA right now.";
  elements.updated.textContent = "Error";
  elements.status.classList.remove("good");
}

function clearError() {
  elements.error.hidden = true;
  elements.error.textContent = "";
}

async function fetchStation(id) {
  const resp = await fetch(stationUrl(id), { cache: "no-store" });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  return resp.json();
}

async function updateReport() {
  clearError();
  elements.status.textContent = "Pulling latest buoy and pier readings…";
  elements.updated.textContent = "Updating";
  elements.status.classList.remove("good");

  try {
    const [buoy, wind] = await Promise.all([fetchStation(BUOY_ID), fetchStation(WIND_ID)]);

    elements.wvht.textContent = formatUnits(buoy.waveHeightFt, "ft");
    elements.dpd.textContent = formatUnits(buoy.dominantPeriodSec, "s", 0);
    elements.mwd.textContent = degreesToCompass(buoy.swellDirDeg);
    elements.wtmp.textContent = formatUnits(buoy.waterTempF, "°F", 0);

    elements.wspd.textContent = formatUnits(wind.windKts, "kts");
    elements.wgst.textContent = formatUnits(wind.windGustKts, "kts");

    const windDirValue =
      wind.windDirDeg ??
      (Number.isFinite(Number(wind.windDirRaw)) ? Number(wind.windDirRaw) : null);
    const windDirLabel = windDirValue == null && wind.windDirField === null
      ? "Not reported"
      : degreesToCompass(windDirValue);
    elements.wdir.textContent = windDirLabel;

    const stamp =
      (buoy.updatedIso && new Date(buoy.updatedIso)) ||
      (wind.updatedIso && new Date(wind.updatedIso)) ||
      new Date();

    elements.updated.textContent = `Updated ${stamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
    elements.status.textContent = "Live NOAA feed";
    elements.status.classList.add("good");
  } catch (err) {
    console.error(err);
    showError("Could not load NOAA station data. Check your connection or try again in a minute.");
  }
}

document.getElementById("refresh").addEventListener("click", updateReport);

updateReport();
