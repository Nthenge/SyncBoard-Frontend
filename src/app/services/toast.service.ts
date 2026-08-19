import { Injectable, signal } from '@angular/core';

export type ToastType = 'error' | 'success';

@Injectable({ providedIn: 'root' })
export class ToastService {
  message = signal<string | null>(null);
  type = signal<ToastType>('error');

  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  show(message: string, type: ToastType = 'error', durationMs = 4000): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.message.set(message);
    this.type.set(type);
    this.timeoutId = setTimeout(() => {
      this.message.set(null);
      this.timeoutId = null;
    }, durationMs);
  }

  dismiss(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.message.set(null);
  }
}