import { Routes } from '@angular/router';
import { Birthday } from './pages/birthday';
import { Wishes } from './pages/wishes';

export const routes: Routes = [
  { path: '', redirectTo: 'geburtstag', pathMatch: 'full' },
  { path: 'geburtstag', component: Birthday, title: 'Happy Birthday, Rubsi!' },
  { path: 'wuensche', component: Wishes, title: 'Wünsche für Rubsi' },
  { path: '**', redirectTo: 'geburtstag' },
];
