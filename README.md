# ERP-SDA — API Gateway

Punto único de entrada para todos los microservicios del ERP.  
**Stack:** Fastify · TypeScript · JWT · Zod

## Responsabilidades

- Validar JWT en cada request protegido
- Verificar permisos por grupo antes de reenviar al microservicio
- Rate limiting (100 req/min por IP)
- Reenviar requests a User, Group y Ticket services

## Setup local

```bash
cp .env.example .env
# Editar .env con tus valores

npm install
npm run dev
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Login — devuelve JWT |
| `POST` | `/auth/register` | Registro de usuario |
| `GET` | `/api/users` | Listar usuarios |
| `PATCH` | `/api/users/:id/permissions` | Asignar permisos |
| `GET` | `/api/groups` | Listar grupos |
| `POST` | `/api/groups` | Crear grupo |
| `GET` | `/api/tickets` | Listar tickets |
| `POST` | `/api/tickets` | Crear ticket |
| `GET` | `/health` | Healthcheck |

## Variables de entorno

| Variable | Descripción |
|---|---|
| `PORT` | Puerto (default: 3000) |
| `JWT_SECRET` | Secret para firmar JWT |
| `GATEWAY_SECRET` | Secret compartido con microservicios |
| `USER_SERVICE_URL` | URL del User Service |
| `GROUP_SERVICE_URL` | URL del Group Service |
| `TICKET_SERVICE_URL` | URL del Ticket Service |
| `CORS_ORIGINS` | Origenes permitidos (separados por coma) |
