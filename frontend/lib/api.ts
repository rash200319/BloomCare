export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8001';

export async function apiFetch(path: string, options: RequestInit = {}) {
    const url = path.startsWith('http') ? path : `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            ...(options.headers as Record<string, string> || {}),
        },
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`HTTP ${res.status}: ${body}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) return res.json();
    return res.text();
}

export async function login(user_id: string, password: string) {
    const res = await fetch(`${BACKEND_URL}/api/v1/auth/login-user-id`, {
        method: 'POST',
        body: JSON.stringify({ user_id, password }),
        headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `Login failed ${res.status}`);
    }
    return res.json();
}

export async function registerUser(email: string, password: string, full_name = '', role = 'PATIENT') {
    return apiFetch('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name, role }),
        headers: { 'Content-Type': 'application/json' },
    });
}
