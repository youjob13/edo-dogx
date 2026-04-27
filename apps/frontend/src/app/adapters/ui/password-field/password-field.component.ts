import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { TuiButton } from '@taiga-ui/core/components/button';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';

@Component({
  selector: 'edo-dogx-password-field',
  imports: [ReactiveFormsModule, TuiButton, TuiTextfield],
  templateUrl: './password-field.component.html',
  styleUrl: './password-field.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordFieldComponent {
  private static nextId = 0;

  public readonly label = input('Пароль');
  public readonly autocomplete = input('current-password');
  public readonly control = input.required<FormControl<string>>();

  protected readonly inputId = `password-field-${PasswordFieldComponent.nextId++}`;
  protected readonly showPasswordAriaLabel = $localize`:@@auth.passwordField.showAria:Показать пароль`;
  protected readonly hidePasswordAriaLabel = $localize`:@@auth.passwordField.hideAria:Скрыть пароль`;

  public readonly visibilityChange = output<boolean>();
  public readonly focusChange = output<boolean>();
  public readonly typingChange = output<boolean>();

  protected readonly visible = signal(false);

  private typingTimer: ReturnType<typeof setTimeout> | null = null;

  protected toggleVisibility(): void {
    this.visible.update((current) => !current);
    this.visibilityChange.emit(this.visible());
  }

  protected onFocus(): void {
    this.focusChange.emit(true);
  }

  protected onBlur(): void {
    this.focusChange.emit(false);
    this.typingChange.emit(false);
  }

  protected onInput(): void {
    this.typingChange.emit(true);

    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    this.typingTimer = setTimeout(() => {
      this.typingChange.emit(false);
      this.typingTimer = null;
    }, 260);
  }
}