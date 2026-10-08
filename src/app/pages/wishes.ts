import { AfterViewInit, Component, ElementRef, Injector, OnDestroy, QueryList, ViewChild, ViewChildren, afterNextRender, inject, signal } from '@angular/core';
import { CantinaPlayer } from './cantina-player';

@Component({
  selector: 'app-wishes',
  templateUrl: './wishes.html',
  styleUrl: './wishes.css',
})
export class Wishes implements AfterViewInit, OnDestroy {
  protected readonly prankStarted = signal(false);
  protected readonly activeDialogs = signal<number[]>([]);
  protected readonly audioError = signal(false);
  protected readonly songReady = signal(false);
  protected readonly startPending = signal(false);
  protected readonly autoplayBlocked = signal(false);
  private readonly injector = inject(Injector);
  private destroyed = false;
  private preparation = 0;
  private readonly music = new CantinaPlayer({
    onPlaying: () => this.beginDialogs(),
    onBlocked: () => {
      if (this.destroyed || !this.startPending()) return;
      this.autoplayBlocked.set(true);
      this.songContainer?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    onError: () => {
      if (this.destroyed) return;
      this.audioError.set(true);
      this.startPending.set(false);
      this.songReady.set(false);
    },
  });
  @ViewChildren('prankDialog') private dialogs?: QueryList<ElementRef<HTMLDialogElement>>;
  @ViewChild('stopButton') private stopButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('songContainer') private songContainer?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    this.prepareSong();
  }

  protected prepareSong(): void {
    const preparation = ++this.preparation;
    this.audioError.set(false);
    this.songReady.set(false);
    this.startPending.set(false);
    this.autoplayBlocked.set(false);
    void this.music.prepare(this.songContainer?.nativeElement).then(() => {
      if (!this.destroyed && preparation === this.preparation) this.songReady.set(true);
    }).catch(() => {
      if (!this.destroyed && preparation === this.preparation) this.audioError.set(true);
    });
  }

  protected startPrank(): void {
    if (this.prankStarted() || this.startPending() || !this.songReady()) return;
    this.audioError.set(false);
    this.autoplayBlocked.set(false);
    this.startPending.set(true);
    try {
      this.music.start();
    } catch {
      this.audioError.set(true);
      this.startPending.set(false);
    }
  }

  private beginDialogs(): void {
    if (this.destroyed || !this.startPending() || this.prankStarted()) return;
    this.startPending.set(false);
    this.autoplayBlocked.set(false);
    this.prankStarted.set(true);
    this.activeDialogs.set([1, 2, 3, 4, 5]);
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
    if (this.activeDialogs().length === 0) {
      afterNextRender(() => this.stopButton?.nativeElement.focus(), { injector: this.injector });
    }
  }

  protected stopPrank(): void {
    if (this.activeDialogs().length > 0) return;
    this.startPending.set(false);
    this.music.stop();
    this.prankStarted.set(false);
    this.audioError.set(false);
    afterNextRender(() => document.getElementById('start-prank')?.focus(), { injector: this.injector });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.music.destroy();
    this.dialogs?.forEach(ref => ref.nativeElement.close());
  }
}
