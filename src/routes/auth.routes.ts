import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { OP_CODES } from '../types/index.js';
import { config } from '../config/env.js';

const LoginBody = z.object({
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Password debe tener al menos 6 caracteres'),
});

const RegisterBody = z.object({
  name:     z.string().min(2, 'Nombre debe tener al menos 2 caracteres'),
  email:    z.string().email('Email inválido'),
  password: z.string().min(6, 'Password debe tener al menos 6 caracteres'),
});

// Headers que el Gateway siempre envía a los microservicios internos.
// El GATEWAY_SECRET identifica que el request viene del Gateway.
function internalHeaders() {
  return {
    'Content-Type':     'application/json',
    'X-Gateway-Secret': config.gatewaySecret,
  };
}

export async function authRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /auth/login ───────────────────────────────────────────
  // Flujo:
  //   1. Validar body con Zod
  //   2. Reenviar credenciales al User Service
  //   3. Si son correctas, firmar JWT con los datos del usuario
  //   4. Devolver token al frontend
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = LoginBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        intOpCode:  OP_CODES.BAD_REQUEST,
        data:       [],
        message:    body.error.issues.map(i => i.message).join(', '),
      });
    }

    // Llamar al User Service para verificar credenciales
    let serviceRes: Response;
    try {
      serviceRes = await fetch(`${config.services.user}/internal/auth/login`, {
        method:  'POST',
        headers: internalHeaders(),
        body:    JSON.stringify(body.data),
      });
    } catch {
      return reply.status(500).send({
        statusCode: 500,
        intOpCode:  OP_CODES.INTERNAL_ERROR,
        data:       [],
        message:    'User Service no disponible',
      });
    }

    const serviceData = await serviceRes.json() as any;

    // Si el User Service devuelve error, propagarlo al frontend
    if (!serviceRes.ok) {
      return reply.status(serviceRes.status).send({
        statusCode: serviceRes.status,
        intOpCode:  serviceData.intOpCode ?? OP_CODES.UNAUTHORIZED,
        data:       [],
        message:    serviceData.message ?? 'Credenciales incorrectas',
      });
    }

    const user = serviceData.data[0];

    // Firmar JWT con los datos del usuario
    // El frontend guarda este token en cookie y lo envía en cada request
    const token = fastify.jwt.sign({
      sub:                user.id,
      name:               user.name,
      email:              user.email,
      globalPermissions:  user.globalPermissions  ?? [],
      permissionsByGroup: user.permissionsByGroup ?? {},
    });

    return reply.status(200).send({
      statusCode: 200,
      intOpCode:  OP_CODES.OK,
      data: [{
        token,
        user: {
          id:                 user.id,
          name:               user.name,
          email:              user.email,
          globalPermissions:  user.globalPermissions,
          permissionsByGroup: user.permissionsByGroup,
        },
      }],
    });
  });

  // ── POST /auth/register ────────────────────────────────────────
  // Flujo:
  //   1. Validar body
  //   2. Enviar al User Service para crear el usuario
  //   3. Devolver confirmación (sin token — el usuario debe hacer login)
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = RegisterBody.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({
        statusCode: 400,
        intOpCode:  OP_CODES.BAD_REQUEST,
        data:       [],
        message:    body.error.issues.map(i => i.message).join(', '),
      });
    }

    let serviceRes: Response;
    try {
      serviceRes = await fetch(`${config.services.user}/users`, {
        method:  'POST',
        headers: internalHeaders(),
        body:    JSON.stringify(body.data),
      });
    } catch {
      return reply.status(500).send({
        statusCode: 500,
        intOpCode:  OP_CODES.INTERNAL_ERROR,
        data:       [],
        message:    'User Service no disponible',
      });
    }

    const serviceData = await serviceRes.json() as any;

    if (!serviceRes.ok) {
      return reply.status(serviceRes.status).send({
        statusCode: serviceRes.status,
        intOpCode:  serviceData.intOpCode ?? OP_CODES.BAD_REQUEST,
        data:       [],
        message:    serviceData.message ?? 'Error al registrar usuario',
      });
    }

    return reply.status(201).send({
      statusCode: 201,
      intOpCode:  OP_CODES.CREATED,
      data:       serviceData.data,
    });
  });
}
