import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateRoleRequest, Permission, Role, SetRolePermissionsRequest } from '../models/role.models';

@Injectable({
  providedIn: 'root',
})
export class RoleService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private roles$?: Observable<Role[]>;
  private permissions$?: Observable<Permission[]>;

  getRoles(forceRefresh = false): Observable<Role[]> {
    if (!this.roles$ || forceRefresh) {
      this.roles$ = this.http.get<Role[]>(`${this.apiUrl}/roles`).pipe(shareReplay(1));
    }
    return this.roles$;
  }

  createRole(payload: CreateRoleRequest): Observable<Role> {
    return this.http.post<Role>(`${this.apiUrl}/roles`, payload).pipe(
      tap(() => {
        this.roles$ = undefined;
      })
    );
  }

  getPermissions(forceRefresh = false): Observable<Permission[]> {
    if (!this.permissions$ || forceRefresh) {
      this.permissions$ = this.http
        .get<Permission[]>(`${this.apiUrl}/permissions`)
        .pipe(shareReplay(1));
    }
    return this.permissions$;
  }

  setRolePermissions(roleId: number, permissionCodes: string[]): Observable<Role> {
    const payload: SetRolePermissionsRequest = { permission_codes: permissionCodes };
    return this.http
      .put<Role>(`${this.apiUrl}/roles/${roleId}/permissions`, payload)
      .pipe(
        tap(() => {
          this.roles$ = undefined;
        })
      );
  }
}
