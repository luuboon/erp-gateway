import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config/env.js';

async function main(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`\n🚀 ERP-SDA Gateway corriendo en http://localhost:${config.port}`);
    console.log(`📡 Microservicios:`);
    console.log(`   /auth            → ${config.services.user} (User Service)`);
    console.log(`   /api/users       → ${config.services.user}`);
    console.log(`   /api/groups      → ${config.services.group}`);
    console.log(`   /api/tickets     → ${config.services.ticket}\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

main();
