import { Component, inject, signal, computed, OnInit } from '@angular/core';
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
import { Board, BoardList, Card, CreateBoardRequest, BoardMemberSummary } from '../../models/board.models';

@Component({
  selector: 'app-boards',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, UserMenuComponent, CardModalComponent],
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
  }

  loadBoards(): void {
    this.loading.set(true);
    this.boardService.getBoardsByWorkspace(this.workspaceId()).subscribe({
      next: (boards: Board[]) => {
        this.boards.set(boards);
        this.filterBoards();  
        this.loading.set(false);
        if (boards.length > 0) {
          this.selectBoard(boards[0]);
        }
      },
      error: () => this.loading.set(false)
    });
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
          }
        });
      },
      error: () => {
        this.boardLists.set([]);
        this.listsLoading.set(false);
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
        this.selectBoard(created);
      },
      error: () => this.creating.set(false)
    });
  }

  // ─── Invite ─────────────────────────────────────────────────────────────────

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
      next: (res) => { board.isStarred = res.starred; }, 
      error: () => { board.isStarred = previous; } 
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
      },
      error: () => {}
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
      },
      error: (err: { error?: { message?: string } }) => {
        this.listDeleteError.set({
          listId,
          message: err?.error?.message || 'Failed to delete list. Please try again.'
        });
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
    },
    error: (err: { error?: { message?: string } }) => {
      this.listError.set(err?.error?.message || 'Failed to create list. Please try again.');
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
    }).subscribe(() => {
      this.boardLists.update(lists => lists.map(list => ({
        ...list,
        cards: (list.cards || []).map(c => c.id === updatedCard.id ? { ...c, ...updatedCard } : c)
      })));
      this.closeCardModal();
    });
  }

  onDeleteCard(cardId: string | number): void {
    this.cardService.deleteCard(String(cardId)).subscribe(() => {
      this.boardLists.update(lists => lists.map(list => ({
        ...list,
        cards: (list.cards || []).filter(c => c.id !== cardId)
      })));
      this.closeCardModal();
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
    },
    error: (err: { error?: { message?: string } }) => {
      this.creatingCardModal.set(false);
      this.createCardModalError.set(err?.error?.message || 'Failed to create card. Please try again.');
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
      },
      error: () => this.isReassigningInPanel.set(false)
    });
  }

  // ─── Drag and Drop ──────────────────────────────────────────────────────────

  drop(event: CdkDragDrop<Card[]>, targetListId: string | number): void {
    const cards = event.container.data || [];
    const previousCards = event.previousContainer.data || [];

    if (event.previousContainer === event.container) {
      const reorderedCards = [...cards];
      moveItemInArray(reorderedCards, event.previousIndex, event.currentIndex);
      this.boardLists.update(lists => lists.map(list =>
        list.id === targetListId ? { ...list, cards: reorderedCards } : list
      ));
    } else {
      const previousListId = previousCards[event.previousIndex]?.listId;
      if (previousListId != null) {
        const sourceCards = [...previousCards];
        const destCards = [...cards];
        transferArrayItem(sourceCards, destCards, event.previousIndex, event.currentIndex);
        if (destCards[event.currentIndex]) { destCards[event.currentIndex].listId = targetListId; }
        this.boardLists.update(lists => lists.map(list => {
          if (list.id === previousListId) return { ...list, cards: sourceCards };
          if (list.id === targetListId) return { ...list, cards: destCards };
          return list;
        }));
        this.cardService.moveCard({
          cardId: String(destCards[event.currentIndex]?.id ?? ''),
          targetListId: String(targetListId),
          newIndex: event.currentIndex
        }).subscribe();
      }
    }
  }
}