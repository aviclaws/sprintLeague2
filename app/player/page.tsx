// app/player/page.tsx
"use client";
import { useEffect, useRef, useState } from "react";

function msToStr(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rems = s % 60;
  const remms = ms % 1000;
  return `${String(m).padStart(2,"0")}:${String(rems).padStart(2,"0")}.${String(Math.floor(remms/10)).padStart(2,"0")}`;
}

export default function PlayerPage() {
  const [running, setRunning] = useState(false);
  const [displayMs, setDisplayMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // scoreboard & leaderboard
  const [score, setScore] = useState<{blue:number;white:number}>({blue:0,white:0});
  const [leaders, setLeaders] = useState<{username:string;duration_ms:number;sprint:number}[]>([]);
  const [sprint, setSprint] = useState<number>(1);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
    async function refresh() {
      const s = await fetch("/api/scoreboard").then(r=>r.json());
      setScore(s);
      const l = await fetch("/api/leaderboard").then(r=>r.json());
      setLeaders(l.rows);
      setSprint(l.sprint);
    }
  }, []);

  function start() {
    if (running) return;
    const now = performance.now();
    startRef.current = now;
    setRunning(true);
    tick();
  }
  function tick() {
    rafRef.current = requestAnimationFrame(() => {
      if (!running || startRef.current == null) return;
      setDisplayMs(Math.floor(performance.now() - startRef.current));
      tick();
    });
  }
  function stop() {
    if (!running) return;
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }
  function reset() {
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;
    setDisplayMs(0);
  }
  async function submit() {
    if (startRef.current == null) return;
    const stopTs = performance.now();
    const res = await fetch("/api/runs/submit", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ start: startRef.current, stop: stopTs, sprint })
    });
    if (res.ok) {
      reset();
      // refresh boards
      const s = await fetch("/api/scoreboard").then(r=>r.json());
      setScore(s);
      const l = await fetch("/api/leaderboard").then(r=>r.json());
      setLeaders(l.rows);
      setSprint(l.sprint);
      alert("Submitted!");
    } else {
      const j = await res.json();
      alert("Submit failed: " + (j.error ?? "unknown"));
    }
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">sprintLeague — Player</h1>
        <form action="/api/auth/logout" method="POST">
          <button className="px-3 py-1 rounded bg-gray-200">Logout</button>
        </form>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-6 rounded-xl border">
          <div className="text-5xl font-mono text-center mb-6">{msToStr(displayMs)}</div>
          <div className="flex gap-3 justify-center">
            <button onClick={start} className="px-4 py-2 rounded bg-black text-white disabled:opacity-50" disabled={running}>Start</button>
            <button onClick={stop} className="px-4 py-2 rounded border">Stop</button>
            <button onClick={reset} className="px-4 py-2 rounded border">Reset</button>
            <button onClick={submit} className="px-4 py-2 rounded bg-blue-600 text-white" disabled={running || displayMs===0}>Submit</button>
          </div>
        </div>

        <div className="p-6 rounded-xl border">
          <h2 className="font-semibold mb-3">Scoreboard (Sprint {sprint})</h2>
          <div className="flex gap-4 text-2xl">
            <div>Blue: <span className="font-mono">{msToStr(score.blue)}</span></div>
            <div>White: <span className="font-mono">{msToStr(score.white)}</span></div>
          </div>

          <h2 className="font-semibold mt-6 mb-2">Leaderboard</h2>
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 border">#</th>
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Best Time</th>
                <th className="p-2 border">Sprint</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((r, i) => (
                <tr key={r.username} className="odd:bg-white even:bg-gray-50">
                  <td className="p-2 border">{i+1}</td>
                  <td className="p-2 border">{r.username}</td>
                  <td className="p-2 border font-mono">{msToStr(r.duration_ms)}</td>
                  <td className="p-2 border">{r.sprint}</td>
                </tr>
              ))}
              {leaders.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-gray-500">No runs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
