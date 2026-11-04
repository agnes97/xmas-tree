export type User = {
  id: string;
  email: string;
  lastLoggedIn: string;
  createdAt: string;
  name: string;
  avatar?: string;
};

export type AuthStatus = 'initializing' | 'loading' | 'authenticated' | 'unauthenticated';

export type LoginBody = {
  email: string;
  password: string;
};
