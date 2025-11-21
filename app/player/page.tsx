"use client";

import { useEffect, useRef, useState, useMemo } from "react";

type Team = "Blue" | "White" | null;

// Show seconds + hundredths only, e.g., "07.32"
function msToStr(ms: number) {
  const s = Math.floor(ms / 1000);
  const hh = Math.floor((ms % 1000) / 10);
  return `${String(s).padStart(2, "0")}.${String(hh).padStart(2, "0")}`;
}

type LeaderRow = {
  index: number;
  username: string;
  duration_ms: number;
  team: Team;
  created_at: string; // ISO timestamp for chronological sorting
};

type TeamRow = {
  username: string;
  avgTodayMs: number;
  runs: number[]; // up to 10, in chronological order
};

const MAX_SPRINTS = 10;

export default function PlayerPage() {
  // stopwatch
  const [displayMs, setDisplayMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const stopRef = useRef<number | null>(null);       // captured when Stop is pressed
  const finalMsRef = useRef<number | null>(null);     // frozen duration at Stop
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  // touch de-dupe (avoid touchstart + synthetic click double-trigger)
  const lastTouchTsRef = useRef<number>(0);
  const TOUCH_CLICK_GAP = 350; // ms

  // player info + data
  const [username, setUsername] = useState<string>("");
  const [team, setTeam] = useState<Team>(null);
  const [avgTime, setAvgTime] = useState<number | null>(null); // all-time from /api/player/avg
  const [score, setScore] = useState<{ blue: number; white: number }>({ blue: 0, white: 0 });
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function refreshBoards() {
    try {
      // daily team totals
      const s = await fetch("/api/scoreboard", { cache: "no-store" }).then((r) => r.json());
      setScore({ blue: s.blue ?? 0, white: s.white ?? 0 });

      // daily leaderboard (today only)
      const l = await fetch("/api/leaderboard", { cache: "no-store" }).then((r) => r.json());
      const rows = Array.isArray(l.rows) ? l.rows : [];
      setLeaders(rows as LeaderRow[]);

      // all-time average for the logged-in player
      const a = await fetch("/api/player/avg", { cache: "no-store" });
      if (a.ok) {
        const { avg_ms } = await a.json();
        setAvgTime(Number(avg_ms) || 0);
      } else {
        setAvgTime(null);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load boards");
    }
  }

  // verify session
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

  // load player info + initial data; then refresh every 3s
  useEffect(() => {
    (async () => {
      try {
        const who = await fetch("/api/whoami", { cache: "no-store" }).then((r) => r.json());
        if (who?.username) setUsername(who.username);
        if (who?.team) setTeam(who.team as Team);
        await refreshBoards();
      } catch (e) {
        console.error(e);
      }
    })();
    const id = setInterval(() => refreshBoards(), 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function tick() {
    if (!runningRef.current || startRef.current == null) return;
    const now = performance.now();
    setDisplayMs(Math.max(0, Math.floor(now - startRef.current)));
    rafRef.current = requestAnimationFrame(tick);
  }

  function start() {
    if (runningRef.current) return;

    // Keep whatever was already elapsed (displayMs) and continue from there
    const alreadyElapsed = displayMs || 0;
    startRef.current = performance.now() - alreadyElapsed;

    // clear end markers for this new running segment
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
      const now = performance.now();                        // exact stop instant
      stopRef.current = now;                                // store stop ts
      const dur = Math.max(0, Math.floor(now - startRef.current));
      finalMsRef.current = dur;                             // freeze duration
      setDisplayMs(dur);                                    // show frozen time
    }
  }

  function reset() {
    // reset everything without recomputing
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

  // ---- Build team tables from today's leaderboard rows (chronological per-run; alphabetical per-user) ----
  const {
    blueRows,
    whiteRows,
    myRunsToday,
    myNextSprint,
    myTeamFirstRows,
    otherTeamRows,
    myTeamTitle,
    otherTeamTitle,
  } = useMemo(() => {
    // group by team + username, then fill runs in chronological order
    const mkTeamMap = () => new Map<string, number[]>(); // username -> up to 10 durations

    const blueMap = mkTeamMap();
    const whiteMap = mkTeamMap();

    // sort all rows chronologically by created_at ascending
    const sorted = [...leaders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    for (const r of sorted) {
      if (r.team !== "Blue" && r.team !== "White") continue;
      const map = r.team === "Blue" ? blueMap : whiteMap;
      if (!map.has(r.username)) map.set(r.username, []);
      const arr = map.get(r.username)!;
      if (arr.length < MAX_SPRINTS) arr.push(r.duration_ms); // fill slots 1..10 in time order
    }

    const toRows = (map: Map<string, number[]>) =>
      [...map.entries()]
        .map(([username, runs]) => {
          const avg = runs.length ? Math.floor(runs.reduce((a, b) => a + b, 0) / runs.length) : 0;
          return { username, avgTodayMs: avg, runs };
        })
        .sort((a, b) => a.username.localeCompare(b.username)); // alphabetical rows (stable)

    const blueRows = toRows(blueMap);
    const whiteRows = toRows(whiteMap);

    // logged-in user's run counts & next sprint number
    const myRuns =
      (team === "Blue" ? blueMap.get(username) : team === "White" ? whiteMap.get(username) : undefined) || [];
    const myNextSprint = Math.min(MAX_SPRINTS, (myRuns?.length || 0) + 1);

    // pick which table shows first based on user's team
    const myTeamFirstRows =
      team === "Blue" ? blueRows : team === "White" ? whiteRows : blueRows;
    const otherTeamRows =
      team === "Blue" ? whiteRows : team === "White" ? blueRows : whiteRows;

    const myTeamTitle =
      team === "Blue" ? "Blue Team (today)" : team === "White" ? "White Team (today)" : "Blue Team (today)";
    const otherTeamTitle =
      team === "Blue" ? "White Team (today)" : team === "White" ? "Blue Team (today)" : "White Team (today)";

    return {
      blueRows,
      whiteRows,
      myRunsToday: myRuns.length,
      myNextSprint,
      myTeamFirstRows,
      otherTeamRows,
      myTeamTitle,
      otherTeamTitle,
    };
  }, [leaders, team, username]);

  async function submit() {
    setErr(null);
    // Require a stopped, valid run
    if (startRef.current == null || stopRef.current == null || finalMsRef.current == null) {
      setErr("Stop the timer before submitting.");
      return;
    }
    // Client-side guard: cap at 10
    if (myRunsToday >= MAX_SPRINTS) {
      setErr("Daily limit reached (10/10).");
      return;
    }

    try {
      const res = await fetch("/api/runs/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // IMPORTANT: use the captured stopRef (not performance.now())
        body: JSON.stringify({ start: startRef.current, stop: stopRef.current }),
      });

      if (!res.ok) {
        const t = await res.json().catch(async () => ({ error: await res.text() }));
        throw new Error(t?.error || `Submit failed (${res.status})`);
      }

      reset();
      await refreshBoards();
    } catch (e: any) {
      setErr(e?.message ?? "Submit failed");
    }
  }

  function TeamBoard({
    title,
    totalMs,
    rows,
    colorClass,
  }: {
    title: string;
    totalMs: number;
    rows: TeamRow[];
    colorClass: string; // e.g., "text-blue-400" or "text-gray-100"
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
                {Array.from({ length: 10 }, (_, i) => (
                  <th key={i} className="p-2 border border-gray-700 text-center font-mono">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-3 text-center text-gray-400">
                    No runs yet.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.username} className="odd:bg-gray-800 even:bg-gray-900">
                    <td className="p-2 border border-gray-700 text-left">{r.username}</td>
                    <td className="p-2 border border-gray-700 text-center font-mono">
                      {r.avgTodayMs ? msToStr(r.avgTodayMs) : "—"}
                    </td>
                    {Array.from({ length: 10 }, (_, i) => {
                      const v = r.runs[i];
                      return (
                        <td key={i} className="p-2 border border-gray-700 text-center font-mono">
                          {typeof v === "number" ? msToStr(v) : "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const finishedAll = myRunsToday >= MAX_SPRINTS;

  // Decide totals card colors for clarity on dark bg
  const totalsBlueClass = "text-blue-400";
  const totalsWhiteClass = "text-gray-100";

  // --- Touch helpers that mirror click handlers and prevent scroll ---
  const handleStartTouch: React.TouchEventHandler<HTMLButtonElement> = (e) => {
    // Stop the browser from interpreting as scroll/drag
    e.preventDefault();
    lastTouchTsRef.current = performance.now();
    if (!finishedAll) start();
  };

  const handleStopTouch: React.TouchEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    lastTouchTsRef.current = performance.now();
    stop();
  };

  // Click handlers that ignore the synthetic click that follows a touch
  const handleStartClick: React.MouseEventHandler<HTMLButtonElement> = () => {
    const now = performance.now();
    if (now - lastTouchTsRef.current < TOUCH_CLICK_GAP) return; // ignore ghost click
    if (!finishedAll) start();
  };

  const handleStopClick: React.MouseEventHandler<HTMLButtonElement> = () => {
    const now = performance.now();
    if (now - lastTouchTsRef.current < TOUCH_CLICK_GAP) return;
    stop();
  };

  return (
    <div className="min-h-screen p-4 space-y-5 bg-gray-900 text-gray-100">
      {/* Header (kept minimal for phone) */}
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">sprintLeague — Player</h1>
          {username && (
            <div className="text-base mt-1">
              <div>
                Logged in as{" "}
                <span className="font-semibold text-blue-400">{username}</span>
                {team && <span className="text-gray-300 ml-1">({team})</span>}
              </div>
              {avgTime != null && (
                <div className="text-gray-300 text-sm mt-1">
                  Avg (all-time):{" "}
                  <span className="font-mono">{msToStr(avgTime)}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <form action="/api/auth/logout" method="POST">
          <button className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">Logout</button>
        </form>
      </header>

      {err && <div className="text-red-400 text-sm">{err}</div>}

      {/* 1) Stopwatch */}
      <section className="p-5 rounded-xl border border-gray-700 bg-gray-800 flex flex-col items-center">
        <div className="text-6xl font-mono text-center mb-1">{msToStr(displayMs)}</div>
        <div className="text-xs text-gray-300 mb-5">
          {finishedAll ? "Finished (10/10)" : `Next sprint: ${myNextSprint}/10`}
        </div>

        {/* Big circular Start/Stop button */}
        {!isRunning ? (
          <button
            type="button"
            onTouchStart={handleStartTouch}
            onClick={handleStartClick}
            disabled={finishedAll}
            // Prefer taps; don't start scroll/zoom on this element
            style={{ touchAction: "manipulation" }}
            className={`w-56 h-56 flex items-center justify-center rounded-full text-white text-3xl font-extrabold shadow-2xl transition-transform transform active:scale-95 select-none ${
              finishedAll
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/40"
            }`}
            aria-pressed="false"
            aria-disabled={finishedAll}
          >
            Start
          </button>
        ) : (
          <button
            type="button"
            onTouchStart={handleStopTouch}
            onClick={handleStopClick}
            style={{ touchAction: "manipulation" }}
            className="w-56 h-56 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white text-3xl font-extrabold shadow-2xl transition-transform transform active:scale-95 hover:shadow-red-500/40 select-none"
            aria-pressed="true"
          >
            Stop
          </button>
        )}

        {/* Reset & Submit spaced apart below */}
        <div className="flex justify-center gap-24 mt-8">
          <button
            onClick={reset}
            className="px-6 py-3 rounded border border-gray-600 hover:bg-gray-700 text-lg"
          >
            Reset
          </button>
          <button
            onClick={submit}
            className="px-6 py-3 rounded bg-green-600 hover:bg-green-500 text-white text-lg disabled:opacity-50"
            disabled={isRunning || displayMs === 0 || finishedAll}
          >
            Submit
          </button>
        </div>
      </section>

      {/* 2) White vs Blue team total time */}
      <section className="p-5 rounded-xl border border-gray-700 bg-gray-800">
        <h2 className="font-semibold text-lg mb-3">Team Totals (today)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
          <div className="p-3 rounded-lg bg-gray-900">
            <div className="text-sm text-gray-300 mb-1">White</div>
            <div className={`text-3xl font-mono ${totalsWhiteClass}`}>{msToStr(score.white)}</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-900">
            <div className="text-sm text-gray-300 mb-1">Blue</div>
            <div className={`text-3xl font-mono ${totalsBlueClass}`}>{msToStr(score.blue)}</div>
          </div>
        </div>
      </section>

      {/* 3) Logged-in user's team scoreboard */}
      <section>
        <TeamBoard
          title={myTeamTitle}
          totalMs={team === "Blue" ? score.blue : team === "White" ? score.white : score.blue}
          rows={myTeamFirstRows}
          colorClass={team === "Blue" ? "text-blue-400" : team === "White" ? "text-gray-100" : "text-blue-400"}
        />
      </section>

      {/* 4) Other team's scoreboard */}
      <section>
        <TeamBoard
          title={otherTeamTitle}
          totalMs={team === "Blue" ? score.white : team === "White" ? score.blue : score.white}
          rows={otherTeamRows}
          colorClass={team === "Blue" ? "text-gray-100" : team === "White" ? "text-blue-400" : "text-gray-100"}
        />
      </section>
    </div>
  );
}
