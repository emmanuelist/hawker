// One pooled connection to Neon (D-014). prepare: false because Neon's pooler runs PgBouncer in
// transaction mode. Never touched by /api/health or the keep-warm loop (D-011, D-014).
import postgres from "postgres";

let client: postgres.Sql | null = null;

export function db(): postgres.Sql {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  client = postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 20,
    prepare: false,
    onnotice: false,
  });
  return client;
}
