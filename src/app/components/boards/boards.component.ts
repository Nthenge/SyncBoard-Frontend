import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BoardService } from '../../services/board.service';
import { WorkspaceService } from '../../services/workspace.service';
import { UserMenuComponent } from '../auth/user-menu/user-menu.component';
import { Board, CreateBoardRequest } from '../../models/board.models';

@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [CommonModule, FormsModule, UserMenuComponent],
  templateUrl: './boards.component.html',
  styleUrls: ['./boards.component.css']
})
export class BoardsComponent implements OnInit {
  trackByBoardId(_index: number, board: Board): string | number {
  return board.id;
}
  trackByMemberEmail(_index: number, member: any): string {
    return member?.email || member?.userId || member?.name;
  }

  private authService = inject(AuthService);
  private boardService = inject(BoardService);
  private workspaceService = inject(WorkspaceService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  workspaceId = signal('');

  boards = signal<Board[]>([]);
  loading = signal(true);
  creating = signal(false);
  showCreateModal = signal(false);
  newBoardName = '';
  selectedColor = '#0079bf';
  searchQuery = '';

  showInviteModal = signal(false);
  inviting = signal(false);
  inviteEmail = '';
  inviteError = signal('');
  inviteSuccess = signal(false);

  boardColors = [
    '#0079bf', '#61bd4f', '#f2d600',
    '#ff9f1a', '#eb5a46', '#c377e0',
    '#0079bf', '#51e898',
  ];

  userName = computed(() => {
    const user = this.authService.user();
    return user?.name || user?.email?.split('@')[0] || 'User';
  });

  filteredBoards = computed(() => {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) return this.boards();
    return this.boards().filter(b => b.boardName.toLowerCase().includes(query));
  });

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    this.loadBoards();
  }

  loadBoards(): void {
    this.loading.set(true);
    this.boardService.getBoardsByWorkspace(this.workspaceId()).subscribe({
      next: (boards: Board[]) => {
        this.boards.set(boards);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  filterBoards(): void {}

  openBoard(boardId: string | number): void {
  this.router.navigate(['/board', boardId]);
}


  goBack(): void {
    this.router.navigate(['/workspaces']);
  }

  createBoard(): void {
    if (!this.newBoardName.trim()) return;
    this.creating.set(true);

    const request: CreateBoardRequest = {
      boardName: this.newBoardName.trim(),
      workSpaceId: this.workspaceId(),
      boardColor: this.selectedColor
    };


    this.boardService.createBoard(request).subscribe({
      next: () => {
        this.showCreateModal.set(false);
        this.newBoardName = '';
        this.creating.set(false);
        this.loadBoards();
      },
      error: () => this.creating.set(false)
    });
  }

  openInviteModal(): void {
    this.inviteEmail = '';
    this.inviteError.set('');
    this.inviteSuccess.set(false);
    this.showInviteModal.set(true);
  }

  closeInviteModal(): void {
    this.showInviteModal.set(false);
    this.inviteEmail = '';
    this.inviteError.set('');
    this.inviteSuccess.set(false);
  }

  sendInvite(): void {
    const emails = this.inviteEmail
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0);

    const invalidEmails = emails.filter(e => !this.isValidEmail(e));

    if (emails.length === 0 || invalidEmails.length > 0) {
      this.inviteError.set(
        invalidEmails.length > 0
          ? `Invalid email(s): ${invalidEmails.join(', ')}`
          : 'Please enter at least one email address.'
      );
      return;
    }

    this.inviting.set(true);
    this.inviteError.set('');

    this.workspaceService.inviteMember({
      workSpaceId: this.workspaceId(),
      invitations: emails.map(email => ({ email, role: 'member' }))
    }).subscribe({
      next: () => {
        this.inviting.set(false);
        this.inviteSuccess.set(true);
      },
      error: (err: { error?: { message?: string } }) => {
        this.inviting.set(false);
        this.inviteError.set(err?.error?.message || 'Failed to send invite. Please try again.');
      }
    });
  }

  // If backend returns boardColor as a hex (e.g. #0079bf), use it; otherwise fall back to hashing.
  getBoardColor(board: Board): string {
    if (!board?.id) return 'linear-gradient(135deg, #0079bf 0%, #026aa7 100%)';

    // Preferred: value returned from API
    if (board.boardColor) {
      return `linear-gradient(135deg, ${board.boardColor} 0%, rgba(2,106,167,1) 100%)`;
    }

    // Fallback: deterministic gradient by id
    const colors = [
      'linear-gradient(135deg, #0079bf 0%, #026aa7 100%)',
      'linear-gradient(135deg, #61bd4f 0%, #519839 100%)',
      'linear-gradient(135deg, #f2d600 0%, #d9b51c 100%)',
      'linear-gradient(135deg, #ff9f1a 0%, #e6891a 100%)',
      'linear-gradient(135deg, #eb5a46 0%, #cf513d 100%)',
      'linear-gradient(135deg, #c377e0 0%, #a855c7 100%)',
      'linear-gradient(135deg, #51e898 0%, #3dcc7a 100%)',
    ];
    const idStr = String(board.id);
    const index = idStr.charCodeAt(idStr.length - 1) % colors.length;
    return colors[index];
  }


  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.charAt(0).toUpperCase();
  }

  toggleStar(board: Board, event: Event): void {
    event.stopPropagation();
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}