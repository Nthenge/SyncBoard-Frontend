import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppNotification, SpringPage } from '../models/board.models';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private base = `${environment.apiUrl}${environment.api.basePath}`;

  constructor(private http: HttpClient) {}

  private mapNotification = (raw: any): AppNotification => ({
    id: raw.id,
    type: raw.type,
    message: raw.message,
    referenceType: raw.referenceType,
    referenceId: raw.referenceId,
    read: raw.read,
    createdAt: raw.createdAt
  });

  getNotifications(page: number, size: number = 10): Observable<SpringPage<AppNotification>> {
    return this.http.get<any>(`${this.base}/user/notifications?page=${page}&size=${size}`).pipe(
      map(response => {
        const raw = response?.data ?? response;
        return {
          content: Array.isArray(raw?.content) ? raw.content.map(this.mapNotification) : [],
          totalElements: raw?.totalElements ?? 0,
          totalPages: raw?.totalPages ?? 0,
          number: raw?.number ?? 0,
          size: raw?.size ?? size,
          last: raw?.last ?? true
        };
      })
    );
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<any>(`${this.base}/user/notifications/unread-count`).pipe(
      map(response => response?.data ?? response ?? 0)
    );
  }

  markRead(notificationId: string | number): Observable<void> {
    return this.http.patch<void>(`${this.base}/user/notifications/${notificationId}/read`, {});
  }

  markAllRead(): Observable<void> {
    return this.http.patch<void>(`${this.base}/user/notifications/read-all`, {});
  }
}