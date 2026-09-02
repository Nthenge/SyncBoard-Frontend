export const endpoints = {
  // USER ENDPOINTS
  auth: {
    login: '/user/login',
    register: '/user/register',
    confirm: '/user/confirm',
    verifyEmail: '/user/confirm',
    update: '/user/update',
    resetPassword: '/user/reset-password',
    confirmAccount: '/user/confirm',
    resetPasswordRequest: '/user/reset-password-request',
    forgotPassword: '/user/reset-password-request',
    logout: '/user/logout',
    delete: '/user/delete',
    deleteAccount: '/user/delete',

    // Additional Swagger endpoints 
    refreshToken: '/auth/refresh-token',
  },

  // BOARD ENDPOINTS
  boards: {
    getAll: '/boards',
    getById: '/boards/{boardId}',
    create: '/boards',
    update: '/boards/{boardId}',
    delete: '/boards/{boardId}',

    // Additional Swagger endpoints (not currently consumed by frontend)
    getByWorkspace: '/boards/workspace/{workspaceId}',
    getActivity: '/boards/{boardId}/activity-logs',
    createFromWorkspace: '/boards/{workspaceId}', // POST /boards/{workspaceId}
  },

  // WORKSPACE ENDPOINTS
  workspace: {
    create: '/workspace/create',

    // Invitations (Swagger has invite/accept/reject + invites listing)
    invite: '/workspace/{workspaceId}/invite',
    acceptInvite: '/workspace/accept-invite',
    rejectInvite: '/workspace/reject-invite',

    // Existing mapping kept
    myWorkspaces: '/workspace/my-workspaces',
    delete: '/workspace/{id}',

    // Additional Swagger endpoints (not currently consumed by frontend)
    getWorkspaceInvitations: '/workspace/{workspaceId}/invitations',
    cancelInvitation: '/workspace/invitations/{invitationId}',
    acceptInvitationToken: '/workspace/invitations/{token}/accept',
    declineInvitationToken: '/workspace/invitations/{token}/decline',
    acceptInviteToken: '/workspace/invitations/{token}/accept',
    declineInviteToken: '/workspace/invitations/{token}/decline',
  },

  // LIST ENDPOINTS
  lists: {
    create: '/boards/lists',
    getByBoard: '/boards/{boardId}/lists',
    update: '/boards/lists/{listId}',
    delete: '/boards/lists/{listId}',
    reorder: '/boards/{boardId}/lists/reorder',
  },

  // CARD ENDPOINTS
  cards: {
    create: '/cards',
    getById: '/cards/{cardId}',
    getByList: '/cards/lists/{listId}/cards',
    update: '/cards/{cardId}',
    delete: '/cards/{cardId}',
    move: '/cards/{cardId}/move',

    // Additional Swagger endpoints (not currently consumed by frontend)
    getComments: '/cards/{cardId}/comments',
    addComments: '/cards/{cardId}/comments',
  },

  // CARD ASSIGNEE ENDPOINTS
  cardAssignees: {
    reassign: '/cards/{cardId}/assignees/reassign',
    remove: '/cards/{cardId}/assignees/{userId}',
  },

  // BOARD MEMBER ENDPOINTS
  boardMembers: {
    add: '/board/{boardId}/members',
    updateRole: '/board/{boardId}/members/{userId}/role',
    remove: '/board/{boardId}/members/{userId}',
  },

  // COMMENT ENDPOINTS
  comments: {
    getByCard: '/cards/{cardId}/comments',
    create: '/cards/{cardId}/comments',
  },

  // NOTIFICATION ENDPOINTS
  notifications: {
    getAll: '/notifications',
    markRead: '/notifications/{id}/read',
  },

  // ACTIVITY LOG ENDPOINTS
  activityLogs: {
    getByBoard: '/boards/{boardId}/activity-logs',
  },

  // ISSUES 
  issues: {
    getAll: '/issues',
    getById: '/issues/{id}',
    create: '/issues',
    update: '/issues/{id}',
    delete: '/issues/{id}',
    toggle: '/issues/{id}/toggle',
    getActive: '/issues/active',
  },

  // TALKS (Swagger endpoints not currently consumed by frontend)
  talks: {
    getAll: '/talks',
    getById: '/talks/{id}',
    getByEmail: '/talks/email/{email}',
    getByIssue: '/talks/issue/{issueId}',
    getByStatus: '/talks/status/{status}',
    create: '/talks',
    submit: '/talks',
    updateStatus: '/talks/{id}/status',
    delete: '/talks/{id}',
  },

  // FAQS (Swagger endpoints not currently consumed by frontend)
  faqs: {
    getAll: '/faqs',
    getById: '/faqs/{id}',
    create: '/faqs',
    update: '/faqs/{id}',
    delete: '/faqs/{id}',
    toggleActive: '/faqs/{id}/activate-deactivate',
    getActive: '/faqs/active',
  },

  // SYSTEM CONFIG (Swagger endpoints not currently consumed by frontend)
  systemConfig: {
    getAll: '/system-config',
    getByKey: '/system-config/{configKey}',
    create: '/system-config',
    update: '/system-config/{configKey}',
  },

  // HEALTH CHECK
  health: {
    get: '/public/health',
  },
};
