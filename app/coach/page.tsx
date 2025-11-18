// app/coach/page.tsx
"use client";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";

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

/** Start/end of day in a specific IANA TZ, returned as UTC Date objects. */
function getTZDayWindow(tz: string = "America/New_York") {
  const now = new Date();
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const tzStart = new Date(tzNow);
  tzStart.setHours(0, 0, 0, 0);
  const tzEnd = new Date(tzStart);
  tzEnd.setDate(tzEnd.getDate() + 1);
  const offset = tzNow.getTime() - now.getTime();
  const start = new Date(tzStart.getTime() - offset);
  const end = new Date(tzEnd.getTime() - offset);
  return { start, end };
}

export default function CoachPage() {
  // SELF (whoami) — for stopwatch visibility + cap
  const [myUsername, setMyUsername] = useState<string>("");
  const [myTeam, setMyTeam] = useState<Team>(null);

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

  // --- STOPWATCH (coach) ---
  const [displayMs, setDisplayMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const stopRef = useRef<number | null>(null);
  const finalMsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  function tick() {
    if (!runningRef.current || startRef.current == null) return;
    const now = performance.now();
    setDisplayMs(Math.max(0, Math.floor(now - startRef.current)));
    rafRef.current = requestAnimationFrame(tick);
  }
  function start() {
    if (runningRef.current) return;
    startRef.current = performance.now();
    stopRef.current = null;
    finalMsRef.current = null;
    runningRef.current = true;
    setIsRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  }
  function stop() {
    if (!runningRef.current) return;
    runningRef.current = false;
    setIsRunning(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (startRef.current != null) {
      const now = performance.now();
      stopRef.current = now;
      const dur = Math.max(0, Math.floor(now - startRef.current));
      finalMsRef.current = dur;
      setDisplayMs(dur);
    }
  }
  function reset() {
    runningRef.current = false;
    setIsRunning(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    stopRef.current = null;
    finalMsRef.current = null;
    setDisplayMs(0);
  }
  async function submitRunFromStopwatch() {
    setError(null);
    if (startRef.current == null || stopRef.current == null || finalMsRef.current == null) {
      setError("Stop the timer before submitting.");
      return;
    }
    if (myRunsToday >= MAX_SPRINTS) {
      setError("Daily limit reached (10/10).");
      return;
    }
    try {
      const res = await fetch("/api/runs/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: startRef.current, stop: stopRef.current }),
      });
      if (!res.ok) {
        const j = await res.json().catch(async () => ({ error: await res.text() }));
        throw new Error(j?.error || `Submit failed (${res.status})`);
      }
      reset();
      await Promise.all([loadRuns(), loadScore()]);
    } catch (e: any) {
      setError(e?.message ?? "Submit failed");
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/whoami", { cache: "no-store" });
        if (!res.ok) {
          window.location.replace("/login");
          return;
        }
        const who = await res.json().catch(() => ({}));
        if (who?.username) setMyUsername(who.username);
        if (who?.team !== undefined) setMyTeam(who.team as Team);
      } catch {
        window.location.replace("/login");
      }
    })();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
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
    } catch (e: any) {
      setError(e?.message ?? "Update failed");
      throw e;
    }
  }

  // API helpers for runs (edit table)
  async function updateRunAPI(id: number | string, ms?: number, username?: string) {
    const payload: any = { id: Number(id) };
    if (typeof ms === "number") payload.duration_ms = Number(ms);
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
      const avg = avgByUser[key];
      return { ...u, __avg: typeof avg === "number" ? avg : undefined as number | undefined };
    });
    withAvg.sort((a, b) => {
      const A = a.__avg ?? Number.POSITIVE_INFINITY;
      const B = b.__avg ?? Number.POSITIVE_INFINITY;
      if (A !== B) return A - B;
      return a.username.localeCompare(b.username);
    });
    return withAvg;
  }, [users, avgByUser]);

  /** Build TODAY scoreboard matrix */
  type Cell = { id?: number; ms?: number };
  type Row = { username: string; avgTodayMs: number; cells: Cell[] };

  const { blueRows, whiteRows, todayTotals } = useMemo(() => {
    const { start, end } = getTZDayWindow("America/New_York");

    const todays = runs.filter((r) => {
      const t = new Date(r.created_at).getTime();
      return t >= start.getTime() && t < end.getTime();
    });

    const byKey = new Map<string, RunRow[]>();
    for (const r of todays) {
      if (r.team !== "Blue" && r.team !== "White") continue;
      const key = `${r.team}|${r.username.toLowerCase()}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(r);
    }

    function buildTeamRows(team: "Blue" | "White"): Row[] {
      const teamRoster = users
        .filter((u) => u.team === team)
        .map((u) => u.username)
        .sort((a, b) => a.localeCompare(b));

      const rows: Row[] = [];
      for (const name of teamRoster) {
        const arr = (byKey.get(`${team}|${name.toLowerCase()}`) ?? []).slice();
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

  // Coach daily count for stopwatch cap
  const { myRunsToday, myNextSprint } = useMemo(() => {
    const { start, end } = getTZDayWindow("America/New_York");
    const isOnTeam = myTeam === "Blue" || myTeam === "White";
    if (!myUsername || !isOnTeam) return { myRunsToday: 0, myNextSprint: 1 };

    const todaysMine = runs.filter((r) => {
      if (!r.username) return false;
      if (r.username.toLowerCase() !== myUsername.toLowerCase()) return false;
      if (r.team !== "Blue" && r.team !== "White") return false;
      const t = new Date(r.created_at).getTime();
      return t >= start.getTime() && t < end.getTime();
    });

    const first10 = todaysMine
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, MAX_SPRINTS);

    const count = first10.length;
    return { myRunsToday: count, myNextSprint: Math.min(MAX_SPRINTS, count + 1) };
  }, [runs, myUsername, myTeam]);

  /** Editable scoreboard handler */
  const handleScoreboardCellBlur = useCallback(
    async (username: string, cell: Cell, newVal: string) => {
      const ms = strToMs(newVal ?? "");
      try {
        if (!cell.id && ms != null && ms > 0) {
          await insertRunViaPatch(username, ms);
        } else if (cell.id && (ms == null || ms <= 0 || newVal.trim() === "")) {
          await deleteRunAPI(cell.id);
        } else if (cell.id && ms != null && ms > 0 && ms !== cell.ms) {
          await updateRunAPI(cell.id, ms);
        }
        await Promise.all([loadRuns(), loadScore()]);
      } catch (e: any) {
        setError(e?.message ?? "Cell update failed");
      }
    },
    [] // stable
  );

  /** ====== MAKE TEAMS (balanced) ======
   *  - Consider players currently on Blue/White only (ignore Bench & coaches)
   *  - Use all-time averages (avgByUser), imputing missing to mean of known
   *  - Split into two teams with minimal total avg difference
   *  - Keep team sizes within 1 (k vs n-k)
   */
  const [balancing, setBalancing] = useState(false);

  function computeBalancedSplit(players: { username: string; avg: number }[]) {
    const n = players.length;
    if (n < 2) return { blue: players.map(p => p.username), white: [] as string[] };

    // size constraint → Blue gets k, White gets n-k
    const k = Math.floor(n / 2);

    // Scale to reduce DP state (10 ms buckets)
    const SCALE = 10;
    const weights = players.map(p => Math.max(0, Math.round(p.avg / SCALE)));
    const total = weights.reduce((a, b) => a + b, 0);

    // dp[size] : Map<sum, { prevSum, idx }>
    const dp: Array<Map<number, { prev: number; idx: number }>> = Array.from({ length: k + 1 }, () => new Map());
    dp[0].set(0, { prev: -1, idx: -1 });

    for (let i = 0; i < n; i++) {
      const w = weights[i];
      for (let size = Math.min(i + 1, k); size >= 1; size--) {
        for (const [sum] of Array.from(dp[size - 1].entries())) {
          const newSum = sum + w;
          if (!dp[size].has(newSum)) {
            dp[size].set(newSum, { prev: sum, idx: i });
          }
        }
      }
    }

    // choose sum closest to half
    const target = Math.floor(total / 2);
    let bestSum = -1;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (const [s] of dp[k].entries()) {
      const d = Math.abs(target - s);
      if (d < bestDiff) {
        bestDiff = d;
        bestSum = s;
      }
    }

    // backtrack to get chosen indices for Blue
    const chosen = new Set<number>();
    let curSum = bestSum;
    let size = k;
    while (size > 0 && curSum >= 0) {
      const node = dp[size].get(curSum)!;
      chosen.add(node.idx);
      curSum = node.prev;
      size -= 1;
    }

    const blueUsernames: string[] = [];
    const whiteUsernames: string[] = [];
    for (let i = 0; i < n; i++) {
      (chosen.has(i) ? blueUsernames : whiteUsernames).push(players[i].username);
    }
    return { blue: blueUsernames, white: whiteUsernames };
  }

  async function makeBalancedTeams() {
    try {
      setBalancing(true);
      setError(null);

      // collect candidates: role=player AND team in Blue/White
      const candidates = users
        .filter(u => u.role === "player" && (u.team === "Blue" || u.team === "White"))
        .map(u => u.username);

      if (candidates.length < 2) {
        setError("Need at least 2 players on Blue/White to make teams.");
        return;
      }

      // build averages (impute missing with mean of known)
      const avgs: { username: string; avg?: number }[] = candidates.map(name => {
        const key = name.trim().toLowerCase();
        return { username: name, avg: avgByUser[key] };
      });
      const known = avgs.filter(a => typeof a.avg === "number").map(a => a.avg!);
      const mean = known.length ? Math.round(known.reduce((s, v) => s + v, 0) / known.length) : 0;
      const playersWithAvg = avgs.map(a => ({ username: a.username, avg: typeof a.avg === "number" ? a.avg! : mean }));

      // compute split
      const split = computeBalancedSplit(playersWithAvg);

      // optional confirmation with quick preview numbers
      const blueSum = playersWithAvg
        .filter(p => split.blue.includes(p.username))
        .reduce((s, p) => s + p.avg, 0);
      const whiteSum = playersWithAvg
        .filter(p => split.white.includes(p.username))
        .reduce((s, p) => s + p.avg, 0);

      const ok = window.confirm(
        `Rebalance teams?\n\nBlue (${split.blue.length}) total avg: ${msToStr(blueSum)}\nWhite (${split.white.length}) total avg: ${msToStr(whiteSum)}\nΔ = ${msToStr(Math.abs(blueSum - whiteSum))}`
      );
      if (!ok) return;

      // apply updates (Bench stays untouched)
      const updates: Promise<any>[] = [];
      for (const name of split.blue) {
        const u = users.find(x => x.username === name);
        if (u?.team !== "Blue") {
          updates.push(updateUser(name, { team: "Blue" }));
        }
      }
      for (const name of split.white) {
        const u = users.find(x => x.username === name);
        if (u?.team !== "White") {
          updates.push(updateUser(name, { team: "White" }));
        }
      }
      await Promise.all(updates);

      // refresh boards
      await Promise.all([loadRuns(), loadScore(), loadUsers()]);
    } catch (e: any) {
      setError(e?.message ?? "Failed to make teams.");
    } finally {
      setBalancing(false);
    }
  }

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
            Team Total (today):{" "}
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

  const showCoachStopwatch = myTeam === "Blue" || myTeam === "White";
  const finishedAll = myRunsToday >= MAX_SPRINTS;

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

      {/* COACH STOPWATCH */}
      {showCoachStopwatch && (
        <section className="p-5 rounded-xl border border-gray-700 bg-gray-800 flex flex-col items-center">
          <div className="text-lg mb-1">
            Logged in as <span className="font-semibold text-blue-400">{myUsername || "—"}</span>
            {myTeam && <span className="text-gray-300 ml-1">({myTeam})</span>}
          </div>
          <div className="text-6xl font-mono text-center mb-1">{msToStr(displayMs)}</div>
          <div className="text-xs text-gray-300 mb-5">
            {finishedAll ? "Finished (10/10)" : `Next sprint: ${myNextSprint}/10`}
          </div>

          {!isRunning ? (
            <button
              onClick={start}
              disabled={finishedAll}
              className={`w-56 h-56 flex items-center justify-center rounded-full text-white text-3xl font-extrabold shadow-2xl transition-transform transform active:scale-95 ${
                finishedAll
                  ? "bg-gray-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/40"
              }`}
            >
              Start
            </button>
          ) : (
            <button
              onClick={stop}
              className="w-56 h-56 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white text-3xl font-extrabold shadow-2xl transition-transform transform active:scale-95 hover:shadow-red-500/40"
            >
              Stop
            </button>
          )}

          <div className="flex justify-center gap-24 mt-8">
            <button
              onClick={reset}
              className="px-6 py-3 rounded border border-gray-600 hover:bg-gray-700 text-lg"
            >
              Reset
            </button>
            <button
              onClick={submitRunFromStopwatch}
              className="px-6 py-3 rounded bg-green-600 hover:bg-green-500 text-white text-lg disabled:opacity-50"
              disabled={isRunning || displayMs === 0 || finishedAll}
            >
              Submit
            </button>
          </div>
        </section>
      )}

      {/* USERS (collapsible) */}
      <section className="space-y-3">
        <div className="w-full flex items-center justify-between">
          <button
            onClick={() => setUsersOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 hover:bg-gray-700"
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

          {/* Make teams button */}
          <button
            onClick={makeBalancedTeams}
            disabled={balancing || uLoading}
            className="px-3 py-2 rounded-lg border border-blue-700 text-blue-200 bg-blue-900/30 hover:bg-blue-900/50 disabled:opacity-50"
            title="Reassign Blue/White players to minimize team avg-time delta"
          >
            {balancing ? "Making teams…" : "Make teams (balanced)"}
          </button>
        </div>

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
