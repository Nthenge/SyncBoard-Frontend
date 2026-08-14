import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { FAQ } from '../models/board.models';

@Injectable({
  providedIn: 'root'
})
export class FaqService {
  private base = `${environment.apiUrl}${environment.api.basePath}`;

  constructor(private http: HttpClient) {}

  getActiveFaqs(): Observable<FAQ[]> {
    return this.http.get<any>(`${this.base}/faqs/active`).pipe(
      map(response => {
        const raw = response?.data ?? response ?? [];
        return Array.isArray(raw) ? raw : [];
      })
    );
  }
}