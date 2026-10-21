# JWT Auth Frontend (Angular + Tailwind CSS)

Aplicación frontend moderna desarrollada en **Angular** y estilizada con **Tailwind CSS**, conectada al backend FastAPI con autenticación JWT, rotación de tokens y RBAC sobre Supabase Postgres.

---

## 🚀 Características

- **Flujo Completo de Autenticación**:
  - Iniciar sesión (Email/Username + Password) con botones de prueba rápida para usuarios preconfigurados (`admin`, `manager`, `user`).
  - Registro con validación en tiempo real de seguridad de contraseñas.
  - Verificación de correo electrónico y reenvío de token.
  - Recuperación y restablecimiento de contraseña.
  - Soporte integrado para `DEV_EXPOSE_TOKENS` mostrando directamente el token devuelto para facilitar pruebas de desarrollo.
- **Seguridad y Manejo de Tokens**:
  - `jwtInterceptor`: Añade automáticamente el token `Bearer <access_token>` a todas las peticiones a la API.
  - `authInterceptor`: Intercepta respuestas `401 Unauthorized`, renueva el token usando `/auth/refresh` y reintenta las solicitudes pendientes de manera transparente.
  - `authGuard`, `guestGuard` y `roleGuard`: Protección robusta de rutas y vistas.
- **Panel de Control y RBAC**:
  - **Overview**: Resumen de usuario activo, estado de la cuenta, roles y permisos efectivos calculados en vivo.
  - **Mi Perfil**: Actualización de nombre y cambio de contraseña (revoca sesiones concurrentes) y cierre global de sesión (`/auth/logout-all`).
  - **Gestión de Usuarios**: Tabla paginada con búsqueda, activación/desactivación instantánea, verificación manual y asignación de roles mediante modal.
  - **Roles y Permisos**: Catálogo de roles del sistema, creación de nuevos roles y edición interactiva de permisos asignados.
  - **Logs de Auditoría**: Historial completo de eventos de seguridad con filtros por evento y resultado, visor modal de metadata en formato JSON legible.

---

## 🛠️ Ejecución

### 1. Iniciar el Backend (FastAPI)
Desde la raíz del proyecto (`jwt-auth-backend`):
```bash
# Activa tu entorno virtual e inicia FastAPI
uvicorn app.main:app --reload
```
La API estará disponible en `http://localhost:8000`.

### 2. Iniciar el Frontend (Angular)
En una nueva terminal, navega a la carpeta `frontend`:
```bash
cd frontend
npm start
```
Abre tu navegador en:
👉 **`http://localhost:4200`**

---

## 👤 Usuarios de Prueba Preconfigurados en la BD

| Usuario | Contraseña | Rol / Permisos |
|---|---|---|
| **admin** | `Admin123!` | Admin completo (`admin`, `user`) con acceso a usuarios, roles y auditoría |
| **manager** | `Manager123!` | Gestor (`manager`, `user`) con acceso a lectura de usuarios y roles |
| **user** | `User123!` | Usuario estándar con acceso a su propio perfil y dashboard |

---

## 📁 Estructura del Proyecto Frontend

```
frontend/src/app/
├── core/
│   ├── guards/          # authGuard, guestGuard, roleGuard
│   ├── interceptors/    # jwtInterceptor, authInterceptor (auto-refresh 401)
│   ├── models/          # auth, user, role y audit TypeScript interfaces
│   └── services/        # auth, user, role y audit HTTP services
├── features/
│   ├── auth/            # login, register, verify-email, forgot-password, reset-password
│   └── dashboard/       # layout, overview, profile, users, roles, audit
└── shared/
    └── components/      # navbar, alert banners
```
