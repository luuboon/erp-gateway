import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate, requirePermission } from '../hooks/auth.hook.js';
import { config } from '../config/env.js';
import { OP_CODES } from '../types/index.js';

async function proxyToTicketService(
  path: string,
  method: string,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const url = `${config.services.ticket}${path}`;
  const headers: Record<string, string> = {
    'Content-Type':     'application/json',
    'X-Gateway-Secret': config.gatewaySecret,
    'X-User-Id':        request.user?.sub   ?? '',
    'X-User-Email':     request.user?.email ?? '',
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
      message:    'Ticket Service no disponible',
    });
  }
}

export async function ticketRoutes(fastify: FastifyInstance): Promise<void> {

  // GET /api/tickets — listar tickets (requiere tickets:view)
  fastify.get('/api/tickets', {
    preHandler: [authenticate, requirePermission('tickets:view')],
  }, async (req, reply) => proxyToTicketService('/tickets', 'GET', req, reply));

  // GET /api/tickets/:id — detalle de ticket
  fastify.get('/api/tickets/:id', {
    preHandler: [authenticate, requirePermission('tickets:view')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToTicketService(`/tickets/${id}`, 'GET', req, reply);
  });

  // POST /api/tickets — crear ticket (requiere tickets:add)
  fastify.post('/api/tickets', {
    preHandler: [authenticate, requirePermission('tickets:add')],
  }, async (req, reply) => proxyToTicketService('/tickets', 'POST', req, reply));

  // PATCH /api/tickets/:id — editar ticket (requiere tickets:move)
  fastify.patch('/api/tickets/:id', {
    preHandler: [authenticate, requirePermission('tickets:move')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToTicketService(`/tickets/${id}`, 'PATCH', req, reply);
  });

  // DELETE /api/tickets/:id — eliminar ticket (requiere tickets:delete)
  fastify.delete('/api/tickets/:id', {
    preHandler: [authenticate, requirePermission('tickets:delete')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToTicketService(`/tickets/${id}`, 'DELETE', req, reply);
  });

  // POST /api/tickets/:id/comments — agregar comentario (requiere tickets:move)
  fastify.post('/api/tickets/:id/comments', {
    preHandler: [authenticate, requirePermission('tickets:move')],
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return proxyToTicketService(`/tickets/${id}/comments`, 'POST', req, reply);
  });
}
