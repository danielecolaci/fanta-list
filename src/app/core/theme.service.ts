import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { afterNextRender, DestroyRef, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type ThemePreference = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  private readonly current = signal<ThemePreference>('dark');
  readonly preference = this.current.asReadonly();

  constructor() {
    // Usiamo un effect per applicare il tema ogni volta che il signal 'current' cambia
    effect(() => {
      const theme = this.current();
      if (this.browser) {
        this.applyTheme(theme);
      }
    });

    afterNextRender(() => {
      if (!this.browser) return;
      const view = this.document.defaultView;
      if (!view) return;

      // Ascolta i cambiamenti del sistema operativo
      const media = view.matchMedia('(prefers-color-scheme: dark)');
      const updateSystemTheme = () => {
        // Se siamo in modalità system, forziamo la rivalutazione aggiornando il signal con se stesso o richiamando la logica
        if (this.current() === 'system') {
          this.applyTheme('system');
        }
      };

      media.addEventListener('change', updateSystemTheme);
      this.destroyRef.onDestroy(() => media.removeEventListener('change', updateSystemTheme));

      // Applicazione iniziale
      this.applyTheme(this.current());
    });
  }

  setPreference(value: ThemePreference): void {
    this.current.set(value);
    if (this.browser) {
      try {
        this.document.defaultView?.localStorage.setItem('fantalist-theme', value);
      } catch {
        // Ignora errori di localStorage
      }
    }
  }

  private applyTheme(preference: ThemePreference): void {
    if (!this.browser) return;
    const view = this.document.defaultView;
    if (!view) return;

    const prefersDark = view.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = preference === 'dark' || (preference === 'system' && prefersDark);

    this.document.documentElement.classList.toggle('dark', isDark);
  }
}
