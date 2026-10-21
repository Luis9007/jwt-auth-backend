import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AlertComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="flex justify-center">
          <div class="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-200">
            ⚡
          </div>
        </div>
        <h2 class="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          Iniciar sesión
        </h2>
        <p class="mt-2 text-center text-sm text-slate-600">
          Conéctate al backend FastAPI con autenticación JWT segura
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <app-alert [type]="alertType" [message]="errorMessage" [devToken]="null"></app-alert>

          <!-- Quick Test Credentials Buttons -->
          <div class="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
            <div class="font-semibold text-slate-700 mb-2">Cuentas de prueba rápida (BD):</div>
            <div class="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                (click)="fillCredentials('admin', 'Admin123!')"
                class="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 rounded font-medium transition text-center"
              >
                👑 admin
              </button>
              <button
                type="button"
                (click)="fillCredentials('manager', 'Manager123!')"
                class="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 rounded font-medium transition text-center"
              >
                💼 manager
              </button>
              <button
                type="button"
                (click)="fillCredentials('user', 'User123!')"
                class="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 rounded font-medium transition text-center"
              >
                👤 user
              </button>
            </div>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-5">
            <div>
              <label for="identifier" class="block text-sm font-medium text-slate-700">
                Usuario o Email
              </label>
              <div class="mt-1">
                <input
                  id="identifier"
                  type="text"
                  formControlName="identifier"
                  autocomplete="username"
                  placeholder="ej. admin o admin@example.com"
                  class="appearance-none block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  [class.border-rose-400]="isFieldInvalid('identifier')"
                />
              </div>
              @if (isFieldInvalid('identifier')) {
                <p class="mt-1 text-xs text-rose-600">Ingresa tu usuario o email</p>
              }
            </div>

            <div>
              <div class="flex items-center justify-between">
                <label for="password" class="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <a routerLink="/auth/forgot-password" class="text-xs font-semibold text-indigo-600 hover:text-indigo-500">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div class="mt-1 relative">
                <input
                  id="password"
                  [type]="showPassword ? 'text' : 'password'"
                  formControlName="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="appearance-none block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  [class.border-rose-400]="isFieldInvalid('password')"
                />
                <button
                  type="button"
                  (click)="showPassword = !showPassword"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-slate-600"
                >
                  {{ showPassword ? 'Ocultar' : 'Ver' }}
                </button>
              </div>
              @if (isFieldInvalid('password')) {
                <p class="mt-1 text-xs text-rose-600">La contraseña es obligatoria</p>
              }
            </div>

            <div>
              <button
                type="submit"
                [disabled]="form.invalid || loading"
                class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                @if (loading) {
                  <span class="inline-flex items-center space-x-2">
                    <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Accediendo...</span>
                  </span>
                } @else {
                  <span>Iniciar sesión</span>
                }
              </button>
            </div>
          </form>

          <div class="mt-6 border-t border-slate-200 pt-6 text-center text-sm">
            <span class="text-slate-600">¿No tienes cuenta?</span>
            <a routerLink="/auth/register" class="ml-1 font-semibold text-indigo-600 hover:text-indigo-500">
              Crear cuenta nueva
            </a>
          </div>

          <div class="mt-2 text-center text-xs text-slate-500">
            <a routerLink="/auth/verify-email" class="hover:underline">
              ¿Necesitas verificar tu correo? Haz clic aquí
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  loading = false;
  showPassword = false;
  errorMessage: string | null = null;
  alertType: 'error' | 'warning' | 'info' = 'error';

  constructor() {
    this.route.queryParams.subscribe((params) => {
      if (params['sessionExpired']) {
        this.errorMessage = 'Tu sesión ha expirado o el token fue revocado. Inicia sesión nuevamente.';
        this.alertType = 'warning';
      } else if (params['registered']) {
        this.errorMessage = '¡Cuenta registrada con éxito! Si requiere verificación, revisa tu correo o introduce el token.';
        this.alertType = 'info';
      }
    });
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  fillCredentials(identifier: string, pass: string): void {
    this.form.patchValue({ identifier, password: pass });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = null;

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.loading = false;
        this.alertType = 'error';
        const detail = err?.error?.detail;

        if (err.status === 423) {
          this.errorMessage = detail || 'Cuenta temporalmente bloqueada por demasiados intentos fallidos. Intenta más tarde.';
        } else if (err.status === 403) {
          this.errorMessage = detail || 'Acceso denegado: cuenta no verificada o inactiva.';
        } else if (err.status === 401) {
          this.errorMessage = detail || 'Credenciales incorrectas. Verifica usuario/correo y contraseña.';
        } else {
          this.errorMessage = detail || 'Error al conectar con el servidor. Revisa si el backend FastAPI está encendido.';
        }
      },
    });
  }
}
