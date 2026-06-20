export interface SessionUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  pspayId?: string;
  mode: 'sso' | 'dev';
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}
