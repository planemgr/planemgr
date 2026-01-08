import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { createPool } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "..", "migrations");

const runMigrations = async () => {
  const pool = createPool(config.databaseUrl);
  const client = await pool.connect();

  try {
    await client.query(
      "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );

    const applied = await client.query("select name from schema_migrations");
    const appliedSet = new Set(applied.rows.map((row: { name: string }) => row.name));

    const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into schema_migrations (name) values ($1)", [file]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations().catch((error) => {
  console.error("Migration failed", error);
  process.exit(1);
});
