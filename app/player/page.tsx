// app/player/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";

function msToStr(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rems = s % 60;
  const remms = Math.floor((ms % 1000) / 10);
  return `${String(m).padStart(2, "0")}:${String(rems).padStart(2, "0")}.${String(remms).padStart(2, "0")}`;
}

export default function PlayerPage() {
  // stopwatch
  const [displayMs, setDisplayMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  // player info + data
  const [username, setUsername] = useState<string>("");
  const [team, setTeam] = useState<string | null>(null);
  const [avgTime, setAvgTime] = useState<number | null>(null);
  const [score, setScore] = useState<{ blue: number; white: number }>({ blue: 0, white: 0 });
  const [leaders, setLeaders] = useState<{ index: number; username: string; duration_ms: number }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function refreshBoards() {
    try {
      // fetch total team times
      const s = await fetch("/api/scoreboard", { cache: "no-store" }).then((r) => r.json());
      setScore({
        blue: s.blue ?? 0,
        white: s.white ?? 0,
      });

      // fetch all runs
      const l = await fetch("/api/leaderboard", { cache: "no-store" }).then((r) => r.json());
      const rows = Array.isArray(l.rows) ? l.rows.slice() : [];

      // sort fastest → slowest
      rows.sort((a: any, b: any) => (a.duration_ms ?? 0) - (b.duration_ms ?? 0));
      setLeaders(rows);

      // compute player's average
      if (username) {
        const mine = rows.filter((r) => r.username === username);
        if (mine.length > 0) {
          const avg = mine.reduce((a, r) => a + (r.duration_ms ?? 0), 0) / mine.length;
          setAvgTime(avg);
        } else {
          setAvgTime(null);
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load boards");
    }
  }

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

  // load player info + initial data
  useEffect(() => {
    (async () => {
      try {
        const who = await fetch("/api/whoami", { cache: "no-store" }).then((r) => r.json());
        if (who?.username) setUsername(who.username);
        if (who?.team) setTeam(who.team);
        await refreshBoards(who?.username);
      } catch (e) {
        console.error(e);
      }
    })();
    const id = setInterval(() => refreshBoards(username), 3000);
    return () => clearInterval(id);
  }, [username]);

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
    startRef.current = performance.now();
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
      setDisplayMs(Math.max(0, Math.floor(now - startRef.current)));
    }
  }

  function reset() {
    stop();
    startRef.current = null;
    setDisplayMs(0);
  }

  async function submit() {
    setErr(null);
    if (startRef.current == null) return;
    const stopTs = performance.now();
    try {
      const res = await fetch("/api/runs/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: startRef.current, stop: stopTs }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Submit failed (${res.status})`);
      }
      reset();
      await refreshBoards(username);
    } catch (e: any) {
      setErr(e?.message ?? "Submit failed");
    }
  }


  return (
    <div className="min-h-screen p-6 space-y-6 bg-gray-900 text-gray-100">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">sprintLeague — Player</h1>
          {username && (
            <div className="text-lg mt-1">
              Logged in as{" "}
              <span className="font-semibold text-blue-400">
                {username}
              </span>
              {team && (
                <span className="text-gray-300 ml-1">
                  ({team})
                </span>
              )}
              {avgTime != null && (
                <span className="text-gray-300 text-base ml-4">
                  Avg Time: <span className="font-mono">{msToStr(avgTime)}</span>
                </span>
              )}
            </div>
          )}
        </div>
        <form action="/api/auth/logout" method="POST">
          <button className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">Logout</button>
        </form>
      </header>

      {err && <div className="text-red-400 text-sm">{err}</div>}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Stopwatch */}
        <div className="p-6 rounded-xl border border-gray-700 bg-gray-800">
          <div className="text-6xl font-mono text-center mb-6">{msToStr(displayMs)}</div>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={start}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
              disabled={isRunning}
            >
              Start
            </button>
            <button onClick={stop} className="px-4 py-2 rounded border border-gray-600 hover:bg-gray-700">
              Stop
            </button>
            <button onClick={reset} className="px-4 py-2 rounded border border-gray-600 hover:bg-gray-700">
              Reset
            </button>
            <button
              onClick={submit}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white disabled:opacity-50"
              disabled={isRunning || displayMs === 0}
            >
              Submit
            </button>
          </div>
        </div>

        {/* Scoreboard + Leaderboard */}
        <div className="p-6 rounded-xl border border-gray-700 bg-gray-800">
          <h2 className="font-semibold mb-3">Scoreboard</h2>
          <div className="flex gap-6 text-2xl mb-4">
            <div>
              Blue: <span className="font-mono text-blue-400">{msToStr(score.blue)}</span>
            </div>
            <div>
              White: <span className="font-mono text-gray-100">{msToStr(score.white)}</span>
            </div>
          </div>

          <h2 className="font-semibold mt-2 mb-2">All Submissions</h2>
            <div className="overflow-x-auto border border-gray-700 rounded-lg">
              <table className="w-full text-sm border-collapse bg-gray-800 text-gray-100">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="p-2 border border-gray-700">#</th>
                    <th className="p-2 border border-gray-700 text-left">Name</th>
                    <th className="p-2 border border-gray-700">Team</th>
                    <th className="p-2 border border-gray-700">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-3 text-center text-gray-400">
                        No runs yet.
                      </td>
                    </tr>
                  ) : (
                    leaders.map((r, i) => (
                      <tr key={i} className="odd:bg-gray-800 even:bg-gray-900">
                        <td className="p-2 border border-gray-700 text-center">{r.index ?? i + 1}</td>
                        <td className="p-2 border border-gray-700 text-left">{r.username}</td>
                        <td
                          className={`p-2 border border-gray-700 text-center font-semibold ${
                            r.team === "Blue" ? "text-blue-400" : r.team === "White" ? "text-gray-100" : "text-gray-400"
                          }`}
                        >
                          {r.team ?? "—"}
                        </td>
                        <td className="p-2 border border-gray-700 font-mono text-center">
                          {msToStr(r.duration_ms)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
        </div>
      </div>
    </div>
  );
}
