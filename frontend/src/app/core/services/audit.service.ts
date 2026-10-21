import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditLogPage } from '../models/audit.models';

@Injectable({
  providedIn: 'root',
})
export class AuditService {
  private http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getAuditLogs(
    limit = 20,
    offset = 0,
    userId?: string,
    event?: string,
    success?: boolean
  ): Observable<AuditLogPage> {
    let params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    if (userId && userId.trim()) {
      params = params.set('user_id', userId.trim());
    }

    if (event && event.trim()) {
      params = params.set('event', event.trim());
    }

    if (typeof success === 'boolean') {
      params = params.set('success', success.toString());
    }

    return this.http.get<AuditLogPage>(`${this.apiUrl}/audit-logs`, { params });
  }
}
