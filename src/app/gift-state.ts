import { Injectable, OnDestroy, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GiftState implements OnDestroy {
  readonly unlocked = signal(false);
  private timer?: ReturnType<typeof setTimeout>;

  start(): void {
    if (this.timer !== undefined || this.unlocked()) return;
    this.timer = setTimeout(() => this.unlocked.set(true), 10_000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
