import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChangePasswordRequest,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  TokenPair,
  User,
} from '../models/auth.models';

const ACCESS_TOKEN_KEY = 'jwt_access_token';
const REFRESH_TOKEN_KEY = 'jwt_refresh_token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly apiUrl = environment.apiUrl;

  private currentUserSignal = signal<User | null>(null);
  private accessTokenSignal = signal<string | null>(this.getStoredAccessToken());
  private isLoadedSignal = signal<boolean>(false);

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly isLoaded = this.isLoadedSignal.asReadonly();
  readonly isAuthenticated = computed(() => !!this.accessTokenSignal());
  readonly roles = computed(() => this.currentUserSignal()?.roles ?? []);
  readonly permissions = computed(() => this.currentUserSignal()?.permissions ?? []);

  constructor() {
    if (this.accessTokenSignal()) {
      this.fetchCurrentUser().subscribe({
        error: () => this.clearSession(),
      });
    } else {
      this.isLoadedSignal.set(true);
    }
  }

  getStoredAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getStoredRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  private saveTokens(tokens: TokenPair): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    this.accessTokenSignal.set(tokens.access_token);
  }

  clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    this.accessTokenSignal.set(null);
    this.currentUserSignal.set(null);
    this.isLoadedSignal.set(true);
  }

  login(credentials: LoginRequest): Observable<User> {
    return this.http.post<TokenPair>(`${this.apiUrl}/auth/login`, credentials).pipe(
      tap((tokens) => this.saveTokens(tokens)),
      switchMap(() => this.fetchCurrentUser())
    );
  }

  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/auth/register`, data);
  }

  refreshToken(): Observable<TokenPair> {
    const refreshToken = this.getStoredRefreshToken();
    if (!refreshToken) {
      this.clearSession();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http
      .post<TokenPair>(`${this.apiUrl}/auth/refresh`, { refresh_token: refreshToken })
      .pipe(
        tap((tokens) => {
          this.saveTokens(tokens);
        }),
        catchError((err) => {
          this.clearSession();
          this.router.navigate(['/auth/login'], { queryParams: { sessionExpired: true } });
          return throwError(() => err);
        })
      );
  }

  logout(): Observable<MessageResponse> {
    const refreshToken = this.getStoredRefreshToken();
    return this.http
      .post<MessageResponse>(`${this.apiUrl}/auth/logout`, { refresh_token: refreshToken })
      .pipe(
        tap(() => {
          this.clearSession();
          this.router.navigate(['/auth/login']);
        }),
        catchError(() => {
          this.clearSession();
          this.router.navigate(['/auth/login']);
          return of({ detail: 'Sesión cerrada localmente' });
        })
      );
  }

  logoutAll(): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/auth/logout-all`, {}).pipe(
      tap(() => {
        this.clearSession();
        this.router.navigate(['/auth/login']);
      })
    );
  }

  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me`).pipe(
      tap((user) => {
        this.currentUserSignal.set(user);
        this.isLoadedSignal.set(true);
      }),
      catchError((err) => {
        this.isLoadedSignal.set(true);
        return throwError(() => err);
      })
    );
  }

  ensureUserLoaded(): Observable<User | null> {
    if (this.currentUserSignal()) {
      return of(this.currentUserSignal());
    }
    if (!this.accessTokenSignal()) {
      return of(null);
    }
    return this.fetchCurrentUser().pipe(
      catchError(() => of(null))
    );
  }

  setCurrentUser(user: User): void {
    this.currentUserSignal.set(user);
    this.isLoadedSignal.set(true);
  }

  verifyEmail(token: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/auth/verify-email`, { token });
  }

  resendVerification(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/auth/resend-verification`, { email });
  }

  forgotPassword(email: string): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(data: ResetPasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/auth/reset-password`, data);
  }

  changePassword(data: ChangePasswordRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/auth/change-password`, data);
  }

  hasRole(roleName: string): boolean {
    return this.roles().includes(roleName);
  }

  hasAnyRole(roleNames: string[]): boolean {
    return roleNames.some((r) => this.roles().includes(r));
  }

  hasPermission(permissionCode: string): boolean {
    return this.permissions().includes(permissionCode);
  }

  hasAllPermissions(permissionCodes: string[]): boolean {
    const userPerms = this.permissions();
    return permissionCodes.every((p) => userPerms.includes(p));
  }
}
