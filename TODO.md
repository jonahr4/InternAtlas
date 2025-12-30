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
- [ ] Add to board link to company page too (hyperlinked to company name)
- [ ] Add stats endpoint + small dashboard - Data analytics on job postings (most popular title, location, etc.)
- [ ] Add Postgres full-text search (tsvector + GIN index)
- [ ] Add support for additional ATS providers (Lever, Workday, etc.)
- [ ] Upload DB online 
- [ ] Deploy app + DB 
    - once deployed, front end is job board where its better search able also says new lisitings today 
    - Back end crawls every 2 hours and updates with new jobs
- [ ] Optional: AI match endpoint + UI
- [ ] Add function to crawl to search to see if jobs in DB are no longer listed on board (or if theier links are invalid) and remove them from the job board( or keep them and just deactivate with note Expeired)

## Notes on front end for final deployion
after deployed fix front end
- add basic view to search table and everything for no sign in
- For sign in have sepcial features
- being able to make "custom searches" where you can create certrain tables for certeain keywords for each one
    - For example have board the  called "MA intern" where you set it up to be Keyword intern and Location and when the click on it it only shows those results. This would be to make it easier for user to look at differnt customized boards
    - Also when useer looks at any of these boards they can click a button that says "SEEN" or smth like that. Then when they look back on the page on a differnt day in furutre, all the new jobs that were posted after "SEEN" was last clicked will show with "NEW" badges that go away when seen is clicked again.
    - User can click on jobs and check "To Apply" which brings them to another page we will have for users who log in which is "Jobs To Apply to" which is a table of the ones you selected to apply. on this to apply screen you can check them again to add them to a applied table. (on same page but bellow the to apply table) On either of these tables you will have option ro remove jobs from table also
- The idea is of someone wants to go on app to search around and use it also but you can also make account to make it easier to organize
- The page from having an account to not having acround isnt a big chnage
- The page signed out is basically what we have already just the main table as it is and top right will hvae a sign in for more features    
    - We will use firebase for logins
- When logged in there will be 3 lines top right corner than when u click side nav bar comes to right that shows the options for "Custom Tables" and "Application Tracking" tables. Additionally when logged in there is a new button for Adding that when clickec gives option to add to Applied or To Apply which will add them to corresponding tables. The way to add these is when logged in new selector squars will be on left of each job row that only become visible when the new button select is trigged, promting users to select
-The Custom Tables Screen contains Option to add tables and exisiting tables that you have already created, They are just stacked on top eachother
- APplication trcking is simular First table is to apply and then u scoll down and see another table applied
- U can also get emailed when compnay u like posts jobs under search terms (stretch goal)
##
Redefine porblem statment and what solutuion would be. Problem is i dont trust job boards that all posts different jobs giving me the feeling im missing on jobs that arent posting. Also its too hard to track all differnt companies individial. Solutuon: this free and assessable Master list that is really easy to use and has Huge Job data base that is easily filterable to what users are looking for and updated daily off of a huge list of companies . I feel like smth like this doesnt exisit 

