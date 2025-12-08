const BUOY_ID = "46254"; // Swell + water
const WIND_ID = "LJPC1";  // Wind at pier

const elements = {
  wvht: document.getElementById("wvht"),
  dpd: document.getElementById("dpd"),
  mwd: document.getElementById("mwd"),
  wtmp: document.getElementById("wtmp"),
  wspd: document.getElementById("wspd"),
  wdir: document.getElementById("wdir"),
  status: document.getElementById("status"),
  updated: document.getElementById("updated"),
  error: document.getElementById("error"),
};

const stationUrl = (id) => `https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`;

function formatUnits(value, suffix, fractionDigits = 1) {
  if (value == null || Number.isNaN(value)) return "--";
  return `${Number(value).toFixed(fractionDigits)} ${suffix}`;
}

function degreesToCompass(deg) {
  if (deg == null || deg === "") return "--";
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

function parseNdbcText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const headerLine = lines.find((line) => line.startsWith("#"));
  const dataLine = lines.find((line) => !line.startsWith("#"));

  if (!headerLine || !dataLine) {
    throw new Error("Unexpected NDBC format");
  }

  const headerTokens = headerLine.replace(/^#+\s*/, "").split(/\s+/);
  const dataTokens = dataLine.split(/\s+/);
  const idx = Object.fromEntries(headerTokens.map((name, i) => [name, i]));

  const read = (name) => {
    const pos = idx[name];
    if (pos == null || pos >= dataTokens.length) return null;
    const token = dataTokens[pos];
    if (!token || token === "MM" || /^9+/.test(token)) return null;
    const num = Number(token);
    return Number.isFinite(num) ? num : null;
  };

  const year = read("YYYY") ?? read("YY");
  const month = read("MM");
  const day = read("DD");
  const hour = read("hh") ?? read("HH");
  const minute = read("mm") ?? 0;

  const timestamp =
    year && month && day && hour != null
      ? new Date(Date.UTC(year < 100 ? 2000 + year : year, month - 1, day, hour, minute, 0))
      : null;

  const waveHeightM = read("WVHT");
  const dominantPeriod = read("DPD");
  const swellDir = read("MWD");
  const waterTempC = read("WTMP");

  const windSpeedMs = read("WSPD");
  const windDir = read("WDIR") ?? read("WD");

  const mToFt = (m) => (m == null ? null : m * 3.28084);
  const cToF = (c) => (c == null ? null : (c * 9) / 5 + 32);
  const msToKts = (ms) => (ms == null ? null : ms * 1.94384);

  return {
    waveHeightFt: mToFt(waveHeightM),
    dominantPeriod,
    swellDir,
    waterTempF: cToF(waterTempC),
    windKts: msToKts(windSpeedMs),
    windDir,
    updated: timestamp,
  };
}

async function fetchStation(id) {
  const resp = await fetch(stationUrl(id), { cache: "no-store" });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  const text = await resp.text();
  return parseNdbcText(text);
}

async function updateReport() {
  clearError();
  elements.status.textContent = "Pulling latest buoy and pier readings…";
  elements.updated.textContent = "Updating";
  elements.status.classList.remove("good");

  try {
    const [buoy, wind] = await Promise.all([fetchStation(BUOY_ID), fetchStation(WIND_ID)]);

    elements.wvht.textContent = formatUnits(buoy.waveHeightFt, "ft");
    elements.dpd.textContent = formatUnits(buoy.dominantPeriod, "s", 0);
    elements.mwd.textContent = degreesToCompass(buoy.swellDir);
    elements.wtmp.textContent = formatUnits(buoy.waterTempF, "°F", 0);

    elements.wspd.textContent = formatUnits(wind.windKts, "kts");
    elements.wdir.textContent = degreesToCompass(wind.windDir);

    const stamp = buoy.updated || wind.updated || new Date();
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
