import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type WorkspaceInviteRole = 'admin' | 'member';

export interface SendWorkspaceInvitationRequest {
  workSpaceId: string | number;
  invitations: Array<{ email: string; role: WorkspaceInviteRole }>;
}

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private base = `${environment.apiUrl}${environment.api.basePath}`;

  constructor(private http: HttpClient) {}

  sendInvitation(
    request: SendWorkspaceInvitationRequest
  ): Observable<any> {
    return this.http.post<any>(
      `${this.base}/workspace/${request.workSpaceId}/invite`,
      { email: request.invitations.map(i => i.email), role: undefined }
    );
  }
}

