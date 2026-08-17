import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { BoardMemberSummary } from '../models/board.models';

@Injectable({
  providedIn: 'root'
})
export class BoardMemberService {
  private base = `${environment.apiUrl}${environment.api.basePath}`;

  constructor(private http: HttpClient) {}

  private mapMember = (raw: any): BoardMemberSummary => ({
    id: raw.id,
    userId: raw.userId,
    userFullName: raw.userFullName,
    role: raw.role,
    boardId: raw.boardId
  });

  getMembers(boardId: string | number): Observable<BoardMemberSummary[]> {
    return this.http.get<any>(`${this.base}/board/${boardId}/members`).pipe(
      map(response => {
        const raw = response?.data ?? response ?? [];
        return (Array.isArray(raw) ? raw : []).map(this.mapMember);
      })
    );
  }

  addMembers(boardId: string | number, userIds: (string | number)[]): Observable<void> {
    return this.http.post<void>(`${this.base}/board/${boardId}/members`, { userIds });
  }
}