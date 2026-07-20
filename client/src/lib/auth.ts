export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Login failed');
  }
  return res.json();
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Registration failed');
  }
  return res.json();
}

export function saveAuth(token: string, user: AuthUser) {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    localStorage.setItem('criclive_token', token);
    localStorage.setItem('criclive_user', JSON.stringify(user));
  } catch (err) {
    // ignore in non-browser environments
  }
}

export function clearAuth() {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    localStorage.removeItem('criclive_token');
    localStorage.removeItem('criclive_user');
  } catch (err) {
    // ignore in non-browser environments
  }
}

export function getAuth() {
  try {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return null;
    const token = localStorage.getItem('criclive_token');
    const user = localStorage.getItem('criclive_user');
    return token && user ? { token, user: JSON.parse(user) as AuthUser } : null;
  } catch (err) {
    return null;
  }
}
