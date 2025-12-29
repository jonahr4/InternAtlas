import { prisma } from "../src/lib/prisma";

type GreenhouseJob = {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  created_at: string;
  updated_at: string;
  content?: string;
};

type LeverJob = {
  id: string;
  text: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  description?: string;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
  };
};

type Company = {
  id: string;
  name: string;
  platform: "GREENHOUSE" | "LEVER" | "WORKDAY" | "CUSTOM";
  boardUrl: string;
};

type NormalizedJob = {
  companyName: string;
  externalId: string;
  title: string;
  location: string | null;
  postedAt: string | null;
  jobUrl: string;
  descriptionText?: string | null;
};

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
    externalId: String(job.id),
    title: job.title,
    location: job.location?.name ?? null,
    postedAt: job.created_at ?? null,
    jobUrl: job.absolute_url,
    descriptionText: job.content ?? null,
  };
}

function getLeverSlug(boardUrl: string): string {
  const url = new URL(boardUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Invalid Lever board URL: ${boardUrl}`);
  }
  return parts[0];
}

async function fetchLeverJobs(boardUrl: string): Promise<LeverJob[]> {
  const slug = getLeverSlug(boardUrl);
  const apiUrl = `https://api.lever.co/v0/postings/${slug}?mode=json`;
  const res = await fetch(apiUrl);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${apiUrl}: ${res.status}`);
  }

  const data = (await res.json()) as LeverJob[];
  return data ?? [];
}

function normalizeLeverJob(companyName: string, job: LeverJob): NormalizedJob {
  const postedAt =
    typeof job.createdAt === "number"
      ? new Date(job.createdAt).toISOString()
      : null;
  return {
    companyName,
    externalId: job.id,
    title: job.text,
    location: job.categories?.location ?? null,
    postedAt,
    jobUrl: job.hostedUrl ?? job.applyUrl ?? "",
    descriptionText: job.description ?? null,
  };
}

function getSupportedCompanies(companies: Company[]): Company[] {
  return companies.filter(
    (company) => company.platform === "GREENHOUSE" || company.platform === "LEVER"
  );
}

async function main() {
  const startedAt = Date.now();
  const keywordArg = process.argv.find((arg) => arg.startsWith("--keyword="));
  const keyword = keywordArg
    ? keywordArg.replace("--keyword=", "").trim().toLowerCase()
    : "";
  const companies = (await prisma.company.findMany({
    select: { id: true, name: true, platform: true, boardUrl: true },
  })) as Company[];
  const supportedCompanies = getSupportedCompanies(companies);

  if (supportedCompanies.length === 0) {
    console.log("No Greenhouse or Lever companies found.");
    return;
  }

  let totalJobs = 0;
  let totalCreated = 0;
  let totalCreatedFromExistingCompanies = 0;
  let totalCreatedFromNewCompanies = 0;
  let totalNewCompanies = 0;
  let totalExistingCompanies = 0;
  let totalWorking = 0;
  let totalBroken = 0;
  const jobsFoundByPlatform = new Map<string, number>();
  const jobsCreatedByPlatform = new Map<string, number>();
  const companiesByPlatform = new Map<string, number>();
  const nameColumnWidth = Math.max(
    12,
    ...supportedCompanies.map((company) => company.name.length + 2)
  );
  const atsColumnWidth = Math.max(
    5,
    ...supportedCompanies.map((company) => company.platform.length + 2)
  );

  console.log(
    `${"Company".padEnd(nameColumnWidth)}ATS${" ".repeat(
      Math.max(1, atsColumnWidth - 3)
    )}Status  \t\tTotal Jobs  \t\tNew Jobs`
  );

  for (const company of supportedCompanies) {
    try {
      let normalized: NormalizedJob[] = [];
      if (company.platform === "GREENHOUSE") {
        const jobs = await fetchGreenhouseJobs(company.boardUrl);
        normalized = jobs.map((job) => normalizeGreenhouseJob(company.name, job));
      } else if (company.platform === "LEVER") {
        const jobs = await fetchLeverJobs(company.boardUrl);
        normalized = jobs
          .map((job) => normalizeLeverJob(company.name, job))
          .filter((job) => job.jobUrl);
      } else {
        console.log(`${company.name}: unsupported ATS (${company.platform})`);
        continue;
      }

      if (keyword) {
        normalized = normalized.filter((job) => {
          const haystack = `${job.title} ${job.descriptionText ?? ""}`.toLowerCase();
          return haystack.includes(keyword);
        });
      }

      const existingJobs = await prisma.job.findMany({
        where: { companyId: company.id, sourcePlatform: company.platform },
        select: { externalId: true },
      });
      const existingIds = new Set(
        existingJobs
          .map((job) => job.externalId)
          .filter((id): id is string => Boolean(id))
      );
      const isNewCompany = existingIds.size === 0;
      let newJobsForCompany = 0;

      for (const job of normalized) {
        if (existingIds.has(job.externalId)) {
          continue;
        }

        await prisma.job.create({
          data: {
            companyId: company.id,
            title: job.title,
            location: job.location,
            postedAt: job.postedAt ? new Date(job.postedAt) : null,
            jobUrl: job.jobUrl,
            applyUrl: job.jobUrl,
            descriptionText: job.descriptionText,
            sourcePlatform: company.platform,
            externalId: job.externalId,
            status: "ACTIVE",
          },
        });

        existingIds.add(job.externalId);
        newJobsForCompany += 1;
        totalCreated += 1;
        jobsCreatedByPlatform.set(
          company.platform,
          (jobsCreatedByPlatform.get(company.platform) ?? 0) + 1
        );
      }

      totalJobs += normalized.length;
      jobsFoundByPlatform.set(
        company.platform,
        (jobsFoundByPlatform.get(company.platform) ?? 0) + normalized.length
      );
      totalWorking += 1;

      if (newJobsForCompany > 0) {
        if (isNewCompany) {
          totalCreatedFromNewCompanies += newJobsForCompany;
        } else {
          totalCreatedFromExistingCompanies += newJobsForCompany;
        }
      }

      const status = isNewCompany ? "NEW" : "OLD";
      if (isNewCompany) {
        totalNewCompanies += 1;
      } else {
        totalExistingCompanies += 1;
      }
      companiesByPlatform.set(
        company.platform,
        (companiesByPlatform.get(company.platform) ?? 0) + 1
      );
      const totalLabel = `\t${normalized.length}\tTotal Jobs`;
      const newLabel = `\t${newJobsForCompany}\tNew Jobs`;
      console.log(
        `${company.name.padEnd(nameColumnWidth)}${company.platform.padEnd(
          atsColumnWidth
        )}${status.padEnd(7)}${totalLabel.padEnd(14)}${newLabel}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      totalBroken += 1;
      console.error(`${company.name}: error - ${message}`);
    }
  }

  const durationMs = Date.now() - startedAt;
  const avgMsPerJob = totalJobs > 0 ? Math.round(durationMs / totalJobs) : 0;

  console.log("");
  console.log("Crawl summary");
  console.log(
    "+------------------------------+---------------------------+"
  );
  console.log(
    `| Total companies found        | ${String(
      supportedCompanies.length
    ).padEnd(25)}|`
  );
  console.log(
    `| New companies                | ${String(totalNewCompanies).padEnd(25)}|`
  );
  console.log(
    `| Existing companies           | ${String(
      totalExistingCompanies
    ).padEnd(25)}|`
  );
  console.log(
    "+------------------------------+---------------------------+"
  );
  console.log(
    `| Total jobs found             | ${String(totalJobs).padEnd(25)}|`
  );
  console.log(
    `| Total jobs created           | ${String(totalCreated).padEnd(25)}|`
  );
  console.log(
    `| New jobs from existing co.   | ${String(
      totalCreatedFromExistingCompanies
    ).padEnd(25)}|`
  );
  console.log(
    `| New jobs from new co.        | ${String(
      totalCreatedFromNewCompanies
    ).padEnd(25)}|`
  );
  console.log(
    "+------------------------------+---------------------------+"
  );
  console.log(
    `| Total working links          | ${String(totalWorking).padEnd(25)}|`
  );
  console.log(
    `| Total broken links           | ${String(totalBroken).padEnd(25)}|`
  );
  console.log(
    `| Time taken                   | ${`${(durationMs / 1000).toFixed(
      2
    )}s`.padEnd(25)}|`
  );
  console.log(
    `| Estimated time per job       | ${`${avgMsPerJob}ms${
      totalJobs === 0 ? " (n/a)" : ""
    }`.padEnd(25)}|`
  );
  console.log(
    "+------------------------------+---------------------------+"
  );

  if (jobsFoundByPlatform.size > 0) {
    console.log("Jobs by ATS");
    console.log("+------------------------------+---------------------------+");
    const platforms = Array.from(jobsFoundByPlatform.keys()).sort();
    for (const platform of platforms) {
      const found = jobsFoundByPlatform.get(platform) ?? 0;
      const created = jobsCreatedByPlatform.get(platform) ?? 0;
      const companies = companiesByPlatform.get(platform) ?? 0;
      const label = `${platform} (found/created/companies)`;
      console.log(
        `| ${label.padEnd(29)}| ${`${found}/${created}/${companies}`.padEnd(
          25
        )}|`
      );
    }
    console.log("+------------------------------+---------------------------+");
  }

}

main()
  .catch((error) => {
    console.error(`Crawler failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
