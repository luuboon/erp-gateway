import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requirePermission } from '../hooks/auth.hook.js';
import { config } from '../config/env.js';
import { OP_CODES, JwtPayload } from '../types/index.js';

// Helper para reenviar un request al User Service con los headers internos
async function proxyToUserService(
  path: string,
  method: string,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const url = `${config.services.user}${path}`;

  // X-Gateway-Secret → identifica que viene del Gateway
  // X-User-Id        → quién está haciendo el request (para auditoría)
  const user = request.user as JwtPayload;
  const headers: Record<string, string> = {
    'Content-Type':     'application/json',
    'X-Gateway-Secret': config.gatewaySecret,
    'X-User-Id':        user?.sub        ?? '',
    'X-User-Email':     user?.email       ?? '',
  };

  const options: RequestInit = { method, headers };

  // Pasar el body en métodos que lo tienen
  if (['POST', 'PATCH', 'PUT'].includes(method) && request.body) {
    options.body = JSON.stringify(request.body);
  }

  try {
    const res = await fetch(url, options);
    const data = await res.json();
    return reply.status(res.status).send(data);
  } catch {
    return reply.status(503).send({
      statusCode: 503,
      intOpCode:  OP_CODES.INTERNAL_ERROR,
      data:       [],
      message:    'User Service no disponible',
    });
  }
}

export async function userRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/users — listar usuarios (solo requiere estar autenticado)
  fastify.get('/api/users', {
    preHandler: [authenticate],
  }, async (req, reply) => proxyToUserService('/users', 'GET', req, reply));

  // GET /api/users/:id — ver usuario
  fastify.get('/api/users/:id', {
    preHandler: [authenticate],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToUserService(`/users/${id}`, 'GET', req, reply);
  });

  // PATCH /api/users/:id — editar usuario
  fastify.patch('/api/users/:id', {
    preHandler: [authenticate],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToUserService(`/users/${id}`, 'PATCH', req, reply);
  });

  // DELETE /api/users/:id — eliminar usuario (requiere users:manage)
  fastify.delete('/api/users/:id', {
    preHandler: [authenticate, requirePermission('users:manage')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToUserService(`/users/${id}`, 'DELETE', req, reply);
  });

  // PATCH /api/users/:id/permissions — asignar permisos (requiere users:manage)
  fastify.patch('/api/users/:id/permissions', {
    preHandler: [authenticate, requirePermission('users:manage')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToUserService(`/users/${id}/permissions`, 'PATCH', req, reply);
  });
}
