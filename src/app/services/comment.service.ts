import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Comment, CreateCommentRequest } from '../models/board.models';

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private base = `${environment.apiUrl}${environment.api.basePath}`;

  constructor(private http: HttpClient) {}

  private mapComment = (raw: any): Comment => ({
    id: raw.id,
    cardId: raw.cardId,
    authorId: raw.authorId,
    authorName: raw.authorName,
    content: raw.content,
    createdAt: raw.createdAt,
    mentions: Array.isArray(raw.mentions)
      ? raw.mentions.map((m: any) => ({ userId: m.userId, userFullName: m.userFullName }))
      : []
  });

  getComments(cardId: string | number): Observable<Comment[]> {
    return this.http.get<any>(`${this.base}/cards/${cardId}/comments`).pipe(
      map(response => {
        const raw = response?.data ?? response ?? [];
        return (Array.isArray(raw) ? raw : []).map(this.mapComment);
      })
    );
  }

  createComment(cardId: string | number, request: CreateCommentRequest): Observable<Comment> {
    return this.http.post<any>(`${this.base}/cards/${cardId}/comments`, request).pipe(
      map(response => this.mapComment(response?.data ?? response))
    );
  }

  deleteComment(cardId: string | number, commentId: string | number): Observable<void> {
    return this.http.delete<void>(`${this.base}/cards/${cardId}/comments/${commentId}`);
  }
}