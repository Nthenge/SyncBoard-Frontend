import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { WorkspaceService } from '../../services/workspace.service';
import { AuthService } from '../../services/auth.service';
import { Workspace, CreateWorkspaceRequest, WorkspaceInvitation,AssignedCardSummary, CreateBoardRequest, MyInvitation } from '../../models/board.models';
import { BoardService } from '../../services/board.service';
import { Board } from '../../models/board.models';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ListService } from '../../services/list.service';
import { CardService } from '../../services/card.service';
import { BoardList, Card } from '../../models/board.models';
import { BoardMemberService } from '../../services/board-member.service';
import { BoardMemberSummary } from '../../models/board.models';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

type ModalStep = 'create' | 'invite';

// Minimal shape for the "Jump back in" strip. Swap this for your real
// board model once boards are wired up — see loadRecentBoards() below.
export interface RecentBoardSummary {
  id: number;
  name: string;
  workspaceId: number;
  workspaceName: string;
  listId?: number;
  listName?: string;
  cardId?: number;
  cardTitle?: string;
  lastAccessedAt?: string;
}

@Component({
  selector: 'app-workspaces',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './workspaces.component.html',
  styleUrls: ['./workspaces.component.css']
})
export class WorkspacesComponent implements OnInit {
  private workspaceService = inject(WorkspaceService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private boardService = inject(BoardService);
  private listService = inject(ListService);
  private cardService = inject(CardService);
  private boardMemberService = inject(BoardMemberService);

  workspaceBoards = signal<Board[]>([]);
  boardsLoading = signal(false);
  boardsError = signal('');
  workspaces = signal<Workspace[]>([]);
  loading = signal(true);
  creating = signal(false);
  sending = signal(false);
  showCreateBoardModal = signal(false);
  newBoardTitle = '';
  newBoardDescription = '';
  creatingBoard = signal(false);
  createBoardError = signal('');
  selectedBoardId = signal<string | number | null>(null);
  boardLists = signal<BoardList[]>([]);
  listsLoading = signal(false);
  selectedListId = signal<string | number | null>(null);
  reassigningCardId = signal<string | number | null>(null);
  panelBoardMembers = signal<BoardMemberSummary[]>([]);
  isReassigningInPanel = signal(false);
  activeQuickTab = signal<'starred' | 'recent' | 'tasks' | 'due' | 'invites' | 'scratchpad'>('starred');
  scratchpadText = '';
  allUserBoards = signal<Board[]>([]);
  pendingInvites = signal<MyInvitation[]>([]);
  scratchpadSaving = signal(false);
  scratchpadSavedAt = signal<Date | null>(null);
  membersDropdownOpen = signal(false);
  highlightedCardId = signal<string | number | null>(null);
  assignedTasks = signal<AssignedCardSummary[]>([]);
  starredBoards = signal<Board[]>([]);
  leaveWorkspaceError = signal('');
  showEditWorkspaceModal = signal(false);
  editWorkspaceTarget = signal<Workspace | null>(null);
  editWorkspaceName = '';
  editWorkspaceDescription = '';
  editWorkspaceError = signal('');
  savingWorkspaceEdit = signal(false);

  private scratchpadChange$ = new Subject<string>();

  primaryWorkspaces = computed(() => this.filteredWorkspaces().slice(0, 4));

  overflowWorkspacesCount = computed(() =>
    Math.max(0, this.filteredWorkspaces().length - 4)
  );

  allLoadedCards = computed(() => {
    return this.boardLists().flatMap(l => l.cards || []);
  });

  toggleMembersDropdown(event: Event) {
    event.stopPropagation();
    this.membersDropdownOpen.update(v => !v);
  }

  closeMembersDropdown() {
    this.membersDropdownOpen.set(false);
  }

  loadAssignedTasks(): void {
    this.cardService.getAssignedToMe().subscribe({
      next: (tasks) => this.assignedTasks.set(tasks),
      error: () => this.assignedTasks.set([])
    });
  }

  openTasksTab(): void {
    this.activeQuickTab.set('tasks');
    this.loadAssignedTasks();
  }

  openAssignedTask(task: AssignedCardSummary): void {
    this.workspaces.update(list => {
      const idx = list.findIndex(ws => ws.id === task.workspaceId);
      if (idx <= 0) return list;
      const target = list[idx];
      const rest = [...list.slice(0, idx), ...list.slice(idx + 1)];
      return [target, ...rest];
    });

    this.activeWorkspaceId.set(task.workspaceId);

    this.boardsLoading.set(true);
    this.boardService.getBoardsByWorkspace(String(task.workspaceId)).subscribe({
      next: (boards) => {
        this.workspaceBoards.set(boards);
        this.boardsLoading.set(false);

        const targetBoard = boards.find(b => b.id === task.boardId);
        if (!targetBoard) return;

        this.selectedBoardId.set(targetBoard.id);
        this.loadBoardListsAndHighlight(targetBoard.id, task.listId, task.cardId);
      },
      error: () => this.boardsLoading.set(false)
    });
  }

  myAssignedTasks = computed(() => {
    const uid = this.currentUserId();
    if (!uid) return [];
    return this.allLoadedCards().filter(c => String(c.assigneeId) === String(uid));
  });

  dueSoonTasks = computed(() => {
    const uid = this.currentUserId();
    const now = new Date().getTime();
    const fortyEightHours = 48 * 60 * 60 * 1000;

    return this.allLoadedCards().filter(c => {
      const isAssigned = uid ? String(c.assigneeId) === String(uid) : true;
      if (!c.dueDate || !isAssigned) return false;
      const due = new Date(c.dueDate).getTime();
      return due >= now && due <= now + fortyEightHours;
    });
  });

  loadStarredBoards(): void {
    this.boardService.getStarredBoards().subscribe({
      next: (boards) => this.starredBoards.set(boards),
      error: () => this.starredBoards.set([])
    });
  }

  starredWorkspaces = signal<Workspace[]>([]);

  loadStarredWorkspaces(): void {
    this.workspaceService.getStarredWorkspaces().subscribe({
      next: (workspaces) => this.starredWorkspaces.set(workspaces),
      error: () => this.starredWorkspaces.set([])
    });
  }

  selectedListCards = computed(() => {
    const list = this.boardLists().find(l => l.id === this.selectedListId());
    return list?.cards || [];
  });

  selectList(list: BoardList): void {
    this.selectedListId.set(this.selectedListId() === list.id ? null : list.id);
  }

  selectedBoard = computed(() =>
    this.workspaceBoards().find(b => b.id === this.selectedBoardId()) ?? null
  );

  // --- Filter and Active Workspace State ---
  activeWorkspaceId = signal<string | number | null>(null);
  workspaceFilter = signal<string>('');

  filteredWorkspaces = computed(() => {
    const filterText = this.workspaceFilter().toLowerCase().trim();
    return this.workspaces().filter(ws =>
      ws.workSpaceName.toLowerCase().includes(filterText)
    );
  });

  showModal = signal(false);
  modalStep = signal<ModalStep>('create');
  justCreatedWorkspace = signal<Workspace | null>(null);

  accountMenuOpen = signal(false);

  recentBoards = signal<RecentBoardSummary[]>([]);
  cardMenuOpenId = signal<string | number | null>(null);

  totalMembers = computed(() =>
    this.workspaces().reduce((sum, ws) => sum + (ws.members?.length ?? 0), 0)
  );

  newWorkspaceName = '';
  newWorkspaceDescription = '';
  inviteEmail = '';
  inviteRole: 'admin' | 'member' = 'member';
  invitedEmails = signal<string[]>([]);

  error = signal('');
  inviteError = signal('');
  inviteSuccess = signal('');

  userName = computed(() => {
    const user = this.authService.user();
    return user?.name || user?.email?.split('@')[0] || 'User';
  });

  userEmail = computed(() => this.authService.user()?.email ?? null);
  currentUserId = computed(() => this.authService.user()?.id ?? null);

  ngOnInit(): void {
  this.loadWorkspaces();
  this.loadScratchpad();
  this.loadRecentBoards();
  this.loadStarredBoards();
  this.loadStarredWorkspaces();

  this.scratchpadChange$.pipe(
    debounceTime(1500),
    distinctUntilChanged()
  ).subscribe(content => this.saveScratchpad(content));
}

loadRecentBoards(): void {
  this.boardService.getRecentBoards(5).subscribe({
    next: (recent) => this.recentBoards.set(recent),
    error: () => this.recentBoards.set([])
  });
}

loadScratchpad(): void {
  this.workspaceService.getScratchpad().subscribe({
    next: (res) => {
      this.scratchpadText = res?.content ?? '';
      this.scratchpadSavedAt.set(res?.updatedAt ? new Date(res.updatedAt) : null);
    },
    error: () => {} // leave scratchpad empty on failure — non-critical feature
  });
}

  onScratchpadInput(value: string): void {
    this.scratchpadText = value;
    this.scratchpadChange$.next(value);
  }

  private saveScratchpad(content: string): void {
    this.scratchpadSaving.set(true);
    this.workspaceService.updateScratchpad(content).subscribe({
      next: (res) => {
        this.scratchpadSaving.set(false);
        this.scratchpadSavedAt.set(res?.updatedAt ? new Date(res.updatedAt) : new Date());
      },
      error: () => this.scratchpadSaving.set(false)
    });
  }

  clearScratchpad(): void {
    if (!this.scratchpadText.trim()) return; 
    this.scratchpadText = '';
    this.scratchpadChange$.next(''); 
  }

  loadWorkspaces(): void {
  this.loading.set(true);
  this.workspaceService.getMyWorkspaces().subscribe({
    next: (workspaces) => {
      this.workspaces.set(workspaces);
      this.loading.set(false);
      if (workspaces.length > 0 && this.activeWorkspaceId() === null) {
        this.activeWorkspaceId.set(workspaces[0].id);
        this.loadBoardsForWorkspace(workspaces[0].id);
      }
    },
    error: () => this.loading.set(false)
  });
}

private loadBoardsForWorkspace(workspaceId: string | number): void {
  this.boardsLoading.set(true);
  this.boardsError.set('');
  this.boardService.getBoardsByWorkspace(String(workspaceId)).subscribe({
    next: (boards) => {
      this.workspaceBoards.set(boards);
      this.boardsLoading.set(false);
      if (boards.length > 0) {
        this.selectedBoardId.set(boards[0].id);
        this.loadBoardLists(boards[0].id);
      } else {
        this.clearSelectedBoard();
      }
    },
    error: () => {
      this.boardsLoading.set(false);
      this.boardsError.set('Failed to load boards.');
    }
  });
}

selectBoard(board: Board): void {
  if (this.selectedBoardId() === board.id) {
    this.clearSelectedBoard();
    return;
  }
  this.selectedBoardId.set(board.id);
  this.selectedListId.set(null);
  this.loadBoardLists(board.id);
  this.boardService.trackBoardAccess(board.id).subscribe({
    next: () => this.loadRecentBoards()
  });
}

clearSelectedBoard(): void {
  this.selectedBoardId.set(null);
  this.selectedListId.set(null);
  this.boardLists.set([]);
}

getSelectedListName(): string {
  const list = this.boardLists().find(l => l.id === this.selectedListId());
  return list?.name || '';
}

private loadBoardLists(boardId: string | number): void {
  this.listsLoading.set(true);
  this.boardLists.set([]);
  this.selectedListId.set(null);

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
          this.selectedListId.set(merged[0].id);
          this.listsLoading.set(false);
        },
        error: () => {
          const fallback = normalized.map(l => ({ ...l, cards: [] }));
          this.boardLists.set(fallback);
          this.selectedListId.set(fallback[0].id);
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

openBoardFromDetail(board: Board): void {
  this.router.navigate(['/workspaces', board.workSpaceId, 'boards', board.id]);
}

getMemberRole(member: any): string {
  const role = member?.role || member?.workspaceRole;
  return role ? this.formatRole(role) : 'Member';
}

  openWorkspace(id: string | number): void {
    this.activeWorkspaceId.set(id); // Set active workspace state
    this.router.navigate(['/workspaces', id, 'boards']);
  }

  openBoard(board: Board): void {
    const wsId = board.workSpaceId;
    if (wsId == null || board.id == null) return;

    // Push the owning workspace to the front of the list
    this.workspaces.update(list => {
      const idx = list.findIndex(ws => ws.id === wsId);
      if (idx <= 0) return list;
      const target = list[idx];
      const rest = [...list.slice(0, idx), ...list.slice(idx + 1)];
      return [target, ...rest];
    });

    this.activeWorkspaceId.set(wsId);

    this.boardsLoading.set(true);
    this.boardService.getBoardsByWorkspace(String(wsId)).subscribe({
      next: (boards) => {
        this.workspaceBoards.set(boards);
        this.boardsLoading.set(false);

        const targetBoard = boards.find(b => b.id === board.id);
        if (!targetBoard) return;

        this.selectedBoardId.set(targetBoard.id);
        this.loadBoardListsAndHighlight(targetBoard.id); 
      },
      error: () => this.boardsLoading.set(false)
    });
  }

  toggleStar(ws: Workspace, event: Event): void {
    event.stopPropagation();
    const previous = ws.isStarred;
    ws.isStarred = !previous;
    this.workspaceService.starWorkspace(String(ws.id)).subscribe({
      next: (res) => { ws.isStarred = res.starred; this.loadStarredWorkspaces(); },
      error: () => { ws.isStarred = previous; }
    });
  }

  // ─── Card: ⋯ menu ───────────────────────────────────────────────────────

  toggleCardMenu(id: string | number, event: Event): void {
    event.stopPropagation();
    this.cardMenuOpenId.update(current => (current === id ? null : id));
  }

  closeCardMenuBackdrop(event: Event): void {
    event.stopPropagation();
    this.cardMenuOpenId.set(null);
  }

  editWorkspace(ws: Workspace, event: Event): void {
    event.stopPropagation();
    this.cardMenuOpenId.set(null);
    this.editWorkspaceTarget.set(ws);
    this.editWorkspaceName = ws.workSpaceName;
    this.editWorkspaceDescription = ws.workSpaceDescription || '';
    this.editWorkspaceError.set('');
    this.showEditWorkspaceModal.set(true);
  }

  closeEditWorkspaceModal(): void {
    this.showEditWorkspaceModal.set(false);
    this.editWorkspaceTarget.set(null);
  }

  saveWorkspaceEdit(): void {
    const target = this.editWorkspaceTarget();
    if (!target || !this.editWorkspaceName.trim()) return;

    this.savingWorkspaceEdit.set(true);
    this.editWorkspaceError.set('');

    this.workspaceService.updateWorkspace(target.id, {
      workSpaceName: this.editWorkspaceName.trim(),
      workSpaceDescription: this.editWorkspaceDescription.trim() || undefined
    }).subscribe({
      next: (updated) => {
        this.workspaces.update(list =>
          list.map(w => (w.id === updated.id ? updated : w))
        );
        this.savingWorkspaceEdit.set(false);
        this.closeEditWorkspaceModal();
      },
      error: (err: { error?: { message?: string } }) => {
        this.savingWorkspaceEdit.set(false);
        this.editWorkspaceError.set(err?.error?.message || 'Failed to update workspace. Please try again.');
      }
    });
  }

  leaveWorkspace(ws: Workspace, event: Event): void {
    event.stopPropagation();
    this.cardMenuOpenId.set(null);
    this.leaveWorkspaceError.set('');

    this.workspaceService.leaveWorkspace(ws.id).subscribe({
      next: () => {
        this.workspaces.update(list => list.filter(w => w.id !== ws.id));

        if (this.activeWorkspaceId() === ws.id) {
          this.activeWorkspaceId.set(null);
          this.workspaceBoards.set([]);
          this.clearSelectedBoard();
        }
      },
      error: (err: { error?: { message?: string } }) => {
        this.leaveWorkspaceError.set(err?.error?.message || 'Failed to leave workspace. Please try again.');
        setTimeout(() => this.leaveWorkspaceError.set(''), 4000);
      }
    });
  }

  getRole(ws: Workspace): string {
    const anyWs = ws as any;
    const uid = this.currentUserId();

    if (uid != null && anyWs.owner?.id === uid && anyWs.owner?.role) {
      return this.formatRole(anyWs.owner.role);
    }

    const member = anyWs.members?.find((m: any) => m?.id === uid);
    if (member?.role) return this.formatRole(member.role);

    return 'Member';
  }

  private formatRole(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }

  // ─── Card: member avatar stack ──────────────────────────────────────────
  // Assumes members are objects with a name/email somewhere on them; adjust
  // getMemberLabel() to your real member shape if this doesn't match.

  getVisibleMembers(ws: Workspace, max = 4): any[] {
    return ((ws as any).members ?? []).slice(0, max);
  }

  getExtraMemberCount(ws: Workspace, max = 4): number {
    return Math.max(0, ((ws as any).members?.length ?? 0) - max);
  }

  getMemberLabel(member: any): string {
    return member?.name || member?.fullName || member?.email || member?.user?.name || member?.user?.email || 'Member';
  }

  getMemberInitial(member: any): string {
    return this.getMemberLabel(member).charAt(0).toUpperCase();
  }

  selectedWorkspace = computed(() =>
    this.workspaces().find(ws => ws.id === this.activeWorkspaceId()) ?? null
  );

  selectWorkspace(id: string | number): void {
    this.activeWorkspaceId.set(id);
    this.loadBoardsForWorkspace(id);

    this.workspaces.update(list => {
      const idx = list.findIndex(ws => ws.id === id);
      if (idx <= 0) return list;
      const target = list[idx];
      const rest = [...list.slice(0, idx), ...list.slice(idx + 1)];
      return [target, ...rest];
    });
  }

  getLastActivityLabel(ws: Workspace): string | null {
    const raw = (ws as any).updatedAt || (ws as any).lastActivityAt || (ws as any).lastActivity;
    if (!raw) return null;
    const date = new Date(raw);
    if (isNaN(date.getTime())) return null;
    return `Updated ${this.timeAgo(date)}`;
  }

  private timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  onFilterChange(value: string) {
    this.workspaceFilter.set(value);
  }

  // ─── Account Menu ─────────────────────────────────────────────────────────

  toggleAccountMenu(): void {
    this.accountMenuOpen.update(open => !open);
  }

  closeAccountMenu(): void {
    this.accountMenuOpen.set(false);
  }

  openSettings(): void {
    this.router.navigate(['/settings']);
  }

  openNotifications(): void {
  // TODO: wire this up once there's a notifications endpoint/panel.
}

  inviteToWorkspace(ws: Workspace, event: Event): void {
    event.stopPropagation();
    this.cardMenuOpenId.set(null);
    this.resetModal();
    this.justCreatedWorkspace.set(ws);
    this.modalStep.set('invite');
    this.showModal.set(true);
  }

  openInviteFlow(): void {
    const activeId = this.activeWorkspaceId();
    const activeWorkspace = activeId != null
      ? this.workspaces().find(ws => ws.id === activeId)
      : null;

    if (activeWorkspace) {
      this.resetModal();
      this.justCreatedWorkspace.set(activeWorkspace);
      this.modalStep.set('invite');
      this.showModal.set(true);
    } else {
      this.openCreateModal();
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  // ─── Create Workspace ─────────────────────────────────────────────────────

  openCreateModal(): void {
    this.resetModal();
    this.modalStep.set('create');
    this.showModal.set(true);
  }

  createWorkspace(): void {
    if (!this.newWorkspaceName.trim()) return;
    this.creating.set(true);
    this.error.set('');

    const request: CreateWorkspaceRequest = {
      workSpaceName: this.newWorkspaceName.trim(),
      workSpaceDescription: this.newWorkspaceDescription.trim() || undefined
    };

    this.workspaceService.createWorkspace(request).subscribe({
      next: (workspace) => {
        this.workspaces.update(ws => [workspace, ...ws]);
        this.creating.set(false);
        this.justCreatedWorkspace.set(workspace);
        this.modalStep.set('invite');
      },
      error: () => {
        this.creating.set(false);
        this.error.set('Failed to create workspace. Please try again.');
      }
    });
  }

  openCreateBoardModal(): void {
  this.newBoardTitle = '';
  this.newBoardDescription = '';
  this.createBoardError.set('');
  this.showCreateBoardModal.set(true);
}

closeCreateBoardModal(): void {
  this.showCreateBoardModal.set(false);
  this.newBoardTitle = '';
  this.newBoardDescription = '';
  this.createBoardError.set('');
}

createBoardInline(): void {
  const ws = this.selectedWorkspace();
  if (!ws || !this.newBoardTitle.trim()) return;

  this.creatingBoard.set(true);
  this.createBoardError.set('');

  const request: CreateBoardRequest = {
    boardName: this.newBoardTitle.trim(),
    boardDescription: this.newBoardDescription.trim() || undefined,
    workSpaceId: ws.id
  };

  this.boardService.createBoard(request).subscribe({
    next: (board) => {
      this.workspaceBoards.update(list => [board, ...list]);
      this.creatingBoard.set(false);
      this.closeCreateBoardModal();
    },
    error: () => {
      this.creatingBoard.set(false);
      this.createBoardError.set('Failed to create board. Please try again.');
    }
  });
}

  // ─── Invite Members ───────────────────────────────────────────────────────

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

    const workspace = this.justCreatedWorkspace();
    if (!workspace) return;

    this.sending.set(true);
    this.inviteError.set('');
    this.inviteSuccess.set('');

    this.workspaceService.inviteMember({
      workSpaceId: workspace.id,
      invitations: [{ email, role: this.inviteRole }]   // ← wrapped in array
    }).subscribe({
      next: () => {
        this.invitedEmails.update(list => [...list, email]);
        this.inviteSuccess.set(`Invite sent to ${email}`);
        this.inviteEmail = '';
        this.sending.set(false);
        setTimeout(() => this.inviteSuccess.set(''), 3000);
      },
      error: (err: { error?: { message?: string } }) => {
        this.sending.set(false);
        this.inviteError.set(err?.error?.message || 'Failed to send invite. Please try again.');
      }
    });
  }

  // ─── Modal Helpers ────────────────────────────────────────────────────────

  skipToBoards(): void {
    const workspace = this.justCreatedWorkspace();
    if (workspace) {
      this.closeModal();
      this.openWorkspace(workspace.id);
    }
  }

  finishAndGoToBoards(): void {
    const workspace = this.justCreatedWorkspace();
    if (workspace) {
      this.closeModal();
      this.openWorkspace(workspace.id);
    }
  }

  closeModal(): void {
    this.showModal.set(false);
    this.resetModal();
  }

  private resetModal(): void {
    this.newWorkspaceName = '';
    this.newWorkspaceDescription = '';
    this.inviteEmail = '';
    this.inviteRole = 'member';
    this.invitedEmails.set([]);
    this.error.set('');
    this.inviteError.set('');
    this.inviteSuccess.set('');
    this.justCreatedWorkspace.set(null);
    this.modalStep.set('create');
  }

  toggleReassignPicker(card: Card, event: Event): void {
  event.stopPropagation();

  if (this.reassigningCardId() === card.id) {
    this.reassigningCardId.set(null);
    return;
  }

  this.reassigningCardId.set(card.id);

  const boardId = this.selectedBoardId();
  if (boardId != null) {
    this.boardMemberService.getMembers(boardId).subscribe({
      next: (members) => this.panelBoardMembers.set(members),
      error: () => this.panelBoardMembers.set([])
    });
  }
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

  getBoardsMemberSummary(): string {
  const total = this.workspaceBoards().reduce((sum, b) => sum + (b.members?.length ?? 0), 1);
  return total > 0 + 1 ? `${total} member${total !== 1 ? 's' : ''} across boards` : 'In this workspace';
}

getBoardsLastActivitySummary(): string {
  const dates = this.workspaceBoards()
    .map(b => (b as any).boardCreatedAt)
    .filter(Boolean)
    .map(raw => new Date(raw))
    .filter(d => !isNaN(d.getTime()));

  if (!dates.length) return '';
  const latest = new Date(Math.max(...dates.map(d => d.getTime())));
  return `Latest ${this.timeAgo(latest)}`;
}

  getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  removeInvitedEmail(email: string): void {
    this.invitedEmails.update(list => list.filter(e => e !== email));
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  loadMyInvitations(): void {
  this.workspaceService.getMyInvitations().subscribe({
    next: (invites) => this.pendingInvites.set(invites),
    error: () => this.pendingInvites.set([])
  });
}

openInvitesTab(): void {
  this.activeQuickTab.set('invites');
  this.loadMyInvitations();
}

  // --- Workspace Invitation Handlers ---
  acceptInvitation(token: string): void {
  this.workspaceService.acceptInvite(token).subscribe({
    next: () => {
      this.pendingInvites.update(list => list.filter(i => i.token !== token));
      this.loadWorkspaces();
    },
    error: () => {}
  });
}

  // Rename 'rejectInvite' to 'rejectInvitation'
rejectInvitation(token: string): void {
  this.workspaceService.rejectInvitation(token).subscribe({
    next: () => this.pendingInvites.update(list => list.filter(i => i.token !== token)),
    error: () => {}
  });
}

openRecentActivity(recent: RecentBoardSummary): void {
    this.workspaces.update(list => {
      const idx = list.findIndex(ws => ws.id === recent.workspaceId);
      if (idx <= 0) return list;
      const target = list[idx];
      const rest = [...list.slice(0, idx), ...list.slice(idx + 1)];
      return [target, ...rest];
    });

    this.activeWorkspaceId.set(recent.workspaceId);

    this.boardsLoading.set(true);
    this.boardService.getBoardsByWorkspace(String(recent.workspaceId)).subscribe({
      next: (boards) => {
        this.workspaceBoards.set(boards);
        this.boardsLoading.set(false);

        const targetBoard = boards.find(b => b.id === recent.id);
        if (!targetBoard) return;

        this.selectedBoardId.set(targetBoard.id);
        this.loadBoardListsAndHighlight(targetBoard.id, recent.listId, recent.cardId);
      },
      error: () => this.boardsLoading.set(false)
    });
  }

  private loadBoardListsAndHighlight(boardId: string | number, targetListId?: number, targetCardId?: number): void {
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

            const matchedList = targetListId != null
              ? merged.find(l => String(l.id) === String(targetListId))
              : null;

            this.selectedListId.set(matchedList ? matchedList.id : merged[0].id);
            this.highlightedCardId.set(targetCardId ?? null);

            this.listsLoading.set(false);
          },
          error: () => this.listsLoading.set(false)
        });
      },
      error: () => this.listsLoading.set(false)
    });
  }
}