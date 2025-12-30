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
- [x] Implement first adapter (Greenhouse or Lever)
- [x] Normalize job fields into schema
- [x] Implement upsert + dedupe key strategy
- [x] Ingest 10+ companies on the same platform

## Phase 3 - Product MVP (filters + search)
- [x] Add API filters (company, location, type, date)
- [x] Add sorting + pagination in API
- [x] Hook UI filters + search to API
- [x] Add job detail view

## Phase 4 - Polish + Stretch
- [x] Add to job  board link to company page too (hyperlinked to company name)
- [x] Add support for additional ATS providers (Lever, Workday - 3 total)
- [x] Upload DB online (Neon PostgreSQL)
- [x] Deploy app + DB (Vercel + Neon) 
- [x] Deployed front end job board with searchable interface
- [x] Back end crawls every 4 hours and updates with new jobs (GitHub Actions)
- [x] Add function to crawl to search to see if jobs in DB are no longer listed on board (or if their links are invalid) and remove them from the job board (or keep them and just deactivate with note Expired)
- [x] Update crawl to recognize jobs that are no longer active and mark them as deactivated
- [x] Automated deployment from main branch
- [x] Production monitoring with Vercel + Neon dashboards



## Phase 5 - front end for final deployion
After deployed, fix front end with authentication and advanced features

### Basic (Non-Logged-In) Experience
- [ ] Add basic view to search table and everything for users without sign in
- [ ] Display main job board table as it currently exists
- [ ] Add "Sign in for more features" button in top right corner
- [ ] Ensure page experience is similar whether logged in or not (main difference is extra features)
- [ ] Jobs that are deativated are striked out on the job board and there is a button top right that will not display them in job board

### Authentication Setup
- [ ] Integrate Firebase for user logins
- [ ] Create sign up flow
- [ ] Create sign in flow
- [ ] Add logout functionality

### Logged-In UI Components
- [ ] Add 3-line menu button in top right corner when logged in
- [ ] Implement side navigation bar that slides in from right when menu clicked
- [ ] Add "Custom Tables" option in side nav
- [ ] Add "Application Tracking" option in side nav
- [ ] Add new "Select Jobs" button above every table that enables job selection mode
- [ ] Implement selector squares on left of each job row (only visible when selection mode triggered)
- [ ] once jobs are slected user. has optopn to add it to "To Apply" or "Applied" boards

### Custom Tables Feature
- [ ] Create "Custom Tables" screen accessible from side nav
- [ ] Add UI to create new custom table with name (e.g., "MA intern")
- [ ] Add keyword input field for custom table setup
- [ ] Add location input field for custom table setup (or any other filters)
- [ ] Display existing custom tables stacked vertically on Custom Tables screen
- [ ] Implement filtering logic to show only jobs matching custom table criteria
- [ ] Add ability to click on custom table to view filtered results
- [ ] Make it easier for users to look at different customized boards

### "SEEN" Feature for Custom Tables
- [ ] Add "SEEN" button to each custom table view
- [ ] Store timestamp of when "SEEN" was last clicked for each custom table
- [ ] Compare job posting dates against last "SEEN" timestamp
- [ ] Display "NEW" badge on jobs posted after last "SEEN" click
- [ ] Remove "NEW" badges when "SEEN" is clicked again
- [ ] Persist "SEEN" state in database per user per custom table

### Application Tracking - "To Apply" Table
- [ ] Create "Application Tracking" screen accessible from side nav
- [ ] Implement "To Apply" functionality when job is selected
- [ ] Create "Jobs To Apply to" table showing all jobs user selected to apply to
- [ ] Display "To Apply" table at top of Application Tracking screen
- [ ] Add checkbox/button to move jobs from "To Apply" to "Applied"
- [ ] Add remove button to delete jobs from "To Apply" table
- [ ] Store "To Apply" jobs in database per user

### Application Tracking - "Applied" Table
- [ ] Create "Applied" table below "To Apply" table on same screen
- [ ] Implement functionality to move jobs from "To Apply" to "Applied" when checked
- [ ] Display all jobs marked as applied
- [ ] Add remove button to delete jobs from "Applied" table
- [ ] Store "Applied" jobs in database per user

### Job Selection Workflow
- [ ] When "Select Jobs" button clicked, show selector squares on left of job rows
- [ ] Display "Add to Applied" and "Add to To Apply" options after jobs selected
- [ ] Implement bulk add to "To Apply" from main job board
- [ ] Implement bulk add to "Applied" from main job board
- [ ] Add confirmation feedback when jobs are added to tables

### Email Notifications (Stretch Goal)
- [ ] Create email subscription system for companies and search terms
- [ ] Allow users to subscribe to specific companies
- [ ] Allow users to subscribe to specific search terms/keywords
- [ ] Send email when subscribed company posts new job matching criteria
- [ ] Add email preferences page for managing subscriptions
- [ ] Implement email unsubscribe functionality

## Phase 6
- [ ] Add stats endpoint + small dashboard - Data analytics on job postings (most popular title, location, etc.)
- [ ] Add Postgres full-text search (tsvector + GIN index)
- [ ] Optional: AI match endpoint + UI


##
Redefine porblem statment and what solutuion would be. Problem is i dont trust job boards that all posts different jobs giving me the feeling im missing on jobs that arent posting. Also its too hard to track all differnt companies individial. Solutuon: this free and assessable Master list that is really easy to use and has Huge Job data base that is easily filterable to what users are looking for and updated daily off of a huge list of companies . I feel like smth like this doesnt exisit 

