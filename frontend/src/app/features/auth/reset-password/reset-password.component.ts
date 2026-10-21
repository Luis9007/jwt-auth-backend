import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AlertComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-indigo-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="flex justify-center">
          <div class="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-200">
            🔒
          </div>
        </div>
        <h2 class="mt-4 text-center text-3xl font-extrabold tracking-tight text-slate-900">
          Nueva Contraseña
        </h2>
        <p class="mt-2 text-center text-sm text-slate-600">
          Ingresa el token de reseteo y define tu nueva contraseña
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <app-alert [type]="alertType" [message]="message"></app-alert>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label for="token" class="block text-sm font-medium text-slate-700">Token de reseteo</label>
              <input
                id="token"
                type="text"
                formControlName="token"
                placeholder="Pega aquí el token recibido"
                class="mt-1 block w-full px-3.5 py-2 border border-slate-300 rounded-xl font-mono text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label for="new_password" class="block text-sm font-medium text-slate-700">Nueva contraseña</label>
              <input
                id="new_password"
                type="password"
                formControlName="new_password"
                placeholder="Mínimo 8 caracteres (letras y números)"
                class="mt-1 block w-full px-3.5 py-2 border border-slate-300 rounded-xl shadow-sm text-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
              @if (form.get('new_password')?.invalid && (form.get('new_password')?.dirty || form.get('new_password')?.touched)) {
                <p class="mt-1 text-xs text-rose-600">
                  La contraseña debe tener al menos 8 caracteres y contener letras y números.
                </p>
              }
            </div>

            <button
              type="submit"
              [disabled]="form.invalid || loading"
              class="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              @if (loading) {
                <span>Actualizando contraseña...</span>
              } @else {
                <span>Guardar nueva contraseña</span>
              }
            </button>
          </form>

          <div class="mt-6 border-t border-slate-200 pt-6 text-center text-sm">
            <a routerLink="/auth/login" class="font-semibold text-indigo-600 hover:text-indigo-500">
              ← Volver a Iniciar Sesión
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ResetPasswordComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  form = this.fb.nonNullable.group({
    token: ['', [Validators.required]],
    new_password: ['', [Validators.required, passwordValidator]],
  });

  loading = false;
  message: string | null = null;
  alertType: 'error' | 'success' = 'error';

  constructor() {
    this.route.queryParams.subscribe((params) => {
      if (params['token']) {
        this.form.patchValue({ token: params['token'] });
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading = true;
    this.message = null;

    this.authService.resetPassword(this.form.getRawValue()).subscribe({
      next: (res) => {
        this.loading = false;
        this.alertType = 'success';
        this.message = res.detail || '¡Contraseña restablecida con éxito! Redirigiendo a inicio de sesión...';
        setTimeout(() => this.router.navigate(['/auth/login']), 2000);
      },
      error: (err) => {
        this.loading = false;
        this.alertType = 'error';
        this.message = err?.error?.detail || 'Token inválido o expirado.';
      },
    });
  }
}
