"use client";

import { useEffect, useRef, useState } from "react";

type Team = "Blue" | "White" | null;

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
  const stopRef = useRef<number | null>(null);
  const finalMsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  // player info + data
  const [username, setUsername] = useState<string>("");
  const [team, setTeam] = useState<Team>(null);
  const [avgTime, setAvgTime] = useState<number | null>(null);
  const [score, setScore] = useState<{ blue: number; white: number }>({ blue: 0, white: 0 });
  const [leaders, setLeaders] = useState<{ index: number; username: string; duration_ms: number; team: Team }[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function refreshBoards() {
    try {
      const s = await fetch("/api/scoreboard", { cache: "no-store" }).then((r) => r.json());
      setScore({ blue: s.blue ?? 0, white: s.white ?? 0 });

      const l = await fetch("/api/leaderboard", { cache: "no-store" }).then((r) => r.json());
      const rows = Array.isArray(l.rows) ? l.rows : [];
      setLeaders(rows);

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

  async function submit() {
    setErr(null);
    if (startRef.current == null || stopRef.current == null || finalMsRef.current == null) {
      setErr("Stop the timer before submitting.");
      return;
    }
    try {
      const res = await fetch("/api/runs/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: startRef.current, stop: stopRef.current }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || `Submit failed (${res.status})`);
      }
      reset();
      await refreshBoards();
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
              <span className="font-semibold text-blue-400">{username}</span>
              {team && <span className="text-gray-300 ml-1">({team})</span>}
              {avgTime != null && (
                <span className="text-gray-300 text-base ml-4">
                  Avg Time (all-time): <span className="font-mono">{msToStr(avgTime)}</span>
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
        <div className="p-6 rounded-xl border border-gray-700 bg-gray-800 flex flex-col items-center">
          <div className="text-6xl font-mono text-center mb-6">{msToStr(displayMs)}</div>

          {/* Big circular Start/Stop button */}
          {!isRunning ? (
            <button
              onClick={start}
              className="w-40 h-40 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white text-2xl font-bold shadow-lg transition-transform transform active:scale-95"
            >
              Start
            </button>
          ) : (
            <button
              onClick={stop}
              className="w-40 h-40 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white text-2xl font-bold shadow-lg transition-transform transform active:scale-95"
            >
              Stop
            </button>
          )}

          {/* Reset & Submit below */}
          <div className="flex gap-4 mt-6">
            <button
              onClick={reset}
              className="px-4 py-2 rounded border border-gray-600 hover:bg-gray-700"
            >
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
          <h2 className="font-semibold mb-3">Scoreboard (today)</h2>
          <div className="flex gap-6 text-2xl mb-4">
            <div>
              Blue: <span className="font-mono text-blue-400">{msToStr(score.blue)}</span>
            </div>
            <div>
              White: <span className="font-mono text-gray-100">{msToStr(score.white)}</span>
            </div>
          </div>

          <h2 className="font-semibold mt-2 mb-2">Today’s Submissions</h2>
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
                    <tr key={`${r.username}-${i}`} className="odd:bg-gray-800 even:bg-gray-900">
                      <td className="p-2 border border-gray-700 text-center">{r.index ?? i + 1}</td>
                      <td className="p-2 border border-gray-700 text-left">{r.username}</td>
                      <td
                        className={`p-2 border border-gray-700 text-center font-semibold ${
                          r.team === "Blue"
                            ? "text-blue-400"
                            : r.team === "White"
                            ? "text-gray-100"
                            : "text-gray-400"
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
