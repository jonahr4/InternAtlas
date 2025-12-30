import { prisma } from "../src/lib/prisma";
import * as fs from "fs";
import * as path from "path";

async function exportCompaniesToCSV() {
  try {
    console.log("Fetching companies from database...");
    
    const companies = await prisma.company.findMany({
      orderBy: { name: "asc" },
    });

    console.log(`Found ${companies.length} companies`);

    // Create CSV content
    const headers = ["id", "name", "platform", "boardUrl", "createdAt", "updatedAt"];
    const rows = companies.map(company => [
      company.id,
      company.name,
      company.platform,
      company.boardUrl,
      company.createdAt.toISOString(),
      company.updatedAt.toISOString(),
    ]);

    // Escape CSV fields (handle commas and quotes)
    const escapeCsvField = (field: string) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(escapeCsvField).join(",")),
    ].join("\n");

    // Write to backup directory
    const backupDir = path.join(process.cwd(), "data", "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const csvPath = path.join(backupDir, "companies.csv");
    fs.writeFileSync(csvPath, csvContent, "utf-8");

    console.log(`✓ Exported ${companies.length} companies to ${csvPath}`);
    
    // Also create a timestamped backup
    const timestamp = new Date().toISOString().split("T")[0];
    const timestampedPath = path.join(backupDir, `companies-${timestamp}.csv`);
    fs.writeFileSync(timestampedPath, csvContent, "utf-8");
    console.log(`✓ Created timestamped backup: ${timestampedPath}`);

  } catch (error) {
    console.error("Error exporting companies:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

exportCompaniesToCSV();
