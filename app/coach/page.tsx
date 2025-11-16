// app/coach/page.tsx (revised)
"use client";
import { useEffect, useState, useMemo, useCallback } from "react";

type Role = "player" | "coach";
type Team = "Blue" | "White" | "Bench" | null;
type UserRow = { username: string; role: Role; team?: Team };
type RunRow = { id: number; username: string; team: Team; duration_ms: number; created_at: string };

const MAX_SPRINTS = 10;

/** Format: seconds + hundredths (SS.hh), e.g., "07.32" */
function msToStr(ms: number) {
  const s = Math.floor(ms / 1000);
  const hh = Math.floor((ms % 1000) / 10);
  return `${String(s).padStart(2, "0")}.${String(hh).padStart(2, "0")}`;
}

/** Parse "SS.hh" or "MM:SS.hh" or raw milliseconds; "" -> null */
function strToMs(str: string): number | null {
  const t = str.trim();
  if (!t) return null;

  // raw integer ms
  if (/^\d+$/.test(t)) return Math.round(parseInt(t, 10));

  // SS.hh or S.hh
  if (/^\d+(\.\d{1,2})?$/.test(t)) return Math.round(parseFloat(t) * 1000);

  // MM:SS.hh (or mm:ss)
  const mmss = t.split(":");
  if (mmss.length === 2) {
    const m = Number(mmss[0]);
    const sec = Number(mmss[1]);
    if (!Number.isFinite(m) || !Number.isFinite(sec)) return null;
    return Math.round(m * 60_000 + sec * 1000);
  }

  return null;
}

/** Start/end of day in a specific IANA TZ, returned as UTC Date objects.
 *  Matches your SQL use of America/New_York in other APIs.
 */
function getTZDayWindow(tz: string = "America/New_York") {
  const now = new Date();
  // Convert "now" into the target TZ by using the well-known offset trick
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const tzStart = new Date(tzNow);
  tzStart.setHours(0, 0, 0, 0);
  const tzEnd = new Date(tzStart);
  tzEnd.setDate(tzEnd.getDate() + 1);
  // Offset between the fake-constructed tzNow and the real now gives us the TZ shift
  const offset = tzNow.getTime() - now.getTime();
  const start = new Date(tzStart.getTime() - offset);
  const end = new Date(tzEnd.getTime() - offset);
  return { start, end };
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

  // AVG (all-time) from the full runs dataset
  const [avgByUser, setAvgByUser] = useState<Record<string, number | undefined>>({});

  // Error UI
  const [error, setError] = useState<string | null>(null);

  // If not logged in, bounce to login
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/whoami", { cache: "no-store" });
        if (!res.ok) {
          window.location.replace("/login");
          return;
        }
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
  async function updateUser(
    username: string,
    changes: { role?: "player" | "coach"; team?: "Blue" | "White" | "Bench" | null }
  ) {
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
        prev.map((u) =>
          u.username === username ? { ...u, role: user.role, team: user.team ?? null } : u
        )
      );
      await Promise.all([loadRuns(), loadScore()]);
    } catch (e: any) {
      setError(e?.message ?? "Update failed");
    }
  }

  // API helpers for runs
  async function updateRunAPI(id: number | string, ms?: number, username?: string) {
    const payload: any = { id: Number(id) }; // <— force number
    if (typeof ms === "number") payload.duration_ms = Number(ms); // <— force number
    if (username) payload.username = username;

    const res = await fetch("/api/coach/runs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error ?? "Update failed");
    }
  }


  async function insertRunViaPatch(username: string, ms: number) {
    const res = await fetch("/api/coach/runs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, duration_ms: ms }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error ?? "Insert failed");
    }
  }

  async function deleteRunAPI(id: number) {
    const res = await fetch(`/api/coach/runs?id=${id}`, {
      method: "DELETE",
      cache: "no-store",
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error ?? "Delete failed");
    }
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

  /** Build TODAY scoreboard “matrix” per team: Name | Avg(today) | 1..10 (chronological) */
  type Cell = { id?: number; ms?: number }; // id undefined => empty/new cell
  type Row = { username: string; avgTodayMs: number; cells: Cell[] };

  const { blueRows, whiteRows, todayTotals } = useMemo(() => {
    const { start, end } = getTZDayWindow("America/New_York");

    // Filter today’s runs using NY calendar day boundaries
    const todays = runs.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= start.getTime() && t < end.getTime();
    });

    // Index all of today's runs by team+username (lowercased)
    const byKey = new Map<string, RunRow[]>();
    for (const r of todays) {
      if (r.team !== "Blue" && r.team !== "White") continue;
      const key = `${r.team}|${r.username.toLowerCase()}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(r);
    }

    // helper to build rows ensuring *all rostered team members appear*, not only those who ran today
    function buildTeamRows(team: "Blue" | "White"): Row[] {
      const teamRoster = users
        .filter((u) => u.team === team)
        .map((u) => u.username)
        .sort((a, b) => a.localeCompare(b));

      const rows: Row[] = [];
      for (const name of teamRoster) {
        const lowerName = name.toLowerCase();
        const arr = (byKey.get(`${team}|${lowerName}`) ?? []).slice();

        // chronological by created_at
        arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const first10 = arr.slice(0, MAX_SPRINTS);
        const avg =
          first10.length > 0
            ? Math.floor(first10.reduce((s, x) => s + x.duration_ms, 0) / first10.length)
            : 0;

        const cells: Cell[] = Array.from({ length: MAX_SPRINTS }, (_, i) => {
          const r = first10[i];
          return r ? { id: r.id, ms: r.duration_ms } : {};
        });

        rows.push({ username: name, avgTodayMs: avg, cells });
      }

      return rows;
    }

    // Team totals (today) based on today's filtered runs
    let blueTotal = 0;
    let whiteTotal = 0;
    for (const r of todays) {
      if (r.team === "Blue") blueTotal += r.duration_ms;
      else if (r.team === "White") whiteTotal += r.duration_ms;
    }

    return {
      blueRows: buildTeamRows("Blue"),
      whiteRows: buildTeamRows("White"),
      todayTotals: { blue: blueTotal, white: whiteTotal },
    };
  }, [runs, users]);

  /** Editable scoreboard cell handler:
   *  - empty cell -> value: PATCH insert
   *  - filled cell -> cleared: DELETE
   *  - filled cell -> changed: PATCH update
   */
  const handleScoreboardCellBlur = useCallback(
    async (username: string, cell: Cell, newVal: string) => {
      const ms = strToMs(newVal ?? "");

      try {
        // INSERT
        if (!cell.id && ms != null && ms > 0) {
          await insertRunViaPatch(username, ms);
        }
        // DELETE
        else if (cell.id && (ms == null || ms <= 0 || newVal.trim() === "")) {
          await deleteRunAPI(cell.id);
        }
        // UPDATE
        else if (cell.id && ms != null && ms > 0 && ms !== cell.ms) {
          await updateRunAPI(cell.id, ms);
        }

        await Promise.all([loadRuns(), loadScore()]);
      } catch (e: any) {
        setError(e?.message ?? "Cell update failed");
      }
    },
    [] // stable
  );

  /** Editable scoreboard table */
  function EditableTeamBoard({
    title,
    totalMs,
    rows,
    colorClass,
  }: {
    title: string;
    totalMs: number;
    rows: Row[];
    colorClass: string;
  }) {
    return (
      <div className="p-5 rounded-xl border border-gray-700 bg-gray-800">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="font-semibold text-lg">{title}</h2>
          <div className="text-base">
            Team Total (today): {" "}
            <span className={`font-mono ${colorClass}`}>{msToStr(totalMs)}</span>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-700 rounded-lg">
          <table className="w-full text-sm border-collapse bg-gray-800 text-gray-100">
            <thead className="bg-gray-700">
              <tr>
                <th className="p-2 border border-gray-700 text-left">Name</th>
                <th className="p-2 border border-gray-700 text-center">Avg (today)</th>
                {Array.from({ length: MAX_SPRINTS }, (_, i) => (
                  <th key={i} className="p-2 border border-gray-700 text-center font-mono">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rLoading ? (
                <tr>
                  <td colSpan={12} className="p-3 text-center text-gray-400">Loading…</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-3 text-center text-gray-400">No runs today.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.username} className="odd:bg-gray-800 even:bg-gray-900">
                    <td className="p-2 border border-gray-700 text-left">{r.username}</td>
                    <td className="p-2 border border-gray-700 text-center font-mono">
                      {r.avgTodayMs ? msToStr(r.avgTodayMs) : "—"}
                    </td>
                    {r.cells.map((c, idx) => (
                      <td
                        key={`${r.username}-${idx}-${c.id ?? "new"}-${c.ms ?? ""}`}
                        className="p-1 border border-gray-700 text-center"
                      >
                        <input
                          defaultValue={typeof c.ms === "number" ? msToStr(c.ms) : ""}
                          placeholder="—"
                          className="w-20 text-center font-mono bg-gray-700 text-gray-100 border border-gray-600 rounded px-2 py-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.target as HTMLInputElement).blur();
                            } else if (e.key === "Escape") {
                              // revert
                              const input = e.target as HTMLInputElement;
                              input.value = typeof c.ms === "number" ? msToStr(c.ms) : "";
                              input.blur();
                            }
                          }}
                          onBlur={(e) => handleScoreboardCellBlur(r.username, c, e.currentTarget.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Tip: Type <span className="font-mono">SS.hh</span> (or <span className="font-mono">MM:SS.hh</span> or raw ms) to add/update. Clear to delete. Press <span className="font-mono">Enter</span> to save, <span className="font-mono">Esc</span> to revert.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-8 bg-gray-900 text-gray-100">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">sprintLeague — Coach</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              loadUsers();
              loadRuns();
              loadScore();
            }}
            className="px-3 py-1 rounded border border-gray-600 hover:bg-gray-700"
          >
            Refresh
          </button>
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
          <svg
            className={`h-5 w-5 transition-transform ${usersOpen ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 011.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
          </svg>
        </button>

        <div
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out ${
            usersOpen ? "max-h-[1400px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="mt-3 overflow-x-auto border border-gray-700 rounded-lg shadow-lg">
            <table className="w-full text-sm border-collapse bg-gray-800 text-gray-100">
              <thead className="bg-gray-700">
                <tr>
                  <th className="p-2 border border-gray-700 text-left">User</th>
                  <th className="p-2 border border-gray-700">Role</th>
                  <th className="p-2 border border-gray-700">Team</th>
                  <th className="p-2 border border-gray-700">Avg Time (all-time)</th>
                </tr>
              </thead>
              <tbody>
                {uLoading ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-center text-gray-400">
                      Loading…
                    </td>
                  </tr>
                ) : usersSorted.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-3 text-center text-gray-400">No users.</td>
                  </tr>
                ) : (
                  usersSorted.map((u) => (
                    <tr key={u.username} className="odd:bg-gray-800 even:bg-gray-900 hover:bg-gray-700">
                      <td className="p-2 border border-gray-700 text-left">{u.username}</td>

                      {/* Role dropdown */}
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

                      {/* Team dropdown */}
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

                      {/* Avg time (all-time) */}
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

      {/* TEAM TOTALS (today) */}
      <section className="p-5 rounded-xl border border-gray-700 bg-gray-800">
        <h2 className="font-semibold text-lg mb-3">Team Totals (today)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
          <div className="p-3 rounded-lg bg-gray-900">
            <div className="text-sm text-gray-300 mb-1">White</div>
            <div className="text-3xl font-mono text-gray-100">{msToStr(score.white)}</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-900">
            <div className="text-sm text-gray-300 mb-1">Blue</div>
            <div className="text-3xl font-mono text-blue-400">{msToStr(score.blue)}</div>
          </div>
        </div>
      </section>

      {/* EDITABLE SCOREBOARD (today) */}
      <section className="space-y-4">
        <EditableTeamBoard
          title="Blue Team (today)"
          totalMs={todayTotals.blue}
          rows={blueRows}
          colorClass="text-blue-400"
        />
        <EditableTeamBoard
          title="White Team (today)"
          totalMs={todayTotals.white}
          rows={whiteRows}
          colorClass="text-gray-100"
        />
      </section>
    </div>
  );
}
