import type { AuthStatus, LoginBody, User } from './types';

const API_URL = 'https://prismify.macovi.space';
const TOKEN_KEY = 'accessToken';

class Auth {
  user = $state.raw<User | null>(null);
  status = $state<AuthStatus>('initializing');
  error = $state<string | null>(null);

  isAuthenticated = $derived(this.status === 'authenticated');

  async init() {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      this.status = 'unauthenticated';
      return;
    }

    await this.fetchMe(token);
  }

  async login(body: LoginBody) {
    this.error = null;

    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      this.error = data.message ?? 'Login failed';
      throw new Error(this.error ?? undefined);
    }

    localStorage.setItem(TOKEN_KEY, data.accessToken);
    await this.fetchMe(data.accessToken);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this.user = null;
    this.error = null;
    this.status = 'unauthenticated';
  }

  private async fetchMe(token: string) {
    this.status = 'loading';

    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch user data');

      this.user = await response.json();
      this.status = 'authenticated';
    } catch {
      this.logout();
    }
  }
}

export const auth = new Auth();
