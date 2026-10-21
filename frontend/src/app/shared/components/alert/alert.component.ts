import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (message) {
      <div
        [ngClass]="{
          'bg-rose-50 border-rose-200 text-rose-800': type === 'error',
          'bg-emerald-50 border-emerald-200 text-emerald-800': type === 'success',
          'bg-amber-50 border-amber-200 text-amber-800': type === 'warning',
          'bg-indigo-50 border-indigo-200 text-indigo-800': type === 'info'
        }"
        class="border rounded-xl p-4 text-sm flex items-start space-x-3 mb-4 transition"
        role="alert"
      >
        <span class="text-lg leading-none mt-0.5">
          @if (type === 'error') { ⚠️ }
          @else if (type === 'success') { ✅ }
          @else if (type === 'warning') { 🔔 }
          @else { ℹ️ }
        </span>
        <div class="flex-1">
          <div class="font-medium whitespace-pre-wrap">{{ message }}</div>
          @if (devToken) {
            <div class="mt-2 p-2 bg-white/80 border border-current rounded-md font-mono text-xs break-all select-all">
              <span class="font-bold">Token de desarrollo:</span> {{ devToken }}
            </div>
          }
        </div>
      </div>
    }
  `
})
export class AlertComponent {
  @Input() type: 'error' | 'success' | 'warning' | 'info' = 'error';
  @Input() message: string | null = null;
  @Input() devToken: string | null = null;
}
