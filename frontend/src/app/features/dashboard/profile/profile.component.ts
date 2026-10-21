import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
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
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertComponent],
  template: `
    <div class="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Mi Perfil</h1>
        <p class="text-sm text-slate-500 mt-1">
          Gestiona tu información personal y opciones de seguridad
        </p>
      </div>

      <!-- Account Info & Full Name Update -->
      <div class="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <h2 class="text-lg font-bold text-slate-900 mb-4">Información de la Cuenta</h2>

        <app-alert [type]="profileAlertType" [message]="profileMessage"></app-alert>

        <form [formGroup]="profileForm" (ngSubmit)="onUpdateProfile()" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Usuario</label>
              <input
                type="text"
                [value]="user()?.username"
                disabled
                class="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Correo Electrónico</label>
              <input
                type="email"
                [value]="user()?.email"
                disabled
                class="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label for="full_name" class="block text-xs font-semibold uppercase text-slate-700 mb-1">Nombre Completo</label>
            <input
              id="full_name"
              type="text"
              formControlName="full_name"
              placeholder="Tu nombre completo"
              class="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div class="flex justify-end pt-2">
            <button
              type="submit"
              [disabled]="profileForm.invalid || savingProfile"
              class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow transition"
            >
              {{ savingProfile ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Change Password Section -->
      <div class="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <h2 class="text-lg font-bold text-slate-900 mb-2">Cambiar Contraseña</h2>
        <p class="text-xs text-slate-500 mb-4">
          Cambiar tu contraseña revocará tus demás sesiones activas por seguridad.
        </p>

        <app-alert [type]="passwordAlertType" [message]="passwordMessage"></app-alert>

        <form [formGroup]="passwordForm" (ngSubmit)="onChangePassword()" class="space-y-4 max-w-lg">
          <div>
            <label for="current_password" class="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Contraseña Actual
            </label>
            <input
              id="current_password"
              type="password"
              formControlName="current_password"
              placeholder="••••••••"
              class="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label for="new_password" class="block text-xs font-semibold uppercase text-slate-700 mb-1">
              Nueva Contraseña
            </label>
            <input
              id="new_password"
              type="password"
              formControlName="new_password"
              placeholder="Mínimo 8 caracteres (letras y números)"
              class="block w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div class="flex justify-end pt-2">
            <button
              type="submit"
              [disabled]="passwordForm.invalid || changingPassword"
              class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow transition"
            >
              {{ changingPassword ? 'Actualizando...' : 'Actualizar Contraseña' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Security & Sessions -->
      <div class="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <h2 class="text-lg font-bold text-slate-900 mb-2">Sesiones y Seguridad</h2>
        <p class="text-xs text-slate-500 mb-4">
          Cierra sesión en todos los navegadores y dispositivos donde tu cuenta esté abierta actualmente.
        </p>

        <button
          type="button"
          (click)="onLogoutAll()"
          class="px-4 py-2.5 border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-sm font-semibold transition"
        >
          Cerrar todas mis sesiones activas (Logout Global)
        </button>
      </div>
    </div>
  `
})
export class ProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private userService = inject(UserService);

  user = this.authService.currentUser;

  profileForm = this.fb.group({
    full_name: [''],
  });

  passwordForm = this.fb.group({
    current_password: ['', [Validators.required]],
    new_password: ['', [Validators.required, passwordValidator]],
  });

  savingProfile = false;
  profileMessage: string | null = null;
  profileAlertType: 'error' | 'success' = 'success';

  changingPassword = false;
  passwordMessage: string | null = null;
  passwordAlertType: 'error' | 'success' = 'success';

  ngOnInit(): void {
    const u = this.user();
    if (u) {
      this.profileForm.patchValue({ full_name: u.full_name || '' });
    }
  }

  onUpdateProfile(): void {
    this.savingProfile = true;
    this.profileMessage = null;

    const full_name = this.profileForm.value.full_name || null;

    this.userService.updateMe({ full_name }).subscribe({
      next: (updatedUser) => {
        this.savingProfile = false;
        this.authService.setCurrentUser(updatedUser);
        this.profileAlertType = 'success';
        this.profileMessage = 'Perfil actualizado con éxito.';
      },
      error: (err) => {
        this.savingProfile = false;
        this.profileAlertType = 'error';
        this.profileMessage = err?.error?.detail || 'Error al actualizar el perfil.';
      },
    });
  }

  onChangePassword(): void {
    if (this.passwordForm.invalid) return;

    this.changingPassword = true;
    this.passwordMessage = null;

    const val = this.passwordForm.getRawValue();

    this.authService
      .changePassword({
        current_password: val.current_password!,
        new_password: val.new_password!,
      })
      .subscribe({
        next: (res) => {
          this.changingPassword = false;
          this.passwordAlertType = 'success';
          this.passwordMessage = res.detail || 'Contraseña cambiada con éxito. Las demás sesiones fueron revocadas.';
          this.passwordForm.reset();
        },
        error: (err) => {
          this.changingPassword = false;
          this.passwordAlertType = 'error';
          this.passwordMessage = err?.error?.detail || 'No se pudo cambiar la contraseña. Verifica la contraseña actual.';
        },
      });
  }

  onLogoutAll(): void {
    if (confirm('¿Estás seguro de que deseas cerrar todas tus sesiones activas?')) {
      this.authService.logoutAll().subscribe();
    }
  }
}
