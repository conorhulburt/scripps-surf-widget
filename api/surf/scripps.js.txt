// api/surf/scripps.js
// Vercel serverless function: NOAA LJPC1 -> JSON for the widget

export default async function handler(req, res) {
  // Basic CORS (useful if you ever embed from another domain)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const url = "https://www.ndbc.noaa.gov/data/5day/ljpc1_5day.txt";
    const resp = await fetch(url);

    if (!resp.ok) {
      throw new Error(`NDBC returned status ${resp.status}`);
    }

    const text = await resp.text();
    const lines = text
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length && !l.startsWith("#"));

    if (lines.length < 2) {
      throw new Error("Unexpected NDBC file format or no data");
    }

    // First non-# line = header
    const header = lines[0].split(/\s+/);
    // Last line = most recent observation
    const latest = lines[lines.length - 1].split(/\s+/);

    const idx = Object.fromEntries(header.map((name, i) => [name, i]));

    const parseNum = (value) => {
      if (!value) return null;
      if (value === "MM") return null;
      if (/^9+(\.0+)?$/.test(value)) return null; // 999.0 etc
      const n = Number(value);
      return Number.isNaN(n) ? null : n;
    };

    const year  = parseNum(latest[idx["YYYY"]]);
    const month = parseNum(latest[idx["MM"]]); // 1–12
    const day   = parseNum(latest[idx["DD"]]);
    const hour  = parseNum(latest[idx["hh"]]); // UTC hour

    const timestamp = new Date(Date.UTC(year, month - 1, day, hour, 0, 0));

    const windDirDeg = parseNum(latest[idx["WD"]]);
    const windMs     = parseNum(latest[idx["WSPD"]]);
    const gustMs     = parseNum(latest[idx["GST"]]);
    const waveM      = parseNum(latest[idx["WVHT"]]);
    const dpd        = parseNum(latest[idx["DPD"]]);  // dominant period
    const apd        = parseNum(latest[idx["APD"]]);  // average period
    const baro       = parseNum(latest[idx["BARO"]]);
    const atmpC      = parseNum(latest[idx["ATMP"]]);
    const wtmpC      = parseNum(latest[idx["WTMP"]]);

    const msToKts = v => (v == null ? null : v * 1.94384);
    const mToFt   = v => (v == null ? null : v * 3.28084);
    const cToF    = v => (v == null ? null : (v * 9) / 5 + 32);

    const json = {
      stationId: "LJPC1",
      name: "Scripps Pier, La Jolla, CA",
      updatedIso: timestamp.toISOString(),
      windDirDeg,
      windKts: msToKts(windMs),
      windGustKts: msToKts(gustMs),
      waveHeightM: waveM,
      waveHeightFt: mToFt(waveM),
      dominantPeriodSec: dpd,
      averagePeriodSec: apd,
      barometricPressureHpa: baro,
      airTempC: atmpC,
      airTempF: cToF(atmpC),
      waterTempC: wtmpC,
      waterTempF: cToF(wtmpC)
    };

    res.status(200).json(json);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Scripps buoy data" });
  }
}
