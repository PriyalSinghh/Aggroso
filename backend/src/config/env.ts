import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const isSqliteDatabaseUrl = (url?: string): boolean => {
  return typeof url === 'string' && url.startsWith('file:');
};

export const resolveDatabaseUrl = (url: string | undefined, nodeEnv = process.env.NODE_ENV || 'development') => {
  const nextUrl = url || 'file:./dev.db';

  if (nodeEnv === 'production' && isSqliteDatabaseUrl(nextUrl)) {
    throw new Error(
      'Production deployments require a PostgreSQL DATABASE_URL. SQLite file:./dev.db is not supported on Vercel/Render/Railway.'
    );
  }

  return nextUrl;
};

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: resolveDatabaseUrl(process.env.DATABASE_URL, process.env.NODE_ENV || 'development'),
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    apiUrl: process.env.AI_API_URL || 'https://api.openai.com/v1',
    model: process.env.AI_MODEL || 'gpt-4o',
  },
};
