# Getting Started

This guide sets up the workspace locally with minimal steps.

## Prerequisites
- Node.js (LTS)
- npm
- Docker Desktop (for Postgres later)

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
- Visit `http://localhost:3000/admin`
- Customize the Google query (location + role keywords)
- Paste Google results into the textarea and click “Import boards”
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

Expected CLI summary:
- Total jobs found
- Total working links
- Total broken links

## Next Step
Continue with Phase 1 in `TODO.md` once the app runs.
