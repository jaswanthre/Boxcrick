import { useEffect, useRef } from "react";
import { clearAuth } from "@/lib/auth";
import { Trophy, RotateCcw, Award } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCricket } from "@/lib/cricket/store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  batterStats, bowlerEconomy, bowlerStats, getWinnerIdx,
  inningsTotals, oversString, playerOfTheMatch, winningMargin,
} from "@/lib/cricket/stats";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export function SummaryView() {
  const { state, dispatch } = useCricket();
  const winnerIdx = getWinnerIdx(state);
  const margin = winningMargin(state);
  const potm = playerOfTheMatch(state);

  const saveStarted = useRef(false);

  useEffect(() => {
    if (!state.ended || state.matchSaved || saveStarted.current) return;
    saveStarted.current = true;

    const persistMatch = async () => {
      const payload = {
        ownerName: state.authUser?.name,
        status: "completed",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        winnerTeamIdx: winnerIdx,
        result:
          winnerIdx !== null
            ? `${state.teams[winnerIdx].name} won ${margin}`
            : "Match tied",
        teams: state.teams,
        innings: state.innings,
        metadata: { savedAt: new Date().toISOString() },
      };

      try {
        const res = await fetch(`${API_BASE}/api/matches`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          await fetch(`${API_BASE}/api/matches/live`, { method: "DELETE" });
          dispatch({ type: "SET_MATCH_SAVED" });
        }
      } catch (error) {
        console.error("Failed to save weekly history", error);
      }
    };

    persistMatch();
  }, [dispatch, margin, state, winnerIdx]);

  const topBatter = () => {
    let best: { name: string; runs: number; balls: number } | null = null;
    for (const inn of state.innings) {
      const players = state.teams[inn.battingTeamIdx].players;
      for (const b of batterStats(inn, players)) {
        if (!best || b.runs > best.runs) {
          best = { name: players.find((p) => p.id === b.playerId)?.name ?? "", runs: b.runs, balls: b.balls };
        }
      }
    }
    return best;
  };
  const topBowler = () => {
    let best: { name: string; wickets: number; runs: number } | null = null;
    for (const inn of state.innings) {
      const players = state.teams[inn.bowlingTeamIdx].players;
      for (const b of bowlerStats(inn)) {
        if (!best || b.wickets > best.wickets || (b.wickets === best.wickets && b.runs < best.runs)) {
          best = { name: players.find((p) => p.id === b.playerId)?.name ?? "", wickets: b.wickets, runs: b.runs };
        }
      }
    }
    return best;
  };
  const tb = topBatter();
  const tw = topBowler();
  const potmPlayer =
    potm ? state.teams[potm.teamIdx].players.find((p) => p.id === potm.playerId) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="glass-card p-8 text-center">
        <Trophy className="mx-auto mb-3 h-10 w-10 text-gold" />
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Match Result</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          {winnerIdx !== null ? (
            <>
              <span className="gold-text">{state.teams[winnerIdx].name}</span> won {margin}
            </>
          ) : (
            <span className="gold-text">{margin || "Match Ended"}</span>
          )}
        </h1>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {state.innings.map((inn, i) => {
          const t = inningsTotals(inn);
          return (
            <div key={i} className="glass-card p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Innings {i + 1}
              </p>
              <p className="mt-1 text-lg font-semibold">{state.teams[inn.battingTeamIdx].name}</p>
              <p className="mt-3 text-3xl font-bold gold-text">
                {t.runs}/{t.wickets}{" "}
                <span className="text-base text-muted-foreground">({oversString(t.legalBalls)})</span>
              </p>
            </div>
          );
        })}
      </div>

      {potm && potmPlayer && (
        <div className="mt-6 glass-card overflow-hidden">
          <div className="relative p-6 sm:p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/10 to-transparent" />
            <div className="relative flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gold-soft">
                <Award className="h-8 w-8 text-gold" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-widest text-gold">🏆 Player of the Match</p>
                <p className="mt-1 truncate text-2xl font-bold">{potmPlayer.name}</p>
                <p className="text-sm text-muted-foreground">{potm.reason}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Score</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="cursor-help text-2xl font-bold gold-text">{potm.score}</p>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs whitespace-pre-line text-left text-[11px]">
                      {potm.breakdown.map((line, index) => (
                        <span key={index}>
                          {line}{index < potm.breakdown.length - 1 ? "\n" : ""}
                        </span>
                      ))}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {tb && (
          <div className="glass-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Top Batter</p>
            <p className="mt-1 text-xl font-semibold">{tb.name}</p>
            <p className="text-sm text-muted-foreground">{tb.runs} ({tb.balls})</p>
          </div>
        )}
        {tw && (
          <div className="glass-card p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Top Bowler</p>
            <p className="mt-1 text-xl font-semibold">{tw.name}</p>
            <p className="text-sm text-muted-foreground">{tw.wickets}/{tw.runs}</p>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <button
          onClick={() => dispatch({ type: "RESET_HOME" })}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-gold to-[oklch(0.72_0.16_70)] px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-gold/20 transition hover:brightness-110"
        >
          <RotateCcw className="h-4 w-4" /> New Match
        </button>
        <button
          onClick={() => {
            dispatch({ type: "SET_TEAMS", teams: state.teams });
            dispatch({ type: "GOTO_SETUP" });
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-white/10"
        >
          Restart Same Teams
        </button>
        <Link
          to="/history"
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-white/10"
        >
          View Weekly History
        </Link>
        <button
          onClick={() => {
            clearAuth();
            dispatch({ type: 'LOGOUT' });
            window.location.href = '/';
          }}
          className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-white/10"
        >
          Logout
        </button>
      </div>
    </div>
  );
}

// silence unused
void bowlerEconomy;
