export interface User {
  id?: number
  firstName: string;
  sirName?: string;
  email: string;
  avatarUrl?: string;
  password?: string;
  name?: string; 
}

export interface AuthResponse {
  success: boolean;
  message: string;
  path?: string;
  timestamp?: string;
  data: {
    id: number;
    email: string;
    token: string;
    firstName: string;
    sirName?: string;
    refreshToken: string; // <-- Added to match backend login payload
    role?: string;        // <-- Added to match backend login payload
  };
}

export interface UserRegistrationRequest {
  firstName: string;
  sirName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  firstName: string;
  sirName: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface DeleteAccountResponse {
  success: boolean;
  message?: string;
}

export interface UserEmailDTO {
  email: string;
}

export interface InviteRequest {
  email: string;
  workspaceId: string;
}

export interface ListRequest {
  name: string;
  boardId: string;
}

export interface AddBoardMemberRequest {
  email: string;
  role: string;
}

export interface CreateCommentRequest {
  content: string;
}

export interface Comment {
  id: string;
  content: string;
  cardId: string;
  userId: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  action: string;
  boardId: string;
  userId: string;
  createdAt: string;
}