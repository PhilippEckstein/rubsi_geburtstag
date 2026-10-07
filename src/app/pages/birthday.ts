import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-birthday',
  templateUrl: './birthday.html',
})
export class Birthday {
  protected readonly surpriseOpen = signal(false);

  protected openSurprise(): void {
    this.surpriseOpen.set(true);
  }
}
