import { Component, Input, Output, EventEmitter, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Card, Label } from '../../models/board.models';
import { CardService } from '../../services/card.service';
import { LabelService } from '../../services/label.service';
import { BoardMemberService } from '../../services/board-member.service';
import { BoardMemberSummary } from '../../models/board.models';

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
    private boardMemberService: BoardMemberService
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

  ngOnInit(): void {
    if (this.card) {
      this.editTitle = this.card.title;
      this.editDescription = this.card.description || '';
    }

    if (this.boardId != null) {
      this.labelService.getLabelsByBoard(this.boardId).subscribe({
        next: (labels) => this.availableLabels.set(labels),
        error: () => this.availableLabels.set([])
      });

      this.boardMemberService.getMembers(this.boardId).subscribe({
        next: (members) => this.boardMembers.set(members),
        error: () => this.boardMembers.set([])
      });
    }
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
      next: (updatedCard) => {
        if (!this.card) return;
        this.card.assigneeId = updatedCard.assigneeId;
        this.card.assigneeName = updatedCard.assigneeName;
        this.isReassigning.set(false);
        this.showAssigneePicker.set(false);
      },
      error: () => this.isReassigning.set(false)
    });
  }

  // ─── Editing ──────────────────────────────────────────────────────────────

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
}