import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { FastifyInstance } from 'fastify';
import { config } from '../config/env.js';
import { OP_CODES } from '../types/index.js';

async function globalPlugins(fastify: FastifyInstance): Promise<void> {
  await fastify.register(helmet, { contentSecurityPolicy: false });

  await fastify.register(cors, {
    origin:      config.cors.origins,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  await fastify.register(rateLimit, {
    max:        config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow,
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      intOpCode:  OP_CODES.RATE_LIMITED,
      data:       [],
      message:    `Demasiadas peticiones. Límite: ${context.max} por ${context.after}`,
    }),
  });

  await fastify.register(jwt, {
    secret: config.jwt.secret,
    sign: { expiresIn: '8h' },
  });

  await fastify.register(sensible);
}

export default fp(globalPlugins, { name: 'global-plugins' });
