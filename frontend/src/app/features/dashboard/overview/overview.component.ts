import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="space-y-6">
      <!-- Welcome Header -->
      <div class="bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur text-xs font-semibold uppercase tracking-wider text-indigo-100 mb-3">
            <span>✨ Sesión Activa</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Hola, {{ user()?.full_name || user()?.username }} 👋
          </h1>
          <p class="mt-2 text-indigo-100 text-sm max-w-xl">
            Bienvenido a la consola de administración. Tu sesión utiliza JWT de corta duración (15 min) con rotación automática de refresh token (7 días).
          </p>
        </div>

        <div class="flex flex-wrap gap-2">
          <a
            routerLink="/dashboard/profile"
            class="px-4 py-2.5 bg-white text-indigo-700 hover:bg-indigo-50 font-semibold text-sm rounded-xl shadow transition"
          >
            Editar Perfil
          </a>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Status Card -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Estado de la Cuenta</div>
            <div class="mt-4 flex items-center space-x-3">
              <span
                [class]="user()?.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'"
                class="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center space-x-1"
              >
                <span>●</span>
                <span>{{ user()?.is_active ? 'Activa' : 'Inactiva' }}</span>
              </span>

              <span
                [class]="user()?.is_verified ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'"
                class="px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center space-x-1"
              >
                <span>{{ user()?.is_verified ? '✓ Email Verificado' : '⚠ Email No Verificado' }}</span>
              </span>
            </div>
            <div class="mt-4 text-xs text-slate-500">
              <span class="font-medium text-slate-700">Email:</span> {{ user()?.email }}
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
            Usuario desde: {{ user()?.created_at | date:'mediumDate' }}
          </div>
        </div>

        <!-- Roles Card -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Roles Asignados (RBAC)</div>
            <div class="mt-3 flex flex-wrap gap-2">
              @for (role of user()?.roles; track role) {
                <span class="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wide">
                  🛡️ {{ role }}
                </span>
              } @empty {
                <span class="text-xs text-slate-400 italic">Sin roles asignados</span>
              }
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
            Los roles se evalúan en cada solicitud HTTP en el backend.
          </div>
        </div>

        <!-- Last Login Card -->
        <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">Último Inicio de Sesión</div>
            <div class="mt-3 text-lg font-bold text-slate-800">
              {{ (user()?.last_login_at | date:'medium') || 'Primera sesión' }}
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
            IP y User-Agent auditados en Supabase
          </div>
        </div>
      </div>

      <!-- Permissions Breakdown -->
      <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h2 class="text-base font-bold text-slate-900 mb-2">Permisos Efectivos</h2>
        <p class="text-xs text-slate-500 mb-4">
          Permisos agregados resultantes de todos los roles asignados a tu cuenta:
        </p>

        <div class="flex flex-wrap gap-2">
          @for (perm of user()?.permissions; track perm) {
            <span class="px-2.5 py-1 bg-slate-100 text-slate-700 font-mono text-xs rounded-md border border-slate-200">
              {{ perm }}
            </span>
          } @empty {
            <span class="text-xs text-slate-400 italic">No tienes permisos especiales en este momento</span>
          }
        </div>
      </div>

      <!-- Quick Navigation Modules -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        @if (canReadUsers()) {
          <a
            routerLink="/dashboard/users"
            class="group p-6 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-2xl shadow-sm transition block"
          >
            <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg mb-3 group-hover:scale-105 transition">
              👥
            </div>
            <h3 class="font-bold text-slate-900 group-hover:text-indigo-600 transition">Gestión de Usuarios</h3>
            <p class="text-xs text-slate-500 mt-1">
              Ver usuarios registrados, asignar roles, activar/desactivar y borrar cuentas.
            </p>
          </a>
        }

        @if (canReadRoles()) {
          <a
            routerLink="/dashboard/roles"
            class="group p-6 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-2xl shadow-sm transition block"
          >
            <div class="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-lg mb-3 group-hover:scale-105 transition">
              🛡️
            </div>
            <h3 class="font-bold text-slate-900 group-hover:text-violet-600 transition">Roles y Permisos</h3>
            <p class="text-xs text-slate-500 mt-1">
              Explorar el catálogo de permisos y configurar roles RBAC del sistema.
            </p>
          </a>
        }

        @if (canReadAudit()) {
          <a
            routerLink="/dashboard/audit"
            class="group p-6 bg-white hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 rounded-2xl shadow-sm transition block"
          >
            <div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg mb-3 group-hover:scale-105 transition">
              📜
            </div>
            <h3 class="font-bold text-slate-900 group-hover:text-emerald-600 transition">Logs de Auditoría</h3>
            <p class="text-xs text-slate-500 mt-1">
              Registro histórico de logins, intentos bloqueados, cambios de contraseña y roles.
            </p>
          </a>
        }
      </div>
    </div>
  `
})
export class OverviewComponent {
  private authService = inject(AuthService);

  user = this.authService.currentUser;

  canReadUsers = computed(() => this.authService.hasPermission('users:read'));
  canReadRoles = computed(() => this.authService.hasPermission('roles:read'));
  canReadAudit = computed(() => this.authService.hasPermission('audit:read'));
}
