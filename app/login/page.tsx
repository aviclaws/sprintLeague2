// app/login/page.tsx
"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.log("[LOGIN] submit");
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        let msg = "Login failed";
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {}
        throw new Error(msg);
      }

      let role: string | undefined;
      try {
        if ((res.headers.get("content-type") || "").includes("application/json")) {
          const j = await res.json();
          role = j?.role;
        }
      } catch {}
      window.location.replace(role === "coach" ? "/coach" : "/player");
    } catch (e: any) {
      console.error("[LOGIN] error", e);
      setErr(e?.message ?? "Login failed");
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-900 text-gray-100 p-6"
      style={{ background: "#0b0b0f", color: "#f0f3f7" }} // fallback if Tailwind not loaded
    >
      <div
        className="w-full max-w-md"
        style={{ width: "100%", maxWidth: 480 }}
      >
        <div
          className="rounded-2xl border p-6 shadow-xl bg-gray-800 border-gray-700"
          style={{ background: "#151821", borderColor: "#2a2f3a" }}
        >
          <h1 className="text-2xl font-bold text-center mb-2">sprintLeague — Login</h1>
          <p className="text-sm text-center mb-6" style={{ opacity: 0.85 }}>
            Enter your credentials to continue
          </p>

          {err && (
            <div
              className="mb-4 rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: "#ff6b6b", color: "#ffb3b3", background: "#3b1e1e" }}
            >
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="username" className="block text-sm mb-1">
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  width: "100%",
                  background: "#212635",
                  border: "1px solid #394155",
                  color: "#e9edf3",
                }}
                placeholder="e.g. coach1"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm mb-1">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  width: "100%",
                  background: "#212635",
                  border: "1px solid #394155",
                  color: "#e9edf3",
                }}
                placeholder="Your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed px-3 py-2 font-medium"
              style={{
                width: "100%",
                background: "#246bff",
                border: "0",
                padding: "10px 12px",
                borderRadius: 10,
                opacity: loading || !username || !password ? 0.6 : 1,
                cursor: loading || !username || !password ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-4 text-xs text-center" style={{ opacity: 0.7 }}>
            If nothing happens, open DevTools → Network and look for <code>POST /api/auth/login</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
