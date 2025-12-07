# Troubleshooting Guide for Deployed App

## Issues Found on https://hulburtlawsurfwidget.vercel.app/

### Problem 1: Outdated Deployment
**Symptoms:**
- Still shows "Air Temp" field (should be removed)
- Missing "Swell Direction" field (should be present)
- All values showing "--" or "Loading..."

**Solution:**
1. **Redeploy to Vercel:**
   ```bash
   vercel --prod
   ```
   Or push to Git and let Vercel auto-deploy

2. **Clear Vercel Cache:**
   - Go to Vercel Dashboard → Your Project → Settings → General
   - Click "Clear Build Cache" or redeploy

3. **Verify Deployment:**
   - Check that latest commit is deployed
   - Check deployment logs for errors

### Problem 2: API Not Returning Data
**Symptoms:**
- All fields show "--" or "---"
- "Loading..." never completes
- Browser console shows errors

**Debugging Steps:**

1. **Test API Directly:**
   Visit: `https://hulburtlawsurfwidget.vercel.app/api/surf/scripps`
   
   Should return JSON with:
   - `swellDirDeg` (may be null)
   - `waterTempF` (may be null)
   - `waveHeightFt`
   - `windKts`
   - etc.

2. **Check Browser Console (F12):**
   - Look for JavaScript errors
   - Check Network tab for failed requests
   - Look for console.log messages from app.js

3. **Check Vercel Function Logs:**
   - Vercel Dashboard → Your Project → Functions → View Logs
   - Look for:
     - "Found swell direction in field..."
     - "Found water temp in field..."
     - "MWD found in header" or "MWD NOT found in header"
     - Any error messages

### Problem 3: CORS or Network Issues
**Symptoms:**
- Console shows CORS errors
- Network requests failing

**Solution:**
1. Check `ALLOWED_ORIGINS` environment variable in Vercel
2. For iframe embedding, CORS shouldn't be an issue
3. Check browser console for specific error messages

### Problem 4: Data Not Parsing from NOAA
**Symptoms:**
- API returns data but `swellDirDeg` and `waterTempF` are null
- Other fields (wave height, wind) work fine

**Debugging:**
1. Check Vercel logs for:
   - "Available fields - Temp: [...]"
   - "Available fields - Swell Dir: [...]"
   - "MWD found in header" or "MWD NOT found in header"

2. Check `meta.availableFields` in API response:
   ```json
   {
     "meta": {
       "availableFields": {
         "temperature": ["WTMP", ...],
         "swellDirection": ["MWD", ...],
         "allFields": [...]
       }
     }
   }
   ```

3. If MWD/WTMP not in header:
   - The NDBC station might not report these fields
   - Check NDBC website: https://www.ndbc.noaa.gov/station_page.php?station=ljpc1
   - Some stations don't report all parameters

### Quick Fixes

1. **Force Refresh:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Clear browser cache

2. **Check Deployment Status:**
   - Vercel Dashboard → Deployments
   - Ensure latest deployment is "Ready"
   - Check for build errors

3. **Redeploy:**
   ```bash
   # If using Vercel CLI
   vercel --prod
   
   # Or push to Git
   git add .
   git commit -m "Fix deployment"
   git push
   ```

4. **Test Locally First:**
   ```bash
   # Install Vercel CLI if needed
   npm install -g vercel
   
   # Test locally
   vercel dev
   ```

### Expected Behavior

**Working App Should Show:**
- ✅ Swell / Period (e.g., "2.5 ft @ 12 s")
- ✅ Swell Direction (e.g., "SW" or "WNW")
- ✅ Wind (e.g., "5.2 kts (SW)")
- ✅ Water Temp (e.g., "68.5 °F")
- ❌ NO Air Temp field

**If Values Show "--":**
- API is working but data is null/missing
- Check Vercel logs to see why parsing failed
- May be normal if NDBC station doesn't report that parameter

### Common Issues

1. **Old Code Deployed:**
   - Solution: Redeploy latest code

2. **Browser Cache:**
   - Solution: Hard refresh or clear cache

3. **Vercel Cache:**
   - Solution: Clear build cache in Vercel settings

4. **API Timeout:**
   - Solution: Check Vercel function timeout settings
   - Default is 10 seconds, may need to increase

5. **NOAA Data Unavailable:**
   - Solution: Check NDBC website for station status
   - Some parameters may not be reported by all stations

### Next Steps

1. **Check Vercel Logs First:**
   - Most issues will show up in function logs
   - Look for errors or warnings

2. **Test API Endpoint:**
   - Visit API URL directly
   - Check if it returns data
   - Check `meta` object for debugging info

3. **Check Browser Console:**
   - Look for JavaScript errors
   - Check Network tab for failed requests
   - Look for console.log debug messages

4. **Verify Deployment:**
   - Ensure latest code is deployed
   - Check deployment logs for build errors

