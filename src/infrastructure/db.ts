import pg from 'pg';
import { config } from '../config/env.js';

// Pool de conexión a la BD de logs (erp_logs en Neon)
// Se crea una sola vez y se reutiliza en toda la app (singleton lazy)
let _pool: pg.Pool | null = null;

export function getLogPool(): pg.Pool {
  if (!_pool) {
    _pool = new pg.Pool({
      connectionString: config.logDatabaseURL,
      ssl: { rejectUnauthorized: false },
      max: 5,                    // máximo 5 conexiones simultáneas
      idleTimeoutMillis: 30_000, // cierra conexiones inactivas tras 30s
    });
  }
  return _pool;
}
