import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

function cleanDatabaseUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.searchParams.delete("channel_binding");
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: cleanDatabaseUrl(process.env.DATABASE_URL),
    ssl: { rejectUnauthorized: false },
  },
});
