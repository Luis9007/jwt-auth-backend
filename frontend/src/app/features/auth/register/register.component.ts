import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

function passwordValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value || '';
  if (!value) return null;
  const hasLetter = /[a-zA-Z]/.test(value);
  const hasNumber = /\d/.test(value);
  const hasMinLength = value.length >= 8;

  if (!hasMinLength || !hasLetter || !hasNumber) {
    return { invalidPasswordStrength: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AlertComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="flex justify-center">
          <div class="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-200">
            ✨
          </div>
        </div>
        <h2 class="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          Crear cuenta
        </h2>
        <p class="mt-2 text-center text-sm text-slate-600">
          Únete y obtén acceso seguro con roles y permisos
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <app-alert [type]="alertType" [message]="message" [devToken]="devToken"></app-alert>

          @if (registeredSuccess) {
            <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
              <div class="text-emerald-700 font-semibold text-base">¡Registro completado!</div>
              <p class="text-xs text-slate-600">
                Tu usuario ha sido registrado. Si la verificación de correo está habilitada, deberás verificar tu token antes de iniciar sesión.
              </p>
              @if (devToken) {
                <div class="pt-2">
                  <a
                    [routerLink]="['/auth/verify-email']"
                    [queryParams]="{ token: devToken }"
                    class="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow transition"
                  >
                    Verificar mi correo ahora
                  </a>
                </div>
              } @else {
                <div class="pt-2">
                  <a
                    routerLink="/auth/login"
                    class="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition"
                  >
                    Ir a Iniciar Sesión
                  </a>
                </div>
              }
            </div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
              <div>
                <label for="username" class="block text-sm font-medium text-slate-700">Nombre de usuario</label>
                <input
                  id="username"
                  type="text"
                  formControlName="username"
                  placeholder="ej. juan_perez"
                  class="mt-1 block w-full px-3.5 py-2 border border-slate-300 rounded-xl shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  [class.border-rose-400]="isFieldInvalid('username')"
                />
                @if (isFieldInvalid('username')) {
                  <p class="mt-1 text-xs text-rose-600">
                    Debe tener entre 3 y 32 caracteres (solo letras, números, guión y punto).
                  </p>
                }
              </div>

              <div>
                <label for="email" class="block text-sm font-medium text-slate-700">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  placeholder="juan@example.com"
                  class="mt-1 block w-full px-3.5 py-2 border border-slate-300 rounded-xl shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  [class.border-rose-400]="isFieldInvalid('email')"
                />
                @if (isFieldInvalid('email')) {
                  <p class="mt-1 text-xs text-rose-600">Introduce un correo electrónico válido.</p>
                }
              </div>

              <div>
                <label for="full_name" class="block text-sm font-medium text-slate-700">Nombre completo (opcional)</label>
                <input
                  id="full_name"
                  type="text"
                  formControlName="full_name"
                  placeholder="Juan Pérez"
                  class="mt-1 block w-full px-3.5 py-2 border border-slate-300 rounded-xl shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label for="password" class="block text-sm font-medium text-slate-700">Contraseña</label>
                <input
                  id="password"
                  [type]="showPassword ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="Mínimo 8 caracteres, letras y números"
                  class="mt-1 block w-full px-3.5 py-2 border border-slate-300 rounded-xl shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
                  [class.border-rose-400]="isFieldInvalid('password')"
                />
                <div class="mt-1 flex items-center justify-between text-xs text-slate-500">
                  <span>Mínimo 8 caracteres (al menos 1 letra y 1 número)</span>
                  <button type="button" (click)="showPassword = !showPassword" class="text-indigo-600 hover:underline">
                    {{ showPassword ? 'Ocultar' : 'Ver' }}
                  </button>
                </div>
                @if (isFieldInvalid('password')) {
                  <p class="mt-1 text-xs text-rose-600">
                    La contraseña no cumple con los requisitos mínimos de seguridad.
                  </p>
                }
              </div>

              <div class="pt-2">
                <button
                  type="submit"
                  [disabled]="form.invalid || loading"
                  class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  @if (loading) {
                    <span>Registrando...</span>
                  } @else {
                    <span>Registrarme</span>
                  }
                </button>
              </div>
            </form>
          }

          <div class="mt-6 border-t border-slate-200 pt-6 text-center text-sm">
            <span class="text-slate-600">¿Ya tienes una cuenta?</span>
            <a routerLink="/auth/login" class="ml-1 font-semibold text-indigo-600 hover:text-indigo-500">
              Inicia sesión
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9_.-]{3,32}$/)]],
    email: ['', [Validators.required, Validators.email]],
    full_name: [''],
    password: ['', [Validators.required, passwordValidator]],
  });

  loading = false;
  showPassword = false;
  message: string | null = null;
  devToken: string | null = null;
  alertType: 'error' | 'success' | 'info' = 'error';
  registeredSuccess = false;

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.message = null;
    this.devToken = null;

    const val = this.form.getRawValue();
    this.authService
      .register({
        email: val.email,
        username: val.username,
        password: val.password,
        full_name: val.full_name || null,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.registeredSuccess = true;
          this.devToken = res.dev_verification_token || null;
          this.alertType = 'success';
          this.message = '¡Usuario creado exitosamente!';
        },
        error: (err) => {
          this.loading = false;
          this.alertType = 'error';
          this.message = err?.error?.detail || 'Ocurrió un error al registrar el usuario.';
        },
      });
  }
}
