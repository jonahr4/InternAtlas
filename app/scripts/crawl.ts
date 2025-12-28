import fs from "node:fs/promises";
import path from "node:path";

type Company = {
  name: string;
  platform: "GREENHOUSE" | "LEVER" | "WORKDAY" | "CUSTOM";
  boardUrl: string;
};

type GreenhouseJob = {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  created_at: string;
  updated_at: string;
  content?: string;
};

type NormalizedJob = {
  companyName: string;
  title: string;
  location: string | null;
  postedAt: string | null;
  jobUrl: string;
  descriptionText?: string | null;
};

const COMPANIES_PATH = path.join(process.cwd(), "data", "companies.json");

function getGreenhouseSlug(boardUrl: string): string {
  const url = new URL(boardUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Invalid Greenhouse board URL: ${boardUrl}`);
  }
  return parts[0];
}

async function fetchGreenhouseJobs(boardUrl: string): Promise<GreenhouseJob[]> {
  const slug = getGreenhouseSlug(boardUrl);
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const res = await fetch(apiUrl);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${apiUrl}: ${res.status}`);
  }

  const data = (await res.json()) as { jobs: GreenhouseJob[] };
  return data.jobs ?? [];
}

function normalizeGreenhouseJob(
  companyName: string,
  job: GreenhouseJob
): NormalizedJob {
  return {
    companyName,
    title: job.title,
    location: job.location?.name ?? null,
    postedAt: job.created_at ?? null,
    jobUrl: job.absolute_url,
    descriptionText: job.content ?? null,
  };
}

async function main() {
  const raw = await fs.readFile(COMPANIES_PATH, "utf-8");
  const companies = JSON.parse(raw) as Company[];
  const greenhouseCompanies = companies.filter(
    (company) => company.platform === "GREENHOUSE"
  );

  if (greenhouseCompanies.length === 0) {
    console.log("No Greenhouse companies found.");
    return;
  }

  for (const company of greenhouseCompanies) {
    try {
      const jobs = await fetchGreenhouseJobs(company.boardUrl);
      const normalized = jobs.map((job) =>
        normalizeGreenhouseJob(company.name, job)
      );

      console.log(
        `${company.name}: ${normalized.length} jobs (sample: ${
          normalized[0]?.title ?? "none"
        })`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${company.name}: error - ${message}`);
    }
  }
}

main();
