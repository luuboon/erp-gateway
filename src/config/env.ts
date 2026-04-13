import { z } from 'zod';

// Valida que todas las variables requeridas existen al arrancar.
// Si falta alguna, el proceso falla con un mensaje claro.
const EnvSchema = z.object({
  PORT:                 z.coerce.number().default(3000),
  NODE_ENV:             z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET:           z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  GATEWAY_SECRET:       z.string().min(8, 'GATEWAY_SECRET debe tener al menos 8 caracteres'),
  USER_SERVICE_URL:     z.string().url(),
  GROUP_SERVICE_URL:    z.string().url(),
  TICKET_SERVICE_URL:   z.string().url(),
  RATE_LIMIT_MAX:       z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  CORS_ORIGINS:         z.string().default('http://localhost:4200'),
  LOG_DATABASE_URL:     z.string().min(1, 'LOG_DATABASE_URL es requerido'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Variables de entorno inválidas:\n', parsed.error.format());
  process.exit(1);
}

export const config = {
  port:        parsed.data.PORT,
  nodeEnv:     parsed.data.NODE_ENV,
  isDev:       parsed.data.NODE_ENV === 'development',
  jwt: {
    secret:    parsed.data.JWT_SECRET,
  },
  gatewaySecret: parsed.data.GATEWAY_SECRET,
  services: {
    user:      parsed.data.USER_SERVICE_URL,
    group:     parsed.data.GROUP_SERVICE_URL,
    ticket:    parsed.data.TICKET_SERVICE_URL,
  },
  rateLimit: {
    max:        parsed.data.RATE_LIMIT_MAX,
    timeWindow: parsed.data.RATE_LIMIT_WINDOW_MS,
  },
  cors: {
    origins:   parsed.data.CORS_ORIGINS.split(',').map(o => o.trim()),
  },
  logDatabaseURL: parsed.data.LOG_DATABASE_URL,
} as const;
