import { Component, ElementRef, Injector, OnDestroy, QueryList, ViewChild, ViewChildren, afterNextRender, inject, signal } from '@angular/core';
import { HardstylePlayer } from './hardstyle-player';

@Component({
  selector: 'app-wishes',
  templateUrl: './wishes.html',
  styleUrl: './wishes.css',
})
export class Wishes implements OnDestroy {
  protected readonly prankStarted = signal(false);
  protected readonly activeDialogs = signal<number[]>([]);
  protected readonly audioError = signal(false);
  protected readonly startPending = signal(false);
  private readonly injector = inject(Injector);
  private readonly music = new HardstylePlayer();
  private destroyed = false;
  private attempt = 0;
  @ViewChildren('prankDialog') private dialogs?: QueryList<ElementRef<HTMLDialogElement>>;
  @ViewChild('stopButton') private stopButton?: ElementRef<HTMLButtonElement>;

  protected async startPrank(): Promise<void> {
    if (this.prankStarted() || this.startPending()) return;
    const attempt = ++this.attempt;
    this.audioError.set(false);
    this.startPending.set(true);
    try {
      // AudioContext creation and resume run directly in the gift click.
      await this.music.start();
      if (this.destroyed || attempt !== this.attempt) return;
      this.startPending.set(false);
      this.prankStarted.set(true);
      this.activeDialogs.set([1, 2, 3, 4, 5]);
      afterNextRender(() => {
        if (this.destroyed || !this.prankStarted()) return;
        this.dialogs?.forEach(ref => ref.nativeElement.showModal());
      }, { injector: this.injector });
    } catch {
      if (this.destroyed || attempt !== this.attempt) return;
      this.audioError.set(true);
      this.startPending.set(false);
    }
  }

  protected dismissDialog(dialog: HTMLDialogElement): void {
    dialog.close();
  }

  protected onDialogClosed(id: number): void {
    if (this.destroyed) return;
    this.activeDialogs.update(dialogs => dialogs.filter(dialogId => dialogId !== id));
    if (this.activeDialogs().length === 0) {
      afterNextRender(() => this.stopButton?.nativeElement.focus(), { injector: this.injector });
    }
  }

  protected stopPrank(): void {
    if (this.activeDialogs().length > 0) return;
    this.attempt++;
    this.startPending.set(false);
    this.music.stop();
    this.prankStarted.set(false);
    this.audioError.set(false);
    afterNextRender(() => document.getElementById('start-prank')?.focus(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.attempt++;
    this.music.stop();
    this.dialogs?.forEach(ref => ref.nativeElement.close());
  }
}
