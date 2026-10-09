import { Component, ElementRef, Injector, OnDestroy, ViewChild, afterNextRender, inject, output, signal } from '@angular/core';

type GameState = 'ready' | 'playing' | 'lost' | 'won';

@Component({
  selector: 'app-gift-game',
  templateUrl: './gift-game.html',
  styleUrl: './gift-game.css',
})
export class GiftGame implements OnDestroy {
  readonly earned = output<void>();
  protected readonly targetScore = 20;
  protected readonly score = signal(0);
  protected readonly bestScore = signal(0);
  protected readonly seconds = signal(25);
  protected readonly state = signal<GameState>('ready');
  protected readonly position = signal({ x: 45, y: 45 });
  protected readonly giftId = signal(0);
  private readonly injector = inject(Injector);
  @ViewChild('giftButton') private giftButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('roundButton') private roundButton?: ElementRef<HTMLButtonElement>;
  private timer?: ReturnType<typeof setInterval>;
  private deadline = 0;
  private nextMove = 0;
  private lastCatch = -Infinity;

  protected start(): void {
    if (this.state() === 'playing' || this.state() === 'won') return;
    this.score.set(0);
    this.seconds.set(25);
    this.state.set('playing');
    const now = performance.now();
    this.deadline = now + 25_000;
    this.lastCatch = -Infinity;
    this.moveGift(now);
    this.timer = setInterval(() => this.tick(), 100);
    afterNextRender(() => this.giftButton?.nativeElement.focus(), { injector: this.injector });
  }

  protected catchGift(id: number): void {
    if (this.state() !== 'playing' || id !== this.giftId()) return;
    const now = performance.now();
    if (now >= this.deadline) { this.tick(); return; }
    if (now - this.lastCatch < 160) return;
    this.lastCatch = now;
    const score = this.score() + 1;
    this.score.set(score);
    this.bestScore.update(best => Math.max(best, score));
    if (score >= this.targetScore) {
      this.state.set('won');
      this.clearTimer();
      this.earned.emit();
    } else {
      this.moveGift(now);
    }
  }

  protected onGiftKeydown(event: KeyboardEvent): void {
    if (event.repeat) event.preventDefault();
  }

  private tick(): void {
    if (this.state() !== 'playing') return;
    const now = performance.now();
    this.seconds.set(Math.max(0, Math.ceil((this.deadline - now) / 1000)));
    if (now >= this.deadline) {
      this.state.set('lost');
      this.clearTimer();
      afterNextRender(() => this.roundButton?.nativeElement.focus(), { injector: this.injector });
    } else if (now >= this.nextMove) {
      this.moveGift(now);
    }
  }

  private moveGift(now: number): void {
    this.position.set({ x: 15 + Math.random() * 70, y: 15 + Math.random() * 70 });
    this.giftId.update(id => id + 1);
    this.nextMove = now + 900;
  }

  private clearTimer(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  ngOnDestroy(): void { this.clearTimer(); }
}
