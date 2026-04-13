import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requirePermission } from '../hooks/auth.hook.js';
import { config } from '../config/env.js';
import { OP_CODES, JwtPayload } from '../types/index.js';

async function proxyToGroupService(
  path: string,
  method: string,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const url = `${config.services.group}${path}`;
  const user = request.user as JwtPayload;
  const headers: Record<string, string> = {
    'Content-Type':     'application/json',
    'X-Gateway-Secret': config.gatewaySecret,
    'X-User-Id':        user?.sub   ?? '',
    'X-User-Email':     user?.email ?? '',
  };

  const options: RequestInit = { method, headers };
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
      message:    'Group Service no disponible',
    });
  }
}

export async function groupRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/groups — listar grupos
  fastify.get('/api/groups', {
    preHandler: [authenticate],
  }, async (req, reply) => proxyToGroupService('/groups', 'GET', req, reply));

  // GET /api/groups/:id — detalle de grupo
  fastify.get('/api/groups/:id', {
    preHandler: [authenticate],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToGroupService(`/groups/${id}`, 'GET', req, reply);
  });

  // POST /api/groups — crear grupo (requiere groups:manage)
  fastify.post('/api/groups', {
    preHandler: [authenticate, requirePermission('groups:manage')],
  }, async (req, reply) => proxyToGroupService('/groups', 'POST', req, reply));

  // PATCH /api/groups/:id — editar grupo (requiere groups:manage)
  fastify.patch('/api/groups/:id', {
    preHandler: [authenticate, requirePermission('groups:manage')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToGroupService(`/groups/${id}`, 'PATCH', req, reply);
  });

  // DELETE /api/groups/:id — eliminar grupo (requiere groups:manage)
  fastify.delete('/api/groups/:id', {
    preHandler: [authenticate, requirePermission('groups:manage')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToGroupService(`/groups/${id}`, 'DELETE', req, reply);
  });

  // POST /api/groups/:id/members — agregar miembro
  fastify.post('/api/groups/:id/members', {
    preHandler: [authenticate, requirePermission('groups:manage')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToGroupService(`/groups/${id}/members`, 'POST', req, reply);
  });

  // DELETE /api/groups/:id/members/:userId — quitar miembro
  fastify.delete('/api/groups/:id/members/:userId', {
    preHandler: [authenticate, requirePermission('groups:manage')],
  }, async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    return proxyToGroupService(`/groups/${id}/members/${userId}`, 'DELETE', req, reply);
  });
}
