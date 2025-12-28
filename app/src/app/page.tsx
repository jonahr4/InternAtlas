type Job = {
  id: string;
  title: string;
  location: string | null;
  postedAt: string | null;
  jobUrl: string;
  company: {
    name: string;
  };
};

async function getJobs(): Promise<Job[]> {
  const res = await fetch("http://localhost:3000/api/jobs", {
    cache: "no-store",
  });

  if (!res.ok) {
    return [];
  }

  return res.json();
}

export default async function Home() {
  const jobs = await getJobs();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold text-zinc-900">
        InternAtlas
      </h1>
      <p className="text-lg text-zinc-600">Minimal job board (Phase 1).</p>
      {jobs.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-200 bg-zinc-50 p-6 text-zinc-600">
          No jobs yet. Run the crawler in Phase 2 to populate the database.
        </div>
      ) : (
        <ul className="space-y-4">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="rounded border border-zinc-200 bg-white p-4"
            >
              <div className="text-sm text-zinc-500">{job.company.name}</div>
              <div className="text-lg font-medium text-zinc-900">
                {job.title}
              </div>
              <div className="text-sm text-zinc-600">
                {job.location ?? "Location unknown"}
              </div>
              <a
                className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline"
                href={job.jobUrl}
                target="_blank"
                rel="noreferrer"
              >
                View posting
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
