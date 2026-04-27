import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TuiCheckbox } from '@taiga-ui/core/components/checkbox';
import { finalize } from 'rxjs';
import { AuthUseCases } from '../../../../application/auth/auth.use-cases';
import { ButtonComponent } from '../../../../design-system/ui-kit/button/button.component';
import { InputComponent } from '../../../../design-system/ui-kit/input/input.component';
import { AuthCatComponent } from '../../../ui/auth-cat/auth-cat.component';
import { PasswordFieldComponent } from '../../../ui/password-field/password-field.component';

const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
};

@Component({
  selector: 'edo-dogx-auth-sign-up',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    TuiCheckbox,
    InputComponent,
    AuthCatComponent,
    PasswordFieldComponent,
  ],
  templateUrl: './sign-up.component.html',
  styleUrl: './sign-up.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignUpComponent {
  private readonly fb = inject(FormBuilder);
  private readonly useCases = inject(AuthUseCases);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly passwordFocused = signal(false);
  protected readonly passwordTyping = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      acceptedTerms: [false, [Validators.requiredTrue]],
    },
    {
      validators: [passwordMatchValidator],
    },
  );

  protected readonly emailControl: FormControl<string> = this.form.controls.email;
  protected readonly passwordControl: FormControl<string> = this.form.controls.password;
  protected readonly confirmPasswordControl: FormControl<string> = this.form.controls.confirmPassword;

  protected submit(): void {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitError.set(null);
    this.loading.set(true);

    this.useCases
      .signUp(this.form.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/dashboard']);
        },
        error: () => {
          this.submitError.set(
            $localize`:@@auth.signUp.submitError:Не удалось создать аккаунт прямо сейчас. Попробуйте ещё раз.`,
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