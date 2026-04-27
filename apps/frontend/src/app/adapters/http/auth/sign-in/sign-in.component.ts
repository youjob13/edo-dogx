import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormControl,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { AuthUseCases } from '../../../../application/auth/auth.use-cases';
import { ButtonComponent } from '../../../../design-system/ui-kit/button/button.component';
import { InputComponent } from '../../../../design-system/ui-kit/input/input.component';
import { AuthCatComponent } from '../../../ui/auth-cat/auth-cat.component';
import { PasswordFieldComponent } from '../../../ui/password-field/password-field.component';

@Component({
  selector: 'edo-dogx-auth-sign-in',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    InputComponent,
    AuthCatComponent,
    PasswordFieldComponent,
  ],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInComponent {
  private readonly fb = inject(FormBuilder);
  private readonly useCases = inject(AuthUseCases);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly passwordFocused = signal(false);
  protected readonly passwordTyping = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly emailControl: FormControl<string> = this.form.controls.email;
  protected readonly passwordControl: FormControl<string> = this.form.controls.password;

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.loading.set(true);

    this.useCases
      .signIn(this.form.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.submitError.set(
            $localize`:@@auth.signIn.submitError:Не удалось войти прямо сейчас. Попробуйте ещё раз.`,
          );
        },
      });
  }

  protected onPasswordVisibilityChange(visible: boolean): void {
    this.passwordVisible.set(visible);
  }

  protected onPasswordFocusChange(focused: boolean): void {
    this.passwordFocused.set(focused);
  }

  protected onPasswordTypingChange(typing: boolean): void {
    this.passwordTyping.set(typing);
  }

  protected onSocialClick(provider: string): void {
    this.submitError.set(
      $localize`:@@auth.social.loginNotReady:Вход через ${provider}:provider: пока не подключён.`,
    );
  }
}