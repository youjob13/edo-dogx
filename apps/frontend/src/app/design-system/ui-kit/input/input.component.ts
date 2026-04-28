import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TuiTextfield } from '@taiga-ui/core/components/textfield';
import { UiKitIconName } from '../ui-kit.models';
import { TuiInputDirective } from "@taiga-ui/core";

let nextInputId = 0;

@Component({
  selector: 'edo-dogx-input',
  imports: [ReactiveFormsModule, TuiTextfield, TuiInputDirective],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InputComponent {
  private readonly generatedId = `edoUiKitInput${nextInputId++}`;

  public readonly label = input<string>();
  public readonly control = input.required<FormControl<string>>();
  public readonly type = input('text');
  public readonly placeholder = input('');
  public readonly autocomplete = input('off');
  public readonly hint = input('');
  public readonly errorText = input('Проверьте это поле.');
  public readonly forceError = input(false);
  public readonly id = input<string | null>(null);
  public readonly leadingIcon = input<UiKitIconName | null>(null);
  public readonly compact = input(false);

  public readonly keyPressedEnter = output<void>();

  protected readonly inputId = (): string => this.id() ?? this.generatedId;

  protected shouldShowError(): boolean {
    const current = this.control();
    return this.forceError() || (current.touched && current.invalid);
  }
}
