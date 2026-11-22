# Put Clinic X Online (No Localhost)

Your system can run as a **public website**. Users open a normal link like:
https://your-clinic-name.onrender.com

It can also be installed on a phone like an app (PWA).

---

## Option A – Free website with Render (recommended)

1. Create a free account at https://render.com
2. Create a new **Web Service**
3. Connect your GitHub repo (upload this project to GitHub first)
   - Or use **Deploy from existing image / manual** if available
4. Settings:
   - **Runtime**: Node
   - **Build Command**: (leave empty)
   - **Start Command**: `node server.js`
5. Click **Deploy**
6. Render gives you a public URL, for example:
   `https://clinicx-xxxx.onrender.com`

Open that URL on any phone or computer — no localhost.

---

## Option B – Railway

1. Go to https://railway.app
2. New Project → Deploy from GitHub (or upload)
3. Start command: `node server.js`
4. Railway gives you a public HTTPS URL

---

## Option C – Install on phone like an App (PWA)

After the website is online:

**Android (Chrome)**
1. Open your Clinic X URL
2. Menu → **Add to Home Screen** / **Install app**

**iPhone (Safari)**
1. Open your Clinic X URL
2. Share → **Add to Home Screen**

It opens full screen like a normal app.

---

## Important notes

- Free hosting may sleep after idle time (first open can be slow)
- Default logins still work (change passwords for real use)
- Data is stored on the server (JSON file). For a busy real clinic later, use a real database
- For production, change the JWT secret and all default passwords

---

## Upload to GitHub (needed for Render/Railway)

```bash
cd ClinicX-Complete
git init
git add .
git commit -m "Clinic X system"
```

Then create a repo on GitHub and push.
