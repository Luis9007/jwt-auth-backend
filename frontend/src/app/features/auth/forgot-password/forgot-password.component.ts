import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AlertComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="flex justify-center">
          <div class="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-200">
            🔑
          </div>
        </div>
        <h2 class="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          Recuperar Contraseña
        </h2>
        <p class="mt-2 text-center text-sm text-slate-600">
          Ingresa tu correo para recibir un token de recuperación
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <app-alert [type]="alertType" [message]="message" [devToken]="devToken"></app-alert>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label for="email" class="block text-sm font-medium text-slate-700">Correo electrónico</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                placeholder="tu-correo@example.com"
                class="mt-1 block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              [disabled]="form.invalid || loading"
              class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              @if (loading) {
                <span>Enviando solicitud...</span>
              } @else {
                <span>Enviar Instrucciones</span>
              }
            </button>
          </form>

          @if (devToken) {
            <div class="mt-5 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center">
              <a
                [routerLink]="['/auth/reset-password']"
                [queryParams]="{ token: devToken }"
                class="text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline"
              >
                👉 Ir directamente al formulario de reseteo con este token
              </a>
            </div>
          }

          <div class="mt-6 border-t border-slate-200 pt-6 text-center text-sm">
            <a routerLink="/auth/login" class="font-semibold text-indigo-600 hover:text-indigo-500">
              ← Regresar a Iniciar Sesión
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  loading = false;
  message: string | null = null;
  devToken: string | null = null;
  alertType: 'error' | 'success' | 'info' = 'info';

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.message = null;
    this.devToken = null;

    this.authService.forgotPassword(this.form.getRawValue().email).subscribe({
      next: (res) => {
        this.loading = false;
        this.alertType = 'info';
        this.message = res.detail;
        this.devToken = res.dev_token || null;
      },
      error: (err) => {
        this.loading = false;
        this.alertType = 'error';
        this.message = err?.error?.detail || 'Error al procesar la solicitud.';
      },
    });
  }
}
