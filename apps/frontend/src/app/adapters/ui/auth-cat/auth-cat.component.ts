import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'edo-dogx-auth-cat',
  templateUrl: './auth-cat.component.html',
  styleUrl: './auth-cat.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCatComponent {
  public readonly passwordHidden = input(true);
  public readonly focused = input(false);
  public readonly typing = input(false);

  protected readonly faceClass = computed(() => {
    if (this.passwordHidden()) {
      return 'is-covered';
    }

    if (this.typing()) {
      return 'is-typing';
    }

    if (this.focused()) {
      return 'is-focused';
    }

    return 'is-open';
  });
}