// app/coach/page.tsx
"use client";
import { useEffect, useState, useMemo } from "react";

type Role = "player" | "coach";
type Team = "Blue" | "White" | "Bench" | null;
type UserRow = { username: string; role: Role; team?: Team };
type RunRow = { id: number; username: string; team: Team; duration_ms: number; created_at: string };

function msToStr(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rems = s % 60;
  const remms = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(rems).padStart(2, "0")}.${String(remms).padStart(2, "0")}`;
}
function strToMs(str: string): number | null {
  const t = str.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t)); // raw ms
  const mmss = t.split(":");
  if (mmss.length === 1) {
    const s = parseFloat(t);
    if (!isFinite(s)) return null;
    return Math.round(s * 1000);
  }
  if (mmss.length === 2) {
    const m = parseFloat(mmss[0]);
    const rest = parseFloat(mmss[1]);
    if (!isFinite(m) || !isFinite(rest)) return null;
    return Math.round(m * 60_000 + rest * 1000);
  }
  return null;
}

export default function CoachPage() {
  // USERS
  const [users, setUsers] = useState<UserRow[]>([]);
  const [uLoading, setULoading] = useState(true);
  const [usersOpen, setUsersOpen] = useState(true);

  // RUNS + SCOREBOARD
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [score, setScore] = useState<{ blue: number; white: number }>({ blue: 0, white: 0 });
  const [rLoading, setRLoading] = useState(true);

  // AVG times by username (ms)
  const [avgByUser, setAvgByUser] = useState<Record<string, number | undefined>>({});

  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newTime, setNewTime] = useState("");

  // If already logged in, bounce to role home
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/whoami", { cache: "no-store" });
        if (!res.ok) {
          // not logged in
          window.location.replace("/login");
          return;
        }
        const me = await res.json();
        // optional: enforce role here, e.g. coach only
        // if (page === 'coach' && me.role !== 'coach') window.location.replace('/player');
      } catch {
        window.location.replace("/login");
      }
    })();
  }, []);

  // remember collapsible state
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("coach_users_open") : null;
    if (saved != null) setUsersOpen(saved === "1");
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("coach_users_open", usersOpen ? "1" : "0");
    }
  }, [usersOpen]);

  // data loaders
  async function loadUsers() {
    setULoading(true);
    try {
      const res = await fetch("/api/coach/list", { cache: "no-store" });
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Users load error");
      setUsers([]);
    } finally {
      setULoading(false);
    }
  }

  // compute averages from current runs
  function recomputeAverages(rows: RunRow[]) {
    const sums: Record<string, { sum: number; count: number }> = {};
    for (const r of rows) {
      if (!r?.username) continue;
      const nameKey = r.username.trim().toLowerCase();
      const ms = Number(r.duration_ms);
      if (!Number.isFinite(ms) || ms <= 0) continue;
      if (!sums[nameKey]) sums[nameKey] = { sum: 0, count: 0 };
      sums[nameKey].sum += ms;
      sums[nameKey].count += 1;
    }
    const avg: Record<string, number> = {};
    Object.entries(sums).forEach(([k, v]) => {
      if (v.count > 0) avg[k] = Math.round(v.sum / v.count);
    });
    setAvgByUser(avg);
  }

  async function loadRuns() {
    setRLoading(true);
    try {
      const res = await fetch("/api/coach/runs", { cache: "no-store" });
      const data = await res.json();
      const rows: RunRow[] = data.rows ?? [];
      setRuns(rows);
      recomputeAverages(rows);
    } catch (e: any) {
      setError(e?.message ?? "Runs load error");
      setRuns([]);
      setAvgByUser({});
    } finally {
      setRLoading(false);
    }
  }

  async function loadScore() {
    try {
      const res = await fetch("/api/scoreboard", { cache: "no-store" });
      const data = await res.json();
      setScore({ blue: data.blue ?? 0, white: data.white ?? 0 });
    } catch (e: any) {
      setError(e?.message ?? "Score load error");
    }
  }

  // update user role/team
  async function updateUser(username: string, changes: { role?: "player" | "coach"; team?: "Blue" | "White" | "Bench" | null }) {
    try {
      const payload: any = {
        username,
        ...(changes.role ? { role: changes.role } : {}),
        ...(changes.team !== undefined ? { team: changes.team === "Bench" ? null : changes.team } : {}),
      };
      const res = await fetch("/api/coach/update-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const { user } = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.username === username ? { ...u, role: user.role, team: user.team ?? null } : u))
      );
      await Promise.all([loadRuns(), loadScore()]);
    } catch (e: any) {
      setError(e?.message ?? "Update failed");
    }
  }

  // run actions
  async function addRun(username: string, timeStr: string) {
    const ms = strToMs(timeStr);
    if (ms == null || ms <= 0) {
      setError("Enter time as MM:SS.xx, SS.xx, or ms");
      return;
    }
    await fetch("/api/coach/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, duration_ms: ms }),
    });
    await Promise.all([loadRuns(), loadScore()]);
  }

  async function updateRun(id: number, timeStr: string, username?: string) {
    const ms = strToMs(timeStr);
    const payload: any = { id, ...(username ? { username } : {}) };
    if (ms != null) payload.duration_ms = ms;

    const res = await fetch("/api/coach/runs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j?.error ?? "Update failed");
      return;
    }
    await Promise.all([loadRuns(), loadScore()]);
  }

  async function deleteRun(id: number) {
    const res = await fetch(`/api/coach/runs?id=${id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j?.error ?? "Delete failed");
      return;
    }
    await Promise.all([loadRuns(), loadScore()]);
  }


  useEffect(() => {
    loadUsers();
    loadRuns();
    loadScore();
  }, []);

  // users sorted by average (lowest first); users with no avg at the end
  const usersSorted = useMemo(() => {
    const withAvg = users.map((u) => {
      const key = u.username.trim().toLowerCase();
      const avg = avgByUser[key]; // undefined if no runs
      return { ...u, __avg: typeof avg === "number" ? avg : undefined as number | undefined };
    });
    withAvg.sort((a, b) => {
      const A = a.__avg ?? Number.POSITIVE_INFINITY;
      const B = b.__avg ?? Number.POSITIVE_INFINITY;
      if (A !== B) return A - B; // lower avg first; undefineds go last
      return a.username.localeCompare(b.username);
    });
    return withAvg;
  }, [users, avgByUser]);

  return (
    <div className="min-h-screen p-6 space-y-8 bg-gray-900 text-gray-100">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">sprintLeague — Coach</h1>
        <div className="flex gap-2">
          <button onClick={() => { loadUsers(); loadRuns(); loadScore(); }} className="px-3 py-1 rounded border border-gray-600 hover:bg-gray-700">Refresh</button>
          <form action="/api/auth/logout" method="POST">
            <button className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">Logout</button>
          </form>
        </div>
      </header>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* USERS (collapsible) */}
      <section className="space-y-3">
        <button
          onClick={() => setUsersOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700"
        >
          <span className="text-xl font-semibold">Users</span>
          <svg className={`h-5 w-5 transition-transform ${usersOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 011.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </button>

        <div className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${usersOpen ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0"}`}>
          <div className="mt-3 overflow-x-auto border border-gray-700 rounded-lg shadow-lg">
            <table className="w-full text-sm border-collapse bg-gray-800 text-gray-100">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-2 border border-gray-700 text-left">User</th>
                  <th className="p-2 border border-gray-700">Role</th>
                  <th className="p-2 border border-gray-700">Team</th>
                  <th className="p-2 border border-gray-700">Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {uLoading ? (
                  <tr><td colSpan={4} className="p-3 text-center text-gray-400">Loading…</td></tr>
                ) : usersSorted.length === 0 ? (
                  <tr><td colSpan={4} className="p-3 text-center text-gray-400">No users.</td></tr>
                ) : (
                  usersSorted.map((u) => (
                    <tr key={u.username} className="odd:bg-gray-800 even:bg-gray-900 hover:bg-gray-700">
                      <td className="p-2 border border-gray-700 text-left">{u.username}</td>

                      {/* Role dropdown (player/coach) */}
                      <td className="p-2 border border-gray-700 text-center">
                        <select
                          defaultValue={u.role}
                          onChange={(e) => updateUser(u.username, { role: e.target.value as Role })}
                          className="bg-gray-700 text-gray-100 border border-gray-600 rounded px-2 py-1"
                        >
                          <option value="player">player</option>
                          <option value="coach">coach</option>
                        </select>
                      </td>

                      {/* Team dropdown (White/Blue/Bench) */}
                      <td className="p-2 border border-gray-700 text-center">
                        <select
                          defaultValue={u.team ?? "Bench"}
                          onChange={(e) => {
                            const v = e.target.value as "Blue" | "White" | "Bench";
                            updateUser(u.username, { team: v });
                          }}
                          className="bg-gray-700 text-gray-100 border border-gray-600 rounded px-2 py-1"
                        >
                          <option value="Blue">Blue</option>
                          <option value="White">White</option>
                          <option value="Bench">Bench</option>
                        </select>
                      </td>

                      {/* Avg time */}
                      <td className="p-2 border border-gray-700 text-center font-mono">
                        {(() => {
                          const a = avgByUser[u.username.trim().toLowerCase()];
                          return typeof a === "number" ? msToStr(a) : "—";
                        })()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SCOREBOARD + RUNS */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">Scoreboard & Runs</h2>
          <div className="text-lg">
            Blue: <span className="font-mono text-blue-400">{msToStr(score.blue)}</span>
            <span className="mx-3 opacity-50">|</span>
            White: <span className="font-mono text-gray-100">{msToStr(score.white)}</span>
          </div>
        </div>

        {/* Add run */}
        <div className="p-3 rounded-lg border border-gray-700 bg-gray-800 flex flex-wrap gap-3 items-center">
          <div className="text-sm opacity-80">Add row:</div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="username"
            className="bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2"
          />
          <input
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            placeholder="time (MM:SS.xx or SS.xx or ms)"
            className="bg-gray-700 text-gray-100 border border-gray-600 rounded px-3 py-2"
          />
          <button
            onClick={() => { if (newName && newTime) { addRun(newName, newTime); setNewName(""); setNewTime(""); } }}
            className="px-3 py-2 rounded bg-green-600 hover:bg-green-500 text-white"
          >
            Add
          </button>
        </div>

        {/* Runs table */}
        <div className="overflow-x-auto border border-gray-700 rounded-lg shadow-lg">
          <table className="w-full text-sm border-collapse bg-gray-800 text-gray-100">
            <thead className="bg-gray-700">
              <tr>
                <th className="p-2 border border-gray-700">Index</th>
                <th className="p-2 border border-gray-700 text-left">Name</th>
                <th className="p-2 border border-gray-700">Team</th>
                <th className="p-2 border border-gray-700">Time</th>
                <th className="p-2 border border-gray-700">Created</th>
                <th className="p-2 border border-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rLoading ? (
                <tr><td colSpan={6} className="p-3 text-center text-gray-400">Loading…</td></tr>
              ) : runs.length === 0 ? (
                <tr><td colSpan={6} className="p-3 text-center text-gray-400">No runs recorded.</td></tr>
              ) : (
                runs.map((r) => (
                  <tr key={`${r.id}-${r.created_at}`} className="odd:bg-gray-800 even:bg-gray-900 hover:bg-gray-700">
                    <td className="p-2 border border-gray-700 text-center">{r.id}</td>
                    <td className="p-2 border border-gray-700">
                      <input
                        defaultValue={r.username}
                        className="w-full bg-gray-700 text-gray-100 border border-gray-600 rounded px-2 py-1"
                        onBlur={(e) => {
                          const name = e.currentTarget.value.trim();
                          if (name && name !== r.username) updateRun(r.id, "", name);
                        }}
                      />
                    </td>
                    <td className="p-2 border border-gray-700 text-center">{r.team ?? "Bench"}</td>
                    <td className="p-2 border border-gray-700">
                      <input
                        defaultValue={msToStr(r.duration_ms)}
                        className="w-full font-mono bg-gray-700 text-gray-100 border border-gray-600 rounded px-2 py-1"
                        onBlur={(e) => {
                          const v = e.currentTarget.value;
                          const parsed = strToMs(v ?? "");
                          if (parsed != null && parsed !== r.duration_ms) updateRun(r.id, v);
                        }}
                      />
                    </td>
                    <td className="p-2 border border-gray-700 text-xs opacity-80 text-center">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="p-2 border border-gray-700 text-center">
                      <button
                        className="px-2 py-1 rounded border border-gray-600 hover:bg-gray-700"
                        onClick={() => deleteRun(r.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
