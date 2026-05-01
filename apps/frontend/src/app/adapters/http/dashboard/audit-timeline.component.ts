import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../design-system/ui-kit';

type AuditOutcome = 'SUCCESS' | 'DENIED' | 'FAILED';

interface AuditItem {
  id: string;
  actor: string;
  actionType: string;
  targetId: string;
  outcome: AuditOutcome;
  occurredAtLabel: string;
}

@Component({
  selector: 'edo-dogx-audit-timeline',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, ButtonComponent],
  template: `
    <edo-dogx-page-section
      title="Аудит событий"
      subtitle="Хронология действий с контролем доступа"
    >
      <edo-dogx-card title="Фильтр аудита" subtitle="Поиск по ID документа">
        <form class="audit__filter" (submit)="$event.preventDefault(); applyFilter()">
          <label>
            <span>ID документа</span>
            <input type="text" [formControl]="documentIdControl" autocomplete="off" />
          </label>
          <edo-dogx-button label="Применить" appearance="primary" size="m" (pressed)="applyFilter()" />
        </form>

        @if (message()) {
          <p class="audit__message" aria-live="polite">{{ message() }}</p>
        }
      </edo-dogx-card>

      <edo-dogx-card title="Лента аудита" subtitle="Успешные и отклоненные операции">
        <ul class="audit__timeline" aria-label="Лента событий аудита">
          @for (item of items(); track item.id) {
            <li class="audit__event">
              <p><strong>{{ item.occurredAtLabel }}</strong></p>
              <p>Пользователь: {{ item.actor }}</p>
              <p>Операция: {{ item.actionType }}</p>
              <p>Документ: {{ item.targetId }}</p>
              <p>
                Результат:
                <span [class.audit__badge--success]="item.outcome === 'SUCCESS'"
                      [class.audit__badge--denied]="item.outcome === 'DENIED'"
                      [class.audit__badge--failed]="item.outcome === 'FAILED'"
                      class="audit__badge">
                  {{ item.outcome }}
                </span>
              </p>
            </li>
          }
        </ul>
      </edo-dogx-card>
    </edo-dogx-page-section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .audit__filter {
        display: grid;
        gap: 0.75rem;
      }

      .audit__filter label {
        display: grid;
        gap: 0.35rem;
      }

      .audit__filter span {
        color: var(--edo-ui-ink-muted);
        font-size: 0.75rem;
      }

      .audit__filter input {
        border-radius: var(--edo-ui-radius-m);
        border: 1px solid var(--edo-ui-border-subtle);
        background: var(--edo-ui-surface-primary);
        color: var(--edo-ui-ink-primary);
        font: inherit;
        min-height: 2.25rem;
        padding: 0.4rem 0.65rem;
      }

      .audit__message {
        margin-top: 0.75rem;
        color: var(--edo-ui-ink-muted);
      }

      .audit__timeline {
        list-style: none;
        margin: 0;
        padding: 0;
        display: grid;
        gap: 0.75rem;
      }

      .audit__event {
        border: 1px solid var(--edo-ui-border-subtle);
        border-radius: var(--edo-ui-radius-m);
        padding: 0.75rem;
        background: var(--edo-ui-surface-secondary);
      }

      .audit__event p {
        margin: 0;
        color: var(--edo-ui-ink-muted);
      }

      .audit__badge {
        border-radius: var(--edo-ui-radius-s);
        font-size: 0.75rem;
        padding: 0.15rem 0.4rem;
      }

      .audit__badge--success {
        background: color-mix(in srgb, var(--edo-ui-status-success) 20%, transparent);
      }

      .audit__badge--denied {
        background: color-mix(in srgb, var(--edo-ui-status-warning) 24%, transparent);
      }

      .audit__badge--failed {
        background: color-mix(in srgb, var(--edo-ui-status-danger) 20%, transparent);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditTimelineComponent {
  protected readonly documentIdControl = new FormControl('doc-2026-001', { nonNullable: true });
  protected readonly message = signal('');

  private readonly allItems = signal<Array<AuditItem>>([
    {
      id: 'audit-1',
      actor: 'user.approver@edo.local',
      actionType: 'documents.approve',
      targetId: 'doc-2026-001',
      outcome: 'SUCCESS',
      occurredAtLabel: '01.05.2026 09:14',
    },
    {
      id: 'audit-2',
      actor: 'user.viewer@edo.local',
      actionType: 'documents.approve',
      targetId: 'doc-2026-001',
      outcome: 'DENIED',
      occurredAtLabel: '01.05.2026 09:16',
    },
    {
      id: 'audit-3',
      actor: 'system.gateway',
      actionType: 'signatures.callback',
      targetId: 'doc-2026-001',
      outcome: 'SUCCESS',
      occurredAtLabel: '01.05.2026 09:22',
    },
  ]);

  protected readonly items = computed(() => {
    const targetId = this.documentIdControl.value.trim();
    if (!targetId) {
      return this.allItems();
    }

    return this.allItems().filter((item) => item.targetId === targetId);
  });

  protected applyFilter(): void {
    const value = this.documentIdControl.value.trim();
    this.message.set(value ? `Показаны события для документа ${value}.` : 'Показаны все события.');
  }
}
