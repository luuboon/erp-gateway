import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requirePermission } from '../hooks/auth.hook.js';
import { getLogPool } from '../infrastructure/db.js';
import { OP_CODES } from '../types/index.js';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /admin/logs — últimos 100 logs
  // Query params opcionales: ?endpoint=, ?userId=, ?statusCode=, ?limit=
  fastify.get('/admin/logs', {
    preHandler: [authenticate, requirePermission('users:manage')],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { endpoint, userId, statusCode, limit = '100' } =
      req.query as Record<string, string>;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (endpoint) {
      conditions.push(`endpoint ILIKE $${idx}`);
      params.push(`%${endpoint}%`);
      idx++;
    }
    if (userId) {
      conditions.push(`user_id = $${idx}`);
      params.push(userId);
      idx++;
    }
    if (statusCode) {
      conditions.push(`status_code = $${idx}`);
      params.push(parseInt(statusCode));
      idx++;
    }

    params.push(Math.min(parseInt(limit), 500)); // máximo 500 registros
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const pool = getLogPool();
    const { rows } = await pool.query(`
      SELECT id, method, endpoint, user_id, ip, status_code, duration_ms, error, created_at
      FROM request_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT $${idx}
    `, params);

    return reply.send({
      statusCode: 200,
      intOpCode:  OP_CODES.OK,
      data:       rows,
    });
  });

  // GET /admin/metrics — métricas agregadas por endpoint
  fastify.get('/admin/metrics', {
    preHandler: [authenticate, requirePermission('users:manage')],
  }, async (_req: FastifyRequest, reply: FastifyReply) => {
    const pool = getLogPool();
    const { rows } = await pool.query(`
      SELECT
        method,
        endpoint,
        request_count,
        error_count,
        total_duration,
        -- Tiempo promedio de respuesta en ms
        CASE WHEN request_count > 0
          THEN ROUND(total_duration::numeric / request_count, 2)
          ELSE 0
        END as avg_duration_ms,
        -- Porcentaje de errores
        CASE WHEN request_count > 0
          THEN ROUND(error_count::numeric / request_count * 100, 2)
          ELSE 0
        END as error_rate_pct,
        last_called_at
      FROM endpoint_metrics
      ORDER BY request_count DESC
    `);

    return reply.send({
      statusCode: 200,
      intOpCode:  OP_CODES.OK,
      data:       rows,
    });
  });
}
