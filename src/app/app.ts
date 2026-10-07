import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly menuOpen = signal(false);
  @ViewChild('pageContent') private pageContent?: ElementRef<HTMLElement>;

  protected toggleMenu(): void {
    this.menuOpen.update(open => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected onPageActivated(): void {
    queueMicrotask(() => {
      this.pageContent?.nativeElement.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
    });
  }
}
