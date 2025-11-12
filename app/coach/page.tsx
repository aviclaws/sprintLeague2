// app/coach/page.tsx
"use client";
import { useEffect, useState } from "react";

type UserRow = { username: string; role: "player"|"coach"|"admin"; team?: "Blue"|"White" };

export default function CoachPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // read users.json via a dev-only endpoint using the dev server static file
    // Simpler: fetch from an API that returns sanitized list (we'll inline fetch /api/coach/list)
    (async () => {
      const u = await fetch("/api/coach/list").then(r=>r.json());
      setUsers(u.users);
      setLoading(false);
    })();
  }, []);

  async function setTeam(username: string, team: "Blue"|"White") {
    const res = await fetch("/api/coach/set-team", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ username, team })
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.username===username ? { ...u, team } : u));
    } else {
      const j = await res.json();
      alert("Update failed: " + (j.error ?? "unknown"));
    }
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">sprintLeague — Coach</h1>
        <form action="/api/auth/logout" method="POST">
          <button className="px-3 py-1 rounded bg-gray-200">Logout</button>
        </form>
      </header>

      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-2 border text-left">User</th>
            <th className="p-2 border">Role</th>
            <th className="p-2 border">Team</th>
            <th className="p-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.username} className="odd:bg-white even:bg-gray-50">
              <td className="p-2 border">{u.username}</td>
              <td className="p-2 border">{u.role}</td>
              <td className="p-2 border">{u.team ?? "—"}</td>
              <td className="p-2 border">
                <div className="flex gap-2 justify-center">
                  <button className="px-2 py-1 rounded border" onClick={()=>setTeam(u.username, "Blue")}>Blue</button>
                  <button className="px-2 py-1 rounded border" onClick={()=>setTeam(u.username, "White")}>White</button>
                </div>
              </td>
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-gray-500">No users.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
