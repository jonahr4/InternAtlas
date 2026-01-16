// Test Taleo API to see what data we can extract for job listings
// Run with: npx tsx scripts/test-taleo.ts

const TEST_BOARDS = [
  { subdomain: "aa270", section: "in", name: "AA270", knownPortalId: "201430233" }, // User found this portal ID
  { subdomain: "stanford", section: "2", name: "Stanford", knownPortalId: "" },
  { subdomain: "lbl", section: "2", name: "Lawrence Berkeley Lab", knownPortalId: "" },
  { subdomain: "axp", section: "2", name: "American Express", knownPortalId: "" },
];

interface TaleoJob {
  [key: string]: unknown;
}

async function testTaleoBoard(subdomain: string, section: string, name: string, knownPortalId?: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`Testing: ${name} (${subdomain}.taleo.net/careersection/${section})`);
  if (knownPortalId) {
    console.log(`Known portal ID: ${knownPortalId}`);
  }
  console.log("=".repeat(80));

  const baseUrl = `https://${subdomain}.taleo.net`;
  const boardUrl = `${baseUrl}/careersection/${section}/jobsearch.ftl`;

  // Taleo uses various API endpoints - let's try the common ones
  const apiEndpoints = [
    // JSON API for job list
    `${baseUrl}/careersection/${section}/mSearchGetJobList.json`,
    // Alternative API endpoint
    `${baseUrl}/careersection/rest/jobboard/searchjobs`,
    // Another common pattern
    `${baseUrl}/careersection/${section}/joblist.ftl?lang=en`,
  ];

  const headers: Record<string, string> = {
    Accept: "application/json, text/html, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: boardUrl,
    Origin: baseUrl,
  };

  // Track cookies from responses
  let cookies = "";

  console.log("\n--- Board URL ---");
  console.log(boardUrl);

  // First, let's try to fetch the job search page to extract portal ID and other config
  console.log("\n--- Fetching job search page ---");
  let portalId = knownPortalId || "";
  try {
    const pageRes = await fetch(boardUrl, { headers });
    console.log(`Status: ${pageRes.status}`);
    console.log(`Content-Type: ${pageRes.headers.get("content-type")}`);

    // Capture cookies for subsequent requests
    const setCookies = pageRes.headers.getSetCookie?.() || [];
    if (setCookies.length > 0) {
      cookies = setCookies.map((c) => c.split(";")[0]).join("; ");
      console.log(`Captured cookies: ${cookies.slice(0, 100)}...`);
    }

    if (pageRes.ok) {
      const html = await pageRes.text();
      console.log(`HTML length: ${html.length} characters`);

      // Look for portal ID in HTML (critical for API access)
      const portalMatch = html.match(/portal[=:]\s*["']?(\d+)["']?/i);
      if (portalMatch) {
        portalId = portalMatch[1];
        console.log(`Found portal ID: ${portalId}`);
      }

      // Look for ftlContext or other config objects
      const ftlContextMatch = html.match(/var\s+ftlContext\s*=\s*(\{[\s\S]*?\});/);
      if (ftlContextMatch) {
        console.log("\n--- Found ftlContext ---");
        console.log(ftlContextMatch[1].slice(0, 1000));
      }

      // Look for careerSectionId
      const csIdMatch = html.match(/careerSectionId[=:]\s*["']?(\d+)["']?/i);
      if (csIdMatch) {
        console.log(`Found careerSectionId: ${csIdMatch[1]}`);
      }

      // Look for JSON data embedded in the page
      const jsonMatch = html.match(/var\s+requisitionListInterface\s*=\s*(\{[\s\S]*?\});/);
      if (jsonMatch) {
        console.log("\n--- Found embedded JSON data (requisitionListInterface) ---");
        try {
          const data = JSON.parse(jsonMatch[1]);
          console.log(JSON.stringify(data, null, 2).slice(0, 2000));
        } catch (e) {
          console.log("Failed to parse embedded JSON");
        }
      }

      // Look for job listings in HTML
      const jobCountMatch = html.match(/(\d+)\s*(?:jobs?|positions?|results?)\s*(?:found|available)/i);
      if (jobCountMatch) {
        console.log(`Found job count in page: ${jobCountMatch[1]}`);
      }

      // Look for all portal/config related variables
      const configMatches = html.matchAll(/var\s+(\w*(?:portal|config|context|section)\w*)\s*=\s*([^;]+);/gi);
      for (const match of configMatches) {
        console.log(`Found config var ${match[1]}: ${match[2].slice(0, 200)}`);
      }
    }
  } catch (err) {
    console.log(`Error fetching page: ${err}`);
  }

  // Add portal-based endpoint if we found a portal ID
  if (portalId) {
    apiEndpoints.unshift(`${baseUrl}/careersection/rest/jobboard/searchjobs?lang=en&portal=${portalId}`);
  }

  // Try the JSON API endpoints
  for (const apiUrl of apiEndpoints) {
    console.log(`\n--- Testing API: ${apiUrl} ---`);

    const apiHeaders = { ...headers };
    if (cookies) {
      apiHeaders.Cookie = cookies;
    }

    try {
      // Try GET first
      const getRes = await fetch(apiUrl, { headers: apiHeaders });
      console.log(`GET Status: ${getRes.status}`);

      if (getRes.ok) {
        const contentType = getRes.headers.get("content-type") || "";
        console.log(`Content-Type: ${contentType}`);

        if (contentType.includes("json")) {
          const data = await getRes.json();
          console.log("\n--- JSON Response ---");
          console.log(JSON.stringify(data, null, 2).slice(0, 3000));

          // Analyze structure
          if (data) {
            console.log("\n--- Response Structure ---");
            console.log("Top-level keys:", Object.keys(data));
            if (Array.isArray(data)) {
              console.log(`Array with ${data.length} items`);
              if (data[0]) {
                console.log("First item keys:", Object.keys(data[0]));
              }
            }
          }
        } else {
          const text = await getRes.text();
          console.log(`Response (first 1000 chars): ${text.slice(0, 1000)}`);
        }
      }

      // Try POST with search params (different formats Taleo uses)
      const postBodies = [
        // Format 1: Standard search
        {
          multilineEnabled: false,
          sortingSelection: { sortBySelectionParam: "2", ascendingSortingOrder: "false" },
          fieldData: { fields: { KEYWORD: "", LOCATION: "" }, valid: true },
          filterSelectionParam: { searchFilterSelections: [] },
          pageNo: 1,
        },
        // Format 2: Simple search
        {
          keyword: "",
          location: "",
          pageSize: 25,
          pageNumber: 1,
        },
        // Format 3: With lang and portal
        {
          lang: "en",
          portal: portalId || "1",
          pageNo: 1,
        },
      ];

      const postBody = JSON.stringify(postBodies[0]);

      const postRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          ...apiHeaders,
          "Content-Type": "application/json",
        },
        body: postBody,
      });

      console.log(`POST Status: ${postRes.status}`);

      if (postRes.ok) {
        const contentType = postRes.headers.get("content-type") || "";
        if (contentType.includes("json")) {
          const data = await postRes.json();
          console.log("\n--- POST JSON Response ---");
          console.log(JSON.stringify(data, null, 2).slice(0, 3000));
        }
      }
    } catch (err) {
      console.log(`Error: ${err}`);
    }
  }

  // Build headers with cookies for remaining requests
  const finalHeaders: Record<string, string> = { ...headers };
  if (cookies) {
    finalHeaders.Cookie = cookies;
  }

  // Try the Oracle REST API pattern (Taleo is owned by Oracle)
  const oracleApiUrl = `${baseUrl}/careersection/rest/jobboard/${section}/searchjobs?lang=en_US`;
  console.log(`\n--- Testing Oracle REST API: ${oracleApiUrl} ---`);
  try {
    const res = await fetch(oracleApiUrl, {
      method: "POST",
      headers: {
        ...finalHeaders,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        keywords: "",
        location: "",
        locationRadius: 0,
        offset: 0,
        limit: 20,
      }),
    });
    console.log(`Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(JSON.stringify(data, null, 2).slice(0, 3000));
    }
  } catch (err) {
    console.log(`Error: ${err}`);
  }

  // Try with portal parameter (from network inspection)
  if (portalId) {
    const portalApiUrl = `${baseUrl}/careersection/rest/jobboard/searchjobs?lang=en&portal=${portalId}`;
    console.log(`\n--- Testing with portal ID: ${portalApiUrl} ---`);
    try {
      const res = await fetch(portalApiUrl, {
        method: "POST",
        headers: {
          ...finalHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          multilineEnabled: false,
          sortingSelection: { sortBySelectionParam: "2", ascendingSortingOrder: "false" },
          fieldData: { fields: { KEYWORD: "", LOCATION: "" }, valid: true },
          filterSelectionParam: { searchFilterSelections: [] },
          pageNo: 1,
        }),
      });
      console.log(`Status: ${res.status}`);
      const contentType = res.headers.get("content-type") || "";
      console.log(`Content-Type: ${contentType}`);
      if (res.ok && contentType.includes("json")) {
        const data = await res.json();
        console.log("\n--- Portal API Response ---");
        console.log(JSON.stringify(data, null, 2).slice(0, 5000));

        // Check for jobs in response
        if (data.requisitionList) {
          console.log(`\nFound ${data.requisitionList.length} jobs!`);
          if (data.requisitionList[0]) {
            console.log("\n--- First job structure ---");
            console.log(JSON.stringify(data.requisitionList[0], null, 2));
          }
        }
      } else {
        const text = await res.text();
        console.log(`Response: ${text.slice(0, 1000)}`);
      }
    } catch (err) {
      console.log(`Error: ${err}`);
    }
  }
}

async function testJobDetailPage(subdomain: string, section: string, jobId: string) {
  console.log("\n" + "=".repeat(80));
  console.log(`Testing Job Detail: ${subdomain}.taleo.net - Job ${jobId}`);
  console.log("=".repeat(80));

  const baseUrl = `https://${subdomain}.taleo.net`;
  const jobUrl = `${baseUrl}/careersection/${section}/jobdetail.ftl?job=${jobId}`;

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

      // Extract job title
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        console.log(`Page title: ${titleMatch[1]}`);
      }

      // Look for job data in script tags
      const scriptDataMatch = html.match(/var\s+jobDetailsInterface\s*=\s*(\{[\s\S]*?\});/);
      if (scriptDataMatch) {
        console.log("\n--- Found embedded job data (jobDetailsInterface) ---");
        try {
          const data = JSON.parse(scriptDataMatch[1]);
          console.log(JSON.stringify(data, null, 2));
        } catch {
          console.log("Failed to parse embedded JSON");
          console.log(scriptDataMatch[1].slice(0, 1000));
        }
      }

      // Look for job description
      const descMatch = html.match(/class="[^"]*jobdescription[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (descMatch) {
        console.log("\n--- Job Description (first 500 chars) ---");
        console.log(descMatch[1].replace(/<[^>]+>/g, " ").slice(0, 500));
      }

      // Look for structured data
      const ldJsonMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
      if (ldJsonMatch) {
        console.log("\n--- Found JSON-LD structured data ---");
        try {
          const data = JSON.parse(ldJsonMatch[1]);
          console.log(JSON.stringify(data, null, 2));
        } catch {
          console.log("Failed to parse JSON-LD");
        }
      }
    }
  } catch (err) {
    console.log(`Error: ${err}`);
  }
}

async function main() {
  console.log("Taleo API Test - Detailed Logging");
  console.log("==================================\n");

  // Test a few boards
  for (const board of TEST_BOARDS.slice(0, 2)) {
    await testTaleoBoard(board.subdomain, board.section, board.name, board.knownPortalId);
  }

  // Test a specific job detail page (from the user's example)
  await testJobDetailPage("aa270", "in", "826632");

  console.log("\n\n" + "=".repeat(80));
  console.log("SUMMARY - Fields needed for Job table:");
  console.log("=".repeat(80));
  console.log(`
Required fields:
- title: string
- jobUrl: string
- companyId: string (from Company table)
- sourcePlatform: TALEO (need to add to enum)

Optional fields we want:
- location: string
- locationType: REMOTE | HYBRID | ONSITE | UNKNOWN
- employmentType: INTERN | NEW_GRAD | FULL_TIME | UNKNOWN
- postedAt: DateTime
- applyUrl: string
- descriptionText: string
- requirementsText: string
- externalId: string (job ID like "826632")
- rawPayload: JSON (full API response)
`);
}

main().catch(console.error);
