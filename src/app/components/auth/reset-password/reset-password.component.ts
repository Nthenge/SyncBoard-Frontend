import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service'; // adjust path to your project

type ResetState = 'no-token' | 'form' | 'submitting' | 'success';

function passwordsMatchValidator(): ValidatorFn {
  return (group): ValidationErrors | null => {
    const pass = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass && confirm && pass !== confirm ? { mismatch: true } : null;
  };
}

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  state: ResetState = 'form';
  submitError = '';
  showPassword = false;
  token = '';
  currentYear = new Date().getFullYear();

  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {
    // Built here, not as a field initializer — field initializers run before
    // constructor param properties (like `fb`) are assigned, so `this.fb` would
    // still be undefined if this were declared inline above.
    this.form = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required]
      },
      { validators: passwordsMatchValidator() }
    );
  }

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.state = 'no-token';
      return;
    }

    this.token = token;
    this.state = 'form';
  }

  get newPassword() {
    return this.form.get('newPassword');
  }

  get confirmPassword() {
    return this.form.get('confirmPassword');
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit(): Promise<void> {
    this.submitError = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state = 'submitting';

    try {
      await this.authService.resetPassword(this.token, this.newPassword?.value);
      this.state = 'success';
    } catch (err: unknown) {
      // Backend throws ResourceNotFoundException("User not found") for an
      // invalid/expired reset token via jwtUtil.validateAndExtractEmailFromResetToken.
      this.state = 'form';
      const httpError = err as { error?: { message?: string } };
      this.submitError =
        httpError?.error?.message || 'This reset link is invalid or has expired. Request a new one.';
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  goToForgotPassword(): void {
    this.router.navigate(['/forgot-password']);
  }
}