# Getting Started

This guide covers both **local development** (Docker) and **production deployment** (Vercel + Neon).

## Quick Links
- 🌐 **Production Site:** [Deployed on Vercel](https://your-app.vercel.app) (update URL)
- 📊 **Database Dashboard:** [Neon Console](https://console.neon.tech)
- 🔄 **Automated Crawling:** [GitHub Actions](https://github.com/jonahr4/InternAtlas/actions)

---

## Local Development Setup

### Prerequisites
- Node.js 20+ (LTS)
- npm or yarn
- Docker Desktop

## Setup
1) Install Docker Desktop (needed for local Postgres):
- https://www.docker.com/products/docker-desktop/

2) Install dependencies:
```bash
cd app
npm install
```

3) Set your environment:
```bash
cp .env.example .env
```

4) Start Postgres (Docker must be running):
```bash
docker run --name internatlas-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=internatlas \
  -p 5432:5432 \
  -d postgres:16
```

5) Apply the database schema:
```bash
npx prisma migrate dev --name init
```

6) Replace the default Next.js homepage with the project placeholder:
- Edit `app/src/app/page.tsx`

7) Build a company list (manual import):
- Start the dev server
```bash
npm run dev
```
- Visit `http://localhost:3000/admin`
- Customize the Google query (location + role keywords)
- Paste Google results into the textarea and click “Import boards”
- You can also import from a GitHub job board table:
  - Visit https://github.com/SimplifyJobs/Summer2026-Internships
  - Open DevTools, copy the raw HTML for the `<table>` element
  - Paste into the “Job board HTML” tab and import
- Inspect stored companies:
```bash
npx prisma studio
```

8) Start the dev server:
```bash
npm run dev
```

9) Open the app:
- http://localhost:3000

## Crawl jobs (from DB)
After importing companies, run:
```bash
npm run crawl
```

To filter by keyword (example: only “intern” roles):
```bash
npm run crawl -- --keyword=intern
```

To clear all jobs (keeps companies):
```bash
npm run jobs:clear
```

Expected CLI summary:
- Total jobs found
- Total working links
- Total broken links

---

## Production Deployment (Vercel + Neon)

### Initial Setup

#### 1. Create Neon Database
1. Sign up at [https://neon.tech](https://neon.tech) (free tier: 0.5GB)
2. Create project named "InternAtlas"
3. Copy connection string: `postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require`

#### 2. Deploy to Vercel
1. Push code to GitHub
2. Sign up at [https://vercel.com](https://vercel.com)
3. Import repository
4. Configure: **Framework:** Next.js | **Root Directory:** `app` | **Environment Variable:** `DATABASE_URL`
5. Deploy!

#### 3. Run Migrations
```bash
DATABASE_URL="your-neon-connection-string" npx prisma migrate deploy
```

#### 4. Set Up Automated Crawling
1. Add `DATABASE_URL` to GitHub Secrets: https://github.com/jonahr4/InternAtlas/settings/secrets/actions
2. Workflow (`.github/workflows/crawl-jobs.yml`) runs every 4 hours

### Manual Production Crawl
```bash
DATABASE_URL="your-neon-connection-string" npm run crawl
```

---

## Architecture
**Local:** Next.js + Docker PostgreSQL + manual crawls  
**Production:** Vercel + Neon + GitHub Actions (every 4 hours)

## Next Step
Continue with Phase 1 in `TODO.md` once the app runs.
