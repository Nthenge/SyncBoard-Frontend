import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { forkJoin } from 'rxjs';
import { BoardService } from '../../services/board.service';
import { ListService } from '../../services/list.service';
import { CardService } from '../../services/card.service';
import { Board, BoardList, Card } from '../../models/board.models';
import { CardModalComponent } from '../card-modal/card-modal.component';

@Component({
  selector: 'app-board-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DragDropModule, CardModalComponent],
  templateUrl: './board-detail.component.html',
  styleUrls: ['./board-detail.component.css']
})
export class BoardDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private boardService = inject(BoardService);
  private listService = inject(ListService);
  private cardService = inject(CardService);

  board = signal<Board | null>(null);
  lists = signal<BoardList[]>([]);

  showNewListInput = signal(false);
  newListName = '';

  activeCardListId = signal<string | null>(null);
  newCardTitle = '';
  selectedCard = signal<Card | null>(null);

  editingBoardName = signal(false);
  boardNameEdit = '';

  editingListId = signal<string | null>(null);
  listNameEdit = '';

  ngOnInit(): void {
    const boardId = this.route.snapshot.paramMap.get('id');
    if (boardId) {
      this.loadBoard(boardId);
    }

    this.listService.lists$.subscribe(lists => {
      // lists$ should be an array, but backend/socket errors can still push unexpected values.
      this.lists.set(Array.isArray(lists) ? this.normalizeColumns(lists) : []);
    });
  }

  loadBoard(boardId: string): void {
    this.boardService.getBoard(boardId).subscribe({
      next: (board) => this.board.set(board),
      error: (err) => {
        // Keep board empty on error.
        console.error('Failed to load board', err);
        this.board.set(null);
      }
    });

    this.listService.getLists(boardId).subscribe({
      next: (lists) => {
        const normalized = Array.isArray(lists) ? this.normalizeColumns(lists) : [];
        if (!normalized.length) {
          this.lists.set([]);
          return;
        }

        // Load cards for each list in parallel and merge by listId.
        forkJoin(normalized.map(list => this.cardService.getCards(list.id))).subscribe({
          next: (cardsByIndex) => {
            const merged = normalized.map((list, idx) => ({
              ...list,
              cards: cardsByIndex[idx] || []
            }));
            this.lists.set(merged);
          },
          error: (err) => {
            console.error('Failed to load cards', err);
            this.lists.set(normalized.map(l => ({ ...l, cards: [] })));
          }
        });
      },
      error: (err) => {
        console.error('Failed to load lists', err);
        this.lists.set([]);
      }
    });
  }

  private normalizeColumns(lists: BoardList[] | unknown): BoardList[] {
    if (!Array.isArray(lists)) return [];

    const canonical = [
      { key: 'todo', names: ['to do', 'todo'] },
      { key: 'inprogress', names: ['in progress', 'in-progress', 'doing', 'inprogress'] },
      { key: 'done', names: ['done', 'completed', 'complete'] },
    ] as const;

    const safeLists = lists as BoardList[];


    const normalize = (s: string) => (s || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

    const byNameMatches: Record<'todo' | 'inprogress' | 'done', BoardList[]> = {
      todo: [],
      inprogress: [],
      done: [],
    };


    for (const list of safeLists || []) {
      const name = normalize(list?.name || '');
      if (!name) continue;

      const todoNames = canonical[0].names.map(normalize);
      const ipNames = canonical[1].names.map(normalize);
      const doneNames = canonical[2].names.map(normalize);

      if (todoNames.includes(name)) byNameMatches.todo.push(list);
      else if (ipNames.includes(name)) byNameMatches.inprogress.push(list);
      else if (doneNames.includes(name)) byNameMatches.done.push(list);
    }

    const pickBest = (items: BoardList[]): BoardList | undefined =>
      items
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        [0];

    const picked: Record<'todo' | 'inprogress' | 'done', BoardList | undefined> = {
      todo: pickBest(byNameMatches.todo),
      inprogress: pickBest(byNameMatches.inprogress),
      done: pickBest(byNameMatches.done),
    };


    // Remove already picked from fallback pool
    const pickedIds = new Set(Object.values(picked).filter(Boolean).map(l => (l as BoardList).id));
    const fallbackPool = (safeLists || [])
      .filter(l => !pickedIds.has(l.id))
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const assignFallback = (key: 'todo' | 'inprogress' | 'done') => {
      if (picked[key]) return;
      const next = fallbackPool.shift();
      if (next) picked[key] = next;
    };

    assignFallback('todo');
    assignFallback('inprogress');
    assignFallback('done');

    const ordered: BoardList[] = [];
    const pushIf = (l?: BoardList) => {
      if (l && !ordered.some(x => x.id === l.id)) ordered.push(l);
    };

    pushIf(picked.todo);
    pushIf(picked.inprogress);
    pushIf(picked.done);

    // Append remaining lists after Done (in backend order)
    const remaining = (safeLists || [])
      .filter(l => !ordered.some(x => x.id === l.id))
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    return [...ordered, ...remaining];
  }


  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.split(' ');
    return parts.length > 1 ? (parts[0][0] + parts[1][0]).toUpperCase() : name[0].toUpperCase();
  }

  // ─── Board Edit/Delete ────────────────────────────────────────────────────

  startEditingBoardName(): void {
    this.boardNameEdit = this.board()?.boardName || '';
    this.editingBoardName.set(true);
  }

  saveBoardName(): void {
  const boardId = this.board()?.id;
  if (!boardId || !this.boardNameEdit.trim()) return;
  this.boardService.updateBoard(String(boardId), { boardName: this.boardNameEdit.trim() }).subscribe({
      next: (updated) => {
        this.board.set(updated);
        this.editingBoardName.set(false);
      },
      error: () => {}
    });
  }

  cancelEditBoardName(): void {
    this.editingBoardName.set(false);
    this.boardNameEdit = '';
  }

  deleteBoard(): void {
  const boardId = this.board()?.id;
  if (!boardId) return;
  if (!confirm('Are you sure you want to delete this board?')) return;
  this.boardService.deleteBoard(String(boardId)).subscribe({
      next: () => this.router.navigate(['/boards']),
      error: () => {}
    });
  }

  // ─── List Edit/Delete ─────────────────────────────────────────────────────

  startEditingList(list: BoardList): void {
    this.listNameEdit = list.name;
    this.editingListId.set(list.id);
  }

  saveListName(listId: string): void {
    if (!this.listNameEdit.trim()) return;
    this.listService.updateList(listId, { name: this.listNameEdit.trim() }).subscribe({
      next: (updated) => {
        this.lists.update(lists => lists.map(l => l.id === listId ? { ...l, name: updated.name } : l));
        this.editingListId.set(null);
      },
      error: () => {}
    });
  }

  cancelEditList(): void {
    this.editingListId.set(null);
    this.listNameEdit = '';
  }

  deleteList(listId: string): void {
    if (!confirm('Are you sure you want to delete this list?')) return;
    this.listService.deleteList(listId).subscribe({
      next: () => this.lists.update(lists => lists.filter(l => l.id !== listId)),
      error: () => {}
    });
  }

  //  Card Modal 

  openCardModal(card: Card): void { this.selectedCard.set({ ...card }); }
  closeCardModal(): void { this.selectedCard.set(null); }


  onSaveCard(updatedCard: Card): void {
  this.cardService.updateCard(String(updatedCard.id), {
    title: updatedCard.title,
    description: updatedCard.description
  }).subscribe(() => this.closeCardModal());
}

  onDeleteCard(cardId: string | number): void {
  this.cardService.deleteCard(String(cardId)).subscribe(() => this.closeCardModal());
}

  //  Drag and Drop 

  drop(event: CdkDragDrop<Card[]>, targetListId: string): void {
    const cards = event.container.data || [];
    const previousCards = event.previousContainer.data || [];

    if (event.previousContainer === event.container) {
      const reorderedCards = [...cards];
      moveItemInArray(reorderedCards, event.previousIndex, event.currentIndex);
      this.lists.update(lists => lists.map(list =>
        list.id === targetListId ? { ...list, cards: reorderedCards } : list
      ));
    } else {
      const previousListId = previousCards[event.previousIndex]?.listId || '';
      if (previousListId) {
        const sourceCards = [...previousCards];
        const destCards = [...cards];
        transferArrayItem(sourceCards, destCards, event.previousIndex, event.currentIndex);
        if (destCards[event.currentIndex]) { destCards[event.currentIndex].listId = targetListId; }
        this.lists.update(lists => lists.map(list => {
          if (list.id === previousListId) return { ...list, cards: sourceCards };
          if (list.id === targetListId) return { ...list, cards: destCards };
          return list;
        }));
        this.cardService.moveCard({
        cardId: String(destCards[event.currentIndex]?.id ?? ''),
        targetListId,
        newIndex: event.currentIndex
      }).subscribe();
      }
    }
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  goBack(): void { this.router.navigate(['/boards']); }

  // ─── List Creation ────────────────────────────────────────────────────────

  toggleNewListInput(): void {
    this.showNewListInput.set(!this.showNewListInput());
    this.newListName = '';
  }

  createList(): void {
    if (this.newListName.trim()) {
      const boardId = this.board()?.id || '';
      if (!boardId) return;

      this.listService.createList({ name: this.newListName.trim(), boardId: String(boardId) }).subscribe({
        next: (newList) => {
          this.newListName = '';
          this.showNewListInput.set(false);
          if (newList?.id) {
            this.activeCardListId.set(newList.id);
            this.newCardTitle = '';
          }
        },
        error: () => {
          // keep input open so user can retry
        }
      });
    }
  }

  // ─── Card Creation ────────────────────────────────────────────────────────

  toggleCardInput(listId: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.activeCardListId() === listId) {
      this.activeCardListId.set(null);
      this.newCardTitle = '';
    } else {
      this.activeCardListId.set(listId);
      this.newCardTitle = '';
    }
  }

  createCardInline(listId: string): void {
    if (this.newCardTitle.trim()) {
      this.cardService.createCard({ title: this.newCardTitle.trim(), listId }).subscribe(() => {
        this.newCardTitle = '';
        this.activeCardListId.set(listId);
      });
    }
  }

  closeCardInput(): void {
    this.activeCardListId.set(null);
    this.newCardTitle = '';
  }
}