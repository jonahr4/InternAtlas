# Companies Backup

This directory contains CSV backups of the companies database.

## Files

- **companies.csv** - Main backup file, automatically updated after each crawl
- **companies-YYYY-MM-DD.csv** - Timestamped backups (git-ignored, local only)

## Usage

The `companies.csv` file is automatically updated after every crawl run. This serves as a:
- Backup of company data stored in GitHub
- Recovery mechanism if database is lost
- Version-controlled history of company additions

To manually export:
```bash
npm run companies:export
```

To restore companies from CSV (if needed in the future):
```bash
# Create a restore script when needed
npm run companies:restore
```

## File Size

The CSV file is approximately 106KB for ~778 companies, making it safe to commit to GitHub.
