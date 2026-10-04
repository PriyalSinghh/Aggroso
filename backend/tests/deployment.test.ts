import { describe, it, expect } from 'vitest';
import { resolveDatabaseUrl, isSqliteDatabaseUrl } from '../src/config/env.js';

describe('Deployment database validation', () => {
  it('rejects SQLite in production deployments', () => {
    expect(() => resolveDatabaseUrl('file:./dev.db', 'production')).toThrow(/PostgreSQL/i);
  });

  it('accepts PostgreSQL URLs in production', () => {
    const url = 'postgresql://aggroso:aggroso@db:5432/aggroso';
    expect(resolveDatabaseUrl(url, 'production')).toBe(url);
    expect(isSqliteDatabaseUrl(url)).toBe(false);
  });
});
