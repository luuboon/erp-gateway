import { FastifyRequest, FastifyReply } from 'fastify';
import { OP_CODES, JwtPayload } from '../types/index.js';

// authenticate — verifica el JWT en el header Authorization.
// Si es válido, popula req.user con el payload.
// Se usa como preHandler en rutas protegidas.
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
    // jwtVerify popula request.user automáticamente
  } catch {
    reply.status(401).send({
      statusCode: 401,
      intOpCode:  OP_CODES.UNAUTHORIZED,
      data:       [],
      message:    'Token inválido o expirado',
    });
  }
}

// requirePermission — factory que devuelve un hook que verifica
// si el usuario tiene el permiso en el grupo activo.
//
// El groupId viene del parámetro de la URL (:groupId).
// Si no hay groupId en la URL, verifica en globalPermissions.
//
// Uso: { preHandler: [authenticate, requirePermission('tickets:add')] }
export function requirePermission(permission: string) {
  return async function (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const user = request.user as JwtPayload | undefined;
    if (!user) {
      reply.status(401).send({
        statusCode: 401,
        intOpCode:  OP_CODES.UNAUTHORIZED,
        data:       [],
        message:    'No autenticado',
      });
      return;
    }

    // Verificar en globalPermissions
    if ((user.globalPermissions ?? []).includes(permission)) return;

    const params = request.params as Record<string, string>;
    const groupId = params?.groupId ?? params?.id;

    if (groupId) {
      // Verificar en el grupo específico de la URL
      const groupPerms = (user.permissionsByGroup ?? {})[groupId] ?? [];
      if (groupPerms.includes(permission)) return;

      // Fallback: si no está en ese grupo (ej. grupo recién creado cuyo ID
      // aún no está en el JWT), verificar en cualquier grupo del usuario
      const allGroupPerms = Object.values(user.permissionsByGroup ?? {}).flat();
      if (allGroupPerms.includes(permission)) return;
    } else {
      // Sin groupId — verificar si tiene el permiso en CUALQUIER grupo
      // Cubre rutas como POST /api/groups donde no hay groupId previo
      const allGroupPerms = Object.values(user.permissionsByGroup ?? {}).flat();
      if (allGroupPerms.includes(permission)) return;
    }

    reply.status(403).send({
      statusCode: 403,
      intOpCode:  OP_CODES.FORBIDDEN,
      data:       [],
      message:    `Permiso requerido: ${permission}`,
    });
  };
}
