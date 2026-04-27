import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  PLATFORM_ID,
  ViewChild,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'edo-dogx-modal',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)',
  },
  template: `
    @if (open()) {
      <div class="edo-ui-kit-modal-backdrop" (click)="onCloseRequested()"></div>
      <section
        #modalPanel
        class="edo-ui-kit-modal"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="ariaLabel()"
        tabindex="-1"
        (click)="$event.stopPropagation()"
        (keydown)="onPanelKeydown($event)"
      >
        <header>
          <h3>{{ title() }}</h3>
          <button type="button" aria-label="Закрыть окно" (click)="onCloseRequested()">Закрыть</button>
        </header>
        <div class="edo-ui-kit-modal__body">
          <ng-content />
        </div>
      </section>
    }
  `,
  styleUrl: './modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalComponent {
  @ViewChild('modalPanel')
  private panelRef?: ElementRef<HTMLElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private previousFocusedElement: HTMLElement | null = null;

  public readonly open = input(false);
  public readonly title = input('Окно');
  public readonly ariaLabel = input('Модальное окно');

  public readonly closed = output<void>();

  constructor() {
    effect(() => {
      const isOpen = this.open();
      if (!this.isBrowser) {
        return;
      }

      if (isOpen) {
        this.previousFocusedElement =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        queueMicrotask(() => this.focusFirstElement());
        return;
      }

      this.restoreFocus();
    });
  }

  protected onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.open() || event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    this.onCloseRequested();
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }

    const focusable = this.getFocusableElements();
    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected onCloseRequested(): void {
    this.closed.emit();
  }

  private focusFirstElement(): void {
    const panel = this.panelRef?.nativeElement;
    if (!panel) {
      return;
    }

    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
      return;
    }

    panel.focus();
  }

  private getFocusableElements(): Array<HTMLElement> {
    const panel = this.panelRef?.nativeElement;
    if (!panel) {
      return [];
    }

    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
  }

  private restoreFocus(): void {
    if (!this.previousFocusedElement) {
      return;
    }

    this.previousFocusedElement.focus();
    this.previousFocusedElement = null;
  }
}
