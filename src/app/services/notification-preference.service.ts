import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationPreference } from '../models/board.models';

@Injectable({
  providedIn: 'root'
})
export class NotificationPreferenceService {
  private base = `${environment.apiUrl}${environment.api.basePath}`;

  constructor(private http: HttpClient) {}

  private mapPreference = (raw: any): NotificationPreference => ({
    emailOnAssign: raw.emailOnAssign,
    inAppOnAssign: raw.inAppOnAssign,
    emailOnBoardAdd: raw.emailOnBoardAdd,
    inAppOnBoardAdd: raw.inAppOnBoardAdd,
    emailOnMention: raw.emailOnMention,
    inAppOnMention: raw.inAppOnMention,
    emailOnDueSoon: raw.emailOnDueSoon,
    inAppOnDueSoon: raw.inAppOnDueSoon,
    weeklyDigest: raw.weeklyDigest
  });

  getPreferences(): Observable<NotificationPreference> {
    return this.http.get<any>(`${this.base}/user/notification-preferences`).pipe(
      map(response => this.mapPreference(response?.data ?? response))
    );
  }

  updatePreferences(prefs: NotificationPreference): Observable<NotificationPreference> {
    return this.http.put<any>(`${this.base}/user/notification-preferences`, prefs).pipe(
      map(response => this.mapPreference(response?.data ?? response))
    );
  }
}