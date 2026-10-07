import { Component, ElementRef, HostListener, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GiftState } from '../gift-state';

@Component({
  selector: 'app-birthday',
  templateUrl: './birthday.html',
  styleUrl: './birthday.css',
})
export class Birthday implements OnDestroy {
  protected readonly gift = inject(GiftState);
  private readonly router = inject(Router);
  @ViewChild('giftDialog') private dialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('giftButton') private button?: ElementRef<HTMLButtonElement>;
  protected readonly position = signal({ x: 0, y: 0 });
  private target = { x: 0, y: 0 };
  private pointer?: { x: number; y: number };
  private frame?: number;
  private lastFrame = 0;
  private lastEscape = 0;

  protected openGift(): void {
    const dialog = this.dialog?.nativeElement;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    this.pointer = undefined;
    const bounds = dialog.getBoundingClientRect();
    this.target = { x: (window.innerWidth - bounds.width) / 2, y: (window.innerHeight - bounds.height) / 2 };
    this.position.set(this.target);
    this.gift.start();
    this.lastFrame = performance.now();
    this.lastEscape = 0;
    if (!this.gift.unlocked()) this.frame = requestAnimationFrame(this.animate);
  }

  protected closeGift(): void {
    this.dialog?.nativeElement.close();
    this.stopAnimation();
  }

  protected revealGift(): void {
    if (!this.gift.unlocked()) return;
    this.closeGift();
    void this.router.navigateByUrl('/geschenk');
  }

  @HostListener('document:pointermove', ['$event'])
  protected onPointerMove(event: PointerEvent): void {
    if (this.dialog?.nativeElement.open && !this.gift.unlocked()) {
      this.pointer = { x: event.clientX, y: event.clientY };
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  protected onPointerDown(event: PointerEvent): void {
    if (!this.dialog?.nativeElement.open || this.gift.unlocked()) return;
    this.pointer = { x: event.clientX, y: event.clientY };
    this.evade(performance.now());
  }

  @HostListener('window:resize')
  protected onResize(): void {
    const dialog = this.dialog?.nativeElement;
    if (!dialog?.open) return;
    const bounds = dialog.getBoundingClientRect();
    const point = this.position();
    this.target = this.clamp(point, bounds.width, bounds.height);
    this.position.set(this.target);
  }

  private clamp(point: { x: number; y: number }, width: number, height: number): { x: number; y: number } {
    return {
      x: Math.max(16, Math.min(point.x, window.innerWidth - width - 16)),
      y: Math.max(16, Math.min(point.y, window.innerHeight - height - 16)),
    };
  }

  private evade(now: number): void {
    const pointer = this.pointer;
    const button = this.button?.nativeElement;
    const dialog = this.dialog?.nativeElement;
    if (!pointer || !button || !dialog || now - this.lastEscape < 180) return;
    const buttonBounds = button.getBoundingClientRect();
    const dx = Math.max(buttonBounds.left - pointer.x, 0, pointer.x - buttonBounds.right);
    const dy = Math.max(buttonBounds.top - pointer.y, 0, pointer.y - buttonBounds.bottom);
    if (Math.hypot(dx, dy) > 100) return;
    const bounds = dialog.getBoundingClientRect();
    const offsetX = buttonBounds.left - bounds.left + buttonBounds.width / 2;
    const offsetY = buttonBounds.top - bounds.top + buttonBounds.height / 2;
    const candidates = [
      { x: 16, y: 16 },
      { x: window.innerWidth - bounds.width - 16, y: 16 },
      { x: 16, y: window.innerHeight - bounds.height - 16 },
      { x: window.innerWidth - bounds.width - 16, y: window.innerHeight - bounds.height - 16 },
    ].map(point => this.clamp(point, bounds.width, bounds.height));
    candidates.sort((a, b) =>
      Math.hypot(b.x + offsetX - pointer.x, b.y + offsetY - pointer.y) -
      Math.hypot(a.x + offsetX - pointer.x, a.y + offsetY - pointer.y));
    this.target = candidates[0];
    this.lastEscape = now;
  }

  private readonly animate = (now: number): void => {
    // Stop at the currently rendered position, even if a move is unfinished.
    if (!this.dialog?.nativeElement.open || this.gift.unlocked()) {
      this.frame = undefined;
      return;
    }
    this.evade(now);
    const current = this.position();
    const factor = 1 - Math.exp(-Math.min(now - this.lastFrame, 40) / 115);
    this.position.set({
      x: current.x + (this.target.x - current.x) * factor,
      y: current.y + (this.target.y - current.y) * factor,
    });
    this.lastFrame = now;
    this.frame = requestAnimationFrame(this.animate);
  };

  private stopAnimation(): void {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
  }

  ngOnDestroy(): void {
    this.stopAnimation();
    this.dialog?.nativeElement.close();
  }
}
