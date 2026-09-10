import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly current = signal<ThemePreference>('system');
  readonly preference = this.current.asReadonly();

  constructor() {
    afterNextRender(() => {
      if (!this.browser) return;
      const view = this.document.defaultView;
      if (!view) return;
      try {
        const saved = view.localStorage.getItem('fantalist-theme');
        if (saved === 'light' || saved === 'dark' || saved === 'system') this.current.set(saved);
      } catch {
        // The theme still works when storage is unavailable.
      }
      const media = view.matchMedia('(prefers-color-scheme: dark)');
      const update = () => this.apply();
      media.addEventListener('change', update);
      this.destroyRef.onDestroy(() => media.removeEventListener('change', update));
      this.apply();
    });
  }

  setPreference(value: string): void {
    if (value !== 'light' && value !== 'dark' && value !== 'system') return;
    this.current.set(value);
    if (this.browser) {
      try {
        this.document.defaultView?.localStorage.setItem('fantalist-theme', value);
      } catch {
        // Do not prevent theme changes when localStorage is blocked.
      }
      this.apply();
    }
  }

  private apply(): void {
    if (!this.browser) return;
    const dark =
      this.current() === 'dark' ||
      (this.current() === 'system' &&
        !!this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches);
    this.document.documentElement.classList.toggle('dark', dark);
  }
}
