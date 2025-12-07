// api/surf/scripps.js
// Vercel serverless function: proxy NOAA NDBC LJPC1 text data into clean JSON
//
// Place this file at:  api/surf/scripps.js  in your Vercel project.

// Configuration
const STATION_ID = process.env.STATION_ID || "LJPC1";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT = 10000; // 10 seconds
const isDevelopment = process.env.NODE_ENV === "development";

// In-memory cache (Note: In serverless, this resets per invocation, but helps with rapid requests)
const cache = {
  data: null,
  timestamp: null,
};

// CORS configuration - allow specific origins or all in development
const getAllowedOrigins = () => {
  const allowed = process.env.ALLOWED_ORIGINS;
  if (allowed) {
    return allowed.split(",").map((o) => o.trim());
  }
  // In development, allow all; in production, restrict
  return isDevelopment ? ["*"] : [];
};

// Fetch with timeout
async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Scripps-Surf-Widget/1.0",
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

// Validate parsed data for sanity
function validateData(data) {
  const warnings = [];

  // Wave height validation (reasonable range: 0-50 feet)
  if (data.waveHeightFt != null) {
    if (data.waveHeightFt < 0 || data.waveHeightFt > 50) {
      warnings.push(`Unusual wave height: ${data.waveHeightFt}ft`);
    }
  }

  // Period validation (reasonable range: 3-30 seconds)
  if (data.dominantPeriodSec != null) {
    if (data.dominantPeriodSec < 3 || data.dominantPeriodSec > 30) {
      warnings.push(`Unusual period: ${data.dominantPeriodSec}s`);
    }
  }

  // Wind validation (reasonable range: 0-100 knots)
  if (data.windKts != null) {
    if (data.windKts < 0 || data.windKts > 100) {
      warnings.push(`Unusual wind speed: ${data.windKts}kts`);
    }
  }

  // Temperature validation (reasonable range: 32-120°F for water, -20-120°F for air)
  if (data.waterTempF != null) {
    if (data.waterTempF < 32 || data.waterTempF > 120) {
      warnings.push(`Unusual water temp: ${data.waterTempF}°F`);
    }
  }

  if (data.airTempF != null) {
    if (data.airTempF < -20 || data.airTempF > 120) {
      warnings.push(`Unusual air temp: ${data.airTempF}°F`);
    }
  }

  if (warnings.length > 0 && isDevelopment) {
    console.warn("Data validation warnings:", warnings);
  }

  return warnings;
}

export default async function handler(req, res) {
  const startTime = Date.now();

  // CORS handling
  const allowedOrigins = getAllowedOrigins();
  const origin = req.headers.origin;

  if (allowedOrigins.includes("*") || (origin && allowedOrigins.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Check cache
  if (cache.data && cache.timestamp && Date.now() - cache.timestamp < CACHE_TTL) {
    console.log(`[${new Date().toISOString()}] Cache hit for ${STATION_ID}`);
    return res.status(200).json(cache.data);
  }

  try {
    // NDBC provides standard meteorological data in /data/realtime2.
    // For safety, we try a couple of likely URLs in order of preference.
    const candidateUrls = [
      `https://www.ndbc.noaa.gov/data/realtime2/${STATION_ID}.txt`,
      `https://www.ndbc.noaa.gov/data/5day/${STATION_ID}_5day.txt`,
      `https://www.ndbc.noaa.gov/data/realtime2/${STATION_ID.toLowerCase()}.txt`,
      `https://www.ndbc.noaa.gov/data/5day/${STATION_ID.toLowerCase()}_5day.txt`,
    ];

    const errors = [];
    let text = null;
    let usedUrl = null;

    for (const url of candidateUrls) {
      try {
        console.log(`[${new Date().toISOString()}] Attempting fetch from ${url}`);
        const resp = await fetchWithTimeout(url, FETCH_TIMEOUT);
        if (!resp || !resp.ok) {
          errors.push(`${url} -> ${resp ? resp.status + " " + resp.statusText : "no response"}`);
          continue;
        }
        text = await resp.text();
        usedUrl = url;
        console.log(`[${new Date().toISOString()}] Successfully fetched from ${url}`);
        break;
      } catch (e) {
        const errorMsg = e.message || String(e);
        errors.push(`${url} -> ${errorMsg}`);
        console.error(`[${new Date().toISOString()}] Fetch error for ${url}:`, errorMsg);
      }
    }

    if (!text) {
      throw new Error("All candidate NDBC URLs failed: " + errors.join(" | "));
    }

    // ---------- Parse NDBC text ----------
    // Lines are space-separated. Header line is usually commented with '#'
    // and contains tokens like: YY MM DD hh mm WD WSPD GST WVHT DPD APD ...
    const rawLines = text.split(/\r?\n/);
    const lines = rawLines
      .map(l => l.trim())
      .filter(l => l.length > 0);

    let headerTokens = null;
    const dataRows = [];

    for (const line of lines) {
      if (line.startsWith("#")) {
        // Strip leading hashes and spaces
        const maybeHeader = line.replace(/^#+\s*/, "");
        const tokens = maybeHeader.split(/\s+/);
        if (tokens.includes("YY") && tokens.includes("MM") && tokens.includes("DD")) {
          headerTokens = tokens;
        }
        continue;
      }

      const tokens = line.split(/\s+/);
      if (!headerTokens || tokens.length < headerTokens.length) {
        continue;
      }

      dataRows.push(tokens);
    }

    if (!headerTokens || dataRows.length === 0) {
      throw new Error("Could not find header/data rows in NDBC file: " + usedUrl);
    }

    // NDBC realtime files are newest-first, so row 0 is the latest obs.
    const latest = dataRows[0];

    const idx = Object.fromEntries(
      headerTokens.map((name, i) => [name, i])
    );

    const parseNum = (value) => {
      if (value == null) return null;
      if (value === "MM") return null;              // Missing
      if (/^9+(\.0+)?$/.test(value)) return null;   // 999, 9999, etc = missing
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };

    // Time fields – sometimes "YY" or "YYYY", and "hh" or "HH"
    const year  = parseNum(idx["YYYY"] != null ? latest[idx["YYYY"]] : latest[idx["YY"]]);
    const month = parseNum(idx["MM"]   != null ? latest[idx["MM"]]   : null);
    const day   = parseNum(idx["DD"]   != null ? latest[idx["DD"]]   : null);
    const hour  = parseNum(idx["hh"]   != null ? latest[idx["hh"]]   :
                          idx["HH"]   != null ? latest[idx["HH"]]   : null);
    const mins  = parseNum(idx["mm"]   != null ? latest[idx["mm"]]   : 0);

    if (!year || !month || !day || hour == null) {
      throw new Error("Missing or invalid timestamp fields in NDBC data for " + usedUrl);
    }

    const timestamp = new Date(
      Date.UTC(
        year < 100 ? 2000 + year : year,
        month - 1,
        day,
        hour,
        mins || 0,
        0
      )
    );

    // Core met / wave variables
    const windDirDeg = parseNum(idx["WD"]    != null ? latest[idx["WD"]]    : null);
    const windMs     = parseNum(idx["WSPD"]  != null ? latest[idx["WSPD"]]  : null);
    const gustMs     = parseNum(idx["GST"]   != null ? latest[idx["GST"]]   : null);
    const waveM      = parseNum(idx["WVHT"]  != null ? latest[idx["WVHT"]]  : null);
    const dpd        = parseNum(idx["DPD"]   != null ? latest[idx["DPD"]]   : null);
    const apd        = parseNum(idx["APD"]   != null ? latest[idx["APD"]]   : null);
    const baro       = parseNum(idx["BARO"]  != null ? latest[idx["BARO"]]  :
                                idx["PRES"]  != null ? latest[idx["PRES"]]  : null);
    const atmpC      = parseNum(idx["ATMP"]  != null ? latest[idx["ATMP"]]  :
                                idx["AT"]    != null ? latest[idx["AT"]]    : null);
    const wtmpC      = parseNum(idx["WTMP"]  != null ? latest[idx["WTMP"]]  : null);

    // ---------- Unit helpers ----------
    const mToFt   = (m)  => (m == null ? null : m * 3.28084);
    const msToKts = (ms) => (ms == null ? null : ms * 1.94384);
    const cToF    = (c)  => (c == null ? null : (c * 9) / 5 + 32);

    const waveHeightFt = mToFt(waveM);
    const windKts = msToKts(windMs);
    const windGustKts = msToKts(gustMs);
    const airTempF = cToF(atmpC);
    const waterTempF = cToF(wtmpC);

    const json = {
      stationId: STATION_ID,
      name: "Scripps Pier, La Jolla, CA",
      sourceUrl: usedUrl,
      updatedIso: timestamp.toISOString(),

      windDirDeg,
      windKts,
      windGustKts: msToKts(gustMs),

      waveHeightM: waveM,
      waveHeightFt,
      dominantPeriodSec: dpd,
      averagePeriodSec: apd,

      barometricPressureHpa: baro,
      airTempC: atmpC,
      airTempF,
      waterTempC: wtmpC,
      waterTempF,

      // Debug info that can be useful in the UI console (only in development)
      ...(isDevelopment && {
        meta: {
          urlsTried: candidateUrls,
          parseHeader: headerTokens,
          fetchTimeMs: Date.now() - startTime,
        },
      }),
    };

    // Validate data
    validateData(json);

    // Update cache
    cache.data = json;
    cache.timestamp = Date.now();

    const responseTime = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] Successfully processed ${STATION_ID} data in ${responseTime}ms`);

    res.status(200).json(json);
  } catch (err) {
    const errorTime = Date.now() - startTime;
    console.error(`[${new Date().toISOString()}] Error in /api/surf/scripps (${errorTime}ms):`, err);

    // Don't expose detailed errors in production
    const errorDetail = isDevelopment && err && err.message ? String(err.message) : undefined;

    res.status(500).json({
      error: "Failed to fetch Scripps buoy data",
      ...(errorDetail && { detail: errorDetail }),
    });
  }
}
