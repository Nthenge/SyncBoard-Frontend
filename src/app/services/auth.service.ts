import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { User, LoginCredentials, RegisterCredentials, AuthResponse, DeleteAccountResponse } from '../models/auth.models';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { firstValueFrom, Observable, tap } from 'rxjs';

export interface RefreshTokenResponse {
    success: boolean;
    message: string;
    path: string;
    timestamp: string;
    data: {
        token: string;
        refreshToken: string;
    };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private currentUserSignal = signal<User | null>(null);
    private tokenSignal = signal<string | null>(null);
    private refreshTokenSignal = signal<string | null>(null);
    private loadingSignal = signal<boolean>(false);

    user = computed(() => this.currentUserSignal());
    isLoggedIn = computed(() => !!this.tokenSignal());
    isLoading = computed(() => this.loadingSignal());

    isAdmin(): boolean {
        const token = this.tokenSignal();
        if (!token) return false;

        try {
            const payload = this.decodeJwtPayload(token);
            const role = payload?.role;
            const roles = payload?.roles;

            if (typeof role === 'string' && role.toLowerCase() === 'admin') return true;
            if (Array.isArray(roles) && roles.some(r => String(r).toLowerCase() === 'admin')) return true;

            return false;
        } catch {
            return false;
        }
    }

    private decodeJwtPayload(token: string): any {
        const parts = token.split('.');
        if (parts.length < 2) return null;

        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );

        return JSON.parse(jsonPayload);
    }

    constructor(private router: Router, private http: HttpClient) {
        this.loadStoredAuth();
    }

    private loadStoredAuth(): void {
        const token = localStorage.getItem('syncboard_token');
        const refreshToken = localStorage.getItem('syncboard_refresh_token');
        const user = localStorage.getItem('syncboard_user');

        if (token && user) {
            this.tokenSignal.set(token);
            this.refreshTokenSignal.set(refreshToken);
            this.currentUserSignal.set(JSON.parse(user));
        }
    }

    private saveAuth(response: AuthResponse): void {
        const userWithName = {
            ...response.data,
            name: `${response.data.firstName} ${response.data.sirName ?? ''}`.trim()
        };
        localStorage.setItem('syncboard_token', response.data.token);
        if (response.data.refreshToken) {
            localStorage.setItem('syncboard_refresh_token', response.data.refreshToken);
            this.refreshTokenSignal.set(response.data.refreshToken);
        }
        localStorage.setItem('syncboard_user', JSON.stringify(userWithName));
        this.tokenSignal.set(response.data.token);
        this.currentUserSignal.set(userWithName);
    }

    async markOnboardingComplete(): Promise<void> {
        const token = this.getAccessToken();
        if (!token) return;

        const current = this.currentUserSignal();
        if (current) {
            const updated = { ...current, hasSeenOnboarding: true };
            localStorage.setItem('syncboard_user', JSON.stringify(updated));
            this.currentUserSignal.set(updated as User);
        }

        try {
            await firstValueFrom(
                this.http.patch(
                    `${environment.apiUrl}${environment.api?.basePath ?? ''}/user/onboarding-complete`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                )
            );
        } catch (error) {
            console.warn('Failed to persist onboarding status', error);
        }
    }

    getAccessToken(): string | null {
        return this.tokenSignal() || localStorage.getItem('syncboard_token');
    }

    getRefreshToken(): string | null {
        return this.refreshTokenSignal() || localStorage.getItem('syncboard_refresh_token');
    }

    /**
     * Called by the HttpInterceptor when an access token expires (401).
     * Requests a new token using the saved refreshToken.
     */
    refreshToken(): Observable<RefreshTokenResponse> {
        const refreshToken = this.getRefreshToken();
        
        const url = `${environment.apiUrl}${environment.api?.basePath ?? ''}/user/refresh`;

        return this.http.post<RefreshTokenResponse>(url, { refreshToken }).pipe(
            tap(response => {
                if (response?.data?.token) {
                    localStorage.setItem('syncboard_token', response.data.token);
                    this.tokenSignal.set(response.data.token);

                    if (response.data.refreshToken) {
                        localStorage.setItem('syncboard_refresh_token', response.data.refreshToken);
                        this.refreshTokenSignal.set(response.data.refreshToken);
                    }
                }
            })
        );
    }

    async login(credentials: LoginCredentials): Promise<void> {
        this.loadingSignal.set(true);
        try {
            const response = await firstValueFrom(
                this.http.post<AuthResponse>(
                    `${environment.apiUrl}${environment.api.basePath}${environment.api.endpoints.auth.login}`,
                    credentials
                )
            );
            if (response) {
                this.saveAuth(response);
                this.router.navigate(['/workspaces']);
            } else {
                throw new Error('Login failed: No response from server');
            }
        } catch (error: any) {
            const backendMessage = error?.error?.message;
            throw new Error(backendMessage || 'Login failed. Please try again.');
        } finally {
            this.loadingSignal.set(false);
        }
    }

    async register(credentials: RegisterCredentials): Promise<void> {
        this.loadingSignal.set(true);
        try {
            await firstValueFrom(
                this.http.post(
                    `${environment.apiUrl}${environment.api.basePath}${environment.api.endpoints.auth.register}`,
                    credentials
                )
            );
        } catch (error: any) {
            const backendMessage = error?.error?.message;
            throw new Error(backendMessage || 'Registration failed. Please try again.');
        } finally {
            this.loadingSignal.set(false);
        }
    }

    logout(): void {
        const token = this.getAccessToken();

        if (!token) {
            this.finishLogout();
            return;
        }

        this.http.put(
            `${environment.apiUrl}${environment.api?.basePath ?? ''}/user/logout`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
        ).subscribe({
            next: () => this.finishLogout(),
            error: () => this.finishLogout()
        });
    }

    private finishLogout(): void {
        this.clearAllAuthData();
        this.router.navigate(['/']);
    }

    verifyEmail(token: string): Promise<boolean> {
        return firstValueFrom(
            this.http.get<{ success: boolean }>(
                `${environment.apiUrl}${environment.api.basePath}${environment.api.endpoints.auth.verifyEmail}?token=${token}`
            )
        ).then(response => {
            if (response?.success) {
                localStorage.setItem('email_verified', 'true');
                localStorage.removeItem('verification_error');
                return true;
            } else {
                localStorage.setItem('verification_error', 'Verification failed');
                return false;
            }
        }).catch(() => {
            localStorage.setItem('verification_error', 'Network error during verification');
            return false;
        });
    }

    isEmailVerified(): boolean {
        return localStorage.getItem('email_verified') === 'true';
    }

    clearVerificationStatus(): void {
        localStorage.removeItem('email_verified');
        localStorage.removeItem('verification_error');
    }

    getVerificationError(): string | null {
        return localStorage.getItem('verification_error');
    }

    isUserLoggedIn(): boolean {
        return this.isLoggedIn();
    }

    async forgotPassword(email: string): Promise<void> {
        this.loadingSignal.set(true);
        try {
            await firstValueFrom(
                this.http.post(
                    `${environment.apiUrl}${environment.api.basePath}${environment.api.endpoints.auth.forgotPassword}`,
                    { email }
                )
            );
        } catch (error: any) {
            const backendMessage = error?.error?.message;
            throw new Error(backendMessage || 'Could not process request. Please try again.');
        } finally {
            this.loadingSignal.set(false);
        }
    }

    async updateProfile(update: { firstName?: string; sirName?: string; email?: string; avatarUrl?: string; password?: string }): Promise<void> {
    this.loadingSignal.set(true);
    const token = this.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const current = this.currentUserSignal();
    const payload = {
        firstName: update.firstName ?? current?.firstName ?? '',
        sirName: update.sirName ?? current?.sirName ?? '',
        email: update.email ?? current?.email ?? '',
        avatarUrl: update.avatarUrl ?? (current as any)?.avatarUrl ?? '',
        password: update.password ?? ''
    };

    try {
        const response = await firstValueFrom(
            this.http.put<{ data: any }>(
                `${environment.apiUrl}${environment.api?.basePath ?? ''}/user/update`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            )
        );

        const updated = response?.data;
        if (updated) {
            const userWithName = {
                ...current,
                ...updated,
                name: `${updated.firstName ?? current?.firstName ?? ''} ${updated.sirName ?? current?.sirName ?? ''}`.trim()
            };
            localStorage.setItem('syncboard_user', JSON.stringify(userWithName));
            this.currentUserSignal.set(userWithName as User);
        }
    } catch (error: any) {
        const backendMessage = error?.error?.message;
        throw new Error(backendMessage || 'Could not update profile. Please try again.');
    } finally {
        this.loadingSignal.set(false);
    }
}

async deleteAccount(): Promise<{ success: boolean; message: string }> {
    this.loadingSignal.set(true);
    const token = this.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    try {
        const response = await firstValueFrom(
            this.http.delete<{ success: boolean; message: string }>(
                `${environment.apiUrl}${environment.api?.basePath ?? ''}/user/delete`,
                { headers: { Authorization: `Bearer ${token}` } }
            )
        );

        this.clearAllAuthData();
        this.router.navigate(['/login']);

        return response || { success: true, message: 'Account deleted successfully' };
    } catch (error: any) {
        const backendMessage = error?.error?.message;
        throw new Error(backendMessage || 'Could not delete account. Please try again.');
    } finally {
        this.loadingSignal.set(false);
    }
}

async uploadAvatar(file: File): Promise<string> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await firstValueFrom(
            this.http.post<{ data: { url: string } }>(
                `${environment.apiUrl}${environment.api?.basePath ?? ''}/user/avatar`,
                formData,
                { headers: { Authorization: `Bearer ${token}` } }
            )
        );

        const url = response?.data?.url;
        if (!url) throw new Error('Upload succeeded but no URL was returned.');
        return url;
    } catch (error: any) {
        const backendMessage = error?.error?.message;
        throw new Error(backendMessage || 'Failed to upload image. Please try again.');
    }
}

async fetchAvatarAsBlobUrl(url: string): Promise<string> {
    const blob = await firstValueFrom(
        this.http.get(url, { responseType: 'blob' })
    );
    return URL.createObjectURL(blob);
}

    async resetPassword(token: string, newPassword: string): Promise<void> {
        this.loadingSignal.set(true);
        try {
            await firstValueFrom(
                this.http.post(
                    `${environment.apiUrl}${environment.api.basePath}${environment.api.endpoints.auth.resetPassword}`,
                    { token, newPassword }
                )
            );
        } catch (error: any) {
            const backendMessage = error?.error?.message;
            throw new Error(backendMessage || 'Could not reset password. Please try again.');
        } finally {
            this.loadingSignal.set(false);
        }
    }

    private clearAllAuthData(): void {
        localStorage.removeItem('syncboard_token');
        localStorage.removeItem('syncboard_refresh_token');
        localStorage.removeItem('syncboard_user');
        localStorage.removeItem('registration_complete');
        localStorage.removeItem('email_verified');
        localStorage.removeItem('verification_error');
        this.tokenSignal.set(null);
        this.refreshTokenSignal.set(null);
        this.currentUserSignal.set(null);
    }
}