import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function buildPoolConfig(rawUrl: string): pg.PoolConfig {
  try {
    const url = new URL(rawUrl);
    url.searchParams.delete("channel_binding");
    return {
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: false },
    };
  } catch {
    return {
      connectionString: rawUrl,
      ssl: { rejectUnauthorized: false },
    };
  }
}

export const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL));
export const db = drizzle(pool, { schema });
