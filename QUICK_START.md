# 🚀 Quick Start - 5 Minute Setup

Follow these steps to get your surf widget live on your website.

## Step 1: Deploy to Vercel (2 minutes)

### Option A: Using Vercel CLI

```bash
# 1. Install Vercel CLI (one time)
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Deploy to production
vercel --prod
```

### Option B: Using Vercel Website

1. Go to **[vercel.com](https://vercel.com)** and sign in
2. Click **"Add New..."** → **"Project"**
3. **Import** your Git repo OR **drag & drop** this folder
4. Click **"Deploy"**
5. Wait ~30 seconds

✅ **You'll get a URL like:** `https://your-project.vercel.app`

---

## Step 2: Test It (1 minute)

1. **Visit your URL**: `https://your-project.vercel.app`
   - Should show surf data!

2. **Test the API**: `https://your-project.vercel.app/api/surf/scripps`
   - Should return JSON data

✅ **If both work, you're ready!**

---

## Step 3: Embed on Your Website (2 minutes)

### Copy this code to your HTML:

```html
<iframe 
  src="https://your-project.vercel.app" 
  width="500" 
  height="600" 
  frameborder="0"
  style="border-radius: 14px; box-shadow: 0 8px 18px rgba(15, 23, 42, 0.15);">
</iframe>
```

**Replace `your-project.vercel.app` with your actual Vercel URL!**

### For Responsive Design:

```html
<div style="position: relative; padding-bottom: 120%; height: 0; overflow: hidden; max-width: 500px; margin: 0 auto;">
  <iframe 
    src="https://your-project.vercel.app" 
    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;"
    frameborder="0">
  </iframe>
</div>
```

---

## Step 4: Optional Configuration

### If you want to restrict CORS:

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Add:
   - **Name**: `ALLOWED_ORIGINS`
   - **Value**: `https://yourdomain.com,https://www.yourdomain.com`
3. Click **Save**
4. **Redeploy** (Vercel will prompt you)

---

## ✅ Done!

Your surf widget is now live and embedded on your website!

---

## 🆘 Need Help?

- **API not working?** Check [SETUP_GUIDE.md](./SETUP_GUIDE.md#troubleshooting)
- **Want more details?** See [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- **Customization?** See [README.md](./README.md#customization)

---

## 📋 Checklist

- [ ] Deployed to Vercel
- [ ] Got deployment URL
- [ ] Tested widget page
- [ ] Tested API endpoint
- [ ] Embedded on website
- [ ] Tested on mobile
- [ ] (Optional) Set CORS restrictions

