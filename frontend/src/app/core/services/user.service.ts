import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/auth.models';
import { AdminUpdateUserRequest, UpdateMeRequest, UserPage } from '../models/user.models';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me`);
  }

  updateMe(payload: UpdateMeRequest): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/me`, payload);
  }

  getUsers(limit = 20, offset = 0, query?: string): Observable<UserPage> {
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    if (query && query.trim()) {
      params = params.set('q', query.trim());
    }

    return this.http.get<UserPage>(`${this.apiUrl}/users`, { params });
  }

  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${id}`);
  }

  updateUser(id: string, payload: AdminUpdateUserRequest): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/${id}`, payload);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/${id}`);
  }

  assignRole(userId: string, roleId: number): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/users/${userId}/roles/${roleId}`, {});
  }

  removeRole(userId: string, roleId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/${userId}/roles/${roleId}`);
  }
}
