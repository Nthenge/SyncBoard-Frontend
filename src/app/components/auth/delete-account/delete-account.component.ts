import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-delete-account',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './delete-account.component.html',
    styleUrl: './delete-account.component.css'
})
export class DeleteAccountComponent {
    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private router = inject(Router);

    deleteForm = this.fb.group({
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmDelete: ['', [Validators.required, Validators.pattern('DELETE')]]
    });

    loading = signal(false);
    error = signal('');
    success = signal(false);
    showPassword = signal(false);

    get userName(): string {
        const user = this.authService.user();
        return user?.name || user?.email?.split('@')[0] || 'User';
    }

    get userEmail(): string {
        return this.authService.user()?.email || '';
    }

    togglePasswordVisibility(): void {
        this.showPassword.update(value => !value);
    }

    async onSubmit() {
        if (this.deleteForm.invalid) {
            Object.values(this.deleteForm.controls).forEach(control => control.markAsTouched());
            return;
        }

        this.loading.set(true);
        this.error.set('');

        try {
            const { password } = this.deleteForm.value;
            await this.authService.deleteAccount();
            this.success.set(true);
        } catch (err) {
            this.error.set(err instanceof Error ? err.message : 'Failed to delete account. Please check your password.');
        } finally {
            this.loading.set(false);
        }
    }

    cancel(): void {
        this.router.navigate(['/boards']);
    }
}

