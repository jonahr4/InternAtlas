// Test Workable API to see what data we can extract for job listings
// Run with: npx tsx scripts/test-workable.ts

const TEST_COMPANIES = [
  { slug: "ae-perkins", name: "AE Perkins" }, // User found API working for this one
  { slug: "k1x", name: "K1X" },
  { slug: "iv-ai", name: "IV AI" },
  { slug: "trexquant", name: "TrexQuant" },
  { slug: "altom-transport", name: "Altom Transport" },
];

interface WorkableJob {
  id?: string;
  shortcode?: string;
  title?: string;
  department?: string;
  location?: {
    city?: string;
    country?: string;
    region?: string;
    workplace_type?: string;
  };
  shortlink?: string;
  application_url?: string;
  published_on?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface WorkableJobsResponse {
  jobs?: WorkableJob[];
  results?: WorkableJob[];
  total?: number;
  [key: string]: unknown;
}

async function testWorkableCompany(slug: string, name: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`Testing: ${name} (apply.workable.com/${slug})`);
  console.log("=".repeat(80));

  const baseUrl = `https://apply.workable.com/${slug}`;

  const headers = {
    Accept: "application/json, text/html, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: baseUrl,
    Origin: "https://apply.workable.com",
  };

  // Actual Workable API endpoints (found via network inspection)
  const apiEndpoints = [
    // Jobs list endpoint
    `https://apply.workable.com/api/v3/accounts/${slug}/jobs`,
    // Account info with full details
    `https://apply.workable.com/api/v1/accounts/${slug}?full=true`,
    // Advanced account endpoint
    `https://apply.workable.com/api/v1/advanced/accounts/${slug}`,
  ];

  console.log("\n--- Career Page URL ---");
  console.log(baseUrl);

  // First, fetch the main career page
  console.log("\n--- Fetching career page ---");
  try {
    const pageRes = await fetch(baseUrl, { headers });
    console.log(`Status: ${pageRes.status}`);
    console.log(`Content-Type: ${pageRes.headers.get("content-type")}`);

    if (pageRes.ok) {
      const html = await pageRes.text();
      console.log(`HTML length: ${html.length} characters`);

      // Look for Next.js data
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        console.log("\n--- Found __NEXT_DATA__ ---");
        try {
          const data = JSON.parse(nextDataMatch[1]);
          console.log("Top-level keys:", Object.keys(data));
          if (data.props?.pageProps) {
            console.log("pageProps keys:", Object.keys(data.props.pageProps));

            // Look for jobs in pageProps
            const pageProps = data.props.pageProps;
            if (pageProps.jobs) {
              console.log(`\nFound ${pageProps.jobs.length} jobs in pageProps.jobs`);
              if (pageProps.jobs[0]) {
                console.log("\n--- First job structure ---");
                console.log(JSON.stringify(pageProps.jobs[0], null, 2));
              }
            }
            if (pageProps.initialJobData) {
              console.log("\n--- initialJobData ---");
              console.log(JSON.stringify(pageProps.initialJobData, null, 2).slice(0, 2000));
            }
          }
        } catch (e) {
          console.log(`Failed to parse __NEXT_DATA__: ${e}`);
        }
      }

      // Look for window.__PRELOADED_STATE__ or similar
      const preloadedMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/);
      if (preloadedMatch) {
        console.log("\n--- Found __PRELOADED_STATE__ ---");
        try {
          const data = JSON.parse(preloadedMatch[1]);
          console.log(JSON.stringify(data, null, 2).slice(0, 2000));
        } catch {
          console.log("Failed to parse __PRELOADED_STATE__");
        }
      }

      // Look for JSON-LD structured data
      const ldJsonMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
      for (const match of ldJsonMatches) {
        console.log("\n--- Found JSON-LD ---");
        try {
          const data = JSON.parse(match[1]);
          console.log(JSON.stringify(data, null, 2).slice(0, 1500));
        } catch {
          console.log("Failed to parse JSON-LD");
        }
      }
    }
  } catch (err) {
    console.log(`Error fetching page: ${err}`);
  }

  // Try each API endpoint
  for (const apiUrl of apiEndpoints) {
    console.log(`\n--- Testing API: ${apiUrl} ---`);

    // Try GET first
    try {
      const res = await fetch(apiUrl, {
        headers: {
          ...headers,
          Accept: "application/json",
        },
      });
      console.log(`GET Status: ${res.status}`);

      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        console.log(`Content-Type: ${contentType}`);

        if (contentType.includes("json")) {
          const data = (await res.json()) as WorkableJobsResponse;
          console.log("\n--- JSON Response Structure ---");
          console.log("Top-level keys:", Object.keys(data));

          if (data.jobs && Array.isArray(data.jobs)) {
            console.log(`Found ${data.jobs.length} jobs`);
            if (data.jobs[0]) {
              console.log("\n--- First Job ---");
              console.log(JSON.stringify(data.jobs[0], null, 2));
            }
          } else if (data.results && Array.isArray(data.results)) {
            console.log(`Found ${data.results.length} results`);
            if (data.results[0]) {
              console.log("\n--- First Result ---");
              console.log(JSON.stringify(data.results[0], null, 2));
            }
          } else {
            console.log("\n--- Full Response (first 2000 chars) ---");
            console.log(JSON.stringify(data, null, 2).slice(0, 2000));
          }
        } else {
          const text = await res.text();
          console.log(`Response (first 500 chars): ${text.slice(0, 500)}`);
        }
      } else {
        const text = await res.text();
        console.log(`Error response: ${text.slice(0, 500)}`);
      }
    } catch (err) {
      console.log(`Error: ${err}`);
    }

    // Try POST (some Workable endpoints need POST)
    if (apiUrl.includes("/jobs")) {
      try {
        const postRes = await fetch(apiUrl, {
          method: "POST",
          headers: {
            ...headers,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: "",
            location: [],
            department: [],
            worktype: [],
            remote: [],
          }),
        });
        console.log(`POST Status: ${postRes.status}`);

        if (postRes.ok) {
          const data = await postRes.json();
          console.log("\n--- POST Response ---");
          console.log(JSON.stringify(data, null, 2).slice(0, 3000));
        }
      } catch (err) {
        console.log(`POST Error: ${err}`);
      }
    }
  }
}

async function testJobDetailPage(slug: string, jobId: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`Testing Job Detail: apply.workable.com/${slug}/j/${jobId}`);
  console.log("=".repeat(80));

  const jobUrl = `https://apply.workable.com/${slug}/j/${jobId}/`;

  const headers = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  console.log(`\n--- Fetching: ${jobUrl} ---`);

  try {
    const res = await fetch(jobUrl, { headers });
    console.log(`Status: ${res.status}`);

    if (res.ok) {
      const html = await res.text();
      console.log(`HTML length: ${html.length} characters`);

      // Extract page title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        console.log(`Page title: ${titleMatch[1]}`);
      }

      // Look for Next.js data with job details
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        console.log("\n--- Found __NEXT_DATA__ ---");
        try {
          const data = JSON.parse(nextDataMatch[1]);
          if (data.props?.pageProps) {
            const pageProps = data.props.pageProps;
            console.log("pageProps keys:", Object.keys(pageProps));

            // The job details are typically in pageProps
            if (pageProps.job) {
              console.log("\n--- Job Details ---");
              console.log(JSON.stringify(pageProps.job, null, 2));
            }
            if (pageProps.jobData) {
              console.log("\n--- jobData ---");
              console.log(JSON.stringify(pageProps.jobData, null, 2));
            }
          }
        } catch (e) {
          console.log(`Failed to parse: ${e}`);
        }
      }

      // Look for JSON-LD structured data (Google structured data for jobs)
      const ldJsonMatches = html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
      for (const match of ldJsonMatches) {
        console.log("\n--- Found JSON-LD structured data ---");
        try {
          const data = JSON.parse(match[1]);
          if (data["@type"] === "JobPosting") {
            console.log("This is a JobPosting schema!");
            console.log(JSON.stringify(data, null, 2));
          } else {
            console.log(JSON.stringify(data, null, 2).slice(0, 1000));
          }
        } catch {
          console.log("Failed to parse JSON-LD");
        }
      }
    }
  } catch (err) {
    console.log(`Error: ${err}`);
  }

  // Also try the API endpoint for single job
  const apiUrl = `https://apply.workable.com/api/v1/widget/accounts/${slug}/jobs/${jobId}`;
  console.log(`\n--- Testing single job API: ${apiUrl} ---`);
  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log("\n--- Single Job API Response ---");
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.log(`Error: ${err}`);
  }
}

async function main() {
  console.log("Workable API Test - Detailed Logging");
  console.log("=====================================\n");

  // Test a few companies
  for (const company of TEST_COMPANIES.slice(0, 2)) {
    await testWorkableCompany(company.slug, company.name);
  }

  // Test a specific job detail page (from user's example)
  await testJobDetailPage("k1x", "2B194B6B0E");

  console.log("\n\n" + "=".repeat(80));
  console.log("SUMMARY - Fields needed for Job table:");
  console.log("=".repeat(80));
  console.log(`
Required fields:
- title: string
- jobUrl: string
- companyId: string (from Company table)
- sourcePlatform: WORKABLE (need to add to enum)

Optional fields we want:
- location: string
- locationType: REMOTE | HYBRID | ONSITE | UNKNOWN (from workplace_type)
- employmentType: INTERN | NEW_GRAD | FULL_TIME | UNKNOWN
- postedAt: DateTime (from published_on or created_at)
- applyUrl: string (from application_url or shortlink)
- descriptionText: string
- requirementsText: string
- externalId: string (shortcode like "2B194B6B0E")
- rawPayload: JSON (full API response)

Workable workplace_type mapping:
- "remote" -> REMOTE
- "hybrid" -> HYBRID
- "on_site" -> ONSITE
`);
}

main().catch(console.error);
