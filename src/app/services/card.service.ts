import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Card, CreateCardRequest, UpdateCardRequest, MoveCardRequest } from '../models/board.models';
import { ListService } from './list.service';

@Injectable({
  providedIn: 'root'
})
export class CardService {
  private useMockData = false;
  private base = `${environment.apiUrl}${environment.api.basePath}`;

  constructor(
    private http: HttpClient,
    private listService: ListService
  ) {}

  private mapCard = (raw: any): Card => ({
    id: raw.id,
    title: raw.title,
    description: raw.description ?? '',
    listId: raw.listId,
    order: raw.position,
    priority: raw.priority,
    dueDate: raw.dueDate ? new Date(raw.dueDate) : undefined,
    labels: Array.isArray(raw.labels)
      ? raw.labels.map((l: any) => ({ id: l.id, name: l.name, color: l.color, boardId: l.boardId }))
      : [],
    assigneeId: raw.assigneeId,
    assigneeName: raw.assigneeName,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
    updatedAt: undefined
  });

  getCards(listId: string): Observable<Card[]> {
    if (this.useMockData) {
      const lists = this.listService.getCurrentLists();
      const list = lists.find(l => l.id === listId);
      return of(list?.cards || []).pipe(delay(200));
    }

    return this.http.get<any>(`${this.base}/cards/lists/${listId}/cards`).pipe(
      map(response => {
        const raw = response?.data ?? response ?? [];
        return (Array.isArray(raw) ? raw : []).map(this.mapCard);
      })
    );
  }

  getCard(cardId: string): Observable<Card> {
    return this.http.get<any>(`${this.base}/cards/${cardId}`).pipe(
      map(response => this.mapCard(response?.data ?? response))
    );
  }

  createCard(request: CreateCardRequest): Observable<Card> {
    const body = {
      listId: request.listId,
      title: request.title,
      description: request.description,
      priority: request.priority,
      dueDate: request.dueDate,
      position: request.order
    };

    return this.http.post<any>(`${this.base}/cards`, body).pipe(
      map(response => this.mapCard(response?.data ?? response))
    );
  }

  updateCard(cardId: string, updates: UpdateCardRequest): Observable<Card> {
    const body = {
      listId: updates.listId,
      title: updates.title,
      description: updates.description,
      priority: updates.priority,
      dueDate: updates.dueDate,
      position: updates.order
    };

    return this.http.put<any>(`${this.base}/cards/${cardId}`, body).pipe(
      map(response => this.mapCard(response?.data ?? response))
    );
  }

  moveCard(request: MoveCardRequest): Observable<Card> {
    return this.http.put<any>(`${this.base}/cards/${request.cardId}/move`, request).pipe(
      map(response => this.mapCard(response?.data ?? response))
    );
  }

  deleteCard(cardId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/cards/${cardId}`);
  }

  reassignCard(cardId: string | number, userId: string | number): Observable<Card> {
  return this.http.put<any>(`${this.base}/cards/${cardId}/assignee`, { userId }).pipe(
    map(response => this.mapCard(response?.data ?? response))
  );
}

  attachLabel(cardId: string | number, labelId: string | number): Observable<void> {
    return this.http.post<void>(`${this.base}/cards/${cardId}/labels/${labelId}`, {});
  }

  detachLabel(cardId: string | number, labelId: string | number): Observable<void> {
    return this.http.delete<void>(`${this.base}/cards/${cardId}/labels/${labelId}`);
  }
}