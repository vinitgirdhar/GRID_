# GRID — Railway Deployment Plan

**Stack:** React 18 + Vite (frontend) · FastAPI + Python (backend) · PostgreSQL + PostGIS (database)  
**Platform:** [Railway](https://railway.app)  
**Services you will create:** 3 — Database, Backend, Frontend

---

## ⚠️ Do This Before Anything Else

Your `.env.example` file contains **real credentials**:
- `GEMINI_API_KEY` — rotate it at [aistudio.google.com](https://aistudio.google.com) → API Keys → Delete and regenerate
- `DATABASE_URL` — this appears to be a Render.com database password; if you no longer use that DB, ignore it. If you do, change the password.

Never put real keys in `.env.example`. That file is meant to show the shape of variables, not real values.

---

## Overview

```
Railway Project
├── Service: postgres     ← Railway-managed PostgreSQL
├── Service: backend      ← FastAPI (Python)
└── Service: frontend     ← React/Vite (static, served via Node)
```

All three live inside a single Railway **project**, so they share a private network and Railway auto-injects the DB connection string.

---

## Step 1 — Push Your Code to GitHub

Railway deploys from GitHub. If your code isn't there yet:

1. Go to [github.com](https://github.com) → New Repository → Name it `grid-app` → Private → Create
2. In VS Code terminal (from your project root):

```bash
git init
git add .
git commit -m "feat: initial commit"
git remote add origin https://github.com/YOUR_USERNAME/grid-app.git
git push -u origin main
```

> **Make sure `.env` is in your `.gitignore`** (should already be). Never commit real `.env` files.

---

## Step 2 — Fix `requirements.txt` Before Deploying

The `airllm` package tries to download a 16GB+ Llama model at runtime. Railway's free tier only has 8GB RAM and builds will time out or crash. Remove it unless you specifically use it in production:

Open `backend/requirements.txt` and either delete the `airllm` line or comment it out:

```
# airllm   ← comment this out if you don't use local LLMs in production
```

Commit and push:
```bash
git add backend/requirements.txt
git commit -m "chore: remove airllm from prod requirements"
git push
```

---

## Step 3 — Create Railway Account & Project

1. Go to [railway.app](https://railway.app) → **Login with GitHub**
2. Click **New Project**
3. Click **Empty Project**
4. Name it `GRID`

You now have an empty Railway project. You will add 3 services to it.

---

## Step 4 — Add the PostgreSQL Database

Railway provides managed Postgres with PostGIS included.

1. Inside your Railway project, click **+ Add Service**
2. Choose **Database** → **PostgreSQL**
3. Railway creates the database instantly. Click on it to open its settings.
4. Go to the **Query** tab (inside Railway's Postgres service) and run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

This enables the PostGIS geometry support your backend needs for `SpatialZone` and `DemandSnapshot`.

5. Go to the **Variables** tab of the Postgres service. You'll see `DATABASE_URL` — copy it. You'll use it in Step 6.

---

## Step 5 — Create the Backend Config Files

You need two files at the **repo root** to tell Railway how to build and run the backend.

### `Procfile` (repo root)
```
web: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

### `nixpacks.toml` (repo root)
```toml
[phases.setup]
nixPkgs = ["python311", "libpq"]

[phases.install]
cmds = ["pip install -r backend/requirements.txt"]

[start]
cmd = "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"
```

These files are already created for you at the end of this document — just follow the instructions to create them, then:

```bash
git add Procfile nixpacks.toml
git commit -m "chore: add Railway backend config"
git push
```

---

## Step 6 — Deploy the Backend Service

1. Inside your Railway project, click **+ Add Service**
2. Choose **GitHub Repo** → Select your `grid-app` repository
3. Railway will auto-detect Python and start deploying
4. **Before the deploy finishes**, click on the service → **Variables** tab → Add these:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Paste the value from Step 4 (the Railway Postgres URL) |
| `WEATHER_API_KEY` | Your WeatherAPI key from [weatherapi.com](https://www.weatherapi.com) |
| `GEMINI_API_KEY` | Your new Gemini key (after rotating in Step 0) |
| `ALLOWED_ORIGINS` | Leave blank for now — you'll fill this after the frontend deploys |

5. Go to **Settings** tab → **Networking** → click **Generate Domain**. Railway gives you a public URL like `grid-backend-production.up.railway.app`. **Copy this URL** — you'll need it for the frontend.

6. Watch the **Deployments** tab. Look for green ✅. If it fails, check the **Build Logs** tab.

### Common backend errors:

**Error: `psycopg2` fails to install**  
Add this to your `nixpacks.toml` under `nixPkgs`: `"postgresql"`

**Error: `No module named 'backend'`**  
Make sure your start command is `uvicorn backend.main:app` (not `main:app`), run from the repo root.

**Error: `relation "spatial_zones" does not exist`**  
Your DB tables haven't been created yet. In Railway's Postgres → Query tab, or by running:
```bash
# One-time setup via Railway CLI (optional)
railway run python -c "from backend.database import Base, engine; Base.metadata.create_all(engine)"
```

---

## Step 7 — Configure CORS in the Backend

Once you know your frontend URL (from Step 8), come back and add it to the backend's environment variables:

In your Railway backend service → **Variables**:
```
ALLOWED_ORIGINS=https://YOUR-FRONTEND.up.railway.app
```

The backend's `config.py` already reads this variable and adds it to CORS. Railway will auto-redeploy when you save.

---

## Step 8 — Create the Frontend Config Files

The frontend needs to know the backend URL at build time (Vite bakes it in as `import.meta.env.VITE_API_BASE_URL`).

Create `frontend.railway.toml` — **wait, Railway uses one `railway.toml` per service root**. Since both services point to the same GitHub repo, you'll set the build/start commands directly in the Railway UI for the frontend (see below). No extra file needed.

---

## Step 9 — Deploy the Frontend Service

1. Inside your Railway project, click **+ Add Service** → **GitHub Repo** → Same `grid-app` repo
2. Railway will try to build it. **Stop it first** by clicking **Cancel Deploy**
3. Click **Settings** tab:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npx serve -s dist --listen $PORT`
   - **Root Directory:** `/` (leave as root)
4. Go to **Variables** tab → Add:

| Variable | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://YOUR-BACKEND-URL.up.railway.app/api` (from Step 6) |
| `NODE_ENV` | `production` |

5. Go to **Settings** → **Networking** → **Generate Domain** → Copy your frontend URL
6. Click **Deploy** (or it auto-deploys when you save variables)

> **Why `npx serve`?** Railway runs containers, not static CDN hosting. `serve` is a tiny Node.js static file server. Vite builds your app into `/dist`, and `serve` serves that folder.

---

## Step 10 — Wire Everything Together

1. **Update backend CORS** (Step 7): Paste your frontend URL into the backend's `ALLOWED_ORIGINS` variable
2. **Verify frontend env**: Your `VITE_API_BASE_URL` should be the backend URL **without** a trailing slash, e.g.:
   ```
   https://grid-backend-production.up.railway.app/api
   ```
3. Railway auto-redeploys both services when you save variables

---

## Step 11 — Run Database Migrations

Your models use SQLAlchemy. You need to create the tables once:

1. Install the Railway CLI:
   ```bash
   npm install -g @railway/cli
   ```
2. Login:
   ```bash
   railway login
   ```
3. Link to your project:
   ```bash
   railway link
   ```
4. Select your **backend** service when prompted
5. Run the table creation:
   ```bash
   railway run python -c "from backend.database import Base, engine; Base.metadata.create_all(bind=engine)"
   ```

This creates all tables (`spatial_zones`, `demand_snapshots`, etc.) in your Railway PostgreSQL database.

---

## Step 12 — Smoke Test

Open your frontend URL in the browser. Check:

- [ ] Landing page loads (no blank white screen)
- [ ] Open browser DevTools → Console: no CORS errors
- [ ] Driver login works
- [ ] Dashboard data loads (check the Network tab for API calls returning 200)
- [ ] Map renders (Leaflet)

If you see CORS errors like `Access-Control-Allow-Origin`:  
→ Go to backend Variables → `ALLOWED_ORIGINS` → make sure the frontend URL matches exactly (no trailing slash, correct protocol `https://`)

---

## Environment Variables Summary

### Backend Service Variables
```
DATABASE_URL         = (auto-set if you use Railway Postgres reference variable)
WEATHER_API_KEY      = your_weatherapi_key
GEMINI_API_KEY       = your_new_gemini_key
ALLOWED_ORIGINS      = https://your-frontend.up.railway.app
```

### Frontend Service Variables
```
VITE_API_BASE_URL    = https://your-backend.up.railway.app/api
NODE_ENV             = production
```

---

## Using Railway Reference Variables (Recommended)

Instead of copy-pasting the `DATABASE_URL`, Railway can inject it automatically:

1. In your **backend service** → Variables → click **+ Add Variable**
2. Click the **$ Reference** button
3. Select your Postgres service → Select `DATABASE_URL`

Railway now automatically keeps this in sync, even if the DB restarts and gets a new connection string.

---

## Free Tier Limits

Railway's free (Hobby) plan gives you **$5 of compute credit/month**. Your three services will use approximately:
- Postgres: ~$0/month (small DB is free)
- Backend: ~$2–4/month (FastAPI is lightweight)
- Frontend: ~$1–2/month (static serving is very cheap)

You're close to the free tier limit. To reduce costs:
- Set **Sleep** on the frontend service (it wakes on request)
- Backend can also sleep if traffic is low

---

## Checklist

- [ ] Credentials rotated (Gemini key, DB password)
- [ ] `airllm` removed from `requirements.txt`
- [ ] Code pushed to GitHub
- [ ] Railway project created
- [ ] PostgreSQL service added + PostGIS extension enabled
- [ ] `Procfile` and `nixpacks.toml` created and pushed
- [ ] Backend service deployed with all env vars
- [ ] Backend domain generated and copied
- [ ] Frontend service deployed with `VITE_API_BASE_URL`
- [ ] Frontend domain generated and copied
- [ ] Backend `ALLOWED_ORIGINS` updated with frontend URL
- [ ] Database tables created via `railway run`
- [ ] Smoke test passed

---

## Files to Create Right Now

Run these commands in your terminal from the project root:

**Create `Procfile`:**
```
web: uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

**Create `nixpacks.toml`:**
```toml
[phases.setup]
nixPkgs = ["python311", "libpq", "postgresql"]

[phases.install]
cmds = ["pip install --no-cache-dir -r backend/requirements.txt"]

[start]
cmd = "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"
```

Then:
```bash
git add Procfile nixpacks.toml
git commit -m "chore: railway deployment config"
git push
```
