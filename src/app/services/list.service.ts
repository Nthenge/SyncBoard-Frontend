
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { BoardList, CreateListRequest, UpdateListRequest } from '../models/board.models';

@Injectable({
  providedIn: 'root'
})
export class ListService {
  
  private useMockData = false;

  // Lists signal for real-time updates
  private listsSubject = new BehaviorSubject<BoardList[]>([]);
  lists$ = this.listsSubject.asObservable();

constructor(private http: HttpClient) {
    // Initialize with empty lists - user creates their own lists
    // Set useMockData to true only if you want pre-filled demo data
    if (this.useMockData) {
      // Start with empty lists - user will create their own
      this.listsSubject.next([]);
    }
  }
  /**
   * Get all lists for a board
   */
getLists(boardId: string): Observable<BoardList[]> {
  if (this.useMockData) {
    return of([]).pipe(delay(300));
  }

  return this.http.get<any>(
    `${environment.apiUrl}${environment.api.basePath}/boards/${boardId}/lists`
  ).pipe(
    map(response => {
      const raw = response?.data ?? response ?? [];
      return (Array.isArray(raw) ? raw : []).map((l: any) => ({
        id: l.id,
        name: l.title,
        order: l.position,
        boardId: l.boardId,
        cards: []
      } as BoardList));
    })
  );
}

  /**
   * Create a new list
   */
  createList(request: CreateListRequest): Observable<BoardList> {
    if (this.useMockData) {
      const currentLists = this.listsSubject.value;
      const newList: BoardList = {
        id: `list-${Date.now()}`,
        name: request.name,
        boardId: request.boardId,
        order: request.order ?? currentLists.length,
        cards: []
      };

      // Update the lists
      const updatedLists = [...currentLists, newList];
      this.listsSubject.next(updatedLists);

      return of(newList).pipe(delay(200));
    }

    const body = {
      title: request.name,
      position: request.order ?? this.listsSubject.value.length,
      boardId: request.boardId,
    };

    return this.http.post<BoardList>(
      `${environment.apiUrl}${environment.api.basePath}/boards/lists`,
      body
    ).pipe(
      // Keep UI in sync even in non-mock mode
      map(created => {
        const current = this.listsSubject.value;
        this.listsSubject.next([...current, created]);
        return created;
      })
    );
  }

  /**
   * Update a list
   */
  updateList(listId: string, updates: UpdateListRequest): Observable<BoardList> {
    if (this.useMockData) {
      const currentLists = this.listsSubject.value;
      const listIndex = currentLists.findIndex(l => l.id === listId);
      
      if (listIndex !== -1) {
        const updatedList = { ...currentLists[listIndex], ...updates };
        const updatedLists = [...currentLists];
        updatedLists[listIndex] = updatedList;
        this.listsSubject.next(updatedLists);
        return of(updatedList).pipe(delay(200));
      }
    }

    return this.http.put<BoardList>(
      `${environment.apiUrl}${environment.api.basePath}/lists/${listId}`,
      updates
    );
  }

  /**
   * Delete a list
   */
  deleteList(listId: string): Observable<void> {
    if (this.useMockData) {
      const currentLists = this.listsSubject.value;
      const updatedLists = currentLists.filter(l => l.id !== listId);
      this.listsSubject.next(updatedLists);
      return of(undefined).pipe(delay(200));
    }

    return this.http.delete<void>(
      `${environment.apiUrl}${environment.api.basePath}/lists/${listId}`
    );
  }

  /**
   * Reorder lists
   */
  reorderLists(boardId: string, listIds: string[]): Observable<BoardList[]> {
    if (this.useMockData) {
      const currentLists = this.listsSubject.value;
      const reorderedLists = listIds.map((id, index) => {
        const list = currentLists.find(l => l.id === id);
        return list ? { ...list, order: index } : null;
      }).filter((l): l is BoardList => l !== null);
      
      this.listsSubject.next(reorderedLists);
      return of(reorderedLists).pipe(delay(200));
    }

    return this.http.put<BoardList[]>(
      `${environment.apiUrl}${environment.api.basePath}/boards/${boardId}/lists/reorder`,
      { listIds }
    );
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Get current lists value
   */
  getCurrentLists(): BoardList[] {
    return this.listsSubject.value;
  }

  /**
   * Update lists from external source (e.g., WebSocket)
   */
  updateLists(lists: BoardList[]): void {
    this.listsSubject.next(lists);
  }
}
