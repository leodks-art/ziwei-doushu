import { Pool, type QueryResult, type QueryResultRow } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __ziweiPgPool: Pool | undefined;
}

export function hasDatabaseConfig(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }
  if (!globalThis.__ziweiPgPool) {
    globalThis.__ziweiPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === '1' ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalThis.__ziweiPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

export async function safeQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T> | null> {
  if (!hasDatabaseConfig()) return null;
  return query<T>(text, params);
}
