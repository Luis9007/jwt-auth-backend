import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../../core/services/user.service';
import { RoleService } from '../../../core/services/role.service';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/auth.models';
import { Role } from '../../../core/models/role.models';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, AlertComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Gestión de Usuarios</h1>
          <p class="text-sm text-slate-500 mt-1">
            Administra las cuentas de usuario, estados de verificación y roles asignados.
          </p>
        </div>

        <div class="flex items-center space-x-2">
          <input
            type="text"
            [(ngModel)]="searchQuery"
            (keyup.enter)="onSearch()"
            placeholder="Buscar por usuario o email..."
            class="px-3.5 py-2 border border-slate-300 rounded-xl text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500 w-64"
          />
          <button
            (click)="onSearch()"
            class="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition"
          >
            Buscar
          </button>
        </div>
      </div>

      <app-alert [type]="alertType" [message]="alertMessage"></app-alert>

      <!-- Users Table Card -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th class="py-3.5 px-4">Usuario</th>
                <th class="py-3.5 px-4">Email</th>
                <th class="py-3.5 px-4">Estado</th>
                <th class="py-3.5 px-4">Verificado</th>
                <th class="py-3.5 px-4">Roles</th>
                <th class="py-3.5 px-4">Registrado</th>
                <th class="py-3.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @if (loading) {
                <tr>
                  <td colspan="7" class="py-12 text-center text-sm text-slate-500">
                    <div class="inline-flex items-center space-x-2">
                      <svg class="animate-spin h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      <span>Cargando lista de usuarios...</span>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (user of users; track user.id) {
                  <tr class="hover:bg-slate-50/50 transition">
                    <td class="py-3.5 px-4">
                      <div class="font-medium text-slate-900">{{ user.username }}</div>
                      @if (user.full_name) {
                        <div class="text-xs text-slate-400">{{ user.full_name }}</div>
                      }
                    </td>
                    <td class="py-3.5 px-4 text-slate-600">{{ user.email }}</td>
                    <td class="py-3.5 px-4">
                      <button
                        (click)="toggleActive(user)"
                        [disabled]="!canWriteUsers()"
                        [title]="canWriteUsers() ? 'Haz clic para cambiar estado' : ''"
                        [class]="user.is_active ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-rose-100 text-rose-800 hover:bg-rose-200'"
                        class="px-2.5 py-0.5 rounded-full text-xs font-semibold transition"
                      >
                        {{ user.is_active ? 'Activo' : 'Inactivo' }}
                      </button>
                    </td>
                    <td class="py-3.5 px-4">
                      <button
                        (click)="toggleVerified(user)"
                        [disabled]="!canWriteUsers()"
                        [title]="canWriteUsers() ? 'Haz clic para cambiar verificación' : ''"
                        [class]="user.is_verified ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'"
                        class="px-2.5 py-0.5 rounded-full text-xs font-semibold transition"
                      >
                        {{ user.is_verified ? 'Sí' : 'No' }}
                      </button>
                    </td>
                    <td class="py-3.5 px-4">
                      <div class="flex flex-wrap gap-1">
                        @for (r of user.roles; track r) {
                          <span class="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-xs font-medium">
                            {{ r }}
                          </span>
                        } @empty {
                          <span class="text-xs text-slate-400 italic">-</span>
                        }
                      </div>
                    </td>
                    <td class="py-3.5 px-4 text-xs text-slate-500">
                      {{ user.created_at | date:'shortDate' }}
                    </td>
                    <td class="py-3.5 px-4 text-right space-x-2">
                      @if (canWriteRoles()) {
                        <button
                          (click)="openRoleModal(user)"
                          class="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition"
                        >
                          Roles
                        </button>
                      }
                      @if (canDeleteUsers()) {
                        <button
                          (click)="deleteUser(user)"
                          class="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition"
                        >
                          Eliminar
                        </button>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="py-8 text-center text-sm text-slate-400">
                      No se encontraron usuarios.
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Total: <span class="font-bold text-slate-700">{{ total }}</span> usuarios
          </div>
          <div class="space-x-2">
            <button
              (click)="prevPage()"
              [disabled]="offset === 0 || loading"
              class="px-3 py-1 bg-white border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50 transition"
            >
              Anterior
            </button>
            <button
              (click)="nextPage()"
              [disabled]="offset + limit >= total || loading"
              class="px-3 py-1 bg-white border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50 transition"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      <!-- Manage Roles Modal -->
      @if (selectedUserForRoles) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-slate-900">
                Roles de {{ selectedUserForRoles.username }}
              </h3>
              <button (click)="selectedUserForRoles = null" class="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <p class="text-xs text-slate-500">
              Activa o desactiva los roles que deseas asignar a este usuario:
            </p>

            <div class="space-y-2 py-2">
              @for (role of availableRoles; track role.id) {
                <label class="flex items-center space-x-3 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    [checked]="hasUserRole(selectedUserForRoles, role.name)"
                    (change)="toggleRoleAssignment(selectedUserForRoles, role, $event)"
                    class="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <div class="text-sm font-semibold text-slate-800">{{ role.name }}</div>
                    @if (role.description) {
                      <div class="text-xs text-slate-400">{{ role.description }}</div>
                    }
                  </div>
                </label>
              }
            </div>

            <div class="pt-2 flex justify-end">
              <button
                (click)="selectedUserForRoles = null"
                class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class UsersComponent implements OnInit {
  private userService = inject(UserService);
  private roleService = inject(RoleService);
  private authService = inject(AuthService);

  users: User[] = [];
  total = 0;
  limit = 15;
  offset = 0;
  searchQuery = '';
  loading = false;

  availableRoles: Role[] = [];
  selectedUserForRoles: User | null = null;

  alertMessage: string | null = null;
  alertType: 'error' | 'success' = 'success';

  canWriteUsers = () => this.authService.hasPermission('users:write');
  canDeleteUsers = () => this.authService.hasPermission('users:delete');
  canWriteRoles = () => this.authService.hasPermission('roles:write');

  ngOnInit(): void {
    this.loadUsers();
  }

  onSearch(): void {
    this.offset = 0;
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.alertMessage = null;

    this.userService.getUsers(this.limit, this.offset, this.searchQuery).subscribe({
      next: (page) => {
        this.loading = false;
        this.users = page.items;
        this.total = page.total;
      },
      error: (err) => {
        this.loading = false;
        this.alertType = 'error';
        this.alertMessage = err?.error?.detail || 'Error al cargar usuarios desde el servidor.';
      },
    });
  }

  loadRoles(): void {
    this.roleService.getRoles().subscribe({
      next: (roles) => (this.availableRoles = roles),
    });
  }

  prevPage(): void {
    if (this.offset >= this.limit) {
      this.offset -= this.limit;
      this.loadUsers();
    }
  }

  nextPage(): void {
    if (this.offset + this.limit < this.total) {
      this.offset += this.limit;
      this.loadUsers();
    }
  }

  toggleActive(user: User): void {
    if (!this.canWriteUsers()) return;
    const newStatus = !user.is_active;

    this.userService.updateUser(user.id, { is_active: newStatus }).subscribe({
      next: (updated) => {
        user.is_active = updated.is_active;
        this.alertType = 'success';
        this.alertMessage = `Estado de ${user.username} actualizado a ${newStatus ? 'Activo' : 'Inactivo'}.`;
      },
      error: (err) => {
        this.alertType = 'error';
        this.alertMessage = err?.error?.detail || 'No se pudo actualizar el estado.';
      },
    });
  }

  toggleVerified(user: User): void {
    if (!this.canWriteUsers()) return;
    const newStatus = !user.is_verified;

    this.userService.updateUser(user.id, { is_verified: newStatus }).subscribe({
      next: (updated) => {
        user.is_verified = updated.is_verified;
        this.alertType = 'success';
        this.alertMessage = `Verificación de ${user.username} actualizada a ${newStatus ? 'Verificado' : 'No verificado'}.`;
      },
      error: (err) => {
        this.alertType = 'error';
        this.alertMessage = err?.error?.detail || 'No se pudo actualizar la verificación.';
      },
    });
  }

  deleteUser(user: User): void {
    if (!confirm(`¿Estás seguro de eliminar permanentemente al usuario ${user.username}?`)) {
      return;
    }

    this.userService.deleteUser(user.id).subscribe({
      next: () => {
        this.alertType = 'success';
        this.alertMessage = `Usuario ${user.username} eliminado.`;
        this.loadUsers();
      },
      error: (err) => {
        this.alertType = 'error';
        this.alertMessage = err?.error?.detail || 'No se pudo eliminar el usuario.';
      },
    });
  }

  openRoleModal(user: User): void {
    this.selectedUserForRoles = user;
    if (this.availableRoles.length === 0) {
      this.loadRoles();
    }
  }

  hasUserRole(user: User, roleName: string): boolean {
    return user.roles.includes(roleName);
  }

  toggleRoleAssignment(user: User, role: Role, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;

    if (checked) {
      this.userService.assignRole(user.id, role.id).subscribe({
        next: () => {
          if (!user.roles.includes(role.name)) {
            user.roles.push(role.name);
          }
        },
        error: (err) => {
          (event.target as HTMLInputElement).checked = false;
          this.alertType = 'error';
          this.alertMessage = err?.error?.detail || 'Error al asignar el rol.';
        },
      });
    } else {
      this.userService.removeRole(user.id, role.id).subscribe({
        next: () => {
          user.roles = user.roles.filter((r) => r !== role.name);
        },
        error: (err) => {
          (event.target as HTMLInputElement).checked = true;
          this.alertType = 'error';
          this.alertMessage = err?.error?.detail || 'Error al remover el rol.';
        },
      });
    }
  }
}
