import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing.component';
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { BoardsComponent } from './components/boards/boards.component';
import { BoardDetailComponent } from './components/board-detail/board-detail.component';
import { EmailConfirmComponent } from './components/auth/email-confirm/email-confirm.component';
import { ForgotPasswordComponent } from './components/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/auth/reset-password/reset-password.component';
import { DeleteAccountComponent } from './components/auth/delete-account/delete-account.component';
import { WorkspacesComponent } from './components/workspaces/workspaces.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { SupportAdminComponent } from './components/support-admin/support-admin.component';
import { SettingsComponent } from './components/settings/settings';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'confirm-account', component: LandingComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: LandingComponent },
  { path: 'accept-invite/:token', component: EmailConfirmComponent },
  { path: 'delete-account', component: DeleteAccountComponent, canActivate: [authGuard] },
  { path: 'workspaces', component: WorkspacesComponent, canActivate: [authGuard] },
  { path: 'workspaces/:workspaceId/boards', component: BoardsComponent, canActivate: [authGuard] },
  { path: 'board/:id', component: BoardDetailComponent, canActivate: [authGuard] },
  { path: 'support-admin', component: SupportAdminComponent, canActivate: [authGuard, adminGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'boards', redirectTo: 'workspaces' },
  { path: '**', redirectTo: '' }
];