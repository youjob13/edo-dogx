import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../design-system/ui-kit';

type CategoryCode = 'HR' | 'FINANCE' | 'GENERAL';

interface CategoryWorkflowView {
  category: CategoryCode;
  workflowCode: string;
  retentionClass: string;
  visibilityRule: string;
}

@Component({
  selector: 'edo-dogx-category-workflow',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, ButtonComponent],
  template: `
    <edo-dogx-page-section
      title="Категорийные маршруты"
      subtitle="HR и FINANCE обрабатываются по отдельным политикам"
    >
      <edo-dogx-card title="Назначение категории" subtitle="Выбор маршрута и видимости документа">
        <form class="category-workflow__form" (submit)="$event.preventDefault(); applyCategory()">
          <label>
            <span>Категория</span>
            <select [formControl]="categoryControl">
              @for (item of categories; track item.value) {
                <option [value]="item.value">{{ item.label }}</option>
              }
            </select>
          </label>

          <edo-dogx-button label="Применить политику" appearance="primary" size="m" (pressed)="applyCategory()" />
        </form>

        @if (message()) {
          <p class="category-workflow__message" aria-live="polite">{{ message() }}</p>
        }
      </edo-dogx-card>

      <edo-dogx-card title="Параметры маршрута" subtitle="Ограничения видимости и хранения">
        @if (selected(); as cfg) {
          <div class="category-workflow__details">
            <p><strong>Категория:</strong> {{ cfg.category }}</p>
            <p><strong>Workflow:</strong> {{ cfg.workflowCode }}</p>
            <p><strong>Срок хранения:</strong> {{ cfg.retentionClass }}</p>
            <p><strong>Видимость:</strong> {{ cfg.visibilityRule }}</p>
          </div>
        }
      </edo-dogx-card>
    </edo-dogx-page-section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .category-workflow__form {
        display: grid;
        gap: 0.75rem;
      }

      .category-workflow__form label {
        display: grid;
        gap: 0.35rem;
      }

      .category-workflow__form span {
        font-size: 0.75rem;
        color: var(--edo-ui-ink-muted);
      }

      .category-workflow__form select {
        border-radius: var(--edo-ui-radius-m);
        border: 1px solid var(--edo-ui-border-subtle);
        background: var(--edo-ui-surface-primary);
        color: var(--edo-ui-ink-primary);
        min-height: 2.25rem;
        font: inherit;
        padding: 0.4rem 0.65rem;
      }

      .category-workflow__message {
        margin-top: 0.75rem;
        color: var(--edo-ui-ink-muted);
      }

      .category-workflow__details {
        display: grid;
        gap: 0.35rem;
      }

      .category-workflow__details p {
        margin: 0;
        color: var(--edo-ui-ink-muted);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryWorkflowComponent {
  protected readonly categories = [
    { value: 'GENERAL', label: 'GENERAL' },
    { value: 'HR', label: 'HR' },
    { value: 'FINANCE', label: 'FINANCE' },
  ] as const;

  protected readonly categoryControl = new FormControl<CategoryCode>('GENERAL', {
    nonNullable: true,
  });

  protected readonly message = signal('');

  private readonly policies: Record<CategoryCode, CategoryWorkflowView> = {
    GENERAL: {
      category: 'GENERAL',
      workflowCode: 'general-approval',
      retentionClass: 'GENERAL_DEFAULT',
      visibilityRule: 'Доступ для стандартных ролей EDMS',
    },
    HR: {
      category: 'HR',
      workflowCode: 'hr-approval',
      retentionClass: 'HR_STANDARD',
      visibilityRule: 'Только роли HR и администратор',
    },
    FINANCE: {
      category: 'FINANCE',
      workflowCode: 'finance-approval',
      retentionClass: 'FINANCE_LONG',
      visibilityRule: 'Только роли FINANCE и администратор',
    },
  };

  protected readonly selected = computed(() => this.policies[this.categoryControl.value]);

  protected applyCategory(): void {
    const category = this.categoryControl.value;
    const cfg = this.policies[category];
    this.message.set(`Для категории ${cfg.category} применен маршрут ${cfg.workflowCode}.`);
  }
}
