import type { AuthStatus, LoginBody, User } from './types';

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'https://prismify.macovi.space';
const TOKEN_KEY = 'accessToken';

/** who was logged in last on this device, so the tree can open before /auth/me answers */
const USER_KEY = 'xmasTreeUser';

function cachedUser(): User | null {
  try {
    if (!localStorage.getItem(TOKEN_KEY)) return null;
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function cacheUser(user: User | null) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    // storage blocked; /auth/me still answers
  }
}

/** a token older than this is swapped for a fresh one, so a week away is all it takes to stay in */
const RENEW_AFTER_SECONDS = 24 * 60 * 60;

function issuedAt(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)).iat ?? null;
  } catch {
    return null;
  }
}

class Auth {
  user = $state.raw<User | null>(cachedUser());
  status = $state<AuthStatus>('initializing');
  error = $state<string | null>(null);

  isAuthenticated = $derived(this.status === 'authenticated');

  /** prismify hasn't confirmed the stored token yet, only a dropped connection stood in the way */
  private unconfirmed = false;

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

  /** Calls the API as the logged-in user; a rejected token logs them out. */
  async request(path: string, init: RequestInit = {}) {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${API_URL}${path}`, { ...init, headers });
    if (response.status === 401) this.logout();
    return response;
  }

  /** asks prismify again once the viewer is back, if the last try never reached it */
  recheck() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (this.unconfirmed && token) this.fetchMe(token, true);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    cacheUser(null);
    this.user = null;
    this.error = null;
    this.status = 'unauthenticated';
  }

  private async fetchMe(token: string, quietly = false) {
    if (!quietly) this.status = 'loading';

    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      response = new Response(null, { status: 503 });
    }

    // only prismify turning the token down logs out; offline or a server hiccup keeps it
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      this.unconfirmed = false;
      this.logout();
      return;
    }

    if (!response.ok) {
      this.unconfirmed = true;
      this.status = this.user ? 'authenticated' : 'unauthenticated';
      return;
    }

    try {
      this.user = await response.json();
    } catch {
      this.unconfirmed = true;
      this.status = this.user ? 'authenticated' : 'unauthenticated';
      return;
    }
    this.unconfirmed = false;
    cacheUser(this.user);
    this.status = 'authenticated';
    this.renew(token);
  }

  /** trades a day-old token for a fresh 7-day one; prismify stops after 60 days from the login */
  private async renew(token: string) {
    const iat = issuedAt(token);
    if (iat === null || Date.now() / 1000 - iat < RENEW_AFTER_SECONDS) return;

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const { accessToken } = await response.json();
      if (accessToken && localStorage.getItem(TOKEN_KEY) === token) {
        localStorage.setItem(TOKEN_KEY, accessToken);
      }
    } catch {
      // the current token still works until it expires
    }
  }
}

export const auth = new Auth();
