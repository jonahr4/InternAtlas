// Quick test of Workday API

async function test() {
  const boardUrl = "https://capitalone.wd12.myworkdayjobs.com/Capital_One";
  const origin = "https://capitalone.wd12.myworkdayjobs.com";
  const tenant = "capitalone";
  const site = "Capital_One";

  const apiUrl = `${origin}/wday/cxs/${tenant}/${site}/jobs`;

  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: boardUrl,
    Origin: origin,
    "X-Requested-With": "XMLHttpRequest",
    "Content-Type": "application/json; charset=utf-8",
  };

  const body = JSON.stringify({
    offset: 0,
    limit: 10,
    searchText: "",
    appliedFacets: {},
  });

  console.log(`Testing: ${apiUrl}`);
  console.log(`Headers:`, headers);
  console.log(`Body:`, body);

  const res = await fetch(apiUrl, {
    method: "POST",
    headers,
    body,
  });

  console.log(`Status: ${res.status}`);
  console.log(`OK: ${res.ok}`);

  if (res.ok) {
    const data = await res.json();
    console.log(`Total jobs: ${data.total}`);
    console.log(`Jobs returned: ${data.jobPostings?.length ?? 0}`);
  } else {
    const text = await res.text();
    console.log(`Error: ${text}`);
  }
}

test().catch(console.error);
