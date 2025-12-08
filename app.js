const BUOY_PAGE = "https://www.ndbc.noaa.gov/station_page.php?station=46254"; // Swell + water
const PIER_PAGE = "https://www.ndbc.noaa.gov/station_page.php?station=ljpc1";   // Wind

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

function formatUnits(value, suffix) {
  return value != null && value !== "" ? `${value} ${suffix}` : "--";
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
}

function clearError() {
  elements.error.hidden = true;
  elements.error.textContent = "";
}

function extractFromTable(doc, label) {
  const headers = Array.from(doc.querySelectorAll("th, td"));
  const match = headers.find((cell) => cell.textContent.trim().toUpperCase() === label);
  if (match && match.nextElementSibling) {
    return match.nextElementSibling.textContent.trim();
  }
  return null;
}

function regexSearch(html, label) {
  const regex = new RegExp(`${label}[^<]{0,40}?>\\s*([0-9.]+)`, "i");
  const m = html.match(regex);
  return m ? m[1] : null;
}

function parseValue({ doc, html, label }) {
  return extractFromTable(doc, label) || regexSearch(html, label);
}

async function fetchStation(url) {
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
  const html = await resp.text();
  const doc = new DOMParser().parseFromString(html, "text/html");
  return { doc, html };
}

async function loadBuoy() {
  const { doc, html } = await fetchStation(BUOY_PAGE);
  const wvht = parseValue({ doc, html, label: "WVHT" });
  const dpd = parseValue({ doc, html, label: "DPD" });
  const mwd = parseValue({ doc, html, label: "MWD" });
  const wtmp = parseValue({ doc, html, label: "WTMP" });
  return { wvht, dpd, mwd, wtmp, updated: new Date().toLocaleTimeString() };
}

async function loadWind() {
  const { doc, html } = await fetchStation(PIER_PAGE);
  const wspd = parseValue({ doc, html, label: "WSPD" });
  const wdir = parseValue({ doc, html, label: "WDIR" });
  return { wspd, wdir };
}

async function updateReport() {
  clearError();
  elements.status.textContent = "Pulling latest buoy and pier readings…";
  elements.updated.textContent = "Updating";

  try {
    const [buoy, wind] = await Promise.all([loadBuoy(), loadWind()]);

    elements.wvht.textContent = formatUnits(buoy.wvht, "ft");
    elements.dpd.textContent = formatUnits(buoy.dpd, "s");
    elements.mwd.textContent = degreesToCompass(buoy.mwd);
    elements.wtmp.textContent = formatUnits(buoy.wtmp, "°F");

    elements.wspd.textContent = formatUnits(wind.wspd, "kts");
    elements.wdir.textContent = degreesToCompass(wind.wdir);

    const stamp = buoy.updated || new Date().toLocaleTimeString();
    elements.updated.textContent = `Updated ${stamp}`;
    elements.status.textContent = "Live NOAA feed";
    elements.status.classList.add("good");
  } catch (err) {
    console.error(err);
    showError("Could not load NOAA station pages. Check your connection or try again in a minute.");
  }
}

document.getElementById("refresh").addEventListener("click", updateReport);

updateReport();
