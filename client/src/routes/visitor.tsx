import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useCricket } from "@/lib/cricket/store";
import {
  batterStats,
  bowlerEconomy,
  bowlerOversString,
  bowlerStats,
  currentPartnership,
  inningsTotals,
  lastSixBalls,
  oversString,
  runRate,
} from "@/lib/cricket/stats";
import { clearAuth, getAuth, isVisitorSession } from "@/lib/auth";
import type { Ball, Innings, MatchState } from "@/lib/cricket/types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

function VisitorView() {
  const { state, dispatch } = useCricket();
  const [serverLive, setServerLive] = useState<MatchState | null>(null);

  useEffect(() => {
    if (!isVisitorSession()) {
      window.location.replace("/");
      return;
    }

    const onPopState = () => {
      if (isVisitorSession() && window.location.pathname !== "/visitor") {
        window.history.pushState(null, "", "/visitor");
      }
    };

    window.history.pushState(null, "", "/visitor");
    window.addEventListener("popstate", onPopState);

    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/matches/live`);
        if (!res.ok) throw new Error("Failed to load live match");
        const data = await res.json();
        setServerLive(data ? data : null);
      } catch {
        setServerLive(null);
      }
    };

    load();
    const timer = window.setInterval(load, 2000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  const liveState = useMemo(() => {
    if (serverLive?.innings?.length > 0) return serverLive;
    if (state.phase === "live" && state.innings.length > 0) return state;
    return null;
  }, [serverLive, state]);

  const previousInnings = useMemo(() => {
    if (!liveState || liveState.innings.length <= 1) return [];
    return liveState.innings.slice(0, liveState.currentInningsIdx);
  }, [liveState]);

  const hasLive = Boolean(liveState);
  const inn = hasLive ? liveState!.innings[liveState!.currentInningsIdx] : null;
  const teams = hasLive
    ? liveState!.teams
    : [
        { name: "", players: [] },
        { name: "", players: [] },
      ];
  const overs = hasLive ? liveState!.overs : 0;
  const totals = inn ? inningsTotals(inn) : null;
  const rr = totals ? runRate(totals.runs, totals.legalBalls) : 0;
  const partnership = inn ? currentPartnership(inn) : { runs: 0, balls: 0 };

  const battingTeam = inn ? teams[inn.battingTeamIdx] : null;
  const bowlingTeam = inn ? teams[inn.bowlingTeamIdx] : null;

  const target =
    liveState?.currentInningsIdx === 1 && liveState.innings.length > 0
      ? inningsTotals(liveState.innings[0]).runs + 1
      : null;
  const runsNeeded = target !== null && totals ? Math.max(0, target - totals.runs) : null;
  const ballsRemaining =
    target !== null && totals ? Math.max(0, overs * 6 - totals.legalBalls) : null;
  const rrr =
    target !== null && ballsRemaining && ballsRemaining > 0 && runsNeeded !== null
      ? (runsNeeded / ballsRemaining) * 6
      : 0;

  return (
    <div className="pb-10">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-3xl font-bold">Live Score (Visitor)</h2>
          <div className="flex gap-2">
            <Link
              to="/history"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm"
            >
              History
            </Link>
            {getAuth() && !state.authUser ? (
              <button
                onClick={() => {
                  clearAuth();
                  dispatch({ type: "LOGOUT" });
                  window.location.replace("/");
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm"
              >
                Logout
              </button>
            ) : null}
          </div>
        </div>

        {!hasLive ? (
          <div className="glass-card p-6 text-sm text-muted-foreground">
            No live match currently.
          </div>
        ) : (
          <>
            <div className="sticky top-4 z-10 rounded-3xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-6 shadow-lg backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {battingTeam?.name} — {liveState!.currentInningsIdx === 0 ? "1st" : "2nd"}{" "}
                    innings
                  </p>
                  <div className="mt-2 flex flex-wrap items-baseline gap-3">
                    <span className="text-5xl font-bold text-gold">
                      {totals!.runs}/{totals!.wickets}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({oversString(totals!.legalBalls)}/{overs})
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-right text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Run Rate</p>
                    <p className="font-semibold">{rr.toFixed(2)}</p>
                  </div>
                  {target !== null && runsNeeded !== null && ballsRemaining !== null && (
                    <>
                      <div>
                        <p className="text-muted-foreground">Target</p>
                        <p className="font-semibold text-gold">{target}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Need</p>
                        <p className="font-semibold">
                          {runsNeeded} off {ballsRemaining}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Req RR</p>
                        <p className="font-semibold">{rrr.toFixed(2)}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <p className="text-muted-foreground">Partnership</p>
                    <p className="font-semibold">
                      {partnership.runs}({partnership.balls})
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Chip>
                  👤 {battingTeam?.players.find((p) => p.id === inn!.strikerId)?.name ?? "—"} *
                </Chip>
                <Chip>
                  {battingTeam?.players.find((p) => p.id === inn!.nonStrikerId)?.name ?? "—"}
                </Chip>
                <Chip>
                  🎯 {bowlingTeam?.players.find((p) => p.id === inn!.bowlerId)?.name ?? "—"}
                </Chip>
                <Chip>
                  P’ship {partnership.runs}({partnership.balls})
                </Chip>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  This over
                </span>
                {lastSixBalls(inn!).map((b) => (
                  <BallBadge key={b.id} b={b} />
                ))}
              </div>
            </div>

            <div className="mx-auto mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <BattingScorecard inn={inn!} team={battingTeam!} />
              <BowlingScorecard inn={inn!} team={bowlingTeam!} />
            </div>

            {previousInnings.length > 0 && (
              <div className="mt-10 space-y-6">
                {previousInnings.map((prev, index) => {
                  const team = teams[prev.battingTeamIdx];
                  return (
                    <div key={index} className="space-y-4">
                      <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Previous Innings — {team.name}
                      </div>
                      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                        <BattingScorecard inn={prev} team={team} />
                        <BowlingScorecard inn={prev} team={teams[prev.bowlingTeamIdx]} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs">
      {children}
    </span>
  );
}

function BallBadge({ b }: { b: Ball }) {
  let label = "";
  let cls = "bg-white/5 text-foreground";
  if (b.isWicket) {
    label = "W";
    cls = "bg-danger/20 text-danger";
  } else if (b.extra === "wide") {
    label = `Wd${b.runs ? `+${b.runs}` : ""}`;
    cls = "bg-white/10 text-muted-foreground";
  } else if (b.extra === "noball") {
    label = `Nb${b.runs ? `+${b.runs}` : ""}`;
    cls = "bg-white/10 text-muted-foreground";
  } else if (b.runs === 0) {
    label = "•";
  } else if (b.runs === 4 || b.runs === 6) {
    label = String(b.runs);
    cls = "bg-gold-soft text-gold";
  } else label = String(b.runs);
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cls}`}
    >
      {label}
    </span>
  );
}

function BattingScorecard({
  inn,
  team,
}: {
  inn: Innings;
  team: { name: string; players: { id: string; name: string }[] };
}) {
  const rows = batterStats(inn, team.players);
  const nameOf = (id: string) => team.players.find((p) => p.id === id)?.name ?? "—";

  return (
    <section className="glass-card overflow-hidden">
      <div className="border-b border-white/10 px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Batting — {team.name}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-white/5">
              <th className="px-4 py-2 text-left">Batter</th>
              <th className="px-2 py-2 text-right">R</th>
              <th className="px-2 py-2 text-right">B</th>
              <th className="px-2 py-2 text-right">4s</th>
              <th className="px-2 py-2 text-right">6s</th>
              <th className="px-2 py-2 text-right">SR</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium">{nameOf(r.playerId)}</div>
                  <div className="text-[11px] text-muted-foreground">{r.status}</div>
                </td>
                <td className="px-2 py-2 text-right font-semibold">{r.runs}</td>
                <td className="px-2 py-2 text-right">{r.balls}</td>
                <td className="px-2 py-2 text-right">{r.fours}</td>
                <td className="px-2 py-2 text-right">{r.sixes}</td>
                <td className="px-2 py-2 text-right">
                  {r.balls ? ((r.runs / r.balls) * 100).toFixed(1) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BowlingScorecard({
  inn,
  team,
}: {
  inn: Innings;
  team: { name: string; players: { id: string; name: string }[] };
}) {
  const rows = bowlerStats(inn);
  const nameOf = (id: string) => team.players.find((p) => p.id === id)?.name ?? "—";

  return (
    <section className="glass-card overflow-hidden">
      <div className="border-b border-white/10 px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Bowling — {team.name}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr className="border-b border-white/5">
              <th className="px-4 py-2 text-left">Bowler</th>
              <th className="px-2 py-2 text-right">O</th>
              <th className="px-2 py-2 text-right">R</th>
              <th className="px-2 py-2 text-right">W</th>
              <th className="px-2 py-2 text-right">M</th>
              <th className="px-2 py-2 text-right">Econ</th>
              <th className="px-2 py-2 text-right">Dots</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.playerId} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2 font-medium">{nameOf(r.playerId)}</td>
                <td className="px-2 py-2 text-right">{bowlerOversString(r)}</td>
                <td className="px-2 py-2 text-right">{r.runs}</td>
                <td className="px-2 py-2 text-right font-semibold">{r.wickets}</td>
                <td className="px-2 py-2 text-right">{r.maidens}</td>
                <td className="px-2 py-2 text-right">{bowlerEconomy(r).toFixed(2)}</td>
                <td className="px-2 py-2 text-right">{r.dots}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export const Route = createFileRoute("/visitor")({
  component: VisitorView,
});
