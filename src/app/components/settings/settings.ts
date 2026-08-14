import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FaqService } from '../../services/faq.service';
import { TalkService } from '../../services/talk.service';
import { FAQ, Issue } from '../../models/board.models';

type SettingsSection =
  | 'support' | 'faq' | 'account' | 'notifications'
  | 'workspaces' | 'boards' | 'terms' | 'privacy' | 'security';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.css']
})
export class SettingsComponent implements OnInit {
  private router = inject(Router);
  private authService = inject(AuthService);
  private faqService = inject(FaqService);
  private talkService = inject(TalkService);

  activeSection = signal<SettingsSection>('support');

  userName = computed(() => {
    const user = this.authService.user();
    return user?.name || user?.email?.split('@')[0] || 'User';
  });

  // Update loadAccountForm() - firstName/sirName/email already prepopulate correctly,
// no change needed there. Just remove avatarUrl from manual text entry flow below.

avatarUploading = signal(false);
avatarError = signal('');

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

  // TODO: point this at the real backend upload endpoint once you share it.
  // Expected: returns { url: string } (or similar) after processing.
  this.authService.uploadAvatar(file).then((url: string) => {
    this.accountForm.avatarUrl = url;
    this.avatarUploading.set(false);
  }).catch((err: Error) => {
    this.avatarUploading.set(false);
    this.avatarError.set(err.message || 'Failed to upload image.');
  });
}

  userEmail = computed(() => this.authService.user()?.email ?? '');
  // ─── Account tab ────────────────────────────────────────────────────────
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
  }).catch((err: Error) => {
    this.deleting.set(false);
    this.deleteError.set(err.message);
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
    this.accountError.set('Passwords do not match.');
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
    this.accountForm.newPassword = '';
    this.accountForm.confirmPassword = '';
    setTimeout(() => this.accountSuccess.set(''), 3000);
  }).catch((err: Error) => {
    this.accountSaving.set(false);
    this.accountError.set(err.message);
  });
}

  // ─── FAQ ────────────────────────────────────────────────────────────────────

  faqs = signal<FAQ[]>([]);
  faqsLoading = signal(false);
  expandedFaqId = signal<number | null>(null);

  // ─── Support: Contact / issue form ──────────────────────────────────────────

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
  if (section === 'account') {
    this.loadAccountForm();
  }
}

  // ─── FAQ ────────────────────────────────────────────────────────────────────

  loadFaqs(): void {
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

  // ─── Issue / contact form ───────────────────────────────────────────────────

  loadIssues(): void {
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
      },
      error: (err: { error?: { message?: string } }) => {
        this.talkSubmitting.set(false);
        this.talkError.set(err?.error?.message || 'Failed to send message. Please try again.');
      }
    });
  }

  sendAnother(): void {
    this.talkSuccess.set(false);
  }
}