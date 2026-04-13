# 📋 Plan de Implementación — ERP-SDA Microservicios

> **Stack:** API Gateway (Fastify/TS) · User Service (Go+Chi) · Group Service (Go+Chi) · Ticket Service (Fastify/TS)  
> **Convención de respuesta:** `{ statusCode, intOpCode, data[] }`

---

## Fase 0 — Fundamentos del Gateway ✅ (este zip)

El Gateway ya tiene implementado:

| Tarea | Archivo | Estado |
|---|---|---|
| Validación de env vars con Zod | `src/config/env.ts` | ✅ |
| Plugins globales (CORS, Helmet, JWT, Rate-limit) | `src/plugins/global.plugin.ts` | ✅ |
| Hook `authenticate` (verifica JWT) | `src/hooks/auth.hook.ts` | ✅ |
| Hook `requirePermission(perm)` (verifica permisos) | `src/hooks/auth.hook.ts` | ✅ |
| Rutas `/auth/login` y `/auth/register` (mock) | `src/routes/auth.routes.ts` | ✅ |
| Rutas proxy `/api/users`, `/api/groups`, `/api/tickets` | `src/routes/*.routes.ts` | ✅ |
| Contrato `ApiResponse` y `OP_CODES` | `src/types/index.ts` | ✅ |
| Dockerfile + docker-compose skeleton | raíz | ✅ |

**Cómo arrancar:**
```bash
cp .env.example .env   # editar JWT_SECRET y URLs
npm install
npm run dev            # tsx watch — recarga en caliente
```

---

## Fase 1 — User Service en Go

### 1.1 Estructura del proyecto

```
erp-user-service/
├── cmd/
│   └── server/
│       └── main.go          # entrypoint
├── internal/
│   ├── domain/
│   │   ├── user.go          # struct User, errores de dominio
│   │   └── repository.go    # interface UserRepository
│   ├── application/
│   │   └── user_service.go  # lógica de negocio (Create, GetByEmail, etc.)
│   ├── infrastructure/
│   │   ├── postgres/
│   │   │   └── user_repo.go # implementación PostgreSQL de UserRepository
│   │   └── http/
│   │       ├── handler.go   # handlers HTTP (Chi)
│   │       ├── middleware.go # verify x-gateway-secret
│   │       └── router.go    # montaje de rutas
│   └── dto/
│       ├── request.go       # structs de request con validación
│       └── response.go      # ApiResponse[T]
├── go.mod
├── go.sum
├── Dockerfile
└── .env.example
```

### 1.2 Tarea por tarea

#### Tarea 1.2.1 — Inicializar módulo Go
```bash
mkdir erp-user-service && cd erp-user-service
go mod init github.com/luuboon/erp-user-service
go get github.com/go-chi/chi/v5
go get github.com/jackc/pgx/v5          # driver PostgreSQL
go get github.com/golang-jwt/jwt/v5     # solo para decodificar, NO para emitir
go get github.com/go-playground/validator/v10
```

#### Tarea 1.2.2 — Struct `User` y errores de dominio (`internal/domain/user.go`)
```go
package domain

import "errors"

var (
    ErrUserNotFound     = errors.New("usuario no encontrado")
    ErrEmailAlreadyUsed = errors.New("el email ya está registrado")
    ErrInvalidPassword  = errors.New("contraseña inválida")
)

type User struct {
    ID          string   `json:"id"`
    Name        string   `json:"name"`
    Email       string   `json:"email"`
    Password    string   `json:"-"`        // NUNCA en JSON
    Permissions []string `json:"permissions"`
    Avatar      string   `json:"avatar,omitempty"`
}
```

#### Tarea 1.2.3 — Interface `UserRepository` (`internal/domain/repository.go`)
```go
package domain

import "context"

type UserRepository interface {
    GetAll(ctx context.Context) ([]User, error)
    GetByID(ctx context.Context, id string) (*User, error)
    GetByEmail(ctx context.Context, email string) (*User, error)
    Create(ctx context.Context, u *User) (*User, error)
    Update(ctx context.Context, id string, changes map[string]any) (*User, error)
    Delete(ctx context.Context, id string) error
    UpdatePermissions(ctx context.Context, id string, perms []string) error
}
```

#### Tarea 1.2.4 — Implementación PostgreSQL (`internal/infrastructure/postgres/user_repo.go`)
- Conectar con `pgx/v5/pgxpool`
- Implementar cada método de la interface usando queries SQL directas (no ORM)
- Hashear password con `bcrypt` en `Create`
- En `GetByEmail` comparar password con `bcrypt.CompareHashAndPassword`

#### Tarea 1.2.5 — `UserService` (`internal/application/user_service.go`)
- Recibe `UserRepository` por inyección de dependencias
- Métodos: `CreateUser`, `AuthenticateUser`, `GetUsers`, `UpdateUser`, `DeleteUser`, `SetPermissions`
- `AuthenticateUser` NO emite JWT (eso lo hace el Gateway)
- Retorna errores de dominio que los handlers traducen a HTTP codes

#### Tarea 1.2.6 — Middleware de seguridad interna (`internal/infrastructure/http/middleware.go`)
```go
// Verifica que el request venga del Gateway (no del exterior)
func GatewayOnly(secret string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if r.Header.Get("X-Gateway-Secret") != secret {
                writeError(w, 403, "0xA2", "Acceso denegado")
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

#### Tarea 1.2.7 — Handlers y Router
```
POST   /internal/auth/login       → UserService.AuthenticateUser (llamado por Gateway en /auth/login)
GET    /users                     → UserService.GetUsers
GET    /users/:id                 → UserService.GetByID
POST   /users                     → UserService.CreateUser
PATCH  /users/:id                 → UserService.UpdateUser
DELETE /users/:id                 → UserService.DeleteUser
PATCH  /users/:id/permissions     → UserService.SetPermissions
```

#### Tarea 1.2.8 — Actualizar Gateway
En `src/routes/auth.routes.ts`, reemplazar los bloques `// MOCK temporal` por:
```typescript
const res = await fetch(`${config.services.user}/internal/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type':     'application/json',
    'x-gateway-secret': config.jwt.secret,
  },
  body: JSON.stringify(body.data),
});
const serviceResponse = await res.json();
if (!serviceResponse.success) { /* mapear error */ }
const userProfile = serviceResponse.data[0];
// luego firmar JWT con userProfile.id, email, permissions...
```

---

## Fase 2 — Group Service en Go

> Sigue exactamente la misma estructura que User Service.

### Endpoints internos
```
GET    /groups              → listar grupos
GET    /groups/:id          → detalle con memberIds populados
POST   /groups              → crear grupo
PATCH  /groups/:id          → editar
DELETE /groups/:id          → eliminar
POST   /groups/:id/members  → añadir miembro (valida que userId existe llamando al User Service)
DELETE /groups/:id/members/:userId → quitar miembro
```

### Consideración clave — comunicación entre servicios
Group Service necesita consultar al User Service para validar que un `userId` existe antes de añadirlo como miembro. Esta comunicación es **service-to-service**, interna, y debe usar el header `X-Gateway-Secret`:

```go
// En group_service.go
func (s *GroupService) AddMember(ctx context.Context, groupID, userID string) error {
    // Validar que el user existe
    resp, err := s.httpClient.Get(
        fmt.Sprintf("%s/users/%s", s.userServiceURL, userID),
        // headers internos...
    )
    if resp.StatusCode == 404 {
        return ErrUserNotFound
    }
    // ... añadir al grupo
}
```

---

## Fase 3 — Ticket Service en Fastify/TypeScript

### 3.1 Estructura
```
erp-ticket-service/
├── src/
│   ├── config/env.ts
│   ├── types/index.ts          # reusar contrato ApiResponse
│   ├── domain/
│   │   ├── ticket.model.ts     # copiar del frontend (sin cambios)
│   │   └── ticket.repository.ts
│   ├── infrastructure/
│   │   └── postgres/
│   │       └── pg-ticket.repository.ts
│   ├── application/
│   │   └── ticket.service.ts
│   ├── routes/
│   │   └── ticket.routes.ts
│   ├── hooks/
│   │   └── gateway-only.hook.ts  # verifica x-gateway-secret
│   ├── app.ts
│   └── server.ts
├── package.json
└── Dockerfile
```

### 3.2 Ventaja del frontend Angular
Los modelos `Ticket`, `TicketStatus`, `TicketPriority` ya están definidos y probados en el frontend. El Ticket Service puede importar **exactamente** la misma estructura. El schema SQL ya existe en `schema.sql` del repo del frontend.

### 3.3 Endpoints
```
GET    /tickets              → getTickets (filtros: ?groupId=, ?status=, ?assignedTo=)
GET    /tickets/:id          → getById
POST   /tickets              → create (el userId viene del header x-user-id)
PATCH  /tickets/:id          → update (genera historial automáticamente igual que el frontend)
DELETE /tickets/:id          → delete
POST   /tickets/:id/comments → addComment
```

---

## Fase 4 — Base de datos compartida (PostgreSQL en Neon)

### Tablas por servicio
```
User Service  → users, user_permissions
Group Service → groups, group_members
Ticket Service → tickets, ticket_comments, ticket_history
```

> El schema.sql del repo del frontend ya tiene estas tablas. Cada servicio apunta al mismo Neon cluster pero solo accede a sus propias tablas (separación por convención, no por schema — suficiente para este tamaño de proyecto).

### Migraciones
Usar un sistema de migraciones simple:
- **Go services:** `golang-migrate/migrate`
- **Fastify service:** `node-pg-migrate` o `db-migrate`

---

## Fase 5 — Conectar el frontend Angular

### Crear `HttpXxxRepository` para cada dominio

En lugar del `InMemoryXxxRepository`, crear una implementación HTTP que llame al Gateway:

```typescript
// src/app/infrastructure/repositories/http/http-ticket.repository.ts
@Injectable({ providedIn: 'root' })
export class HttpTicketRepository implements TicketRepository {
  private http = inject(HttpClient);
  private base = 'http://localhost:3000/api/tickets';

  async getTickets(): Promise<Ticket[]> {
    const res = await firstValueFrom(this.http.get<ApiResponse<Ticket>>(`${this.base}`));
    return res.data;
  }
  // ...
}
```

### Cambiar el provider en `app.config.ts`
```typescript
// Cambiar de:
{ provide: TicketRepository, useClass: InMemoryTicketRepository }
// A:
{ provide: TicketRepository, useClass: HttpTicketRepository }
```

**Cero cambios en servicios, components ni UI.**  
Aquí es donde se paga toda la arquitectura de repositorios que ya construiste.

---

## Orden sugerido de implementación

```
Semana 1  → Fase 1 (User Service completo + tests con Bruno/Thunder)
Semana 2  → Fase 2 (Group Service)
Semana 3  → Fase 3 (Ticket Service)
Semana 4  → Fase 4 (BD real en Neon, migraciones)
Semana 5  → Fase 5 (conectar Angular al Gateway)
```

---

## Herramientas de testing recomendadas
- **Bruno** (open source, como Postman pero en archivos `.bru`) — para colecciones de requests
- **ThunderClient** (VSCode extension) — para pruebas rápidas
- **Vitest** — ya configurado en el Gateway para unit tests de hooks/validators

---

## Convención de respuesta — recordatorio

Todos los servicios, sin excepción, responden así:
```json
{
  "statusCode": 200,
  "intOpCode": "0x00",
  "data": [ { ... } ]
}
```

| intOpCode | Significado |
|---|---|
| `0x00` | OK |
| `0x01` | Created |
| `0xA0` | Bad Request |
| `0xA1` | Unauthorized |
| `0xA2` | Forbidden |
| `0xA3` | Not Found |
| `0xA4` | Conflict |
| `0xA5` | Rate Limited |
| `0xFF` | Internal Error |
