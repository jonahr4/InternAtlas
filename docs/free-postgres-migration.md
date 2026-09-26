# Migrate InternAtlas Postgres to a free host

**Goal:** move the production database off DigitalOcean's managed Postgres
($15/mo now that student credits expired) to a **$0/mo** self-hosted Postgres,
with zero code changes to the app.

**Status:** plan + supporting files. The actual data move and secret swaps are
manual steps below (they need Jonah's Oracle / DigitalOcean / Vercel access).

## Decision

**Target: Oracle Cloud "Always Free" VM running Postgres 16 in Docker.**

Why this one:

- Free tier is permanent (no expiry, no trial cliff) and includes a VM with
  **2 OCPUs / 12 GB RAM** plus **200 GB of block storage** — far more than this
  database needs. (Oracle cut the ARM allowance from 4 OCPU / 24 GB to
  2 / 12 in August 2026; 2 / 12 is still plenty for a few-GB Postgres.)
- Postgres 16 in Docker = same major version as DigitalOcean's managed
  cluster, so `pg_dump` / `pg_restore` just works. No extensions in our
  schema, nothing exotic to port.
- The app only needs `DATABASE_URL` pointed at the new host. No code changes.

Why not the other free options:

- **Neon free tier (512 MB)** / **Supabase free (500 MB)** — the database is
  several GB (300k+ jobs with full descriptions + raw JSON payloads + ~20
  indexes). It physically does not fit.
- **Neon paid ($19/mo for 10 GB)** — costs *more* than DigitalOcean's $15/mo.
  Wrong direction.
- **Hetzner VPS (~$5–6/mo)** — cheapest paid option, but not free.
- **Vercel Postgres via the Neon integration** — the Pro plan's bundled
  allowance is only 256 MB; paid tiers bill through Neon (see above).

## Architecture after migration

```
Vercel (Next.js app) ──DATABASE_URL──▶ Oracle VM (Ubuntu 24.04, Docker)
                                           └─ Postgres 16 (port 5432)
GitHub Actions crawlers ──secrets──▶ same VM (every 12h)
```

The workflows in `.github/workflows/` already read `DATABASE_URL` from the repo
secret, so cutover is a secret swap, no code deploy.
Their DigitalOcean port handling (`${DATABASE_URL//25061/25060}`) is already
a safe no-op for any non-DigitalOcean URL — a self-hosted
`postgresql://…:5432/…` string contains no `25061`, so it passes through
untouched and no workflow changes are needed.

## Runbook

### 0. Measure the database

In the DigitalOcean control panel (or `psql`):

```sql
SELECT pg_size_pretty(pg_database_size(current_database()));
SELECT count(*) FROM "Job";
```

Sanity check that the numbers below still hold (a few GB, well under 200 GB).

### 1. Create the Oracle Cloud account

1. Sign up at <https://www.oracle.com/cloud/free/> (Always Free, not the
   30-day trial).
2. You need a **real credit/debit card** — Oracle rejects prepaid and most
   virtual cards — plus phone verification. You are not charged for
   Always Free resources.
3. Pick your **home region** carefully; it can't be changed later. Choose one
   near the Vercel deployment region — `us-ashburn-1` for US East is the
   usual pick.

> Capacity caveat: Ampere A1 capacity in popular regions sometimes shows
> "out of capacity". If so, retry off-peak or try a neighboring region.

### 2. Create the VM

Compute → Instances → Create instance:

- Image: **Ubuntu 24.04**, shape `VM.Standard.A1.Flex`
- **2 OCPU, 12 GB RAM** (the current Always Free max for ARM)
- Networking: attach a public IPv4 (default VCN is fine)
- Add your SSH public key, note the **public IP**

Open the firewall:

1. VCN → Security Lists → add ingress rules for TCP **22** (SSH) and **5432**
   (Postgres) from `0.0.0.0/0`.
2. Ubuntu images also ship restrictive `iptables` rules — allow the ports
   there too or Postgres stays unreachable:
   ```bash
   sudo iptables -I INPUT -p tcp --dport 5432 -j ACCEPT
   sudo iptables -I INPUT -p tcp --dport 22 -j ACCEPT
   sudo netfilter-persistent save
   ```

### 3. Start Postgres on the VM

```bash
# on the VM
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
mkdir -p ~/internatlas && cd ~/internatlas
# copy infra/docker-compose.yml, infra/.env (from infra/.env.example),
# infra/backup.sh, infra/restore.sh from this repo
cp /path/to/repo/infra/* .
# edit .env: set a long random POSTGRES_PASSWORD
docker compose up -d
docker exec internatlas-postgres pg_isready -U internatlas
```

### 4. Dump from DigitalOcean, restore to the VM

From any machine with `psql`/`pg_dump`. Use the **direct** connection, not the
pooled one: take the `DATABASE_URL` repo-secret value and change port `25061`
to `25060` (`pg_dump` needs a session-level connection, which the pooler port
doesn't provide):

```bash
DIRECT_URL="$(echo "$DATABASE_URL" | sed 's/25061/25060/')"
pg_dump "$DIRECT_URL" -Fc -f internatlas-$(date +%F).dump
```

Copy the dump to the VM and restore:

```bash
# on the VM, in ~/internatlas
./restore.sh /path/to/internatlas-2026-09-26.dump
```

Verify row counts match the source:

```sql
SELECT (SELECT count(*) FROM "Company") AS companies,
       (SELECT count(*) FROM "Job") AS jobs;
```

Also confirm Prisma is happy with the schema (from the repo):

```bash
cd app && DATABASE_URL="postgresql://internatlas:<pw>@<vm-ip>:5432/internatlas" \
  npx prisma migrate deploy
```

It should report "no pending migrations".

### 5. Swap the secrets

| Where | Secret | New value |
|---|---|---|
| Vercel (production env) | `DATABASE_URL` | `postgresql://internatlas:<pw>@<vm-ip>:5432/internatlas` (see notes) |
| GitHub repo secrets | `DATABASE_URL` | same as above |

Notes:

- There is only one secret to swap. Self-hosted Postgres has no pooler port,
  so the same direct URL is used everywhere; the workflows' existing
  `${DATABASE_URL//25061/25060}` substitution is a no-op for this URL and
  passes it through untouched.
- The app's Prisma client opens a connection pool per serverless function;
  with `max_connections=100` and Vercel's low traffic this is fine. If you
  ever see `too many clients`, add PgBouncer in front (out of scope here).
- Prefer `sslmode=require` on the connection string. The compose setup uses
  Postgres's default self-signed… actually plain TCP; for a job board with no
  user PII in Postgres (auth lives in Firebase), password auth over the open
  internet is acceptable, TLS termination via a proxy is a future hardening
  step.

### 6. Verify before deleting anything

1. Open the Vercel site — listings and search should load from the new DB.
2. In GitHub Actions, manually run one crawl workflow
   (Actions → e.g. "Crawl Jobs" → Run workflow) and confirm new rows land.
3. Let **one scheduled crawl cycle (12h)** pass and re-check.

### 7. Delete the DigitalOcean cluster

Database → `db-postgresql-nyc3-70588` → Destroy. Hourly billing stops
immediately. September usage still bills ~Oct 1 (already accrued); October
accrues nothing.

**Rollback:** keep the DO cluster until step 6 passes, and keep the
`internatlas-<date>.dump` file somewhere safe (it also doubles as your
off-site backup).

## Ongoing ops

- **Backups:** add a cron on the VM — `./backup.sh` keeps the last 14 daily
  dumps in `infra/backups/`. Monthly, copy one dump off the VM.
- **Oracle idle reclamation:** Oracle has historically reclaimed Always Free
  instances that sit idle for long stretches. The twice-daily crawlers keep
  this box active, but check Oracle's current policy wording before treating
  this as settled.
- **Cost:** $0/mo as long as usage stays within Always Free limits
  (2 OCPU / 12 GB / 200 GB storage — this workload is nowhere near them).

## Files in this PR

- `docs/free-postgres-migration.md` — this runbook
- `infra/docker-compose.yml` — Postgres 16 service for the VM
- `infra/.env.example` — template for DB credentials (never commit real ones)
- `infra/backup.sh` — timestamped `pg_dump`, 14-day retention
- `infra/restore.sh` — restore a dump (with confirmation prompt)

No workflow or app code changes are needed: the existing
`${DATABASE_URL//25061/25060}` substitution in the crawl/migration workflows
is a no-op for non-DigitalOcean URLs, so they work unchanged against the new
host once the secret is swapped.
