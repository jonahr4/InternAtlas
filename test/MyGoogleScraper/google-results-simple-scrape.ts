import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// ========== CONFIGURATION ==========

// ATS sites to scrape
const ATS_SITES = [
  'jobs.lever.co',
  'myworkdayjobs.com',
  'icims.com',
  'boards.greenhouse.io',
  'jobs.smartrecruiters.com'
];

// Job search terms (will run separate search for each)
// const JOB_TERMS = [
//   'Software Engineer Intern',
//   'Software Developer Intern',
//   'Backend Engineer Intern',
//   'Frontend Engineer Intern',
//   'Full Stack Engineer Intern',
//   'Software Engineering Intern',
//   'SWE Intern',
//   'New Grad',
// ];
const JOB_TERMS = [
  'Software Engineering',
  'Social Media',
  'Product Manager',
  'Multimedia',
];


// Locations to keep query simple (OR logic within each search)
const LOCATION_QUERY = 'New York OR NYC OR "New York City"';

const DELAY_BETWEEN_PAGES = 4000; // 4 seconds between page loads (increased)
const DELAY_BETWEEN_SEARCHES = 8000; // 8 seconds between different searches (increased)
const RANDOM_DELAY_MAX = 3000; // Add up to 3 seconds random delay

// Anti-bot detection helpers
function randomDelay(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function humanScroll(page: any) {
  // Simulate human-like scrolling behavior
  await page.evaluate(async () => {
    const distance = Math.floor(Math.random() * 300) + 200;
    await new Promise((resolve) => {
      let totalHeight = 0;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve(null);
        }
      }, 100);
    });
  });
}

// ===================================

// ===================================

function buildSearchQuery(atsSite: string, jobTerm: string): string {
  // Simple query like the one that works well for the user
  return `site:${atsSite} ${LOCATION_QUERY} intext:"apply" (intext:${jobTerm})`;
}

async function scrapeGoogleResults() {
  console.log('🚀 Starting Multi-ATS Google Job Scraper...');
  console.log(`📋 Scraping ${ATS_SITES.length} ATS platforms`);
  console.log(`🔍 Job Terms: ${JOB_TERMS.length} separate searches per ATS`);
  console.log(`📍 Location: ${LOCATION_QUERY}`);
  console.log(`📊 Total searches: ${ATS_SITES.length * JOB_TERMS.length}\n`);

  // Create timestamped output folder with keywords and location
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                    new Date().toTimeString().split(' ')[0].replace(/:/g, '');
  
  // Create a sanitized folder name that includes job terms and location
  const sanitizedTerms = JOB_TERMS.map(term => term.replace(/[^a-zA-Z0-9]/g, '_')).join('-');
  const sanitizedLocation = LOCATION_QUERY.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const folderName = `${timestamp}_${sanitizedTerms}_${sanitizedLocation}`;
  
  const outputDir = path.join(__dirname, 'results', folderName);
  fs.mkdirSync(outputDir, { recursive: true });
  console.log(`📁 Output directory: ${outputDir}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled', // Hide automation
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ]
  });

  const page = await browser.newPage();
  
  // Randomize viewport to look more human
  const viewportWidth = 1280 + Math.floor(Math.random() * 200);
  const viewportHeight = 720 + Math.floor(Math.random() * 200);
  await page.setViewport({ width: viewportWidth, height: viewportHeight });

  // Rotate user agents
  const userAgents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  await page.setUserAgent(randomUserAgent);
  
  // Hide webdriver property
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });
  });

  const allResultsByAts: Record<string, Set<string>> = {};
  
  // Scrape each ATS site
  for (let atsIndex = 0; atsIndex < ATS_SITES.length; atsIndex++) {
    const atsSite = ATS_SITES[atsIndex];
    
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🏢 ATS ${atsIndex + 1}/${ATS_SITES.length}: ${atsSite}`);
    console.log(`${'='.repeat(80)}\n`);

    const atsLinks = new Set<string>();
    
    // Run separate search for each job term
    for (let termIndex = 0; termIndex < JOB_TERMS.length; termIndex++) {
      const jobTerm = JOB_TERMS[termIndex];
      const searchQuery = buildSearchQuery(atsSite, jobTerm);
      
      console.log(`   🔍 Search ${termIndex + 1}/${JOB_TERMS.length}: "${jobTerm}"`);
      console.log(`      Query: ${searchQuery}`);

      let pageNumber = 1;

      try {
        // Random delay before search to appear more human
        await randomDelay(2000, 5000);
        
        // Navigate to first page
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle0', timeout: 60000 });

        while (true) {
          // Wait for results to load (doubled timeout for captcha)
          await page.waitForSelector('#search', { timeout: 20000 });
          
          // Simulate human-like scrolling
          await randomDelay(500, 1500);
          await humanScroll(page);
          await randomDelay(1000, 2000);
        
          // Extract all job links from current page (matching the ATS site)
          const pageLinks = await page.evaluate((targetSite) => {
            const links: string[] = [];
            const resultLinks = document.querySelectorAll('a[jsname="UWckNb"]');
            
            resultLinks.forEach((link) => {
              const href = link.getAttribute('href');
              if (href && href.includes(targetSite)) {
                links.push(href);
              }
            });
            
            return links;
          }, atsSite);

          // Add new links to set
          let newLinksCount = 0;
          pageLinks.forEach(link => {
            if (!atsLinks.has(link)) {
              atsLinks.add(link);
              newLinksCount++;
            }
          });

          console.log(`      Page ${pageNumber}: Found ${pageLinks.length} links (${newLinksCount} new, total: ${atsLinks.size})`);

          // Check if there's a "Next" button
          const nextButton = await page.$('a#pnnext');
          
          if (!nextButton) {
            console.log(`      ✓ No more pages for "${jobTerm}"\n`);
            break;
          }

          // Click next and wait
          pageNumber++;
          
          // Random delay before clicking to simulate human behavior
          await randomDelay(1000, 2500);
          
          await Promise.all([
            nextButton.click(),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 })
          ]);

          // Longer delay between pages to avoid rate limiting
          await randomDelay(DELAY_BETWEEN_PAGES, DELAY_BETWEEN_PAGES + RANDOM_DELAY_MAX);
        }

      } catch (error) {
        console.error(`      ❌ Error scraping "${jobTerm}":`, error);
      }
      
      // Longer random delay between different job term searches
      if (termIndex < JOB_TERMS.length - 1) {
        await randomDelay(DELAY_BETWEEN_SEARCHES, DELAY_BETWEEN_SEARCHES + RANDOM_DELAY_MAX);
      }
    }
    
    // Store results for this ATS
    allResultsByAts[atsSite] = atsLinks;
    
    // Save individual ATS file
    const atsFileName = `${atsSite.replace(/\./g, '_')}.txt`;
    const atsFilePath = path.join(outputDir, atsFileName);
    const linksArray = Array.from(atsLinks).sort();
    fs.writeFileSync(atsFilePath, linksArray.join('\n'), 'utf-8');
    console.log(`\n   💾 ${atsSite}: Saved ${atsLinks.size} total unique links to ${atsFileName}\n`);
  
    // Longer delay between different ATS searches
    if (atsIndex < ATS_SITES.length - 1) {
      const delayTime = DELAY_BETWEEN_SEARCHES * 2;
      console.log(`   ⏳ Waiting ${delayTime/1000}s before next ATS...\n`);
      await randomDelay(delayTime, delayTime + RANDOM_DELAY_MAX);
    }
  }

  await browser.close();

  // Save combined results
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 FINAL SUMMARY');
  console.log(`${'='.repeat(80)}\n`);
  
  const allCombinedLinks = new Set<string>();
  let totalLinks = 0;
  
  ATS_SITES.forEach(site => {
    const count = allResultsByAts[site]?.size || 0;
    totalLinks += count;
    console.log(`   ${site.padEnd(30)} ${count.toString().padStart(5)} jobs`);
    allResultsByAts[site]?.forEach(link => allCombinedLinks.add(link));
  });
  
  console.log(`\n   ${'Total Unique Jobs'.padEnd(30)} ${allCombinedLinks.size.toString().padStart(5)}`);
  console.log(`   ${'Total Links (with duplicates)'.padEnd(30)} ${totalLinks.toString().padStart(5)}`);
  
  // Save all combined links
  const combinedFilePath = path.join(outputDir, '_all_jobs_combined.txt');
  const allLinksArray = Array.from(allCombinedLinks).sort();
  fs.writeFileSync(combinedFilePath, allLinksArray.join('\n'), 'utf-8');
  
  console.log(`\n✅ Complete! All results saved to: ${outputDir}`);
  console.log(`   - Individual ATS files: ${ATS_SITES.length} files`);
  console.log(`   - Combined file: _all_jobs_combined.txt`);
  console.log(`${'='.repeat(80)}\n`);
}

// Run the scraper
scrapeGoogleResults().catch(console.error);
