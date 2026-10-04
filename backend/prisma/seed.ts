import { runDatabaseSeed } from '../src/services/seedService.js';
import { prisma } from '../src/db/prisma.js';

export const seed = runDatabaseSeed;

if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  runDatabaseSeed()
    .catch((e) => {
      console.error('❌ Error during seed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
