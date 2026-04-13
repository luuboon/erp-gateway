import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { getLogPool } from '../infrastructure/db.js';
import { JwtPayload } from '../types/index.js';

// onRequest — se ejecuta cuando llega el request, guarda el timestamp de inicio
export function onRequestHook(
  request: FastifyRequest,
  _reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  (request as any).startTime = Date.now();
  done();
}

// onResponse — se ejecuta cuando se envía la respuesta, guarda el log
export async function onResponseHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // Ignorar el healthcheck para no llenar la BD de ruido
  if (request.url === '/health') return;

  const startTime = (request as any).startTime ?? Date.now();
  const durationMs = Date.now() - startTime;
  const statusCode = reply.statusCode;
  const method = request.method;

  // Normalizar el endpoint — reemplazar UUIDs e IDs por :id
  // Así /api/tickets/abc-123 y /api/tickets/def-456 cuentan como el mismo endpoint
  const endpoint = normalizeEndpoint(request.url);

  // Obtener el userId del JWT si está autenticado
  const user = (request as any).user as JwtPayload | undefined;
  const userId = user?.sub ?? '';

  // IP real del cliente (Railway pone la IP en X-Forwarded-For)
  const ip = (request.headers['x-forwarded-for'] as string) ?? request.ip ?? '';

  const pool = getLogPool();

  // Guardar en paralelo — no esperamos a que termine para no bloquear la respuesta
  Promise.all([
    // Insertar log individual
    pool.query(
      `INSERT INTO request_logs (method, endpoint, user_id, ip, status_code, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [method, endpoint, userId, ip, statusCode, durationMs],
    ),

    // Actualizar métricas agregadas con UPSERT
    // Si ya existe el endpoint, incrementa los contadores
    // Si no existe, lo crea
    pool.query(
      `INSERT INTO endpoint_metrics (method, endpoint, request_count, total_duration, error_count, last_called_at)
       VALUES ($1, $2, 1, $3, $4, NOW())
       ON CONFLICT (method, endpoint) DO UPDATE SET
         request_count  = endpoint_metrics.request_count + 1,
         total_duration = endpoint_metrics.total_duration + $3,
         error_count    = endpoint_metrics.error_count + $4,
         last_called_at = NOW()`,
      [method, endpoint, durationMs, statusCode >= 500 ? 1 : 0],
    ),
  ]).catch(err => {
    // Si falla el log, solo lo registramos en consola — no fallamos el request
    console.error('Error guardando log:', err);
  });
}

// onError — se ejecuta si hay un error no capturado, guarda el stack trace
export async function onErrorHook(
  request: FastifyRequest,
  reply: FastifyReply,
  error: Error,
): Promise<void> {
  const startTime = (request as any).startTime ?? Date.now();
  const durationMs = Date.now() - startTime;
  const endpoint = normalizeEndpoint(request.url);
  const user = (request as any).user as JwtPayload | undefined;

  const pool = getLogPool();

  pool.query(
    `INSERT INTO request_logs (method, endpoint, user_id, ip, status_code, duration_ms, error)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      request.method,
      endpoint,
      user?.sub ?? '',
      request.ip ?? '',
      reply.statusCode,
      durationMs,
      error.stack ?? error.message,
    ],
  ).catch(console.error);
}

// Normaliza URLs reemplazando IDs dinámicos por :id
// /api/tickets/abc-123-def → /api/tickets/:id
// /api/groups/xxx/members/yyy → /api/groups/:id/members/:id
function normalizeEndpoint(url: string): string {
  return url
    .split('?')[0]  // quitar query params
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/[0-9a-f]{24}/g, '/:id');
}
