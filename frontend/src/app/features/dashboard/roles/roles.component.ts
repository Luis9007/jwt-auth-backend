import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RoleService } from '../../../core/services/role.service';
import { AuthService } from '../../../core/services/auth.service';
import { Permission, Role } from '../../../core/models/role.models';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AlertComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Roles y Permisos</h1>
          <p class="text-sm text-slate-500 mt-1">
            Administración del control de acceso basado en roles (RBAC)
          </p>
        </div>

        @if (canWriteRoles()) {
          <button
            (click)="showCreateModal = true"
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow transition"
          >
            + Crear Nuevo Rol
          </button>
        }
      </div>

      <app-alert [type]="alertType" [message]="alertMessage"></app-alert>

      <!-- Roles Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        @for (role of roles; track role.id) {
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold uppercase tracking-wide">
                  🛡️ {{ role.name }}
                </span>
                <span class="text-xs text-slate-400">ID: {{ role.id }}</span>
              </div>

              <p class="text-xs text-slate-600 mb-4 min-h-[32px]">
                {{ role.description || 'Sin descripción' }}
              </p>

              <div>
                <div class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Permisos ({{ role.permissions.length }})
                </div>
                <div class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                  @for (perm of role.permissions; track perm.id) {
                    <span class="px-2 py-0.5 bg-slate-100 text-slate-700 font-mono text-[11px] rounded border border-slate-200" [title]="perm.description || perm.code">
                      {{ perm.code }}
                    </span>
                  } @empty {
                    <span class="text-xs text-slate-400 italic">Sin permisos asignados</span>
                  }
                </div>
              </div>
            </div>

            @if (canWriteRoles()) {
              <div class="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                <button
                  (click)="openEditPermissions(role)"
                  class="px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition"
                >
                  Modificar Permisos
                </button>
              </div>
            }
          </div>
        }
      </div>

      <!-- Create Role Modal -->
      @if (showCreateModal) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-bold text-slate-900">Crear Rol</h3>
              <button (click)="showCreateModal = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <form [formGroup]="createRoleForm" (ngSubmit)="onCreateRole()" class="space-y-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Nombre (identificador)</label>
                <input
                  type="text"
                  formControlName="name"
                  placeholder="ej. editor, auditor"
                  class="block w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
                <span class="text-[11px] text-slate-400">Minúsculas, letras y números (ej. operador_2)</span>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 uppercase mb-1">Descripción</label>
                <input
                  type="text"
                  formControlName="description"
                  placeholder="Descripción de la función de este rol"
                  class="block w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div class="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  (click)="showCreateModal = false"
                  class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="createRoleForm.invalid"
                  class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Edit Permissions Modal -->
      @if (editingRole) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-bold text-slate-900">
                  Permisos para {{ editingRole.name }}
                </h3>
                <p class="text-xs text-slate-500">Selecciona los permisos que otorgará este rol</p>
              </div>
              <button (click)="editingRole = null" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div class="overflow-y-auto space-y-2 py-2 flex-1">
              @for (perm of allPermissions; track perm.id) {
                <label class="flex items-start space-x-3 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="checkbox"
                    [checked]="selectedPermCodes.has(perm.code)"
                    (change)="togglePermSelection(perm.code, $event)"
                    class="h-4 w-4 mt-0.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <div class="text-xs font-mono font-bold text-slate-900">{{ perm.code }}</div>
                    @if (perm.description) {
                      <div class="text-xs text-slate-500">{{ perm.description }}</div>
                    }
                  </div>
                </label>
              }
            </div>

            <div class="pt-3 border-t border-slate-100 flex justify-end space-x-2">
              <button
                (click)="editingRole = null"
                class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Cancelar
              </button>
              <button
                (click)="saveRolePermissions()"
                class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition"
              >
                Guardar Permisos
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class RolesComponent implements OnInit {
  private roleService = inject(RoleService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  roles: Role[] = [];
  allPermissions: Permission[] = [];

  showCreateModal = false;
  createRoleForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/^[a-z][a-z0-9_]{1,31}$/)]],
    description: [''],
  });

  editingRole: Role | null = null;
  selectedPermCodes = new Set<string>();

  alertMessage: string | null = null;
  alertType: 'error' | 'success' = 'success';

  canWriteRoles = () => this.authService.hasPermission('roles:write');

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.roleService.getRoles().subscribe({
      next: (roles) => (this.roles = roles),
      error: (err) => {
        this.alertType = 'error';
        this.alertMessage = err?.error?.detail || 'Error al obtener roles.';
      },
    });

    this.roleService.getPermissions().subscribe({
      next: (perms) => (this.allPermissions = perms),
    });
  }

  onCreateRole(): void {
    if (this.createRoleForm.invalid) return;

    const val = this.createRoleForm.getRawValue();
    this.roleService
      .createRole({ name: val.name, description: val.description || null })
      .subscribe({
        next: (created) => {
          this.roles.push(created);
          this.showCreateModal = false;
          this.createRoleForm.reset();
          this.alertType = 'success';
          this.alertMessage = `Rol '${created.name}' creado exitosamente.`;
        },
        error: (err) => {
          this.alertType = 'error';
          this.alertMessage = err?.error?.detail || 'Error al crear el rol.';
        },
      });
  }

  openEditPermissions(role: Role): void {
    this.editingRole = role;
    this.selectedPermCodes = new Set(role.permissions.map((p) => p.code));
  }

  togglePermSelection(code: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedPermCodes.add(code);
    } else {
      this.selectedPermCodes.delete(code);
    }
  }

  saveRolePermissions(): void {
    if (!this.editingRole) return;

    const roleId = this.editingRole.id;
    const codes = Array.from(this.selectedPermCodes);

    this.roleService.setRolePermissions(roleId, codes).subscribe({
      next: (updatedRole) => {
        const index = this.roles.findIndex((r) => r.id === roleId);
        if (index !== -1) {
          this.roles[index] = updatedRole;
        }
        this.editingRole = null;
        this.alertType = 'success';
        this.alertMessage = `Permisos de '${updatedRole.name}' actualizados.`;
      },
      error: (err) => {
        this.alertType = 'error';
        this.alertMessage = err?.error?.detail || 'Error al actualizar permisos.';
      },
    });
  }
}
