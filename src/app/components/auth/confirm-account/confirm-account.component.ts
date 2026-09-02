import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../services/auth.service'; // adjust path to your project

type ConfirmState = 'loading' | 'success' | 'already-confirmed' | 'error';

@Component({
  selector: 'app-confirm-account',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './confirm-account.component.html',
  styleUrls: ['./confirm-account.component.scss']
})
export class ConfirmAccountComponent implements OnInit {
  state: ConfirmState = 'loading';
  errorMessage = '';
  currentYear = new Date().getFullYear();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.state = 'error';
      this.errorMessage = 'This confirmation link is missing its token.';
      return;
    }

    this.authService.confirmAccount(token).subscribe({
      next: () => {
        this.state = 'success';
      },
      error: (err) => {
        // Backend throws ResourceAlreadyExistsException("Account already confirmed, please login")
        // and ResourceNotFoundException("User not found") - adjust matching if your
        // global exception handler shapes errors differently.
        const message: string = err?.error?.message || '';

        if (message.toLowerCase().includes('already confirmed')) {
          this.state = 'already-confirmed';
        } else {
          this.state = 'error';
          this.errorMessage = message || 'This link is invalid or has expired.';
        }
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}