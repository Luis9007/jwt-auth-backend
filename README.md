# JWT Auth Backend (FastAPI + Supabase Postgres)

Autenticación y autorización con JWT sobre las tablas `jwt_*` del proyecto Supabase
`jwt-auth-backend` (`afjjmrymllslbvwysbij`).

## Qué incluye
- Registro, login (JSON y OAuth2 form para el botón *Authorize* de Swagger).
- **Access token** corto (15 min) + **refresh token** (7 días) con **rotación** y
  **detección de reutilización** (si se reusa un refresh ya rotado, se revoca toda la familia).
- Logout con **blacklist** del access token (`jti`) y logout global.
- Bloqueo de cuenta tras N intentos fallidos (423) y comparación de tiempo constante si el usuario no existe.
- Verificación de email, olvido/reset de contraseña y cambio de contraseña (revoca sesiones).
- **RBAC**: roles y permisos leídos de la BD en cada petición (los cambios aplican al instante).
  Dependencias `require_roles(...)` (alguno) y `require_permissions(...)` (todos).
- Auditoría en `jwt_audit_logs`.
- Contraseñas con bcrypt; tokens de reset/verificación/refresh guardados solo como hash SHA-256.

## Puesta en marcha
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # y edítalo
uvicorn app.main:app --reload
```
Docs interactivas: http://localhost:8000/docs

### Puesta en marcha del Frontend (Angular)
```bash
cd frontend
npm install   # solo la primera vez si es necesario
npm start
```
Frontend interactivo: http://localhost:4200

### Variables clave
- `DATABASE_URL`: contraseña de la BD en *Dashboard > Project Settings > Database* (puedes resetearla ahí).
  La conexión directa (`db.<ref>.supabase.co`) es IPv6; si tu red no lo soporta usa el
  **Session pooler** (host y usuario `postgres.<ref>` desde el botón *Connect*).
  Con el Transaction pooler (puerto 6543) ya se desactiva el cache de prepared statements.
- `JWT_SECRET`: ≥ 32 caracteres. `python -c "import secrets; print(secrets.token_urlsafe(64))"`
- `DEV_EXPOSE_TOKENS=true` devuelve los tokens de verificación/reset en la respuesta (solo desarrollo).
  **En producción pon `false` e integra un proveedor de email** (hay `TODO` en `routers/auth.py`).

## Usuarios de prueba (ya cargados en la BD)
| Usuario | Contraseña | Notas |
|---|---|---|
| admin | `Admin123!` | roles admin + user |
| manager | `Manager123!` | manager + user |
| user | `User123!` | user |
| pending | `Pending123!` | email sin verificar → 403 |
| locked | `Locked123!` | bloqueado 15 min → 423 |
| inactive | `Inactive123!` | desactivado → 403 |

## Endpoints
| Método | Ruta | Acceso |
|---|---|---|
| POST | `/auth/register`, `/auth/login`, `/auth/token`, `/auth/refresh` | público |
| POST | `/auth/verify-email`, `/auth/resend-verification`, `/auth/forgot-password`, `/auth/reset-password` | público |
| POST | `/auth/logout`, `/auth/logout-all`, `/auth/change-password` | autenticado |
| GET/PATCH | `/users/me` | autenticado (PATCH: `profile:write`) |
| GET | `/users`, `/users/{id}` | `users:read` |
| PATCH | `/users/{id}` | `users:write` |
| DELETE | `/users/{id}` | `users:delete` |
| PUT/DELETE | `/users/{id}/roles/{role_id}` | `roles:write` |
| GET | `/roles`, `/permissions` | `roles:read` |
| POST/PUT | `/roles`, `/roles/{id}/permissions` | `roles:write` |
| GET | `/audit-logs` | `audit:read` |
| GET | `/health` | público |

## Proteger tus propias rutas
```python
from fastapi import Depends
from app.deps import Principal, require_permissions, require_roles

@app.get("/reports")
async def reports(p: Principal = Depends(require_permissions("audit:read"))): ...

@app.get("/admin-only")
async def admin_only(p: Principal = Depends(require_roles("admin"))): ...
```

## Tests
```bash
pip install -r requirements-dev.txt
pytest
```
Usan SQLite en memoria (no tocan tu base de datos).

## Mantenimiento
Limpia filas caducadas periódicamente: `python -m scripts.purge_expired`

## Producción: pendientes recomendados
- Rate limiting en `/auth/*` (p. ej. slowapi o en el proxy/WAF).
- Servicio de email real y `DEV_EXPOSE_TOKENS=false`.
- HTTPS obligatorio; `uvicorn --proxy-headers` detrás de un proxy para registrar la IP real.
- Si el cliente es un navegador, guarda el refresh token en una cookie `HttpOnly; Secure; SameSite`.
- Rotar `JWT_SECRET` invalida todos los tokens emitidos.
