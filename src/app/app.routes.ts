import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Listone Fantacalcio 2026/27 · FantaList',
    loadComponent: () =>
      import('./features/players/pages/players-page/players-page').then((m) => m.PlayersPage),
  },
  { path: '**', redirectTo: '' },
];
