import JobSearch from "@/app/components/JobSearch";

export default async function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[108rem] flex-col gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold text-zinc-900">
        InternAtlas
      </h1>
      <p className="text-lg text-zinc-600">
        Minimal job board (Phase 3 filters + search).
      </p>
      <a
        className="text-sm font-medium text-blue-600 hover:underline"
        href="/admin"
      >
        Go to admin import
      </a>
      <JobSearch />
    </main>
  );
}
