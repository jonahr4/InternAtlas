# InternAtlas TODO

## Phase 0 - Setup
- [x] Install Node.js (LTS) and Docker Desktop
- [x] Create Next.js app with TypeScript
- [x] Run dev server and confirm homepage loads

## Phase 1 - Foundation (DB + app skeleton)
- [x] Start local Postgres in Docker
- [x] Add Prisma and configure `DATABASE_URL`
- [x] Define schema: `companies`, `jobs` (optional: `crawl_runs`)
- [x] Create `GET /api/jobs` that reads from DB
- [x] Build minimal Job Board UI wired to `/api/jobs`

## Phase 2 - Ingestion MVP (jobs -> DB)
- [x] Add `data/companies.json` seed list
- [x] Create `scripts/crawl.ts` runner
- [x] Add manual company import UI (paste Greenhouse URLs -> companies table)
- [ ] Implement first adapter (Greenhouse or Lever)
- [ ] Normalize job fields into schema
- [ ] Implement upsert + dedupe key strategy
- [ ] Ingest 10+ companies on the same platform
- [ ] Add a source list pipeline: start from careers list directories (careerslist.pages.dev, awesome-career-pages), extract career page URLs, and store them for later ingestion

## Phase 3 - Product MVP (filters + search)
- [ ] Add Postgres full-text search (tsvector + GIN index)
- [ ] Add API filters (company, location, type, date)
- [ ] Add sorting + pagination in API
- [ ] Hook UI filters + search to API
- [ ] Add job detail view

## Phase 4 - Polish + Stretch
- [ ] Add crawl run logging (counts, duration, errors)
- [ ] Add stats endpoint + small dashboard
- [ ] Add basic tests (adapters + API)
- [ ] Deploy app + DB
- [ ] Optional: AI match endpoint + UI
