import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  Workspace,
  CreateWorkspaceRequest,
  WorkspaceMember,
  WorkspaceInvitation,
  SendWorkspaceInvitationRequest,
  WorkspaceInvitationResponse,
  MyInvitation
} from '../models/board.models';

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {
  private base = `${environment.apiUrl}${environment.api.basePath}`;

  constructor(private http: HttpClient) {}

  getMyWorkspaces(): Observable<Workspace[]> {
    return this.http.get<any>(`${this.base}/workspace/my-workspaces`).pipe(
      map(response => response.data)
    );
  }

  getWorkspace(id: string | number): Observable<Workspace> {
    return this.http.get<any>(`${this.base}/workspace/${id}`).pipe(
      map(response => response.data)
    );
  }

  createWorkspace(request: CreateWorkspaceRequest): Observable<Workspace> {
    return this.http.post<any>(`${this.base}/workspace/create`, request).pipe(
      map(response => response.data)
    );
  }

  deleteWorkspace(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/workspace/${id}`);
  }

  getWorkspaceMembers(workspaceId: string | number): Observable<WorkspaceMember[]> {
    return this.http.get<any>(`${this.base}/workspace/${workspaceId}/members`).pipe(
      map(response => response.data ?? response)
    );
  }

  removeWorkspaceMember(workspaceId: string | number, userId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/workspace/${workspaceId}/members/${userId}`
    );
  }

  updateWorkspaceMemberRole(
    workspaceId: string | number,
    userId: string,
    role: 'admin' | 'member'
  ): Observable<WorkspaceMember> {
    return this.http.put<any>(
      `${this.base}/workspace/${workspaceId}/members/${userId}/role`,
      { role }
    ).pipe(map(response => response.data ?? response));
  }

inviteMember(request: SendWorkspaceInvitationRequest): Observable<WorkspaceInvitationResponse> {
  return this.http.post<WorkspaceInvitationResponse>(
    `${this.base}/workspace/${request.workSpaceId}/invite`,
    { email: request.invitations.map(i => i.email) }
  );
}

  getPendingInvitations(workspaceId: string | number): Observable<WorkspaceInvitation[]> {
    return this.http.get<any>(
      `${this.base}/workspace/${workspaceId}/invites`
    ).pipe(map(response => response.data ?? response));
  }

  cancelInvitation(workspaceId: string | number, invitationId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/workspace/${workspaceId}/invites/${invitationId}`
    );
  }

  acceptInvitation(token: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.base}/workspace/invitations/${token}/accept`,
      {}
    );
  }

  declineInvitation(token: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(
      `${this.base}/workspace/invitations/${token}/decline`,
      {}
    );
  }

  // UPDATE: Match backend path /workspace/accept-invite?token=...
acceptInvite(token: string): Observable<any> {
  return this.http.post<any>(
    `${this.base}/workspace/accept-invite`,
    {},
    { params: { token } }
  );
}

// UPDATE: Match backend path /workspace/reject-invite?token=...
rejectInvite(token: string): Observable<any> {
  return this.http.post<any>(
    `${this.base}/workspace/reject-invite`,
    {},
    { params: { token } }
  );
}

// UPDATE: Match backend endpoint GET /workspace/{workspaceId}/invitations
getWorkspaceInvitations(workspaceId: string | number): Observable<WorkspaceInvitation[]> {
  return this.http.get<any>(
    `${this.base}/workspace/${workspaceId}/invitations`
  ).pipe(map(response => response.data ?? response));
}

// UPDATE: Match backend endpoint DELETE /workspace/invitations/{invitationId}
deleteInvitation(invitationId: string | number): Observable<void> {
  return this.http.delete<void>(
    `${this.base}/workspace/invitations/${invitationId}`
  );
}

getMyInvitations(): Observable<MyInvitation[]> {
  return this.http.get<any>(`${this.base}/workspace/my-invitations`).pipe(
    map(response => response.data ?? response)
  );
}

rejectInvitation(token: string): Observable<any> {
  return this.rejectInvite(token);
}
}