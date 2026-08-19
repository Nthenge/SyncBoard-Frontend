import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { BoardService } from '../../services/board.service';
import { WorkspaceService } from '../../services/workspace.service';
import { ListService } from '../../services/list.service';
import { CardService } from '../../services/card.service';
import { BoardMemberService } from '../../services/board-member.service';
import { UserMenuComponent } from '../auth/user-menu/user-menu.component';
import { CardModalComponent } from '../card-modal/card-modal.component';
import { CreateCardRequest, CardPriority } from '../../models/board.models';
import { Board, BoardList, Card, CreateBoardRequest, BoardMemberSummary, AssignedCardSummary } from '../../models/board.models';

@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, UserMenuComponent, CardModalComponent],
  templateUrl: './boards.component.html',
  styleUrls: ['./boards.component.css']
})
export class BoardsComponent implements OnInit, OnDestroy {
  trackByBoardId(_index: number, board: Board): string | number {
    return board.id;
  }

  trackByMemberEmail(_index: number, member: any): string {
    return member?.email || member?.userId || member?.name;
  }

  ngOnDestroy(): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }
  }

  private authService = inject(AuthService);
  private boardService = inject(BoardService);
  private workspaceService = inject(WorkspaceService);
  private listService = inject(ListService);
  private cardService = inject(CardService);
  private boardMemberService = inject(BoardMemberService);
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
  accountMenuOpen = signal(false);

  userEmail = computed(() => this.authService.user()?.email ?? '');
  currentUserId = computed(() => this.authService.user()?.id ?? null);

  toggleAccountMenu(): void {
    this.accountMenuOpen.update(open => !open);
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  openSettings(): void {
    this.router.navigate(['/settings']);
  }

  boardColors = [
    '#0079bf', '#61bd4f', '#f2d600',
    '#ff9f1a', '#eb5a46', '#c377e0',
    '#0079bf', '#51e898',
  ];

  // ─── Right panel: selected board ───────────────────────────────────────────

  selectedBoardId = signal<string | number | null>(null);
  boardLists = signal<BoardList[]>([]);
  listsLoading = signal(false);

  panelMembers = signal<BoardMemberSummary[]>([]);
  membersLoading = signal(false);

  boardMemberCounts = signal<Record<string, number>>({});

  isBoardAdmin = computed(() => {
    const uid = this.currentUserId();
    if (uid == null) return false;
    const member = this.panelMembers().find(m => String(m.userId) === String(uid));
    const role = member?.role?.toLowerCase();
    return role === 'admin' || role === 'owner';
  });

  showCreateCardModal = signal(false);
  createCardTargetListId = signal<string | number | null>(null);
  newCardTitle = '';
  newCardDescription = '';
  newCardPriority = signal<CardPriority | ''>('');
  newCardDueDateInput = '';
  creatingCardModal = signal(false);
  createCardModalError = signal('');
  cardPriorities: CardPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  activeCardListId = signal<string | number | null>(null);
  showNewListInput = signal(false);
  newListName = '';
  listError = signal<string | null>(null);
  listDeleteError = signal<{ listId: string | number; message: string } | null>(null);
  showMembersDropdown = signal(false);
  editingListId = signal<string | number | null>(null);
  listNameEdit = '';
  selectedCard = signal<Card | null>(null);
  reassigningCardId = signal<string | number | null>(null);
  isReassigningInPanel = signal(false);
  workspaceMembers = signal<{ id: number; firstName: string; sirName: string; email: string; avatarUrl?: string }[]>([]);
  showAddMemberPicker = signal(false);
  addingMemberId = signal<string | number | null>(null);
  addMemberError = signal<string | null>(null);
  showEditBoardDropdown = signal(false);
  showEditBoardModal = signal(false);
  showLeaveBoardModal = signal(false);
  showDeleteBoardModal = signal(false);
  editBoardName = '';
  editBoardDescription = '';
  savingBoardEdit = signal(false);
  editBoardError = signal('');
  leavingBoard = signal(false);
  leaveBoardError = signal('');
  deletingBoard = signal(false);
  deleteBoardError = signal('');
  toastMessage = signal<string | null>(null);
  toastType = signal<'error' | 'success'>('error');
  showAssignedCardsModal = signal(false);
  assignedCards = signal<AssignedCardSummary[]>([]);
  assignedCardsLoading = signal(false);
  assignedCardsError = signal('');

  groupedAssignedCards = computed(() => {
    const groups = new Map<number, { boardId: number; boardName: string; cards: AssignedCardSummary[] }>();
    for (const card of this.assignedCards()) {
      if (!groups.has(card.boardId)) {
        groups.set(card.boardId, { boardId: card.boardId, boardName: card.boardName, cards: [] });
      }
      groups.get(card.boardId)!.cards.push(card);
    }
    return Array.from(groups.values());
  });

  openAssignedCardsModal(): void {
    this.showAssignedCardsModal.set(true);
    this.assignedCardsLoading.set(true);
    this.assignedCardsError.set('');

    this.cardService.getAssignedToMe().subscribe({
      next: (cards) => {
        this.assignedCards.set(cards);
        this.assignedCardsLoading.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.assignedCardsLoading.set(false);
        const message = err?.error?.message || 'Failed to load your assigned cards.';
        this.assignedCardsError.set(message);
        this.showToast(message, 'error');
      }
    });
  }

  closeAssignedCardsModal(): void {
    this.showAssignedCardsModal.set(false);
  }

  goToAssignedCard(card: AssignedCardSummary): void {
    const board = this.boards().find(b => b.id === card.boardId);
    this.closeAssignedCardsModal();
    if (board) {
      this.selectBoard(board);
    }
  }

  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  showToast(message: string, type: 'error' | 'success' = 'error', durationMs = 4000): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.toastTimeoutId = setTimeout(() => {
      this.toastMessage.set(null);
      this.toastTimeoutId = null;
    }, durationMs);
  }

  dismissToast(): void {
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
    this.toastMessage.set(null);
  }

  toggleEditBoardDropdown(event: Event): void {
    event.stopPropagation();
    if (!this.showEditBoardDropdown()) {
      this.showMembersDropdown.set(false);
    }
    this.showEditBoardDropdown.set(!this.showEditBoardDropdown());
  }

  closeEditBoardDropdown(): void {
    this.showEditBoardDropdown.set(false);
  }

  // ─── Edit board ───

  openEditBoardModal(): void {
    const sb = this.selectedBoard();
    this.editBoardName = sb?.boardName || '';
    this.editBoardDescription = sb?.boardDescription || '';
    this.editBoardError.set('');
    this.showEditBoardDropdown.set(false);
    this.showEditBoardModal.set(true);
  }

  closeEditBoardModal(): void {
    this.showEditBoardModal.set(false);
  }

  saveBoardEdit(): void {
    const boardId = this.selectedBoardId();
    if (!boardId || !this.editBoardName.trim()) return;

    this.savingBoardEdit.set(true);
    this.editBoardError.set('');

    this.boardService.updateBoard(String(boardId), {
      boardName: this.editBoardName.trim(),
      boardDescription: this.editBoardDescription.trim() || undefined
    }).subscribe({
      next: (updated) => {
        this.boards.update(list => list.map(b => b.id === boardId ? { ...b, ...updated } : b));
        this.filterBoards();
        this.savingBoardEdit.set(false);
        this.closeEditBoardModal();
        this.showToast('Board updated.', 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        this.savingBoardEdit.set(false);
        const message = err?.error?.message || 'Failed to update board. Please try again.';
        this.editBoardError.set(message);
        this.showToast(message, 'error');
      }
    });
  }

  openInviteFromBoardMenu(): void {
    this.showEditBoardDropdown.set(false);
    this.openInviteModal();
  }

  // ─── Leave board ───

  openLeaveBoardModal(): void {
    this.leaveBoardError.set('');
    this.showEditBoardDropdown.set(false);
    this.showLeaveBoardModal.set(true);
  }

  closeLeaveBoardModal(): void {
    this.showLeaveBoardModal.set(false);
  }

  confirmLeaveBoard(): void {
    const boardId = this.selectedBoardId();
    if (!boardId || this.leavingBoard()) return;

    this.leavingBoard.set(true);
    this.leaveBoardError.set('');

    this.boardMemberService.leaveBoard(boardId).subscribe({
      next: () => {
        this.leavingBoard.set(false);
        this.closeLeaveBoardModal();
        this.boards.update(list => list.filter(b => b.id !== boardId));
        this.filterBoards();
        this.showToast('You left the board.', 'success');
        const remaining = this.boards();
        if (remaining.length > 0) {
          this.selectBoard(remaining[0]);
        } else {
          this.selectedBoardId.set(null);
          this.boardLists.set([]);
          this.panelMembers.set([]);
        }
      },
      error: (err: { error?: { message?: string } }) => {
        this.leavingBoard.set(false);
        const message = err?.error?.message || 'Failed to leave board. Please try again.';
        this.leaveBoardError.set(message);
        this.showToast(message, 'error');
      }
    });
  }

  // ─── Delete board ───

  openDeleteBoardModal(): void {
    if (!this.isBoardAdmin()) return;
    this.deleteBoardError.set('');
    this.showEditBoardDropdown.set(false);
    this.showDeleteBoardModal.set(true);
  }

  closeDeleteBoardModal(): void {
    this.showDeleteBoardModal.set(false);
  }

  confirmDeleteBoard(): void {
    const boardId = this.selectedBoardId();
    if (!boardId || this.deletingBoard() || !this.isBoardAdmin()) return;

    this.deletingBoard.set(true);
    this.deleteBoardError.set('');

    this.boardService.deleteBoard(String(boardId)).subscribe({
      next: () => {
        this.deletingBoard.set(false);
        this.closeDeleteBoardModal();
        this.boards.update(list => list.filter(b => b.id !== boardId));
        this.filterBoards();
        this.boardMemberCounts.update(counts => {
          const next = { ...counts };
          delete next[String(boardId)];
          return next;
        });
        this.showToast('Board deleted.', 'success');
        const remaining = this.boards();
        if (remaining.length > 0) {
          this.selectBoard(remaining[0]);
        } else {
          this.selectedBoardId.set(null);
          this.boardLists.set([]);
          this.panelMembers.set([]);
        }
      },
      error: (err: { error?: { message?: string } }) => {
        this.deletingBoard.set(false);
        const message = err?.error?.message || 'Failed to delete board. Please try again.';
        this.deleteBoardError.set(message);
        this.showToast(message, 'error');
      }
    });
  }

  addableMembers = computed(() => {
    const boardMemberIds = new Set(this.panelMembers().map(m => String(m.userId)));
    return this.workspaceMembers().filter(wm => !boardMemberIds.has(String(wm.id)));
  });

  getWsMemberLabel(m: { firstName?: string; sirName?: string; email: string }): string {
    const name = [m.firstName, m.sirName].filter(Boolean).join(' ').trim();
    return name || m.email;
  }

  toggleAddMemberPicker(event: Event): void {
    event.stopPropagation();
    const opening = !this.showAddMemberPicker();
    this.showAddMemberPicker.set(opening);
    this.addMemberError.set(null);

    if (opening) {
      const boardId = this.selectedBoardId();
      if (boardId) {
        this.loadPanelMembers(boardId);
      }
    }
  }

  private loadWorkspaceMembers(): void {
    const wsId = this.workspaceId();
    if (!wsId) return;
    this.workspaceService.getWorkspace(wsId).subscribe({
      next: (ws: any) => this.workspaceMembers.set(ws?.members ?? []),
      error: (err) => {
        this.workspaceMembers.set([]);
        console.error('Failed to load workspace members for add-to-board picker:', err);
        this.showToast('Failed to load workspace members.', 'error');
      }
    });
  }

  addMemberToBoard(candidate: { id: number }): void {
    const boardId = this.selectedBoardId();
    if (!boardId || this.addingMemberId() != null) return;

    this.addingMemberId.set(candidate.id);
    this.addMemberError.set(null);

    this.boardMemberService.addMembers(boardId, [candidate.id]).subscribe({
      next: () => {
        this.addingMemberId.set(null);
        this.loadPanelMembers(boardId);
        this.loadBoardMemberCounts(this.boards());
        this.showToast('Member added to board.', 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        this.addingMemberId.set(null);
        const message = err?.error?.message || 'Failed to add member — only board admins can add members.';
        this.addMemberError.set(message);
        this.showToast(message, 'error');
      }
    });
  }

  toggleMembersDropdown(event: Event): void {
    event.stopPropagation();
    this.showMembersDropdown.set(!this.showMembersDropdown());
  }

  closeMembersDropdown(): void {
    this.showMembersDropdown.set(false);
  }

  selectedBoard = computed(() =>
    this.boards().find(b => b.id === this.selectedBoardId()) ?? null
  );

  userAvatarUrl = computed(() => this.authService.user()?.avatarUrl ?? null);

  sortedBoardLists = computed(() =>
    [...this.boardLists()].sort((a, b) => (b.cards?.length || 0) - (a.cards?.length || 0))
  );

  userName = computed(() => {
    const user = this.authService.user();
    return user?.name || user?.email?.split('@')[0] || 'User';
  });

  filteredBoards = signal<Board[]>([]);

  ngOnInit(): void {
    const wsId = this.route.snapshot.paramMap.get('workspaceId') || '';
    this.workspaceId.set(wsId);
    this.loadBoards();
    this.loadWorkspaceMembers();
  }

  loadBoards(): void {
    this.loading.set(true);
    this.boardService.getBoardsByWorkspace(this.workspaceId()).subscribe({
      next: (boards: Board[]) => {
        this.boards.set(boards);
        this.filterBoards();
        this.loading.set(false);
        this.loadBoardMemberCounts(boards);
        if (boards.length > 0) {
          this.selectBoard(boards[0]);
        }
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Failed to load boards.', 'error');
      }
    });
  }

  private loadBoardMemberCounts(boards: Board[]): void {
    if (!boards.length) {
      this.boardMemberCounts.set({});
      return;
    }

    forkJoin(boards.map(b => this.boardMemberService.getMembers(b.id))).subscribe({
      next: (results) => {
        const counts: Record<string, number> = {};
        boards.forEach((b, idx) => {
          counts[String(b.id)] = results[idx]?.length ?? 0;
        });
        this.boardMemberCounts.set(counts);
      },
      error: () => this.boardMemberCounts.set({})
    });
  }

  getBoardMemberCount(board: Board): number {
    const counted = this.boardMemberCounts()[String(board.id)];
    return counted ?? (board.members?.length ?? 0);
  }

  filterBoards(): void {
    const query = this.searchQuery.toLowerCase().trim();
    const source = this.boards();
    this.filteredBoards.set(
      query
        ? source.filter(b => (b.boardName || '').toLowerCase().includes(query))
        : source
    );
  }

  // ─── Board selection ────────────────────────────────────────────────────────

  selectBoard(board: Board): void {
    this.selectedBoardId.set(board.id);
    this.clearListUiState();
    this.loadBoardLists(board.id);
    this.loadPanelMembers(board.id);
  }

  private clearListUiState(): void {
    this.showNewListInput.set(false);
    this.newListName = '';
    this.editingListId.set(null);
    this.listNameEdit = '';
    this.activeCardListId.set(null);
    this.newCardTitle = '';
    this.selectedCard.set(null);
    this.reassigningCardId.set(null);
    this.showMembersDropdown.set(false);
    this.showEditBoardDropdown.set(false);
  }

  private loadBoardLists(boardId: string | number): void {
    this.listsLoading.set(true);
    this.boardLists.set([]);

    this.listService.getLists(String(boardId)).subscribe({
      next: (lists) => {
        const normalized = Array.isArray(lists)
          ? lists.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [];

        if (!normalized.length) {
          this.boardLists.set([]);
          this.listsLoading.set(false);
          return;
        }

        forkJoin(normalized.map(list => this.cardService.getCards(list.id))).subscribe({
          next: (cardsByIndex) => {
            const merged = normalized.map((list, idx) => ({ ...list, cards: cardsByIndex[idx] || [] }));
            this.boardLists.set(merged);
            this.listsLoading.set(false);
          },
          error: () => {
            this.boardLists.set(normalized.map(l => ({ ...l, cards: [] })));
            this.listsLoading.set(false);
            this.showToast('Failed to load cards for this board.', 'error');
          }
        });
      },
      error: () => {
        this.boardLists.set([]);
        this.listsLoading.set(false);
        this.showToast('Failed to load lists for this board.', 'error');
      }
    });
  }

  private loadPanelMembers(boardId: string | number): void {
    this.membersLoading.set(true);
    this.boardMemberService.getMembers(boardId).subscribe({
      next: (members) => {
        this.panelMembers.set(members);
        this.membersLoading.set(false);
      },
      error: () => {
        this.panelMembers.set([]);
        this.membersLoading.set(false);
        this.showToast('Failed to load board members.', 'error');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/workspaces']);
  }

  // ─── Create Board ───────────────────────────────────────────────────────────

  createBoard(): void {
    if (!this.newBoardName.trim()) return;
    this.creating.set(true);

    const request: CreateBoardRequest = {
      boardName: this.newBoardName.trim(),
      workSpaceId: this.workspaceId(),
      boardColor: this.selectedColor
    };

    this.boardService.createBoard(request).subscribe({
      next: (created) => {
        this.showCreateModal.set(false);
        this.newBoardName = '';
        this.creating.set(false);
        this.boards.update(list => [created, ...list]);
        this.filterBoards();
        this.loadBoardMemberCounts(this.boards());
        this.selectBoard(created);
        this.showToast(`Board "${created.boardName}" created.`, 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        this.creating.set(false);
        this.showToast(err?.error?.message || 'Failed to create board. Please try again.', 'error');
      }
    });
  }

  // ─── Invite ─────────────────────────────────────────────────────────────────

  inviteRole: 'admin' | 'member' = 'member';
  invitedEmails = signal<string[]>([]);

  openInviteModal(): void {
    this.inviteEmail = '';
    this.inviteError.set('');
    this.inviteSuccess.set(false);
    this.inviteRole = 'member';
    this.invitedEmails.set([]);
    this.showInviteModal.set(true);
  }

  closeInviteModal(): void {
    this.showInviteModal.set(false);
    this.inviteEmail = '';
    this.inviteError.set('');
    this.inviteSuccess.set(false);
    this.invitedEmails.set([]);
  }

  sendInvite(): void {
    const email = this.inviteEmail.trim().toLowerCase();

    if (!email || !this.isValidEmail(email)) {
      this.inviteError.set('Please enter a valid email address.');
      return;
    }
    if (this.invitedEmails().includes(email)) {
      this.inviteError.set('This email has already been invited.');
      return;
    }

    this.inviting.set(true);
    this.inviteError.set('');

    this.workspaceService.inviteMember({
      workSpaceId: this.workspaceId(),
      invitations: [{ email, role: this.inviteRole }]
    }).subscribe({
      next: () => {
        this.invitedEmails.update(list => [...list, email]);
        this.inviteSuccess.set(true);
        this.inviteEmail = '';
        this.inviting.set(false);
        this.showToast(`Invite sent to ${email}.`, 'success');
        setTimeout(() => this.inviteSuccess.set(false), 3000);
      },
      error: (err: { error?: { message?: string } }) => {
        this.inviting.set(false);
        const message = err?.error?.message || 'Failed to send invite. Please try again.';
        this.inviteError.set(message);
        this.showToast(message, 'error');
      }
    });
  }

  removeInvitedEmail(email: string): void {
    this.invitedEmails.update(list => list.filter(e => e !== email));
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  // ─── Display helpers ────────────────────────────────────────────────────────

  getBoardColor(board: Board): string {
    if (!board?.id) return 'linear-gradient(135deg, #0079bf 0%, #026aa7 100%)';
    if (board.boardColor) {
      return `linear-gradient(135deg, ${board.boardColor} 0%, rgba(2,106,167,1) 100%)`;
    }
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

  getInitial(name: string): string {
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  toggleStar(board: Board, event: Event): void {
    event.stopPropagation();
    const previous = board.isStarred;
    board.isStarred = !previous;
    this.boardService.starBoard(String(board.id)).subscribe({
      next: (res) => {
        board.isStarred = res.starred;
        this.showToast(res.starred ? 'Board starred.' : 'Board unstarred.', 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        board.isStarred = previous;
        this.showToast(err?.error?.message || 'Failed to update star. Please try again.', 'error');
      }
    });
  }

  getPanelMemberSummary(): string {
    const count = this.panelMembers().length;
    return count > 0 ? `${count} member${count !== 1 ? 's' : ''}` : 'Just you, for now';
  }

  getPanelListSummary(): string {
    const count = this.boardLists().length;
    return `${count} list${count !== 1 ? 's' : ''}`;
  }

  // ─── Lists ──────────────────────────────────────────────────────────────────

  startEditingList(list: BoardList, event: Event): void {
    event.stopPropagation();
    this.listNameEdit = list.name;
    this.editingListId.set(list.id);
  }

  saveListName(listId: string | number): void {
    if (!this.listNameEdit.trim()) return;
    this.listService.updateList(String(listId), { name: this.listNameEdit.trim() }).subscribe({
      next: (updated) => {
        this.boardLists.update(lists => lists.map(l => l.id === listId ? { ...l, name: updated.name } : l));
        this.editingListId.set(null);
        this.showToast('List renamed.', 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        this.showToast(err?.error?.message || 'Failed to rename list. Please try again.', 'error');
      }
    });
  }

  cancelEditList(): void {
    this.editingListId.set(null);
    this.listNameEdit = '';
  }

  deleteList(listId: string | number, event: Event): void {
    event.stopPropagation();

    this.listDeleteError.set(null);

    this.listService.deleteList(String(listId)).subscribe({
      next: () => {
        this.boardLists.update(lists => lists.filter(l => l.id !== listId));
        this.showToast('List deleted.', 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        const message = err?.error?.message || 'Failed to delete list. Please try again.';
        this.listDeleteError.set({ listId, message });
        this.showToast(message, 'error');
      }
    });
  }

  toggleNewListInput(): void {
    this.showNewListInput.set(!this.showNewListInput());
    this.newListName = '';
    this.listError.set(null);
  }

  createList(): void {
    if (!this.newListName.trim()) return;
    const boardId = this.selectedBoardId();
    if (!boardId) return;

    this.listError.set(null);

    this.listService.createList({ name: this.newListName.trim(), boardId: String(boardId) }).subscribe({
      next: (newList) => {
        this.boardLists.update(lists => [...lists, { ...newList, cards: [] }]);
        this.newListName = '';
        this.showNewListInput.set(false);
        this.showToast(`List "${newList.name}" created.`, 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        const message = err?.error?.message || 'Failed to create list. Please try again.';
        this.listError.set(message);
        this.showToast(message, 'error');
      }
    });
  }

  // ─── Cards ──────────────────────────────────────────────────────────────────

  openCardModal(card: Card): void {
    this.selectedCard.set({ ...card });
  }

  closeCardModal(): void {
    this.selectedCard.set(null);
  }

  onSaveCard(updatedCard: Card): void {
    this.cardService.updateCard(String(updatedCard.id), {
      title: updatedCard.title,
      description: updatedCard.description
    }).subscribe({
      next: () => {
        this.boardLists.update(lists => lists.map(list => ({
          ...list,
          cards: (list.cards || []).map(c => c.id === updatedCard.id ? { ...c, ...updatedCard } : c)
        })));
        this.closeCardModal();
        this.showToast('Card updated.', 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        this.showToast(err?.error?.message || 'Failed to update card. Please try again.', 'error');
      }
    });
  }

  onDeleteCard(cardId: string | number): void {
    this.cardService.deleteCard(String(cardId)).subscribe({
      next: () => {
        this.boardLists.update(lists => lists.map(list => ({
          ...list,
          cards: (list.cards || []).filter(c => c.id !== cardId)
        })));
        this.closeCardModal();
        this.showToast('Card deleted.', 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        this.showToast(err?.error?.message || 'Failed to delete card. Please try again.', 'error');
      }
    });
  }

  openCreateCardModal(listId: string | number, event?: Event): void {
    if (event) event.stopPropagation();
    this.createCardTargetListId.set(listId);
    this.newCardTitle = '';
    this.newCardDescription = '';
    this.newCardPriority.set('');
    this.newCardDueDateInput = '';
    this.createCardModalError.set('');
    this.showCreateCardModal.set(true);
  }

  closeCreateCardModal(): void {
    this.showCreateCardModal.set(false);
    this.createCardTargetListId.set(null);
  }

  submitCreateCard(): void {
    const listId = this.createCardTargetListId();
    if (!listId || !this.newCardTitle.trim()) return;
    if (this.creatingCardModal()) return;

    this.creatingCardModal.set(true);
    this.createCardModalError.set('');

    let dueDate: Date | undefined;
    if (this.newCardDueDateInput) {
      const [y, m, d] = this.newCardDueDateInput.split('-').map(Number);
      dueDate = new Date(y, m - 1, d);
    }

    const request: CreateCardRequest = {
      title: this.newCardTitle.trim(),
      description: this.newCardDescription.trim() || undefined,
      listId,
      priority: this.newCardPriority() || undefined,
      dueDate
    };

    this.cardService.createCard(request).subscribe({
      next: (newCard) => {
        this.boardLists.update(lists => lists.map(list =>
          list.id === listId ? { ...list, cards: [...(list.cards || []), newCard] } : list
        ));
        this.creatingCardModal.set(false);
        this.closeCreateCardModal();
        this.showToast(`Card "${newCard.title}" created.`, 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        this.creatingCardModal.set(false);
        const message = err?.error?.message || 'Failed to create card. Please try again.';
        this.createCardModalError.set(message);
        this.showToast(message, 'error');
      }
    });
  }

  // ─── Inline reassign (floating picker on each card) ────────────────────────

  toggleReassignPicker(card: Card, event: Event): void {
    event.stopPropagation();
    this.reassigningCardId.set(this.reassigningCardId() === card.id ? null : card.id);
  }

  reassignFromPanel(card: Card, member: BoardMemberSummary, event: Event): void {
    event.stopPropagation();
    if (this.isReassigningInPanel()) return;

    this.isReassigningInPanel.set(true);

    this.cardService.reassignCard(card.id, member.userId).subscribe({
      next: (updated) => {
        this.boardLists.update(lists =>
          lists.map(list => ({
            ...list,
            cards: (list.cards || []).map(c =>
              c.id === card.id ? { ...c, assigneeId: updated.assigneeId, assigneeName: updated.assigneeName } : c
            )
          }))
        );
        this.isReassigningInPanel.set(false);
        this.reassigningCardId.set(null);
        this.showToast(`Card assigned to ${updated.assigneeName || member.userFullName}.`, 'success');
      },
      error: (err: { error?: { message?: string } }) => {
        this.isReassigningInPanel.set(false);
        this.reassigningCardId.set(null);
        this.showToast(err?.error?.message || 'Failed to assign card. Please try again.', 'error');
      }
    });
  }

  // ─── Drag and Drop ──────────────────────────────────────────────────────────

  drop(event: CdkDragDrop<Card[]>, targetListId: string | number): void {
    const cards = event.container.data || [];
    const previousCards = event.previousContainer.data || [];
    const preMoveLists = this.boardLists();

    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;

      const reorderedCards = [...cards];
      moveItemInArray(reorderedCards, event.previousIndex, event.currentIndex);

      this.boardLists.update(lists => lists.map(list =>
        list.id === targetListId ? { ...list, cards: reorderedCards } : list
      ));

      const movedCardId = String(reorderedCards[event.currentIndex]?.id ?? '');

      this.cardService.moveCard({
        cardId: movedCardId,
        targetListId: String(targetListId),
        newIndex: event.currentIndex
      }).subscribe({
        next: () => this.reconcileLists([targetListId]),
        error: (err: { error?: { message?: string } }) => {
          this.boardLists.set(preMoveLists);
          this.showToast(err?.error?.message || 'Failed to reorder card. Please try again.', 'error');
        }
      });

    } else {
      const previousListId = previousCards[event.previousIndex]?.listId;
      if (previousListId == null) return;

      const sourceCards = [...previousCards];
      const destCards = [...cards];
      transferArrayItem(sourceCards, destCards, event.previousIndex, event.currentIndex);
      if (destCards[event.currentIndex]) { destCards[event.currentIndex].listId = targetListId; }

      this.boardLists.update(lists => lists.map(list => {
        if (list.id === previousListId) return { ...list, cards: sourceCards };
        if (list.id === targetListId) return { ...list, cards: destCards };
        return list;
      }));

      const movedCardId = String(destCards[event.currentIndex]?.id ?? '');

      this.cardService.moveCard({
        cardId: movedCardId,
        targetListId: String(targetListId),
        newIndex: event.currentIndex
      }).subscribe({
        next: () => this.reconcileLists([previousListId, targetListId]),
        error: (err: { error?: { message?: string } }) => {
          this.boardLists.set(preMoveLists);
          this.showToast(err?.error?.message || 'Failed to move card. Please try again.', 'error');
        }
      });
    }
  }

  private reconcileLists(listIds: (string | number)[]): void {
    const uniqueIds = Array.from(new Set(listIds.map(String)));
    forkJoin(uniqueIds.map(id => this.cardService.getCards(id))).subscribe({
      next: (results) => {
        this.boardLists.update(lists => lists.map(list => {
          const idx = uniqueIds.indexOf(String(list.id));
          return idx >= 0 ? { ...list, cards: results[idx] } : list;
        }));
      },
      error: () => {}
    });
  }
}