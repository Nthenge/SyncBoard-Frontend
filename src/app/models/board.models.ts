export interface Workspace {
  id: number;
  workSpaceName: string;
  workSpaceDescription?: string;
  workSpaceCreatedAt: string;
  updatedAt: string;
  owner: {
    id: number;
    firstName: string;
    sirName: string;
    email: string;
    avatar?: string | null;
  };
  members: WorkspaceMember[];
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  avatar?: string | null;
  joinedAt?: string;
}

export interface CreateWorkspaceRequest {
  workSpaceName: string;
  workSpaceDescription?: string;
}

// Workspace Invitation 

export interface WorkspaceInvitation {
  id: string;
  workSpaceId: string | number;
  email: string;
  role: 'admin' | 'member';
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined';
  expiresAt: Date;
}

// Updated to support bulk invitations
export interface SendWorkspaceInvitationRequest {
  workSpaceId: string | number;
  invitations: {
    email: string;
    role: 'admin' | 'member';
  }[];
}

export interface WorkspaceInvitationResponse {
  success: boolean;
  results: {
    email: string;
    status: 'sent' | 'failed' | 'already_member' | 'already_invited';
    invitation?: WorkspaceInvitation;
    error?: string;
  }[];
  message?: string;
}

//  Label 

export type CardPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';


export interface Label {
  id: string | number;
  name: string;
  color: string;
  boardId?: string | number;
}

export interface MyInvitation {
  token: string;
  workspaceName: string;
  expiryDate: string;
}

export interface CreateLabelRequest {
  name: string;
  color: string;
}

//  Board Member 

export interface BoardMember {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member' | 'observer';
  avatar?: string;
  joinedAt: Date;
}

export interface BoardMemberSummary {
  id: string | number;
  userId: string | number;
  userFullName: string;
  role: 'owner' | 'admin' | 'member' | 'observer' | string;
  boardId: string | number;
}

//  Card 
export interface Card {
  id: string | number;
  title: string;
  description: string;
  listId: string | number;
  order: number;
  priority?: CardPriority;
  labels: Label[];
  dueDate?: Date;
  assigneeId?: string | number;
  assigneeName?: string;
  createdAt: Date;
  updatedAt?: Date;
}

//  List (Column) 

export interface MyInvitation {
  token: string;
  workspaceName: string;
  expiryDate: string;
}

export interface BoardList {
  id: string;
  name: string;
  boardId: string;
  order: number;
  cards: Card[];
}

//  Board 

export interface Board {
  id: string | number;
  boardName: string;
  boardDescription?: string | null;
  boardCreatedAt?: string;
  boardCreatedBy?: string;
  workSpaceId: string | number;
  isStarred?: boolean;
  boardColor?: string;
  members?: BoardMember[];
}


//  Board Invitation 

export interface Invitation {
  id: string;
  boardId: string;
  email: string;
  role: 'admin' | 'member' | 'observer';
  invitedBy: string;
  status: 'pending' | 'accepted' | 'declined';
  expiresAt: Date;
}

// Board Requests 

export interface CreateBoardRequest {
  boardName: string;
  boardDescription?: string;
  workSpaceId: string | number;
  isStarred?: boolean;
  // Optional board color; backend may store/return it.
  boardColor?: string;
}


export interface UpdateBoardRequest {
  boardName?: string;
  boardDescription?: string;
  isStarred?: boolean;
}

//  List Requests 

export interface CreateListRequest {
  name: string;
  boardId: string;
  order?: number;
}

export interface UpdateListRequest {
  name?: string;
  order?: number;
}

//  Card Requests

export interface CreateCardRequest {
  title: string;
  description?: string;
  listId: string | number;
  order?: number;
  priority?: CardPriority;
  dueDate?: Date;
}

export interface UpdateCardRequest {
  title?: string;
  description?: string;
  order?: number;
  listId?: string | number;
  priority?: CardPriority;
  dueDate?: Date;
}

export interface MoveCardRequest {
  cardId: string;
  targetListId: string;
  newIndex: number;
}

//  Board Invitation Requests 

export interface SendInvitationRequest {
  boardId: string;
  email: string;
  role: 'admin' | 'member' | 'observer';
}

export interface InvitationResponse {
  success: boolean;
  invitation?: Invitation;
  message?: string;
}

//  WebSocket Event

export interface CardMovedEvent {
  cardId: string | number;
  fromListId: string;
  toListId: string;
  newIndex: number;
  userId: string;
}

export interface CardUpdatedEvent {
  card: Card;
  userId: string;
}

export interface CardCreatedEvent {
  card: Card;
  userId: string;
}

export interface CardDeletedEvent {
  cardId: string | number;
  listId: string;
  userId: string;
}

export interface MemberJoinedEvent {
  member: BoardMember;
}

export interface MemberLeftEvent {
  userId: string;
}

export interface PresenceUpdateEvent {
  users: { userId: string; status: 'online' | 'offline' }[];
}

// Mock Data

export const MOCK_BOARD: Board = {
  id: 'board-1',
  boardName: 'Sample Board',
  boardDescription: 'A sample board for testing',
  workSpaceId: 'ws-1',
  isStarred: false,
  members: []
};
// FAQ 

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  active: boolean;
}

// Issue (Talk Categories) 

export interface Issue {
  id: number;
  name: string;
  description?: string;
  active: boolean;
}

// Talk Request 

export interface TalkRequest {
  fullName: string;
  email: string;
  message: string;
  issueId: number;
}

export interface TalkResponse {
  success: boolean;
  message?: string;
}