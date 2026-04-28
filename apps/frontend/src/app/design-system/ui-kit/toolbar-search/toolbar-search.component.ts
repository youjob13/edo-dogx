import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { InputComponent } from '../input/input.component';

@Component({
  selector: 'edo-dogx-toolbar-search',
  imports: [ReactiveFormsModule, InputComponent],
  template: `
    <edo-dogx-input
      [label]="label()"
      [control]="control()"
      [placeholder]="placeholder()"
      [autocomplete]="'off'"
      [id]="id()"
      [compact]="true"
      [leadingIcon]="'search'"
      (keyPressedEnter)="submitted.emit()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolbarSearchComponent {
  public readonly control = input.required<FormControl<string>>();
  public readonly label = input<string>();
  public readonly placeholder = input('Поиск документов');
  public readonly id = input('toolbar-search-input');

  public readonly submitted = output<void>();
}
