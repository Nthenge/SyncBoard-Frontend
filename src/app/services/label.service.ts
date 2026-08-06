import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Label, CreateLabelRequest } from '../models/board.models';

@Injectable({
  providedIn: 'root'
})
export class LabelService {
  private base = `${environment.apiUrl}${environment.api.basePath}`;

  constructor(private http: HttpClient) {}

  private mapLabel = (raw: any): Label => ({
    id: raw.id,
    name: raw.name,
    color: raw.color,
    boardId: raw.boardId
  });

  getLabelsByBoard(boardId: string | number): Observable<Label[]> {
    return this.http.get<any>(`${this.base}/boards/${boardId}/labels`).pipe(
      map(response => {
        const raw = response?.data ?? response ?? [];
        return (Array.isArray(raw) ? raw : []).map(this.mapLabel);
      })
    );
  }

  createLabel(boardId: string | number, request: CreateLabelRequest): Observable<Label> {
    return this.http.post<any>(`${this.base}/boards/${boardId}/labels`, request).pipe(
      map(response => this.mapLabel(response?.data ?? response))
    );
  }

  deleteLabel(labelId: string | number): Observable<void> {
    return this.http.delete<void>(`${this.base}/labels/${labelId}`);
  }
}