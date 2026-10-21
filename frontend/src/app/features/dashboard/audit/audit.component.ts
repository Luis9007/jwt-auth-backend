import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditService } from '../../../core/services/audit.service';
import { AuditLog } from '../../../core/models/audit.models';
import { AlertComponent } from '../../../shared/components/alert/alert.component';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, AlertComponent],
  template: `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900">Logs de Auditoría</h1>
          <p class="text-sm text-slate-500 mt-1">
            Registro histórico de eventos de autenticación, cambios de roles y seguridad.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <input
            type="text"
            [(ngModel)]="filterEvent"
            (keyup.enter)="loadLogs()"
            placeholder="Filtrar por evento (ej. auth.login)..."
            class="px-3 py-1.5 border border-slate-300 rounded-xl text-xs shadow-sm focus:ring-indigo-500 focus:border-indigo-500 w-48"
          />

          <select
            [(ngModel)]="filterSuccess"
            (change)="loadLogs()"
            class="px-3 py-1.5 border border-slate-300 rounded-xl text-xs shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option [ngValue]="undefined">Todos los estados</option>
            <option [ngValue]="true">Solo Exitosos</option>
            <option [ngValue]="false">Solo Fallidos</option>
          </select>

          <button
            (click)="loadLogs()"
            class="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition"
          >
            Filtrar
          </button>
        </div>
      </div>

      <app-alert [type]="'error'" [message]="errorMessage"></app-alert>

      <!-- Logs Table -->
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-sm">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <th class="py-3.5 px-4">ID</th>
                <th class="py-3.5 px-4">Fecha / Hora</th>
                <th class="py-3.5 px-4">Evento</th>
                <th class="py-3.5 px-4">Resultado</th>
                <th class="py-3.5 px-4">Usuario ID</th>
                <th class="py-3.5 px-4">IP</th>
                <th class="py-3.5 px-4 text-right">Detalles</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-mono text-xs">
              @for (log of logs; track log.id) {
                <tr class="hover:bg-slate-50/50 transition">
                  <td class="py-3 px-4 text-slate-400">#{{ log.id }}</td>
                  <td class="py-3 px-4 text-slate-600 font-sans">
                    {{ log.created_at | date:'medium' }}
                  </td>
                  <td class="py-3 px-4 font-bold text-slate-800">
                    {{ log.event }}
                  </td>
                  <td class="py-3 px-4 font-sans">
                    <span
                      [class]="log.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'"
                      class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                    >
                      {{ log.success ? 'Exitoso' : 'Fallido' }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-slate-500 truncate max-w-[120px]" [title]="log.user_id || 'Anónimo'">
                    {{ log.user_id ? log.user_id.slice(0, 8) + '...' : 'anónimo' }}
                  </td>
                  <td class="py-3 px-4 text-slate-500">
                    {{ log.ip_address || '-' }}
                  </td>
                  <td class="py-3 px-4 text-right font-sans">
                    <button
                      (click)="selectedLog = log"
                      class="px-2.5 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition"
                    >
                      Ver Metadata
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="py-8 text-center text-sm font-sans text-slate-400">
                    No hay registros de auditoría que coincidan con la búsqueda.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Total: <span class="font-bold text-slate-700">{{ total }}</span> eventos registrados
          </div>
          <div class="space-x-2">
            <button
              (click)="prevPage()"
              [disabled]="offset === 0"
              class="px-3 py-1 bg-white border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50 transition"
            >
              Anterior
            </button>
            <button
              (click)="nextPage()"
              [disabled]="offset + limit >= total"
              class="px-3 py-1 bg-white border border-slate-300 rounded-md disabled:opacity-50 hover:bg-slate-50 transition"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      <!-- Metadata Modal -->
      @if (selectedLog) {
        <div class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-bold text-slate-900">
                  Evento: {{ selectedLog.event }}
                </h3>
                <span class="text-xs text-slate-500">Registro #{{ selectedLog.id }} • {{ selectedLog.created_at | date:'medium' }}</span>
              </div>
              <button (click)="selectedLog = null" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>

            <div class="space-y-3 text-xs">
              <div>
                <span class="font-semibold text-slate-700">User-Agent:</span>
                <p class="text-slate-600 font-mono mt-0.5 break-all bg-slate-50 p-2 rounded-lg border border-slate-200">
                  {{ selectedLog.user_agent || 'No disponible' }}
                </p>
              </div>

              <div>
                <span class="font-semibold text-slate-700">Metadata (JSON):</span>
                <pre class="mt-0.5 bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto text-[11px] font-mono leading-relaxed">{{ selectedLog.metadata | json }}</pre>
              </div>
            </div>

            <div class="pt-2 flex justify-end">
              <button
                (click)="selectedLog = null"
                class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class AuditComponent implements OnInit {
  private auditService = inject(AuditService);

  logs: AuditLog[] = [];
  total = 0;
  limit = 20;
  offset = 0;

  filterEvent = '';
  filterSuccess: boolean | undefined = undefined;
  errorMessage: string | null = null;

  selectedLog: AuditLog | null = null;

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.errorMessage = null;

    this.auditService
      .getAuditLogs(
        this.limit,
        this.offset,
        undefined,
        this.filterEvent || undefined,
        this.filterSuccess
      )
      .subscribe({
        next: (page) => {
          this.logs = page.items;
          this.total = page.total;
        },
        error: (err) => {
          this.errorMessage = err?.error?.detail || 'Error al cargar los logs de auditoría.';
        },
      });
  }

  prevPage(): void {
    if (this.offset >= this.limit) {
      this.offset -= this.limit;
      this.loadLogs();
    }
  }

  nextPage(): void {
    if (this.offset + this.limit < this.total) {
      this.offset += this.limit;
      this.loadLogs();
    }
  }
}
