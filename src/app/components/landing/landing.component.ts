import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TalkService } from '../../services/talk.service';
import { Issue } from '../../models/board.models';
import { LoginComponent } from '../auth/login/login.component';
import { RegisterComponent } from '../auth/register/register.component';
import { ForgotPasswordComponent } from '../auth/forgot-password/forgot-password.component';

type InfoModalType = 'privacy' | 'terms' | 'security' | 'careers' | null;

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, LoginComponent, RegisterComponent, ForgotPasswordComponent],
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss']
})
export class LandingComponent implements OnInit {
  private talkService = inject(TalkService);

  authModal = signal<'login' | 'register' | 'forgot' | null>(null);

  infoModal = signal<InfoModalType>(null);
  privacyAgreed = signal(false);

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

  closeInfoModal(): void {
    this.infoModal.set(null);
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