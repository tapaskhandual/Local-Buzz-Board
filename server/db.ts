import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
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

const connectionString = cleanDatabaseUrl(process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_URL.includes("neon.tech") || process.env.DATABASE_URL.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

export const db = drizzle(pool, { schema });
