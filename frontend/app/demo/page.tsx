"use client";
import React, { useEffect, useState } from "react";
import { apiFetch, login, BACKEND_URL } from "../../lib/api";

export default function DemoPage() {
    const [status, setStatus] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        apiFetch("/")
            .then((r) => setStatus(r))
            .catch((e) => setError(String(e)));
    }, []);

    const doLogin = async () => {
        setError(null);
        try {
            const res = await login("frontline.staff@bloomcare.health", "rash2003");
            setToken(res.access_token || JSON.stringify(res));
        } catch (e: any) {
            setError(e?.message || String(e));
        }
    };

    return (
        <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
            <h1>Backend Demo</h1>
            <p>
                <strong>Backend URL:</strong> {BACKEND_URL}
            </p>

            <section>
                <h2>Health / Root</h2>
                {error && <pre style={{ color: 'crimson' }}>{error}</pre>}
                {status ? <pre>{JSON.stringify(status, null, 2)}</pre> : <p>Loading status…</p>}
            </section>

            <section style={{ marginTop: 16 }}>
                <h2>Login (demo)</h2>
                {token ? (
                    <div>
                        <p>Access token (copy to Swagger Authorize as Bearer token):</p>
                        <textarea readOnly rows={6} style={{ width: '100%' }} value={token} />
                    </div>
                ) : (
                    <button onClick={doLogin}>Login as frontline.staff@bloomcare.health</button>
                )}
            </section>
        </div>
    );
}
