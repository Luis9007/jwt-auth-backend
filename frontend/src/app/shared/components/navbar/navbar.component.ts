import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16">
          <!-- Logo & Brand -->
          <div class="flex items-center space-x-8">
            <a routerLink="/dashboard" class="flex items-center space-x-3">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xl shadow-md shadow-indigo-100">
                ⚡
              </div>
              <div>
                <span class="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">JWT Auth</span>
                <span class="ml-1.5 px-2 py-0.5 text-xs font-semibold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">FastAPI</span>
              </div>
            </a>

            <!-- Nav Links -->
            <div class="hidden md:flex space-x-1">
              <a
                routerLink="/dashboard"
                routerLinkActive="bg-slate-100 text-indigo-700 font-semibold"
                [routerLinkActiveOptions]="{ exact: true }"
                class="px-3.5 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
              >
                Panel Principal
              </a>

              @if (canReadUsers()) {
                <a
                  routerLink="/dashboard/users"
                  routerLinkActive="bg-slate-100 text-indigo-700 font-semibold"
                  class="px-3.5 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  Usuarios
                </a>
              }

              @if (canReadRoles()) {
                <a
                  routerLink="/dashboard/roles"
                  routerLinkActive="bg-slate-100 text-indigo-700 font-semibold"
                  class="px-3.5 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  Roles y Permisos
                </a>
              }

              @if (canReadAudit()) {
                <a
                  routerLink="/dashboard/audit"
                  routerLinkActive="bg-slate-100 text-indigo-700 font-semibold"
                  class="px-3.5 py-2 rounded-lg text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  Auditoría
                </a>
              }
            </div>
          </div>

          <!-- User Profile & Actions -->
          <div class="flex items-center space-x-3">
            @if (user(); as u) {
              <a
                routerLink="/dashboard/profile"
                class="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
                title="Ver perfil"
              >
                <div class="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center font-medium text-xs uppercase">
                  {{ u.username.slice(0, 2) }}
                </div>
                <div class="text-left text-xs">
                  <div class="font-semibold text-slate-800">{{ u.username }}</div>
                  <div class="text-slate-500 truncate max-w-[120px]">{{ u.roles.join(', ') || 'sin rol' }}</div>
                </div>
              </a>

              <button
                (click)="logout()"
                type="button"
                class="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-slate-300 text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 rounded-lg text-sm font-medium transition-colors"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Salir</span>
              </button>
            }
          </div>
        </div>
      </div>
    </nav>
  `
})
export class NavbarComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  user = this.authService.currentUser;

  canReadUsers = computed(() => this.authService.hasPermission('users:read'));
  canReadRoles = computed(() => this.authService.hasPermission('roles:read'));
  canReadAudit = computed(() => this.authService.hasPermission('audit:read'));

  logout(): void {
    this.authService.logout().subscribe();
  }
}
