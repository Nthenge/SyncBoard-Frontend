import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Board, CreateBoardRequest, UpdateBoardRequest } from '../models/board.models';
import { RecentBoardSummary } from '../models/board.models'; 

@Injectable({
  providedIn: 'root'
})
export class BoardService {
  private base = `${environment.apiUrl}${environment.api.basePath}`;

  constructor(private http: HttpClient) {}

  getBoard(boardId: string): Observable<Board> {
    return this.http.get<any>(`${this.base}/boards/${boardId}`).pipe(
      map(response => response.data ?? response)
    );
  }

  getBoardsByWorkspace(workspaceId: string): Observable<Board[]> {
    return this.http.get<any>(`${this.base}/boards/workspace/${workspaceId}`).pipe(
      map(response => response.data ?? response)
    );
  }


  createBoard(request: CreateBoardRequest): Observable<Board> {
    return this.http.post<any>(
      `${this.base}/boards/${request.workSpaceId}`,
      {
        boardName: request.boardName,
        boardDescription: request.boardDescription,
        boardColor: request.boardColor,
        isStarred: request.isStarred ?? false
      }
    ).pipe(map(response => response.data ?? response));
  }


  updateBoard(boardId: string, request: UpdateBoardRequest): Observable<Board> {
    return this.http.put<any>(`${this.base}/boards/${boardId}`, request).pipe(
      map(response => response.data ?? response)
    );
  }

  deleteBoard(boardId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/boards/${boardId}`);
  }

  getRecentBoards(limit = 5): Observable<RecentBoardSummary[]> {
    return this.http.get<any>(`${this.base}/user/recent-boards?limit=${limit}`).pipe(
      map(response => response.data ?? response)
    );
  }

  trackBoardAccess(boardId: string | number, listId?: string | number, cardId?: string | number): Observable<void> {
    let url = `${this.base}/user/recent-boards/${boardId}`;
    const params: string[] = [];
    if (listId != null) params.push(`listId=${listId}`);
    if (cardId != null) params.push(`cardId=${cardId}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.http.post<void>(url, {});
  }

  starBoard(boardId: string): Observable<{ starred: boolean }> {
    return this.http.post<any>(
      `${environment.apiUrl}${environment.api.basePath}/boards/${boardId}/star`, {}
    ).pipe(map(res => res?.data ?? res));
  }

  getStarredBoards(): Observable<Board[]> {
    return this.http.get<any>(
      `${environment.apiUrl}${environment.api.basePath}/boards/starred`
    ).pipe(map(res => res?.data ?? res ?? []));
  }
}