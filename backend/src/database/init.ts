import { loadEnv } from '../core/config.js';
import { initDatabase } from './db.js';

loadEnv();

async function init() {
  console.log('🌱 Initializing database...\n');
  await initDatabase();
  console.log('\n✅ Database initialization complete!');
}

init().catch((err) => {
  console.error('❌ Failed to initialize database:', err);
  process.exit(1);
});
