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

  // Swell direction validation (reasonable range: 0-360 degrees)
  if (data.swellDirDeg != null) {
    if (data.swellDirDeg < 0 || data.swellDirDeg > 360) {
      warnings.push(`Unusual swell direction: ${data.swellDirDeg}°`);
    }
  }

  // Wind validation (reasonable range: 0-100 knots)
  if (data.windKts != null) {
    if (data.windKts < 0 || data.windKts > 100) {
      warnings.push(`Unusual wind speed: ${data.windKts}kts`);
    }
  }

  // Temperature validation (reasonable range: 32-120°F for water)
  if (data.waterTempF != null) {
    if (data.waterTempF < 32 || data.waterTempF > 120) {
      warnings.push(`Unusual water temp: ${data.waterTempF}°F`);
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
        const tokens = maybeHeader.split(/\s+/).filter(t => t.length > 0); // Remove empty tokens
        if (tokens.includes("YY") && tokens.includes("MM") && tokens.includes("DD")) {
          headerTokens = tokens;
          console.log(`[${new Date().toISOString()}] Found header with ${tokens.length} fields:`, tokens.join(", "));
          // Check if MWD, ATMP, WTMP are in the header
          if (tokens.includes("MWD")) {
            console.log(`[${new Date().toISOString()}] ✓ MWD found in header at position ${tokens.indexOf("MWD")}`);
          } else {
            console.warn(`[${new Date().toISOString()}] ✗ MWD NOT found in header`);
          }
          if (tokens.includes("ATMP")) {
            console.log(`[${new Date().toISOString()}] ✓ ATMP found in header at position ${tokens.indexOf("ATMP")}`);
          } else {
            console.warn(`[${new Date().toISOString()}] ✗ ATMP NOT found in header`);
          }
          if (tokens.includes("WTMP")) {
            console.log(`[${new Date().toISOString()}] ✓ WTMP found in header at position ${tokens.indexOf("WTMP")}`);
          } else {
            console.warn(`[${new Date().toISOString()}] ✗ WTMP NOT found in header`);
          }
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
      if (value == null || value === undefined) return null;
      const str = String(value).trim();
      if (str === "" || str === "MM" || str === "NaN" || str === "N/A") return null;  // Missing indicators
      if (/^9+(\.0+)?$/.test(str)) return null;   // 999, 9999, etc = missing
      const n = Number(str);
      if (!Number.isFinite(n)) return null;
      // Note: 0 is a valid value for some measurements, so we don't filter it out
      return n;
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
    const windDirDeg = ("WD" in idx && idx["WD"] < latest.length) ? parseNum(latest[idx["WD"]]) : null;
    const windMs     = ("WSPD" in idx && idx["WSPD"] < latest.length) ? parseNum(latest[idx["WSPD"]]) : null;
    const gustMs     = ("GST" in idx && idx["GST"] < latest.length) ? parseNum(latest[idx["GST"]]) : null;
    const waveM      = ("WVHT" in idx && idx["WVHT"] < latest.length) ? parseNum(latest[idx["WVHT"]]) : null;
    const dpd        = ("DPD" in idx && idx["DPD"] < latest.length) ? parseNum(latest[idx["DPD"]]) : null;
    const apd        = ("APD" in idx && idx["APD"] < latest.length) ? parseNum(latest[idx["APD"]]) : null;
    
    // Swell direction - check multiple possible field names
    // MWD is the standard NDBC field for Mean Wave Direction
    let swellDirDeg = null;
    const swellDirFields = ["MWD", "MWWD", "WVDIR", "WAVE_DIR"];
    for (const field of swellDirFields) {
      if (field in idx && idx[field] !== undefined && idx[field] < latest.length) {
        const rawValue = latest[idx[field]];
        console.log(`[${new Date().toISOString()}] Checking swell direction field "${field}": raw value = "${rawValue}"`);
        swellDirDeg = parseNum(rawValue);
        if (swellDirDeg != null) {
          console.log(`[${new Date().toISOString()}] Found swell direction in field "${field}": ${rawValue} -> ${swellDirDeg}°`);
          break;
        } else {
          console.log(`[${new Date().toISOString()}] Swell direction field "${field}" exists but value is missing/invalid: "${rawValue}"`);
        }
      } else {
        console.log(`[${new Date().toISOString()}] Swell direction field "${field}" not found in index`);
      }
    }
    
    // If MWD wasn't found, log all available fields for debugging
    if (swellDirDeg == null) {
      console.warn(`[${new Date().toISOString()}] MWD not found. Available fields:`, Object.keys(idx).join(", "));
      console.warn(`[${new Date().toISOString()}] Header tokens:`, headerTokens);
    }
    const baro       = parseNum(idx["BARO"]  != null ? latest[idx["BARO"]]  :
                                idx["PRES"]  != null ? latest[idx["PRES"]]  : null);
    // Temperature fields - check multiple possible field names
    // NOAA NDBC uses ATMP for air temp, WTMP for water temp
    // Some stations may use variations
    let atmpC = null;
    const airTempFields = ["ATMP", "AT", "AIR_TEMP", "TEMP"];
    for (const field of airTempFields) {
      if (field in idx && idx[field] !== undefined && idx[field] < latest.length) {
        const rawValue = latest[idx[field]];
        console.log(`[${new Date().toISOString()}] Checking air temp field "${field}": raw value = "${rawValue}"`);
        atmpC = parseNum(rawValue);
        if (atmpC != null) {
          console.log(`[${new Date().toISOString()}] Found air temp in field "${field}": ${rawValue} -> ${atmpC}°C`);
          break;
        } else {
          console.log(`[${new Date().toISOString()}] Air temp field "${field}" exists but value is missing/invalid: "${rawValue}"`);
        }
      } else {
        console.log(`[${new Date().toISOString()}] Air temp field "${field}" not found in index`);
      }
    }
    
    let wtmpC = null;
    const waterTempFields = ["WTMP", "WT", "WATER_TEMP", "SEA_TEMP"];
    for (const field of waterTempFields) {
      if (field in idx && idx[field] !== undefined && idx[field] < latest.length) {
        const rawValue = latest[idx[field]];
        console.log(`[${new Date().toISOString()}] Checking water temp field "${field}": raw value = "${rawValue}"`);
        wtmpC = parseNum(rawValue);
        if (wtmpC != null) {
          console.log(`[${new Date().toISOString()}] Found water temp in field "${field}": ${rawValue} -> ${wtmpC}°C`);
          break;
        } else {
          console.log(`[${new Date().toISOString()}] Water temp field "${field}" exists but value is missing/invalid: "${rawValue}"`);
        }
      } else {
        console.log(`[${new Date().toISOString()}] Water temp field "${field}" not found in index`);
      }
    }
    
    // If water temperature wasn't found, log for debugging
    if (wtmpC == null) {
      console.warn(`[${new Date().toISOString()}] Water temperature not found. Available fields:`, Object.keys(idx).join(", "));
    }
    
    // Log available fields for debugging (always log, not just in development)
    const tempFields = Object.keys(idx).filter(k => 
      k.includes("TMP") || k.includes("TEMP") || k === "AT" || k === "WT"
    );
    const swellFields = Object.keys(idx).filter(k => 
      k.includes("MWD") || k.includes("WVDIR") || k.includes("WAVE") || k.includes("DIR")
    );
    
    console.log(`[${new Date().toISOString()}] Available fields - Temp: [${tempFields.join(", ")}], Swell Dir: [${swellFields.join(", ")}]`);
    console.log(`[${new Date().toISOString()}] All header fields:`, headerTokens);
    
    if (tempFields.length === 0) {
      console.warn(`[${new Date().toISOString()}] No temperature fields found in NDBC data header`);
    }
    if (swellFields.length === 0) {
      console.warn(`[${new Date().toISOString()}] No swell direction fields found in NDBC data header`);
    }

    // ---------- Unit helpers ----------
    const mToFt   = (m)  => (m == null ? null : m * 3.28084);
    const msToKts = (ms) => (ms == null ? null : ms * 1.94384);
    const cToF    = (c)  => (c == null ? null : (c * 9) / 5 + 32);

    const waveHeightFt = mToFt(waveM);
    const windKts = msToKts(windMs);
    const windGustKts = msToKts(gustMs);
    const waterTempF = cToF(wtmpC);

    // Ensure all required fields are defined (explicitly set to null if undefined)
    const finalSwellDirDeg = (swellDirDeg !== undefined) ? swellDirDeg : null;
    const finalWaterTempF = (waterTempF !== undefined) ? waterTempF : null;
    const finalWaterTempC = (wtmpC !== undefined) ? wtmpC : null;

    const json = {
      stationId: STATION_ID,
      name: "Scripps Pier, La Jolla, CA",
      sourceUrl: usedUrl,
      updatedIso: timestamp.toISOString(),

      windDirDeg: windDirDeg ?? null,
      windKts,
      windGustKts: msToKts(gustMs),

      waveHeightM: waveM,
      waveHeightFt,
      dominantPeriodSec: dpd,
      averagePeriodSec: apd,
      swellDirDeg: finalSwellDirDeg,

      barometricPressureHpa: baro,
      waterTempC: finalWaterTempC,
      waterTempF: finalWaterTempF,

      // Debug info that can be useful in the UI console (always include for debugging)
      meta: {
        urlsTried: candidateUrls,
        parseHeader: headerTokens,
        fetchTimeMs: Date.now() - startTime,
        availableFields: {
          temperature: tempFields,
          swellDirection: swellFields,
          allFields: headerTokens,
        },
        rawValues: {
          wtmpC: wtmpC,
          waterTempF: waterTempF,
          swellDirDeg: swellDirDeg,
        },
        // Include the actual latest data row for debugging
        latestDataRow: latest,
        fieldIndices: idx,
      },
    };

    // Validate data
    validateData(json);

    // Log parsing results (always log for debugging)
    console.log(`[${new Date().toISOString()}] Parsing results:`);
    console.log(`  Water temp: ${wtmpC}°C (${waterTempF}°F)`);
    console.log(`  Swell direction: ${swellDirDeg}°`);
    console.log(`[${new Date().toISOString()}] Final JSON will include: swellDirDeg=${finalSwellDirDeg} (type: ${typeof finalSwellDirDeg}), waterTempF=${finalWaterTempF} (type: ${typeof finalWaterTempF})`);

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

