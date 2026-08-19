import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FaqService } from '../../services/faq.service';
import { TalkService } from '../../services/talk.service';
import { FAQ, Issue } from '../../models/board.models';
import { NotificationPreferenceService } from '../../services/notification-preference.service';
import { NotificationPreference } from '../../models/board.models';
import { ToastService } from '../../services/toast.service';
import { ToastComponent } from '../toast/toast.component';

type SettingsSection =
  | 'support' | 'faq' | 'account' | 'notifications'
  | 'workspaces' | 'boards' | 'terms' | 'privacy' | 'security';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ToastComponent],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css']
})
export class SettingsComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private faqService = inject(FaqService);
  private talkService = inject(TalkService);
  private notificationPreferenceService = inject(NotificationPreferenceService);
  private toast = inject(ToastService);

  activeSection = signal<SettingsSection>('support');

  userName = computed(() => {
    const user = this.authService.user();
    return user?.name || user?.email?.split('@')[0] || 'User';
  });

  avatarUploading = signal(false);
  avatarError = signal('');
  notifPrefs = signal<NotificationPreference | null>(null);
  notifPrefsLoading = signal(false);
  notifPrefsSaving = signal(false);
  notifPrefsSaved = signal(false);
  notifPrefsError = signal('');

  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.avatarError.set('Please select an image file.');
      return;
    }

    this.avatarUploading.set(true);
    this.avatarError.set('');
    this.authService.uploadAvatar(file).then((url: string) => {
      this.accountForm.avatarUrl = url;
      this.avatarUploading.set(false);
      this.toast.show('Profile picture updated.', 'success');
    }).catch((err: Error) => {
      this.avatarUploading.set(false);
      const message = err.message || 'Failed to upload image.';
      this.avatarError.set(message);
      this.toast.show(message, 'error');
    });
  }

  userEmail = computed(() => this.authService.user()?.email ?? '');
  accountForm = {
    firstName: '',
    sirName: '',
    email: '',
    avatarUrl: '',
    newPassword: '',
    confirmPassword: ''
  };

  accountSaving = signal(false);
  accountError = signal('');
  accountSuccess = signal('');

  showDeleteConfirm = signal(false);
  deleting = signal(false);
  deleteError = signal('');
  // Add state to your Angular Component
navMenuOpen = signal<boolean>(false);

toggleNavMenu() {
  this.navMenuOpen.update(open => !open);
}

  loadNotifPrefs(): void {
    this.notifPrefsLoading.set(true);
    this.notifPrefsError.set('');
    this.notificationPreferenceService.getPreferences().subscribe({
      next: (prefs) => {
        this.notifPrefs.set(prefs);
        this.notifPrefsLoading.set(false);
      },
      error: () => {
        this.notifPrefsLoading.set(false);
        const message = 'Failed to load notification preferences.';
        this.notifPrefsError.set(message);
        this.toast.show(message, 'error');
      }
    });
  }

  toggleNotifPref(key: keyof NotificationPreference): void {
    const current = this.notifPrefs();
    if (!current) return;
    this.notifPrefs.set({ ...current, [key]: !current[key] });
    this.notifPrefsSaved.set(false);
  }

  saveNotifPrefs(): void {
    const prefs = this.notifPrefs();
    if (!prefs) return;

    this.notifPrefsSaving.set(true);
    this.notifPrefsError.set('');
    this.notifPrefsSaved.set(false);

    this.notificationPreferenceService.updatePreferences(prefs).subscribe({
      next: (updated) => {
        this.notifPrefs.set(updated);
        this.notifPrefsSaving.set(false);
        this.notifPrefsSaved.set(true);
        this.toast.show('Notification preferences saved.', 'success');
        setTimeout(() => this.notifPrefsSaved.set(false), 3000);
      },
      error: (err: { error?: { message?: string } }) => {
        this.notifPrefsSaving.set(false);
        const message = err?.error?.message || 'Failed to save. Please try again.';
        this.notifPrefsError.set(message);
        this.toast.show(message, 'error');
      }
    });
  }

  openDeleteConfirm(): void {
    this.deleteError.set('');
    this.showDeleteConfirm.set(true);
  }

  closeDeleteConfirm(): void {
    if (this.deleting()) return;
    this.showDeleteConfirm.set(false);
  }

  confirmDeleteAccount(): void {
    this.deleting.set(true);
    this.deleteError.set('');

    this.authService.deleteAccount().then(() => {
      this.deleting.set(false);
      this.toast.show('Account deleted.', 'success');
    }).catch((err: Error) => {
      this.deleting.set(false);
      this.deleteError.set(err.message);
      this.toast.show(err.message || 'Failed to delete account. Please try again.', 'error');
    });
  }

  loadAccountForm(): void {
    const user = this.authService.user();
    if (!user) return;
    this.accountForm.firstName = user.firstName || '';
    this.accountForm.sirName = user.sirName || '';
    this.accountForm.email = user.email || '';
    this.accountForm.avatarUrl = (user as any).avatarUrl || '';
    this.accountForm.newPassword = '';
    this.accountForm.confirmPassword = '';
  }

  saveAccount(): void {
    this.accountError.set('');
    this.accountSuccess.set('');

    if (this.accountForm.newPassword && this.accountForm.newPassword !== this.accountForm.confirmPassword) {
      const message = 'Passwords do not match.';
      this.accountError.set(message);
      this.toast.show(message, 'error');
      return;
    }

    this.accountSaving.set(true);

    this.authService.updateProfile({
      firstName: this.accountForm.firstName.trim(),
      sirName: this.accountForm.sirName.trim(),
      email: this.accountForm.email,
      avatarUrl: this.accountForm.avatarUrl,
      password: this.accountForm.newPassword || undefined
    }).then(() => {
      this.accountSaving.set(false);
      this.accountSuccess.set('Profile updated successfully.');
      this.toast.show('Profile updated.', 'success');
      this.accountForm.newPassword = '';
      this.accountForm.confirmPassword = '';
      setTimeout(() => this.accountSuccess.set(''), 3000);
    }).catch((err: Error) => {
      this.accountSaving.set(false);
      this.accountError.set(err.message);
      this.toast.show(err.message || 'Failed to update profile. Please try again.', 'error');
    });
  }

  faqs = signal<FAQ[]>([]);
  faqsLoading = signal(false);
  expandedFaqId = signal<number | null>(null);

  issues = signal<Issue[]>([]);

  talkForm = {
    fullName: '',
    email: '',
    message: '',
    issueId: null as number | null
  };
  talkSubmitting = signal(false);
  talkSuccess = signal(false);
  talkError = signal('');

  ngOnInit(): void {
    this.loadFaqs();
    this.loadIssues();

    this.talkForm.fullName = this.userName();
    this.talkForm.email = this.userEmail();
  }

  goBack(): void {
    this.router.navigate(['/workspaces']);
  }

  selectSection(section: SettingsSection): void {
    this.activeSection.set(section);
    this.navMenuOpen.set(false);
    if (section === 'account') {
      this.loadAccountForm();
    }
    if (section === 'notifications') {
      this.loadNotifPrefs();
    }
  }

  loadFaqs(): void {
    // Passive load — no toast, avoids greeting the user with an error on page open.
    this.faqsLoading.set(true);
    this.faqService.getActiveFaqs().subscribe({
      next: (faqs) => {
        this.faqs.set(faqs);
        this.faqsLoading.set(false);
      },
      error: () => {
        this.faqs.set([]);
        this.faqsLoading.set(false);
      }
    });
  }

  toggleFaq(faq: FAQ): void {
    this.expandedFaqId.set(this.expandedFaqId() === faq.id ? null : faq.id);
  }

  loadIssues(): void {
    // Passive load — no toast for the same reason as loadFaqs.
    this.talkService.getActiveIssues().subscribe({
      next: (response: any) => {
        const list = Array.isArray(response) ? response : (response?.data ?? []);
        this.issues.set(list);
      },
      error: () => this.issues.set([])
    });
  }

  submitTalk(): void {
    const { fullName, email, message, issueId } = this.talkForm;

    if (!fullName.trim() || !email.trim() || !message.trim() || !issueId) {
      this.talkError.set('Please fill in all fields, including the issue type.');
      return;
    }

    this.talkSubmitting.set(true);
    this.talkError.set('');

    this.talkService.sendMessage({ fullName, email, message, issueId }).subscribe({
      next: () => {
        this.talkSubmitting.set(false);
        this.talkSuccess.set(true);
        this.talkForm.message = '';
        this.talkForm.issueId = null;
        this.toast.show('Message sent to support.', 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        this.talkSubmitting.set(false);
        const message = err?.error?.message || 'Failed to send message. Please try again.';
        this.talkError.set(message);
        this.toast.show(message, 'error');
      }
    });
  }

  sendAnother(): void {
    this.talkSuccess.set(false);
  }
}