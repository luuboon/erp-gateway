import Fastify, { FastifyInstance } from 'fastify';
import { config } from './config/env.js';
import globalPlugins from './plugins/global.plugin.js';
import { authRoutes }   from './routes/auth.routes.js';
import { userRoutes }   from './routes/user.routes.js';
import { groupRoutes }  from './routes/group.routes.js';
import { ticketRoutes } from './routes/ticket.routes.js';
import { OP_CODES } from './types/index.js';

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: config.isDev
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : true,
  });

  // Plugins globales
  await fastify.register(globalPlugins);

  // Healthcheck — sin autenticación
  fastify.get('/health', async () => ({
    statusCode: 200,
    intOpCode:  OP_CODES.OK,
    data:       [{ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() }],
  }));

  // Rutas de autenticación
  fastify.register(authRoutes, { prefix: '/auth' });

  // Rutas proxy hacia microservicios
  fastify.register(userRoutes);
  fastify.register(groupRoutes);
  fastify.register(ticketRoutes);

  // Handler global de errores
  fastify.setErrorHandler((error, _request, reply) => {
    fastify.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      statusCode,
      intOpCode: statusCode >= 500 ? OP_CODES.INTERNAL_ERROR : OP_CODES.BAD_REQUEST,
      data:      [],
      message:   config.isDev ? error.message : 'Error interno del servidor',
    });
  });

  // Ruta no encontrada
  fastify.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      intOpCode:  OP_CODES.NOT_FOUND,
      data:       [],
      message:    'Ruta no encontrada',
    });
  });

  return fastify;
}
