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

const sslNeeded =
  process.env.DATABASE_URL.includes("neon.tech") ||
  process.env.DATABASE_URL.includes("sslmode=require");

export const pool = new Pool({
  connectionString,
  ssl: sslNeeded ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool, { schema });

export async function runStartupMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
          CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin', 'owner');
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_category') THEN
          CREATE TYPE message_category AS ENUM ('general', 'alert', 'question', 'event', 'safety');
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reaction_type') THEN
          CREATE TYPE reaction_type AS ENUM ('like', 'helpful', 'funny', 'warning');
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
          CREATE TYPE report_reason AS ENUM ('spam', 'harassment', 'inappropriate', 'scam', 'other');
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
          CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'dismissed');
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mod_action') THEN
          CREATE TYPE mod_action AS ENUM ('hide', 'unhide', 'warn', 'ban', 'unban', 'role_change');
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mod_target') THEN
          CREATE TYPE mod_target AS ENUM ('message', 'user', 'business_post');
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_tier') THEN
          CREATE TYPE subscription_tier AS ENUM ('monthly', 'yearly', 'lifetime');
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
          CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled');
        END IF;
      END $$;

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_type') THEN
          CREATE TYPE subscription_type AS ENUM ('user', 'business');
        END IF;
      END $$;
    `);

    await client.query(`
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS parent_id VARCHAR;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS flag_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS hidden_by VARCHAR;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS hidden_reason TEXT;
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_tier subscription_tier;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'user';
    `);

    await client.query(`
      ALTER TABLE business_posts ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;
      ALTER TABLE business_posts ADD COLUMN IF NOT EXISTS hidden_by VARCHAR;
    `);

    console.log("Startup migrations completed successfully");
  } catch (err) {
    console.error("Startup migration error (non-fatal):", err);
  } finally {
    client.release();
  }
}
