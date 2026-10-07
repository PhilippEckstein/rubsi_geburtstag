import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly surpriseOpen = signal(false);

  protected openSurprise(): void {
    this.surpriseOpen.set(true);
  }
}
