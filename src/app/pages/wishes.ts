import { Component, ElementRef, Injector, OnDestroy, QueryList, ViewChild, ViewChildren, afterNextRender, inject, signal } from '@angular/core';
import { HardstylePlayer } from './hardstyle-player';
import { GiftGame } from './gift-game';

@Component({
  selector: 'app-wishes',
  imports: [GiftGame],
  templateUrl: './wishes.html',
  styleUrl: './wishes.css',
})
export class Wishes implements OnDestroy {
  protected readonly dialogCount = 25;
  protected readonly gameUnlocked = signal(false);
  protected readonly gameWon = signal(false);
  @ViewChild('gameSection') private gameSection?: ElementRef<HTMLElement>;
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
    if (this.prankStarted() || this.startPending() || this.gameUnlocked()) return;
    const attempt = ++this.attempt;
    this.audioError.set(false);
    this.startPending.set(true);
    try {
      // AudioContext creation and resume run directly in the gift click.
      await this.music.start();
      if (this.destroyed || attempt !== this.attempt) return;
      this.startPending.set(false);
      this.prankStarted.set(true);
      this.activeDialogs.set(Array.from({ length: this.dialogCount }, (_, index) => index + 1));
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
    if (this.destroyed || !this.activeDialogs().includes(id)) return;
    this.activeDialogs.update(dialogs => dialogs.filter(dialogId => dialogId !== id));
    if (this.activeDialogs().length === 0) {
      this.gameUnlocked.set(true);
      afterNextRender(() => {
        this.stopButton?.nativeElement.focus();
        this.gameSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, { injector: this.injector });
    }
  }

  protected onGameEarned(): void {
    if (!this.gameUnlocked()) return;
    this.gameWon.set(true);
    afterNextRender(() => this.gameSection?.nativeElement.querySelector<HTMLElement>('h2')?.focus(), { injector: this.injector });
  }

  protected stopPrank(): void {
    if (this.activeDialogs().length > 0) return;
    this.attempt++;
    this.startPending.set(false);
    this.music.stop();
    this.prankStarted.set(false);
    this.audioError.set(false);
    afterNextRender(() => {
      if (this.gameUnlocked()) this.gameSection?.nativeElement.querySelector<HTMLElement>('h2')?.focus();
      else document.getElementById('start-prank')?.focus();
    }, { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.attempt++;
    this.music.stop();
    this.dialogs?.forEach(ref => ref.nativeElement.close());
  }
}
