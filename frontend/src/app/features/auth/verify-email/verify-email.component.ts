import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AlertComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="flex justify-center">
          <div class="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-200">
            ✉️
          </div>
        </div>
        <h2 class="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          Verificar Correo
        </h2>
        <p class="mt-2 text-center text-sm text-slate-600">
          Ingresa el token de verificación recibido
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <app-alert [type]="alertType" [message]="message" [devToken]="devToken"></app-alert>

          <!-- Form to verify token -->
          <form [formGroup]="verifyForm" (ngSubmit)="onVerify()" class="space-y-4">
            <div>
              <label for="token" class="block text-sm font-medium text-slate-700">Token de verificación</label>
              <input
                id="token"
                type="text"
                formControlName="token"
                placeholder="Pega aquí el token recibido"
                class="mt-1 block w-full px-3.5 py-2 border border-slate-300 rounded-xl font-mono text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              [disabled]="verifyForm.invalid || verifying"
              class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              @if (verifying) {
                <span>Verificando...</span>
              } @else {
                <span>Confirmar Verificación</span>
              }
            </button>
          </form>

          <!-- Resend section -->
          <div class="mt-8 pt-6 border-t border-slate-200">
            <h3 class="text-sm font-semibold text-slate-800 mb-2">¿No recibiste el token?</h3>
            <form [formGroup]="resendForm" (ngSubmit)="onResend()" class="space-y-3">
              <div>
                <input
                  type="email"
                  formControlName="email"
                  placeholder="Introduce tu correo"
                  class="block w-full px-3 py-2 border border-slate-300 rounded-xl text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <button
                type="submit"
                [disabled]="resendForm.invalid || resending"
                class="w-full py-2 px-3 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                @if (resending) {
                  <span>Reenviando...</span>
                } @else {
                  <span>Reenviar correo de verificación</span>
                }
              </button>
            </form>
          </div>

          <div class="mt-6 text-center text-sm">
            <a routerLink="/auth/login" class="font-semibold text-indigo-600 hover:text-indigo-500">
              ← Volver al inicio de sesión
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class VerifyEmailComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  verifyForm = this.fb.nonNullable.group({
    token: ['', [Validators.required]],
  });

  resendForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  verifying = false;
  resending = false;
  message: string | null = null;
  devToken: string | null = null;
  alertType: 'error' | 'success' | 'info' = 'info';

  constructor() {
    this.route.queryParams.subscribe((params) => {
      if (params['token']) {
        this.verifyForm.patchValue({ token: params['token'] });
      }
    });
  }

  onVerify(): void {
    if (this.verifyForm.invalid) return;

    this.verifying = true;
    this.message = null;
    this.devToken = null;

    this.authService.verifyEmail(this.verifyForm.getRawValue().token).subscribe({
      next: (res) => {
        this.verifying = false;
        this.alertType = 'success';
        this.message = res.detail || '¡Correo verificado con éxito! Ahora puedes iniciar sesión.';
        setTimeout(() => this.router.navigate(['/auth/login']), 2500);
      },
      error: (err) => {
        this.verifying = false;
        this.alertType = 'error';
        this.message = err?.error?.detail || 'Token de verificación inválido o expirado.';
      },
    });
  }

  onResend(): void {
    if (this.resendForm.invalid) return;

    this.resending = true;
    this.message = null;
    this.devToken = null;

    this.authService.resendVerification(this.resendForm.getRawValue().email).subscribe({
      next: (res) => {
        this.resending = false;
        this.alertType = 'info';
        this.message = res.detail;
        if (res.dev_token) {
          this.devToken = res.dev_token;
          this.verifyForm.patchValue({ token: res.dev_token });
        }
      },
      error: (err) => {
        this.resending = false;
        this.alertType = 'error';
        this.message = err?.error?.detail || 'Error al solicitar el reenvío.';
      },
    });
  }
}
