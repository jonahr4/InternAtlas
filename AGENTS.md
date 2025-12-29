# InternAtlas Agent Guide

## Purpose
InternAtlas is a crawler-powered internship/new-grad job aggregation app. It currently supports Greenhouse job boards and is focused on Phase 3 work (improving crawl + adding additional ATS support).

## Current Capabilities
- Admin UI (`/admin`) lets you add company job board URLs by pasting:
  - Google search results HTML, or
  - Raw HTML from a job board table
- The parser extracts Greenhouse career page links and stores companies in Postgres.
- `npm run crawl` ingests jobs from stored companies (Greenhouse only right now).

## Key Paths
- UI + API routes: `app/src/app`
- Admin page: `app/src/app/admin/page.tsx`
- API routes: `app/src/app/api`
- Prisma schema: `app/prisma/schema.prisma`
- Crawl scripts: `app/scripts/crawl.ts`

## Local Setup (short)
Follow `GETTING_STARTED.md` for full steps. At minimum:
1) `cd app && npm install`
2) `cp .env.example .env`
3) Start Postgres (Docker) and run `npx prisma migrate dev`
4) `npm run dev`

## Core Workflows
- Import companies: visit `http://localhost:3000/admin`, paste HTML, import.
- Crawl jobs: `npm run crawl`
- Clear jobs: `npm run jobs:clear`

## Phase 3 Focus
- Improve crawl reliability and coverage.
- Add support for additional ATS providers beyond Greenhouse.
- Ensure API filters/search stay stable as ingestion expands.

## Constraints / Decisions
- TypeScript-only (crawler + app).
- Prisma + Postgres.
- Next.js app hosts both UI and API routes.

## When Modifying Ingestion
- Keep adapters per ATS (Greenhouse today; add new adapters similarly).
- Normalize into the existing Prisma schema.
- Preserve dedupe strategy and freshness fields.
