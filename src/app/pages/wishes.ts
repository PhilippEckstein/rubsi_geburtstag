import { Component, ElementRef, Injector, OnDestroy, QueryList, ViewChild, ViewChildren, afterNextRender, inject, signal } from '@angular/core';
import { HardtekPlayer } from './hardtek-player';

@Component({
  selector: 'app-wishes',
  templateUrl: './wishes.html',
  styleUrl: './wishes.css',
})
export class Wishes implements OnDestroy {
  protected readonly prankStarted = signal(false);
  protected readonly activeDialogs = signal<number[]>([]);
  protected readonly audioError = signal(false);
  private readonly injector = inject(Injector);
  private readonly music = new HardtekPlayer();
  private destroyed = false;
  @ViewChildren('prankDialog') private dialogs?: QueryList<ElementRef<HTMLDialogElement>>;
  @ViewChild('stopButton') private stopButton?: ElementRef<HTMLButtonElement>;

  protected startPrank(): void {
    if (this.prankStarted()) return;
    this.audioError.set(false);
    this.prankStarted.set(true);
    this.activeDialogs.set([1, 2, 3, 4, 5]);
    // Starting in the click handler lets browsers play the audio immediately.
    void this.music.start().catch(() => {
      if (!this.destroyed && this.prankStarted()) this.audioError.set(true);
    });
    afterNextRender(() => {
      if (this.destroyed || !this.prankStarted()) return;
      this.dialogs?.forEach(ref => ref.nativeElement.showModal());
    }, { injector: this.injector });
  }

  protected dismissDialog(dialog: HTMLDialogElement): void {
    dialog.close();
  }

  protected onDialogClosed(id: number): void {
    if (this.destroyed) return;
    this.activeDialogs.update(dialogs => dialogs.filter(dialogId => dialogId !== id));
    // Keep the beat running after the last dialog until the stop button is used.
    if (this.activeDialogs().length === 0) {
      afterNextRender(() => this.stopButton?.nativeElement.focus(), { injector: this.injector });
    }
  }

  protected stopPrank(): void {
    if (this.activeDialogs().length > 0) return;
    this.music.stop();
    this.prankStarted.set(false);
    this.audioError.set(false);
    afterNextRender(() => document.getElementById('start-prank')?.focus(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.music.stop();
    this.dialogs?.forEach(ref => ref.nativeElement.close());
  }
}
