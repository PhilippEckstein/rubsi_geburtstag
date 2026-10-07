import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { Birthday } from './pages/birthday';
import { Wishes } from './pages/wishes';
import { GiftState } from './gift-state';

const giftGuard: CanActivateFn = () =>
  inject(GiftState).unlocked() || inject(Router).createUrlTree(['/geburtstag']);

export const routes: Routes = [
  { path: '', redirectTo: 'geburtstag', pathMatch: 'full' },
  { path: 'geburtstag', component: Birthday, title: 'Alles Gute, Rubsi!' },
  { path: 'geschenk', component: Wishes, canActivate: [giftGuard], title: 'Dein Geschenk, Rubsi!' },
  { path: 'wuensche', redirectTo: 'geschenk', pathMatch: 'full' },
  { path: '**', redirectTo: 'geburtstag' },
];
