import { Component, inject, signal, computed, OnInit, Input, Output, EventEmitter, HostBinding } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, NgTemplateOutlet],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    @Input() isModal = false;
    @Output() closeModal = new EventEmitter<void>();

    @Output() switchToRegister = new EventEmitter<string>();
    @Output() switchToForgot = new EventEmitter<void>();

    @HostBinding('class.is-modal') get modalClass() { return this.isModal; }

    loginForm = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(6)]]
    });

    loading = signal(false);
    error = signal('');
    successMessage = signal('');

    isLoggedIn = computed(() => this.authService.isLoggedIn());
    userName = computed(() => {
        const user = this.authService.user();
        return user?.name || user?.email?.split('@')[0] || 'User';
    });

    ngOnInit(): void {
        // unchanged from before
        const registrationComplete = localStorage.getItem('registration_complete');
        const emailVerified = this.authService.isEmailVerified();
        const verificationError = this.authService.getVerificationError();

        if (registrationComplete) {
            localStorage.removeItem('registration_complete');
            this.successMessage.set('Account created successfully! Please sign in.');
        } else if (emailVerified) {
            this.authService.clearVerificationStatus();
            this.successMessage.set('Email verified successfully! Please sign in.');
        } else if (verificationError) {
            this.error.set(verificationError);
            this.authService.clearVerificationStatus();
        }
    }

    async onSubmit() {
        if (this.loginForm.invalid) {
            Object.values(this.loginForm.controls).forEach(control => control.markAsTouched());
            return;
        }

        this.loading.set(true);
        this.error.set('');
        this.successMessage.set('');

        try {
            const { email, password } = this.loginForm.value;
            await this.authService.login({ email: email!, password: password! });

            if (this.isModal) {
                this.closeModal.emit();
            }
            this.router.navigate(['/workspaces']);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Login failed';

            if (message.toLowerCase().includes('please register')) {
                const enteredEmail = this.loginForm.value.email ?? '';
                if (this.isModal) {
                    this.switchToRegister.emit(enteredEmail);
                } else {
                    this.router.navigate(['/register'], { queryParams: { email: enteredEmail } });
                }
                return;
            }

            this.error.set(message);
        } finally {
            this.loading.set(false);
        }
    }

    logout(): void {
        localStorage.removeItem('syncboard_token');
        localStorage.removeItem('syncboard_user');
        localStorage.removeItem('registration_complete');
        window.location.reload();
    }

    get email() { return this.loginForm.get('email'); }
    get password() { return this.loginForm.get('password'); }
}