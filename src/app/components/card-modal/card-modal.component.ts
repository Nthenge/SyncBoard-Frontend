import { Component, Input, Output, EventEmitter, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Card, Label } from '../../models/board.models';
import { CardService } from '../../services/card.service';
import { LabelService } from '../../services/label.service';
import { BoardMemberService } from '../../services/board-member.service';
import { BoardMemberSummary, Comment, CommentMentionSummary } from '../../models/board.models';
import { CommentService } from '../../services/comment.service';

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
}

@Component({
  selector: 'app-card-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './card-modal.component.html',
  styleUrls: ['./card-modal.component.css']
})
export class CardModalComponent implements OnInit {
  constructor(
    private cardService: CardService,
    private labelService: LabelService,
    private boardMemberService: BoardMemberService,
    private commentService: CommentService
  ) {}

  @Input() card: Card | null = null;
  @Input() boardId: string | number | null = null;

  @Output() save = new EventEmitter<Card>();
  @Output() delete = new EventEmitter<string | number>();
  @Output() close = new EventEmitter<void>();

  editTitle = '';
  editDescription = '';

  isEditing = signal(false);
  showLabelPicker = signal(false);
  isTogglingLabel = signal(false);
  showAssigneePicker = signal(false);
  isReassigning = signal(false);

  availableLabels = signal<Label[]>([]);
  boardMembers = signal<BoardMemberSummary[]>([]);

  // ─── Due date / calendar state ───────────────────────────────────────────

  showDueDatePicker = signal(false);
  isUpdatingDueDate = signal(false);
  dueDateError = signal<string | null>(null);
  calendarViewDate = signal<Date>(new Date());
  comments = signal<Comment[]>([]);
  commentsLoading = signal(false);
  newCommentText = '';
  showMentionPicker = signal(false);
  selectedMentions = signal<CommentMentionSummary[]>([]);
  postingComment = signal(false);

  calendarWeeks = computed(() => this.buildCalendarWeeks(this.calendarViewDate()));

  ngOnInit(): void {
    if (this.card) {
      this.editTitle = this.card.title;
      this.editDescription = this.card.description || '';
    }

    if (this.card) {
    this.loadComments();
  }

    if (this.boardId != null) {
      this.labelService.getLabelsByBoard(this.boardId).subscribe({
      next: (labels: Label[]) => this.availableLabels.set(labels),
      error: () => this.availableLabels.set([])
    });

    this.boardMemberService.getMembers(this.boardId).subscribe({
      next: (members: BoardMemberSummary[]) => this.boardMembers.set(members),
      error: () => this.boardMembers.set([])
    });
    }
  }

  loadComments(): void {
    if (!this.card) return;
    this.commentsLoading.set(true);
    this.commentService.getComments(this.card.id).subscribe({
      next: (comments: Comment[]) => {
        this.comments.set(comments);
        this.commentsLoading.set(false);
      },
      error: () => {
        this.comments.set([]);
        this.commentsLoading.set(false);
      }
    });
  }

toggleMentionPicker(): void {
  this.showMentionPicker.set(!this.showMentionPicker());
}

toggleMention(member: BoardMemberSummary): void {
  const current = this.selectedMentions();
  const exists = current.some(m => m.userId === member.userId);
  this.selectedMentions.set(
    exists
      ? current.filter(m => m.userId !== member.userId)
      : [...current, { userId: member.userId, userFullName: member.userFullName }]
  );
}

isMentioned(member: BoardMemberSummary): boolean {
  return this.selectedMentions().some(m => m.userId === member.userId);
}

postComment(): void {
  if (!this.card || !this.newCommentText.trim()) return;
  if (this.postingComment()) return;

  this.postingComment.set(true);

  this.commentService.createComment(this.card.id, {
    content: this.newCommentText.trim(),
    mentionedUserIds: this.selectedMentions().map(m => m.userId)
  }).subscribe({
    next: (comment: Comment) => {
      this.comments.update(list => [...list, comment]);
      this.newCommentText = '';
      this.selectedMentions.set([]);
      this.showMentionPicker.set(false);
      this.postingComment.set(false);
    },
    error: () => this.postingComment.set(false)
  });
}

deleteComment(comment: Comment): void {
  if (!this.card) return;
  this.commentService.deleteComment(this.card.id, comment.id).subscribe({
    next: () => this.comments.update(list => list.filter(c => c.id !== comment.id))
  });
}

  onClose(): void {
    this.close.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.onClose();
    }
  }

  onSave(): void {
    if (this.card && this.editTitle.trim()) {
      const updatedCard: Card = {
        ...this.card,
        title: this.editTitle.trim(),
        description: this.editDescription.trim()
      };
      this.save.emit(updatedCard);
    }
  }

  onDelete(): void {
    if (this.card) {
      this.delete.emit(this.card.id);
    }
  }

  // ─── Labels ───────────────────────────────────────────────────────────────

  toggleLabelPicker(): void {
    this.showLabelPicker.set(!this.showLabelPicker());
  }

  toggleLabel(label: Label): void {
    if (!this.card) return;
    if (this.isTogglingLabel()) return;

    this.isTogglingLabel.set(true);
    const exists = this.card.labels.some(l => l.id === label.id);

    const request$ = exists
      ? this.cardService.detachLabel(this.card.id, label.id)
      : this.cardService.attachLabel(this.card.id, label.id);

    request$.subscribe({
      next: () => {
        if (!this.card) return;
        this.card.labels = exists
          ? this.card.labels.filter(l => l.id !== label.id)
          : [...this.card.labels, label];
        this.isTogglingLabel.set(false);
      },
      error: () => this.isTogglingLabel.set(false)
    });
  }

  hasLabel(labelId: string | number): boolean {
    return this.card?.labels.some(l => l.id === labelId) || false;
  }

  removeLabel(labelId: string | number): void {
    if (!this.card) return;
    if (this.isTogglingLabel()) return;

    this.isTogglingLabel.set(true);

    this.cardService.detachLabel(this.card.id, labelId).subscribe({
      next: () => {
        if (!this.card) return;
        this.card.labels = this.card.labels.filter(l => l.id !== labelId);
        this.isTogglingLabel.set(false);
      },
      error: () => this.isTogglingLabel.set(false)
    });
  }

  // ─── Assignee ─────────────────────────────────────────────────────────────

  toggleAssigneePicker(): void {
    this.showAssigneePicker.set(!this.showAssigneePicker());
  }

  reassign(member: BoardMemberSummary): void {
    if (!this.card) return;
    if (this.isReassigning()) return;

    this.isReassigning.set(true);

    this.cardService.reassignCard(this.card.id, member.userId).subscribe({
      next: (updatedCard: Card) => {
        if (!this.card) return;
        this.card.assigneeId = updatedCard.assigneeId;
        this.card.assigneeName = updatedCard.assigneeName;
        this.isReassigning.set(false);
        this.showAssigneePicker.set(false);
      },
      error: () => this.isReassigning.set(false)
    });
  }

  // ─── Editing (title/description) ───────────────────────────────────────────

  startEditing(): void {
    this.isEditing.set(true);
  }

  cancelEditing(): void {
    if (this.card) {
      this.editTitle = this.card.title;
      this.editDescription = this.card.description || '';
    }
    this.isEditing.set(false);
  }

  // ─── Due date / calendar ────────────────────────────────────────────────────

  toggleDueDatePicker(event?: Event): void {
    if (event) event.stopPropagation();
    if (this.showDueDatePicker()) {
      this.showDueDatePicker.set(false);
      return;
    }
    const current = this.parseDueDate(this.card?.dueDate) || new Date();
    this.calendarViewDate.set(new Date(current.getFullYear(), current.getMonth(), 1));
    this.dueDateError.set(null);
    this.showDueDatePicker.set(true);
  }

  closeDueDatePicker(): void {
    this.showDueDatePicker.set(false);
  }

  prevMonth(): void {
    const d = this.calendarViewDate();
    this.calendarViewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.calendarViewDate();
    this.calendarViewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  monthLabel(): string {
    return this.calendarViewDate().toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  isSelectedDay(day: Date): boolean {
    const selected = this.parseDueDate(this.card?.dueDate);
    return !!selected && this.isSameDay(day, selected);
  }

  isToday(day: Date): boolean {
    return this.isSameDay(day, new Date());
  }

  selectDueDate(day: Date): void {
    if (!this.card) return;
    if (this.isUpdatingDueDate()) return;

    this.isUpdatingDueDate.set(true);
    this.dueDateError.set(null);

    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    const dueDateString = `${y}-${m}-${d}T00:00:00`;

    this.cardService.updateCard(String(this.card.id), { dueDate: dueDateString as any }).subscribe({
      next: (updated: Card) => {
        if (!this.card) return;
        this.card.dueDate = (updated as any)?.dueDate ?? day;
        this.isUpdatingDueDate.set(false);
        this.showDueDatePicker.set(false);
      },
      error: (err: { error?: { message?: string } }) => {
        this.isUpdatingDueDate.set(false);
        this.dueDateError.set(err?.error?.message || 'Failed to update due date.');
      }
    });
  }

  clearDueDate(event: Event): void {
  event.stopPropagation();
  if (!this.card) return;
  if (this.isUpdatingDueDate()) return;

  this.isUpdatingDueDate.set(true);
  this.dueDateError.set(null);

  this.cardService.updateCard(String(this.card.id), { dueDate: null }).subscribe({
    next: (updated: Card) => {
      if (!this.card) return;
      this.card.dueDate = (updated as any)?.dueDate ?? undefined;
      this.isUpdatingDueDate.set(false);
      this.showDueDatePicker.set(false);
    },
    error: (err: { error?: { message?: string } }) => {
      this.isUpdatingDueDate.set(false);
      this.dueDateError.set(err?.error?.message || 'Failed to clear due date.');
    }
  });
}

  private parseDueDate(value: any): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  private buildCalendarWeeks(viewDate: Date): CalendarDay[][] {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: CalendarDay[] = [];

    for (let i = startWeekday - 1; i >= 0; i--) {
      const day = daysInPrevMonth - i;
      cells.push({ date: new Date(year, month - 1, day), inCurrentMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: new Date(year, month, day), inCurrentMonth: true });
    }

    while (cells.length % 7 !== 0) {
      const lastDate = cells[cells.length - 1].date;
      const nextDate = new Date(lastDate);
      nextDate.setDate(lastDate.getDate() + 1);
      cells.push({ date: nextDate, inCurrentMonth: false });
    }

    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks;
  }
}