// app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [error, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const j = await res.json();
      setErr(j.error ?? "Login failed");
      return;
    }
    const j = await res.json();
    router.push(j.role === "coach" ? "/coach" : "/player");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-white p-6 rounded-xl shadow">
        <h1 className="text-2xl font-bold mb-4">sprintLeague — Login</h1>
        <label className="block mb-2 text-sm">Username</label>
        <input className="w-full border rounded px-3 py-2 mb-4" value={username} onChange={e=>setU(e.target.value)} />
        <label className="block mb-2 text-sm">Password</label>
        <input type="password" className="w-full border rounded px-3 py-2 mb-4" value={password} onChange={e=>setP(e.target.value)} />
        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
        <button className="w-full bg-black text-white rounded py-2">Sign in</button>
      </form>
    </div>
  );
}
