# Setup Guide - Surf Forecast Widget

This guide will walk you through deploying and using the Scripps Pier surf forecast widget on your website.

## Table of Contents
1. [Deployment Options](#deployment-options)
2. [Vercel Deployment (Recommended)](#vercel-deployment-recommended)
3. [Alternative: Static Hosting](#alternative-static-hosting)
4. [Embedding on Your Website](#embedding-on-your-website)
5. [Configuration](#configuration)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Deployment Options

You have two main options:

### Option 1: Vercel (Recommended)
- ✅ Free tier available
- ✅ Automatic serverless function deployment
- ✅ Easy environment variable management
- ✅ Custom domain support

### Option 2: Static Hosting + Separate API
- Use Netlify, GitHub Pages, or any static host
- Deploy API separately (Vercel, Railway, etc.)

---

## Vercel Deployment (Recommended)

### Step 1: Prepare Your Project

1. **Install Vercel CLI** (optional, but helpful):
   ```bash
   npm install -g vercel
   ```

2. **Verify your project structure**:
   ```
   scripps-surf-widget/
   ├── api/
   │   └── surf/
   │       └── scripps.js
   ├── index.html
   ├── app.js
   └── .gitignore
   ```

### Step 2: Deploy to Vercel

**Option A: Using Vercel CLI**
```bash
# Login to Vercel
vercel login

# Deploy (follow prompts)
vercel

# For production
vercel --prod
```

**Option B: Using Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Sign up/Login
3. Click "New Project"
4. Import your Git repository (GitHub, GitLab, Bitbucket)
   - OR drag and drop your project folder
5. Vercel will auto-detect the project
6. Click "Deploy"

### Step 3: Configure Environment Variables

After deployment, configure environment variables:

1. Go to your project dashboard on Vercel
2. Navigate to **Settings** → **Environment Variables**
3. Add these variables (optional, defaults work):

   | Variable | Value | Description |
   |----------|-------|-------------|
   | `STATION_ID` | `LJPC1` | NOAA station ID (default: LJPC1) |
   | `ALLOWED_ORIGINS` | `https://yourdomain.com,https://www.yourdomain.com` | CORS allowed origins (comma-separated) |
   | `NODE_ENV` | `production` | Set to `production` for production |

   **Example for CORS:**
   ```
   ALLOWED_ORIGINS=https://example.com,https://www.example.com,https://subdomain.example.com
   ```

4. **Redeploy** after adding variables (Vercel will prompt you)

### Step 4: Get Your Deployment URL

After deployment, Vercel will give you a URL like:
- `https://your-project.vercel.app`

This is your widget URL!

---

## Alternative: Static Hosting

If you want to host the frontend separately:

### Frontend (Static Host)
1. Upload `index.html` and `app.js` to:
   - Netlify
   - GitHub Pages
   - Cloudflare Pages
   - Any static host

2. **Update API endpoint** in `app.js`:
   ```javascript
   // Change this line in app.js
   const API_ENDPOINT = "https://your-api-url.vercel.app/api/surf/scripps";
   ```

### Backend (API)
1. Deploy only the `api/` folder to Vercel
2. Or use another serverless platform (Railway, Render, etc.)

---

## Embedding on Your Website

### Method 1: Iframe Embed (Easiest)

If you deployed to Vercel, you can embed it anywhere:

```html
<iframe 
  src="https://your-project.vercel.app" 
  width="500" 
  height="600" 
  frameborder="0"
  style="border-radius: 14px; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.15);">
</iframe>
```

**Responsive iframe:**
```html
<div style="position: relative; padding-bottom: 120%; height: 0; overflow: hidden; max-width: 500px;">
  <iframe 
    src="https://your-project.vercel.app" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
    frameborder="0">
  </iframe>
</div>
```

### Method 2: Direct Integration

If you want to integrate it directly into your site's HTML:

1. **Copy the widget files** to your website:
   - Copy `app.js` to your site's JS folder
   - Copy the CSS from `index.html` to your stylesheet

2. **Add the HTML structure** to your page:
   ```html
   <div class="surf-card">
     <!-- Copy the HTML structure from index.html -->
   </div>
   ```

3. **Include the script**:
   ```html
   <script src="/path/to/app.js"></script>
   ```

4. **Update API endpoint** in `app.js`:
   ```javascript
   const API_ENDPOINT = "https://your-api-url.vercel.app/api/surf/scripps";
   ```

### Method 3: React/Vue Component (Advanced)

If you're using a framework, you can:
1. Extract the widget logic
2. Create a component
3. Use the API endpoint directly

---

## Configuration

### CORS Setup

If embedding via iframe, you may not need CORS restrictions. But if making direct API calls from your domain:

1. **Set `ALLOWED_ORIGINS`** in Vercel environment variables:
   ```
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

2. **Test CORS**:
   ```javascript
   fetch('https://your-api.vercel.app/api/surf/scripps')
     .then(r => r.json())
     .then(console.log)
     .catch(console.error);
   ```

### Custom Styling

To match your website's design:

1. **Override CSS variables** (if you add them):
   ```css
   .surf-card {
     /* Your custom styles */
   }
   ```

2. **Or modify** the styles in `index.html` directly

### Different Station

To use a different NOAA station:

1. Set `STATION_ID` environment variable in Vercel
2. Update the station name in `index.html`:
   ```html
   <div class="surf-location-title">Your Station Name</div>
   <div class="surf-location-sub">Location (STATION_ID)</div>
   ```

---

## Testing

### Step 1: Test the API

Visit your API endpoint directly:
```
https://your-project.vercel.app/api/surf/scripps
```

You should see JSON data like:
```json
{
  "stationId": "LJPC1",
  "name": "Scripps Pier, La Jolla, CA",
  "waveHeightFt": 2.5,
  "dominantPeriodSec": 12,
  ...
}
```

### Step 2: Test the Widget

1. Visit your deployment URL:
   ```
   https://your-project.vercel.app
   ```

2. Check browser console (F12) for errors

3. Verify:
   - ✅ Data loads
   - ✅ Refresh button works
   - ✅ Auto-refresh works (wait 10 minutes)
   - ✅ Error handling works (disconnect internet briefly)

### Step 3: Test Embedding

1. Create a test HTML page:
   ```html
   <!DOCTYPE html>
   <html>
   <head><title>Test Widget</title></head>
   <body>
     <h1>Surf Widget Test</h1>
     <iframe src="https://your-project.vercel.app" width="500" height="600"></iframe>
   </body>
   </html>
   ```

2. Open in browser and verify it works

---

## Troubleshooting

### API Returns 500 Error

**Check:**
1. Environment variables are set correctly
2. Vercel function logs (Dashboard → Functions → View Logs)
3. NOAA station is active (check ndbc.noaa.gov)

**Common fixes:**
- Ensure `STATION_ID` matches a valid NOAA station
- Check that `NODE_ENV` is set to `production` for production

### CORS Errors

**Symptoms:** Browser console shows CORS errors

**Fix:**
1. Add your domain to `ALLOWED_ORIGINS` in Vercel
2. Redeploy after adding environment variables
3. For iframe embedding, CORS shouldn't be an issue

### Widget Not Loading

**Check:**
1. Browser console for JavaScript errors
2. Network tab to see if API calls are failing
3. Verify `app.js` is accessible
4. Check API endpoint URL is correct

### Data Not Updating

**Check:**
1. NOAA station is reporting data (visit ndbc.noaa.gov)
2. Cache is working (wait 5+ minutes between requests)
3. Auto-refresh is enabled (10-minute interval)

### Stale Data Warning

If you see "stale data" warning:
- NOAA station may not be updating
- Check station status on NOAA website
- Data older than 1 hour triggers warning

---

## Quick Start Checklist

- [ ] Deploy to Vercel (or your preferred host)
- [ ] Set environment variables (if needed)
- [ ] Test API endpoint directly
- [ ] Test widget page
- [ ] Embed on your website
- [ ] Test on mobile devices
- [ ] Verify auto-refresh works
- [ ] Check error handling

---

## Support

For issues:
1. Check Vercel function logs
2. Check browser console
3. Verify NOAA station is active
4. Review this guide's troubleshooting section

---

## Next Steps

Once set up:
- Customize styling to match your site
- Add to multiple pages
- Consider adding multiple stations
- Set up monitoring/alerts

