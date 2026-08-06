import { ComponentFixture, TestBed } from '@angular/core/testing';
import { WorkspacesComponent } from './workspaces.component';
import { Router } from '@angular/router';
import { of } from 'rxjs';

// Services injected by WorkspacesComponent
import { WorkspaceService } from '../../services/workspace.service';
import { AuthService } from '../../services/auth.service';
import { BoardService } from '../../services/board.service';
import { ListService } from '../../services/list.service';
import { CardService } from '../../services/card.service';
import { BoardMemberService } from '../../services/board-member.service';

describe('WorkspacesComponent', () => {
  let component: WorkspacesComponent;
  let fixture: ComponentFixture<WorkspacesComponent>;

  // Lightweight Mocks returning basic RxJS observables
  const mockWorkspaceService = {
    getMyWorkspaces: () => of([]),
    createWorkspace: () => of({}),
    acceptInvite: () => of({}),
    rejectInvite: () => of({})
  };

  const mockAuthService = {
    user: () => ({ id: 1, name: 'User', email: 'user@example.com' }),
    logout: () => {}
  };

  const mockBoardService = {
    getBoardsForUser: () => of([]),
    getBoardsByWorkspace: () => of([])
  };

  const mockListService = {
    getLists: () => of([])
  };

  const mockCardService = {
    getCards: () => of([])
  };

  const mockBoardMemberService = {
    getMembers: () => of([])
  };

  const mockRouter = {
  navigate: (commands: any[]) => Promise.resolve(true)
};

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkspacesComponent],
      providers: [
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: BoardService, useValue: mockBoardService },
        { provide: ListService, useValue: mockListService },
        { provide: CardService, useValue: mockCardService },
        { provide: BoardMemberService, useValue: mockBoardMemberService },
        { provide: Router, useValue: mockRouter }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WorkspacesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});