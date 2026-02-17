<p align="center">
  <img src="app/public/InternAtlasBanner.png" alt="InternAtlas Banner" />
</p>

# InternAtlas
**A production job aggregation platform that crawls 2000+ companies across 4 ATS providers, serving 300,000+ internship and new-grad listings through an intelligent, searchable job board with custom filtering and application tracking.**

🌐 **Live Site:** [https://internatlas.tech](https://internatlas.tech)

---

## Summary
InternAtlas automatically ingests job listings from curated company career sites across multiple ATS providers (**Greenhouse**, **Lever**, **Workday**, **iCIMS**), normalizes them into a **PostgreSQL database** (Digital Ocean), and serves a **production-hosted job board** with real-time **search, advanced filtering, custom tables, and application tracking**.

The platform uses a reverse-discovery workflow: we scrape Google to find companies posting tech internships/new-grad roles, then work backward to identify their career board URLs. This ensures we only track companies actively hiring for technical positions.

**Current Status:**
- ✅ **Live and deployed** at internatlas.tech with Digital Ocean PostgreSQL
- ✅ **2000+ companies** tracked across 4 ATS platforms (Greenhouse, Lever, Workday, iCIMS)
- ✅ **300,000+ active job listings** with automatic status tracking
- ✅ **Automated crawling** twice daily via GitHub Actions
- ✅ **Firebase authentication** with Google OAuth
- ✅ **Firestore-powered** custom tables and application tracking
- ✅ **Live database insights** on About page with real-time statistics
- ✅ **Production-ready** with advanced search, filters, pagination, and personalization

---

## Features (✅ Shipped)

### Job Board
- ✅ **300,000+ live job listings** from PostgreSQL database
- ✅ **Multi-dimensional search and filters:**
  - Real-time keyword search (title, description, company)
  - Company name filter with autocomplete
  - Location search with remote/hybrid/onsite detection
  - Job status (Open / Closed / Both)
  - Employment type (Intern / New Grad / Full Time)
  - ATS platform filter
  - Date-based sorting options
- ✅ **Advanced UI features:**
  - Split-pane interface with job list and detail view
  - Bulk selection mode for saving multiple jobs
  - Responsive mobile design with bottom sheets
  - Status badges (NEW, Open/Closed indicators)
  - Direct links to company career pages and job postings
  - Pagination with configurable page size
  - Keyboard navigation (↑/↓ arrows, Enter to apply)

### Custom Tables
- ✅ **Personalized job filtering** with saved searches
  - Create unlimited custom tables with unique filter combinations
  - Title keyword matching (e.g., "Backend + Python")
  - Location filtering (e.g., "Boston + Remote")
  - Company-specific filters
  - ATS platform filtering
- ✅ **Smart NEW job tracking:**
  - Automatic detection of new jobs since last visit
  - NEW badge count in sidebar
  - "Mark as Seen" functionality
  - Lock/unlock filters with reset option
- ✅ **Firestore-backed storage** for real-time sync across devices

### Application Tracking
- ✅ **Two-stage application workflow:**
  - "To Apply" list for jobs you plan to apply to
  - "Applied" list for completed applications
- ✅ **Quick save actions:**
  - Save individual jobs from detail panel
  - Bulk save from main job board
  - Bulk save from custom tables
- ✅ **Compact tracking interface:**
  - Space-efficient job cards
  - Open/closed status indicators
  - One-click job status updates
  - Direct removal from tracking lists
- ✅ **Firestore-backed** with real-time sync and authentication

### About Page
- ✅ **Live database statistics:**
  - Total jobs and companies tracked
  - Jobs by ATS platform breakdown
  - Real-time data directly from PostgreSQL
  - Visual insights into platform coverage

### Job Discovery & Admin Tools
- ✅ **Google scraper** in `/test/MyGoogleScraper` for discovering companies
  - Searches Google for companies posting tech internships/new-grad roles
  - Filters by ATS platform (Greenhouse, Lever, Workday, iCIMS)
  - Exports job board URLs for validation
- ✅ **Admin page** (`/admin`) for curating company database
  - Paste Google search results or job board HTML
  - Automatically extracts career page URLs
  - Validates and imports companies into PostgreSQL
  - Ensures only companies with active tech hiring are tracke
---

## Automation
- ✅ **GitHub Actions workflows** run crawlers twice daily (every 12 hours)
- ✅ **Platform-specific crawlers:**
  - Greenhouse: `crawl-greenhouse.yml`
  - Lever: `crawl-lever.yml`
  - Workday: `crawl-workday.yml`
  - iCIMS: `crawl-icims.yml`
  - Master: `crawl-jobs.yml` (runs all adapters)
- ✅ **Automatic job status updates** (detects closed/expired listings)
- ✅ **Prisma migrations** deployed automatically on each run
- ✅ **Error handling and logging** for crawl operations
- ✅ **Manual trigger support** via GitHub Actions UI


## Tech Stack
**Frontend:**
- **Next.js 16** (App Router, TypeScript, React Server Components)
- **React 19** with hooks and context API
- **Tailwind CSS** for responsive styling
- **Firebase Authentication** (Google OAuth)

**Backend:**
- **Next.js API Routes** (TypeScript, serverless functions)
- **Prisma ORM** 6.19.1 for PostgreSQL operations
- **PostgreSQL 16** (Digital Ocean Managed Database)
- **Firebase Firestore** for user-specific data:
  - Custom tables with filter configurations
  - Application tracking (To Apply / Applied lists)
  - Real-time synchronization

**Infrastructure:**
- **Vercel** - Frontend and API hosting with automatic deployments
- **Digital Ocean** - Managed PostgreSQL database (300k+ jobs)
- **Firebase** - Authentication and Firestore NoSQL database
- **GitHub Actions** - Automated crawling twice daily
- **.tech domain** - Production domain (internatlas.tech)

**Crawling & Data Processing:**
- **TypeScript-based adapters** for 4 ATS platforms:
  - **Greenhouse** (REST API)
  - **Lever** (REST API)
  - **Workday** (HTML scraping with Axios + Cheerio)
  - **iCIMS** (HTML scraping with Axios + Cheerio)
- **Axios** for HTTP requests
- **Cheerio** for HTML parsing
- **Puppeteer** (in test suite) for Google search scraping

**Future Enhancements:**
- **Azure OpenAI** integration planned for intelligent job matching and custom search term generation

---

## Architecture

### Local Development
```mermaid
flowchart LR
  subgraph Local["Local Development"]
    DEV["Next.js\nlocalhost:3000\n(UI + API)"]
    DOCKER[("Docker\nPostgreSQL 16\nlocalhost:5432")]
    FB["Firebase\n(Cloud)\n- Auth\n- Firestore"]
    
    DEV -->|Prisma| DOCKER
    DEV -->|Firebase SDK| FB
    
    CRAWL["npm run crawl\n(Manual)"] -->|Upsert Jobs| DOCKER
    STUDIO["Prisma Studio\n(DB Inspection)"] -.->|View Data| DOCKER
  end
```

**Components:**
- **Next.js app** - UI + API routes on localhost:3000
- **Docker PostgreSQL** - Local database for job listings
- **Firebase** - Cloud-hosted auth and Firestore (same as production)
- **Manual crawl** - Run `npm run crawl` to test adapters
- **Prisma Studio** - Visual database browser

### Production (internatlas.tech)
```mermaid
flowchart TD
  USER["👤 Users\ninternatlas.tech"] -->|HTTPS| VERCEL
  
  subgraph Vercel["Vercel\n(Next.js Hosting)"]
    UI["React UI\n(SSR/SSG)"]
    API["API Routes\n/api/jobs\n/api/companies"]
  end
  
  subgraph Firebase["Firebase"]
    AUTH["Authentication\n(Google OAuth)"]
    FIRESTORE[("Firestore\nNoSQL DB\n- Custom Tables\n- Tracked Jobs")]
  end
  
  subgraph DO["Digital Ocean"]
    POSTGRES[("PostgreSQL 16\nManaged DB\n300k+ jobs\n2000+ companies")]
  end
  
  subgraph GitHub["GitHub Actions\n(Twice Daily)"]
    GH_GH["crawl-greenhouse.yml"]
    GH_LV["crawl-lever.yml"]
    GH_WD["crawl-workday.yml"]
    GH_IC["crawl-icims.yml"]
    GH_PR["prisma-deploy.yml"]
  end
  
  VERCEL -->|Prisma ORM| POSTGRES
  VERCEL -->|Firebase SDK| AUTH
  VERCEL -->|Firebase SDK| FIRESTORE
  USER -->|Sign In| AUTH
  
  GH_GH -->|Upsert Jobs| POSTGRES
  GH_LV -->|Upsert Jobs| POSTGRES
  GH_WD -->|Upsert Jobs| POSTGRES
  GH_IC -->|Upsert Jobs| POSTGRES
  GH_PR -->|Migrate| POSTGRES
```

**Data Flow:**
1. **GitHub Actions** run twice daily, crawling 4 ATS platforms
2. **Crawlers** fetch jobs and upsert into **Digital Ocean PostgreSQL**
3. **Users** access **Vercel-hosted Next.js app** via internatlas.tech
4. **API routes** query PostgreSQL for job listings
5. **Firebase Auth** handles Google sign-in
6. **Firestore** stores user-specific data (custom tables, tracked jobs)
7. **UI** combines data from PostgreSQL (jobs) and Firestore (user data)

---

## Data Model

### PostgreSQL Schema (Job Listings)
Stores all crawled job data in a normalized relational structure.

**Company Table:**
```prisma
model Company {
  id             String          @id @default(cuid())
  name           String          @unique
  platform       SourcePlatform  // GREENHOUSE | LEVER | WORKDAY | ICIMS
  boardUrl       String          // Career page URL
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  firstCrawledAt DateTime?
  
  jobs           Job[]           // Relation to jobs
}
```

**Job Table:**
```prisma
model Job {
  id               String         @id @default(cuid())
  companyId        String
  company          Company        @relation(fields: [companyId], references: [id])
  
  // Job details
  title            String
  location         String?
  locationType     LocationType   @default(UNKNOWN)  // REMOTE | HYBRID | ONSITE
  employmentType   EmploymentType @default(UNKNOWN)  // INTERN | NEW_GRAD | FULL_TIME
  
  // URLs
  jobUrl           String         // Direct job posting URL
  applyUrl         String?        // Application URL (if different)
  
  // Content
  descriptionText  String?        // Parsed job description
  requirementsText String?        // Parsed requirements
  
  // Metadata
  postedAt         DateTime?      // Original post date (if available)
  sourcePlatform   SourcePlatform // ATS platform
  rawPayload       Json?          // Original API response for debugging
  
  // Deduplication
  externalId       String?        // ATS-provided ID
  dedupeKey        String?        // SHA256 hash for fallback deduplication
  
  // Freshness tracking
  firstSeenAt      DateTime       @default(now())
  lastSeenAt       DateTime       @default(now())
  status           JobStatus      @default(ACTIVE)  // ACTIVE | CLOSED
  
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  
  // Indexes for performance
  @@index([companyId])
  @@index([status, postedAt])
  @@index([employmentType])
  @@unique([sourcePlatform, externalId])
  @@unique([dedupeKey])
}
```

**Key Features:**
- **Composite indexes** optimize common query patterns (status + date, employment type + date)
- **Unique constraints** prevent duplicates via `(sourcePlatform, externalId)` or `dedupeKey`
- **Freshness tracking** enables "NEW" badges and closed job detection
- **Raw payload** stored for debugging adapter issues

### Firestore Schema (User Data)
NoSQL document database for user-specific features requiring real-time sync.

**customTables Collection:**
```typescript
{
  userId: string           // Firebase Auth UID
  name: string             // User-defined table name
  
  // Filter configuration (saved search)
  titleTags: string[]      // Keywords to match in job titles
  locationTags: string[]   // Location filters
  companyFilter: string?   // Specific company name
  selectedPlatforms: string[]  // ATS platforms to include
  
  // NEW job tracking
  lastSeenAt: Timestamp?   // Last time user visited this table
  newJobCount: number      // Count of jobs added since lastSeenAt
  
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**trackedJobs Collection:**
```typescript
{
  userId: string           // Firebase Auth UID
  jobId: string            // References Job.id from PostgreSQL
  status: string           // "to_apply" | "applied"
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

**Firestore Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /customTables/{docId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }
    match /trackedJobs/{docId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }
  }
}
```

**Why Firestore for User Data?**
- **Real-time sync**: Changes propagate instantly across devices
- **Offline support**: Works without internet connection
- **Scalability**: NoSQL structure ideal for user-specific documents
- **Security**: Row-level security via Firebase Auth
- **Separation of concerns**: Job listings (PostgreSQL) vs. user preferences (Firestore)

---

## Repository Structure
```
/InternAtlas
  /.github/workflows/          # CI/CD automation
    crawl-jobs.yml             # Master crawler (all platforms)
    crawl-greenhouse.yml       # Greenhouse-specific
    crawl-lever.yml            # Lever-specific
    crawl-workday.yml          # Workday-specific
    crawl-icims.yml            # iCIMS-specific
    prisma-deploy.yml          # Database migration workflow
    repair-workday.yml         # Workday troubleshooting
  
  /app/                        # Next.js application root
    /prisma/
      schema.prisma            # Database models (Company, Job)
      /migrations/             # Migration history
    
    /scripts/
      crawl.ts                 # Main crawler entry point
      clear-jobs.ts            # Database cleanup utility
      test-workday.ts          # Workday adapter testing
      test-icims.ts            # iCIMS adapter testing
      benchmark-db.ts          # Performance testing
      export-companies.ts      # Company data export
    
    /src/
      /app/                    # Next.js 16 app router
        /admin/                # Company import page
          page.tsx             # Admin UI for adding companies
        /custom-tables/        # Saved search tables
          page.tsx             # Custom tables UI
        /tracking/             # Application tracking
          page.tsx             # To Apply / Applied lists
        /about/                # Live statistics
          page.tsx             # Database insights
        /api/                  # API routes
          /jobs/               # Job listing endpoints
            route.ts           # GET /api/jobs
          /companies/          # Company endpoints
            route.ts           # GET /api/companies
          /stats/              # Statistics endpoint
        page.tsx               # Main job board
      
      /components/             # React components
        JobCard.tsx            # Job list item
        JobDetailPanel.tsx     # Job detail view
        JobSearch.tsx          # Main board with filters
        CompactJobCard.tsx     # Tracking page card
        TopNav.tsx             # Navigation bar
        AuthButton.tsx         # Sign in/out button
        TagInput.tsx           # Multi-tag filter input
      
      /contexts/               # React contexts
        AuthContext.tsx        # Firebase auth state
      
      /lib/                    # Utility libraries
        firebase.ts            # Firebase initialization
        firestore.ts           # Firestore operations
        prisma.ts              # Prisma client singleton
    
    /public/                   # Static assets
    
    /data/                     # Seed data
      companies.json           # Company list backup
      /backups/                # Database backups
  
  /test/                       # Testing & discovery tools
    /MyGoogleScraper/          # Company discovery
      google-results-simple-scrape.ts  # Puppeteer scraper
      /results/                # Scraped HTML outputs
      lever_job_links.txt      # Extracted URLs
    
    /db-performance/           # Database benchmarks
    /google-scraper/           # Alternative scraper
    /jobspy/                   # JobSpy integration
```

---

## Configuration

### Environment Variables

**Production (Vercel + GitHub Actions):**
```bash
# Digital Ocean PostgreSQL
DATABASE_URL="postgresql://user:password@host:25060/database?sslmode=require"

# Firebase Authentication
NEXT_PUBLIC_FIREBASE_API_KEY="AIza..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="internatlas.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="internatlas"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="internatlas.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abc123"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-XXXXXXXXXX"

# Optional: Azure OpenAI (planned feature)
# AZURE_OPENAI_API_KEY="..."
# AZURE_OPENAI_ENDPOINT="https://..."
```

**Local Development:**
```bash
# Docker PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/internatlas?schema=public"

# Firebase (same config as production - use your Firebase project)
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="..."
```

---

## Local Setup

### Prerequisites
- **Node.js** 20+ and npm
- **Docker Desktop** (for PostgreSQL)
- **Firebase account** (for auth + Firestore)

### Quick Start

1. **Clone repository:**
```bash
git clone https://github.com/jonahr4/InternAtlas.git
cd InternAtlas/app
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start Docker PostgreSQL:**
```bash
docker run --name internatlas-db \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=internatlas \
  -p 5432:5432 \
  -d postgres:16
```

4. **Create `.env` file:**
```bash
# In /app directory
cat > .env << EOF
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/internatlas?schema=public"

# Add your Firebase config here
NEXT_PUBLIC_FIREBASE_API_KEY="your-api-key"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-project-id"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-app.appspot.com"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-sender-id"
NEXT_PUBLIC_FIREBASE_APP_ID="your-app-id"
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID="G-XXXXXXXXXX"
EOF
```

5. **Run Prisma migrations:**
```bash
npx prisma migrate dev
```

6. **Generate Prisma client:**
```bash
npx prisma generate
```

7. **Start development server:**
```bash
npm run dev
```

Visit **http://localhost:3000** - you should see the job board (empty initially).

### Optional: Import Companies

8. **Use Google scraper to find companies:**
```bash
cd ../test/MyGoogleScraper
npm install
npm run scrape
```

This will:
- Search Google for tech internship postings on ATS platforms
- Save HTML results to `/results` folder
- Extract career page URLs

9. **Import via Admin page:**
- Navigate to `http://localhost:3000/admin`
- Paste HTML from Google results or job board table
- Click "Import Companies"
- Companies are validated and added to PostgreSQL

### Optional: Run Crawler

10. **Crawl jobs from imported companies:**
```bash
cd ../../app
npm run crawl
```

This will:
- Fetch jobs from all companies in database
- Use appropriate adapter (Greenhouse/Lever/Workday/iCIMS)
- Upsert jobs into PostgreSQL
- Update job statuses (ACTIVE/CLOSED)

**Note:** First crawl takes several minutes for 2000+ companies. Subsequent crawls are faster due to deduplication.

### Troubleshooting

**Database connection issues:**
```bash
# Check Docker container is running
docker ps | grep internatlas-db

# View container logs
docker logs internatlas-db

# Restart container
docker restart internatlas-db
```

**Prisma issues:**
```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio
```

**Firebase authentication not working:**
- Verify Firebase config in `.env`
- Check Firebase Console → Authentication is enabled
- Ensure Google OAuth is configured with correct redirect URLs

---

## Testing & Discovery Tools

### Google Scraper (`/test/MyGoogleScraper`)

**Purpose:**  
Discovers companies actively hiring for tech positions by scraping Google search results.

**How it works:**
1. Searches Google for: `"Software Engineer Intern" site:boards.greenhouse.io`
2. Filters results by ATS platform (Greenhouse, Lever, Workday, iCIMS)
3. Extracts company career page URLs from search results
4. Saves URLs for validation and import

**Usage:**
```bash
cd test/MyGoogleScraper
npm install

# Configure search terms in google-results-simple-scrape.ts
npm run scrape
```

**Configuration:**
```typescript
// Modify these arrays in google-results-simple-scrape.ts
const JOB_TERMS = [
  'Software Engineer Intern',
  'Frontend Engineer Intern',
  'Backend Engineer Intern',
  'New Grad Software Engineer'
];

const ATS_SITES = [
  'boards.greenhouse.io',
  'jobs.lever.co',
  'myworkdayjobs.com',
  'icims.com'
];
```

**Output:**
- `results/*.html` - Raw HTML pages from Google
- `lever_job_links.txt` - Extracted career page URLs

**Why this approach?**
- **Quality over quantity**: Only includes companies actively hiring
- **Tech-focused**: Filters for software engineering roles
- **ATS validation**: Ensures company uses supported platform
- **Reverse discovery**: Start from job postings → work backward to career pages

### Admin Page (`/admin`)

**Purpose:**  
Curate and import companies into the database after validation.

**Workflow:**
1. Run Google scraper to discover companies
2. Copy HTML from Google results or job board tables
3. Navigate to `http://localhost:3000/admin` or `internatlas.tech/admin`
4. Paste HTML into text area
5. Click "Import Companies"
6. System extracts career page URLs and validates format
7. Companies are inserted into PostgreSQL (duplicates skipped)

**Supported Input Formats:**
- Google search results HTML
- Greenhouse job board table HTML
- Lever career pages list
- Workday postings page
- iCIMS listings page

**Validation:**
- URL format must match known ATS patterns
- Company name extracted from URL
- Platform auto-detected from URL structure
- Duplicates prevented via unique company name constraint

---

## API Reference

### `GET /api/jobs`

**Description:** Fetch paginated job listings with filters and search.

**Query Parameters:**
- `q` (string) - Keyword search across title, description, company name
- `company` (string) - Filter by exact company name
- `employmentType` (enum) - `INTERN` | `NEW_GRAD` | `FULL_TIME`
- `locationType` (enum) - `REMOTE` | `HYBRID` | `ONSITE`
- `location` (string) - Location substring filter
- `status` (enum) - `ACTIVE` | `CLOSED` | `both`
- `platform` (enum) - `GREENHOUSE` | `LEVER` | `WORKDAY` | `ICIMS`
- `sort` (string) - Sort field: `company` | `title` | `created_at`
- `sortDir` (enum) - `asc` | `desc`
- `page` (number) - Page number (default: 1)
- `pageSize` (number) - Results per page (default: 50)
- `ids` (string) - Comma-separated job IDs for bulk fetch

**Response:**
```typescript
{
  items: Job[],
  total: number,
  page: number,
  pageSize: number
}
```

### `GET /api/companies`

**Description:** List all companies with job counts.

**Response:**
```typescript
{
  companies: Array<{
    id: string,
    name: string,
    boardUrl: string,
    platform: string,
    jobCount: number
  }>
}
```

### `GET /api/stats`

**Description:** Database statistics for About page.

**Response:**
```typescript
{
  totalJobs: number,
  totalCompanies: number,
  jobsByPlatform: {
    GREENHOUSE: number,
    LEVER: number,
    WORKDAY: number,
    ICIMS: number
  }
}
```

---

## Project Phases

### Phase 1 — Foundation ✅ COMPLETE
- [x] Create Next.js app + TypeScript setup
- [x] Spin up local Postgres (Docker) and connect via `DATABASE_URL`
- [x] Define Prisma schema: `companies`, `jobs`
- [x] Build minimal UI: Job Board page with mock layout
- [x] Implement `GET /api/jobs` returning DB rows

**Exit criteria:** App runs locally, UI loads, API hits DB.

---

### Phase 2 — Ingestion ✅ COMPLETE
- [x] Implement `scripts/crawl.ts` runner (manual trigger)
- [x] Build `GreenhouseAdapter`
- [x] Build `LeverAdapter`
- [x] Build `WorkdayAdapter`
- [x] Build `IcimsAdapter`
- [x] Normalize job fields into schema
- [x] Implement upsert + dedupe key strategy
- [x] Load 2000+ companies and ingest 300k+ jobs

**Exit criteria:** Running `npm run crawl` populates DB with real listings.

---

### Phase 3 — Product MVP ✅ COMPLETE
- [x] Implement PostgreSQL full-text search with GIN indexes
- [x] Add filters in API query (company/type/location/date)
- [x] Hook UI filters + search to API
- [x] Add pagination + sorting
- [x] Build clean job detail view with split-pane interface
- [x] Add keyboard navigation (↑/↓ arrows)
- [x] Implement bulk selection mode
- [x] Add mobile-responsive design

**Exit criteria:** Fully DB-backed job board with filters + search, demo-ready.

---

### Phase 4 — User Features ✅ COMPLETE
- [x] Add Firebase Authentication (Google OAuth)
- [x] Build custom tables feature with Firestore
- [x] Implement NEW job tracking per table
- [x] Build application tracking (To Apply / Applied)
- [x] Add About page with live statistics
- [x] Build Admin page for company imports
- [x] Create Google scraper for company discovery

**Exit criteria:** Personalized features with user authentication.

---

### Phase 5 — Production Deployment ✅ COMPLETE
- [x] Deploy to Vercel (internatlas.tech)
- [x] Set up Digital Ocean managed PostgreSQL
- [x] Configure Firebase for production
- [x] Implement GitHub Actions for automated crawling (twice daily)
- [x] Add platform-specific crawler workflows
- [x] Set up automated Prisma migrations
- [x] Optimize with composite database indexes
- [x] Add error handling and logging

**Exit criteria:** Live production site with automated crawling.

---

### Phase 6 — Future Enhancements 🚧 PLANNED
- [ ] Azure OpenAI integration for intelligent job matching
- [ ] Custom search term generation using AI
- [ ] Resume parser with skill extraction
- [ ] Email notifications for new jobs in custom tables
- [ ] Company following feature
- [ ] Job application deadline tracking
- [ ] Interview preparation resources
- [ ] Salary data aggregation
- [ ] Mobile app (React Native)

**Exit criteria:** Advanced AI-powered features and mobile platform.

---

## Contributing

This is currently a personal project. Bug reports and feature suggestions welcome via GitHub Issues.

---

## License

MIT License - See LICENSE file for details.

---

## Contact

**Jonah Rothman**  
- Live Site: [internatlas.tech](https://internatlas.tech)
- GitHub: [@jonahr4](https://github.com/jonahr4)

---

*Built to help students find tech internships and new-grad opportunities.*
