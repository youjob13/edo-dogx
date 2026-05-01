import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../design-system/ui-kit';

type SignatureStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

interface SignatureRequestView {
  id: string;
  documentId: string;
  signersCount: number;
  status: SignatureStatus;
  providerRef: string;
}

@Component({
  selector: 'edo-dogx-signature-panel',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, ButtonComponent],
  template: `
    <edo-dogx-page-section
      title="Подписание документов"
      subtitle="Запуск запроса подписи и отслеживание статуса"
    >
      <edo-dogx-card
        title="Новый запрос подписи"
        subtitle="Provider-agnostic mock-интеграция для US2"
      >
        <form class="signature-panel__form" (submit)="$event.preventDefault(); startSignature()">
          <label>
            <span>ID документа</span>
            <input type="text" [formControl]="documentIdControl" autocomplete="off" />
          </label>

          <label>
            <span>Подписанты (через запятую)</span>
            <input type="text" [formControl]="signersControl" autocomplete="off" />
          </label>

          <edo-dogx-button label="Запустить подпись" appearance="primary" size="m" (pressed)="startSignature()" />
        </form>

        @if (message()) {
          <p class="signature-panel__message" aria-live="polite">{{ message() }}</p>
        }
      </edo-dogx-card>

      <edo-dogx-card title="Текущие запросы" subtitle="Мониторинг выполнения">
        <div class="signature-panel__list">
          @for (request of requests(); track request.id) {
            <article class="signature-panel__item">
              <p><strong>ID:</strong> {{ request.id }}</p>
              <p><strong>Документ:</strong> {{ request.documentId }}</p>
              <p><strong>Подписантов:</strong> {{ request.signersCount }}</p>
              <p><strong>Статус:</strong> {{ request.status }}</p>
              <p><strong>Provider Ref:</strong> {{ request.providerRef }}</p>

              <div class="signature-panel__actions">
                <edo-dogx-button
                  label="Частично подписан"
                  size="s"
                  appearance="secondary"
                  [disabled]="request.status !== 'PENDING'"
                  (pressed)="setStatus(request.id, 'PARTIAL')"
                />
                <edo-dogx-button
                  label="Завершен"
                  size="s"
                  appearance="primary"
                  [disabled]="request.status === 'COMPLETED'"
                  (pressed)="setStatus(request.id, 'COMPLETED')"
                />
                <edo-dogx-button
                  label="Ошибка"
                  size="s"
                  appearance="secondary"
                  [disabled]="request.status === 'COMPLETED'"
                  (pressed)="setStatus(request.id, 'FAILED')"
                />
              </div>
            </article>
          }
        </div>
      </edo-dogx-card>
    </edo-dogx-page-section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .signature-panel__form {
        display: grid;
        gap: 0.75rem;
      }

      .signature-panel__form label {
        display: grid;
        gap: 0.35rem;
      }

      .signature-panel__form span {
        font-size: 0.75rem;
        color: var(--edo-ui-ink-muted);
      }

      .signature-panel__form input {
        border-radius: var(--edo-ui-radius-m);
        border: 1px solid var(--edo-ui-border-subtle);
        background: var(--edo-ui-surface-primary);
        color: var(--edo-ui-ink-primary);
        font: inherit;
        min-height: 2.25rem;
        padding: 0.4rem 0.65rem;
      }

      .signature-panel__message {
        margin-top: 0.75rem;
        color: var(--edo-ui-ink-muted);
      }

      .signature-panel__list {
        display: grid;
        gap: 0.75rem;
      }

      .signature-panel__item {
        border: 1px solid var(--edo-ui-border-subtle);
        border-radius: var(--edo-ui-radius-m);
        padding: 0.75rem;
        background: var(--edo-ui-surface-secondary);
      }

      .signature-panel__item p {
        margin: 0;
        color: var(--edo-ui-ink-muted);
      }

      .signature-panel__actions {
        margin-top: 0.75rem;
        display: grid;
        gap: 0.5rem;
      }

      @media (min-width: 720px) {
        .signature-panel__actions {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignaturePanelComponent {
  protected readonly documentIdControl = new FormControl('', { nonNullable: true });
  protected readonly signersControl = new FormControl('', { nonNullable: true });
  protected readonly message = signal('');

  private readonly requestsState = signal<Array<SignatureRequestView>>([]);
  protected readonly requests = computed(() => this.requestsState());

  protected startSignature(): void {
    const documentId = this.documentIdControl.value.trim();
    const signers = this.signersControl.value
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value !== '');

    if (!documentId || signers.length === 0) {
      this.message.set('Укажите документ и минимум одного подписанта.');
      return;
    }

    const request: SignatureRequestView = {
      id: `sig-${Date.now()}`,
      documentId,
      signersCount: signers.length,
      status: 'PENDING',
      providerRef: 'provider-pending',
    };

    this.requestsState.update((items) => [request, ...items]);
    this.message.set(`Запрос подписи создан для документа ${documentId}.`);
    this.signersControl.setValue('');
  }

  protected setStatus(id: string, status: SignatureStatus): void {
    this.requestsState.update((items) =>
      items.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              providerRef: status === 'COMPLETED' ? 'provider-complete' : item.providerRef,
            }
          : item,
      ),
    );
  }
}
