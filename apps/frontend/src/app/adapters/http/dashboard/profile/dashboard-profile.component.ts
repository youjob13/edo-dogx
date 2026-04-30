import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent, PageSectionComponent } from '../../../../design-system/ui-kit';

@Component({
  selector: 'edo-dogx-dashboard-profile',
  imports: [ReactiveFormsModule, PageSectionComponent, CardComponent, ButtonComponent],
  templateUrl: './dashboard-profile.component.html',
  styleUrl: './dashboard-profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardProfileComponent {
  protected readonly fullNameControl = new FormControl('Алексей Петров', { nonNullable: true });
  protected readonly emailControl = new FormControl('a.petrov@edo.local', { nonNullable: true });
  protected readonly departmentControl = new FormControl('Юридический департамент', { nonNullable: true });
  protected readonly positionControl = new FormControl('Старший специалист по документообороту', {
    nonNullable: true,
  });
  protected readonly notifyEmailControl = new FormControl(true, { nonNullable: true });
  protected readonly notifyPushControl = new FormControl(true, { nonNullable: true });
  protected readonly notifyInAppControl = new FormControl(true, { nonNullable: true });
  protected readonly phoneControl = new FormControl('+7 (900) 123-45-67', { nonNullable: true });
  protected readonly vkControl = new FormControl('https://vk.com/alexey.petrov', { nonNullable: true });

  protected readonly avatarUrl = signal<string | null>(null);
  protected readonly message = signal('');

  protected onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.message.set('Файл не выбран.');
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.message.set('Выберите файл изображения (PNG, JPG, WEBP и т.п.).');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        this.avatarUrl.set(result);
        this.message.set(`Аватар "${file.name}" загружен.`);
      }
    };
    reader.readAsDataURL(file);
  }

  protected clearAvatar(): void {
    this.avatarUrl.set(null);
    this.message.set('Аватар удален.');
  }

  protected saveProfile(): void {
    this.message.set('Профиль сохранен (мок-режим).');
  }
}
