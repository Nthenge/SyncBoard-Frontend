import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { TalkService } from '../../services/talk.service';
import { Issue } from '../../models/board.models';
import { LoginComponent } from '../auth/login/login.component';
import { FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { RegisterComponent } from '../auth/register/register.component';
import { ForgotPasswordComponent } from '../auth/forgot-password/forgot-password.component';

type InfoModalType = 'privacy' | 'terms' | 'security' | 'careers' | null;

function passwordsMatchValidator(): ValidatorFn {
  return (group): ValidationErrors | null => {
    const pass = group.get('newPassword')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pass && confirm && pass !== confirm ? { mismatch: true } : null;
  };
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, LoginComponent, RegisterComponent, ForgotPasswordComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})

export class LandingComponent implements OnInit {

  constructor(private fb: FormBuilder) {
  this.resetForm = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: passwordsMatchValidator() }
  );
}

  private talkService = inject(TalkService);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  authModal = signal<'login' | 'register' | 'forgot' | 'confirm' | 'reset' |null>(null);
  resetState = signal<'no-token' | 'form' | 'submitting' | 'success'>('form');
  resetSubmitError = signal('');
  resetShowPassword = signal(false);
  resetToken = '';

  resetForm: FormGroup;

  confirmState = signal<'loading' | 'already-confirmed' | 'success' | 'error'>('loading');
  confirmErrorMessage = signal('');

  infoModal = signal<InfoModalType>(null);
  privacyAgreed = signal(false);

  issues = signal<Issue[]>([]);
  registerPrefillEmail = signal('');
  

  onSwitchToRegister(email: string): void {
    this.registerPrefillEmail.set(email || '');
    this.authModal.set('register');
  }

  talkForm = {
    fullName: '',
    email: '',
    message: '',
    issueId: null as number | null
  };
  talkSubmitting = signal(false);
  talkSuccess = signal(false);
  talkError = signal('');

  features = [
    { icon: '📋', title: 'Visual Boards', description: 'Organize work visually with boards that represent projects, goals, or any workflow.' },
    { icon: '📝', title: 'Lists & Cards', description: 'Break down work into lists and cards to track every detail.' },
    { icon: '⚡', title: 'Real-Time Collaboration', description: 'Work together instantly — see changes as they happen.' },
    { icon: '🔧', title: 'Custom Workflows', description: 'Create custom lists and workflows that fit your team\'s needs.' }
  ];

  howItWorks = [
    { step: 1, title: 'Create Board', description: 'Start by creating a new board for your project' },
    { step: 2, title: 'Add Lists', description: 'Add lists to organize your workflow stages' },
    { step: 3, title: 'Add Cards', description: 'Create cards for tasks and drag them through your workflow' }
  ];

  ngOnInit(): void {
     const token = this.route.snapshot.queryParamMap.get('token');
    const isResetPassword = this.route.snapshot.url.some(seg => seg.path === 'reset-password');

    if (token && isResetPassword) {
      this.resetToken = token;
      this.authModal.set('reset');
      this.resetState.set('form');
    } else if (token) {
      this.authModal.set('confirm');
      this.confirmAccount(token);
    }
    this.talkService.getActiveIssues().subscribe({
        next: (response: any) => {
            const list = Array.isArray(response) ? response : (response?.data ?? []);
            this.issues.set(list);
        },
        error: () => {}
    });
  }

  openInfoModal(type: Exclude<InfoModalType, null>): void {
    this.infoModal.set(type);
  }

  get resetNewPassword() {
  return this.resetForm.get('newPassword');
}

get resetConfirmPassword() {
  return this.resetForm.get('confirmPassword');
}

toggleResetPasswordVisibility(): void {
  this.resetShowPassword.set(!this.resetShowPassword());
}

async submitResetPassword(): Promise<void> {
  this.resetSubmitError.set('');

  if (this.resetForm.invalid) {
    this.resetForm.markAllAsTouched();
    return;
  }

  this.resetState.set('submitting');

  try {
    await this.authService.resetPassword(this.resetToken, this.resetNewPassword?.value);
    this.resetState.set('success');
  } catch (err: unknown) {
    this.resetState.set('form');
    const httpError = err as { error?: { message?: string } };
    this.resetSubmitError.set(
      httpError?.error?.message || 'This reset link is invalid or has expired. Request a new one.'
    );
  }
}

  closeInfoModal(): void {
    this.infoModal.set(null);
  }

  private confirmAccount(token: string): void {
  this.authService.confirmAccount(token).subscribe({
    next: () => this.confirmState.set('success'),
    error: (err) => {
      const message: string = err?.error?.message || '';
      if (message.toLowerCase().includes('already confirmed')) {
        this.confirmState.set('already-confirmed');
      } else {
        this.confirmState.set('error');
        this.confirmErrorMessage.set(message || 'This link is invalid or has expired.');
      }
    }
  });
}

  agreeToPrivacy(): void {
    this.privacyAgreed.set(true);
    this.infoModal.set(null);
  }

  handlePrivacyCheckboxClick(event: MouseEvent): void {
    if (!this.privacyAgreed()) {
      event.preventDefault();
      this.openInfoModal('privacy');
    }
  }

  handlePrivacyCheckboxChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.privacyAgreed.set(checked);
  }

  submitTalk(): void {
    const { fullName, email, message, issueId } = this.talkForm;

    if (!fullName.trim() || !email.trim() || !message.trim() || !issueId) {
      this.talkError.set('Please fill in all fields.');
      return;
    }

    if (!this.privacyAgreed()) {
      this.talkError.set('Please agree to the Privacy Policy first.');
      return;
    }

    this.talkSubmitting.set(true);
    this.talkError.set('');

    this.talkService.sendMessage({ fullName, email, message, issueId }).subscribe({
      next: () => {
        this.talkSubmitting.set(false);
        this.talkSuccess.set(true);
        this.talkForm = { fullName: '', email: '', message: '', issueId: null };
        this.privacyAgreed.set(false);
      },
      error: (err) => {
        this.talkSubmitting.set(false);
        this.talkError.set(err?.error?.message || 'Failed to send message. Please try again.');
      }
    });
  }
}