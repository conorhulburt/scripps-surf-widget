# Scripps Pier Surf Forecast Widget

A beautiful, real-time surf forecast widget displaying NOAA NDBC buoy data for Scripps Pier, La Jolla, California.

![Surf Widget](https://img.shields.io/badge/status-production--ready-brightgreen)

## 🚀 Quick Start

### Deploy to Vercel (5 minutes)

1. **Install Vercel CLI** (if you haven't):
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```
   Follow the prompts. When asked:
   - "Set up and deploy?" → **Yes**
   - "Which scope?" → Choose your account
   - "Link to existing project?" → **No** (first time)
   - "Project name?" → Press Enter (or choose a name)
   - "Directory?" → Press Enter (current directory)

3. **Deploy to production**:
   ```bash
   vercel --prod
   ```

4. **Done!** Your widget is live at: `https://your-project.vercel.app`

### Alternative: Deploy via Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"Add New..."** → **"Project"**
3. Import your Git repository OR drag & drop this folder
4. Click **"Deploy"**
5. Wait ~30 seconds for deployment

---

## 📦 Embed on Your Website

### Option 1: Iframe (Easiest)

Replace `your-project.vercel.app` with your actual Vercel URL:

```html
<iframe 
  src="https://your-project.vercel.app" 
  width="500" 
  height="600" 
  frameborder="0"
  style="border-radius: 14px; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.15);">
</iframe>
```

### Option 2: Direct Integration

1. Copy `app.js` to your website
2. Copy the HTML/CSS from `index.html`
3. Update the API endpoint in `app.js`:
   ```javascript
   const API_ENDPOINT = "https://your-project.vercel.app/api/surf/scripps";
   ```

---

## ⚙️ Configuration (Optional)

### Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `STATION_ID` | `LJPC1` | NOAA station ID |
| `ALLOWED_ORIGINS` | `*` (dev) | CORS allowed origins (comma-separated) |
| `NODE_ENV` | `development` | Set to `production` for production |

**Example CORS setup:**
```
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

After adding variables, **redeploy** your project.

---

## 🧪 Testing

1. **Test API**: Visit `https://your-project.vercel.app/api/surf/scripps`
   - Should return JSON data

2. **Test Widget**: Visit `https://your-project.vercel.app`
   - Should show surf data
   - Check browser console (F12) for errors

3. **Test Embed**: Create a test page with the iframe code above

---

## 📁 Project Structure

```
scripps-surf-widget/
├── api/
│   └── surf/
│       └── scripps.js      # Serverless API function
├── app.js                   # Frontend JavaScript
├── index.html              # Main HTML page
├── CONFIGURATION.md        # Detailed config guide
├── SETUP_GUIDE.md          # Complete setup walkthrough
└── IMPROVEMENTS.md         # List of improvements
```

---

## ✨ Features

- ✅ Real-time NOAA buoy data
- ✅ Auto-refresh every 10 minutes
- ✅ Manual refresh button
- ✅ Loading states & animations
- ✅ Offline detection
- ✅ Error handling & retry logic
- ✅ Responsive design
- ✅ Caching for performance
- ✅ Data validation

---

## 🔧 Customization

### Change Station

1. Set `STATION_ID` environment variable
2. Update station name in `index.html`:
   ```html
   <div class="surf-location-title">Your Station</div>
   <div class="surf-location-sub">Location (STATION_ID)</div>
   ```

### Custom Styling

Edit the `<style>` section in `index.html` to match your site's design.

---

## 📚 Documentation

- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Complete setup walkthrough
- **[CONFIGURATION.md](./CONFIGURATION.md)** - Environment variables & config
- **[IMPROVEMENTS.md](./IMPROVEMENTS.md)** - List of all improvements

---

## 🐛 Troubleshooting

### API Not Working
- Check Vercel function logs (Dashboard → Functions)
- Verify NOAA station is active: [ndbc.noaa.gov](https://ndbc.noaa.gov)

### CORS Errors
- Add your domain to `ALLOWED_ORIGINS` environment variable
- Redeploy after adding variables

### Widget Not Loading
- Check browser console (F12)
- Verify `app.js` is accessible
- Check API endpoint URL

---

## 📄 License

Free to use and modify for your projects.

---

## 🙏 Credits

- Data source: [NOAA NDBC](https://www.ndbc.noaa.gov)
- Station: LJPC1 - Scripps Pier, La Jolla, CA

