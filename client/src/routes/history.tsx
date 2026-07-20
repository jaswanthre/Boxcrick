import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getAuth, clearAuth } from "@/lib/auth";
import { useCricket } from "@/lib/cricket/store";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  batterStats,
  bowlerEconomy,
  bowlerOversString,
  bowlerStats,
  inningsTotals,
  oversString,
  playerOfTheMatch,
} from "@/lib/cricket/stats";
import type { MatchState } from "@/lib/cricket/types";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type MatchHistory = {
  _id: string;
  ownerName?: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  winnerTeamIdx?: number | null;
  result?: string;
  teams: { name: string; players: { id: string; name: string }[] }[];
  innings: any[];
};

function safeTime(value?: string) {
  if (!value) return "Unknown";
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : formatDistanceToNow(date, { addSuffix: true });
}

function formatDate(value?: string) {
  if (!value) return "Unknown";
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : format(date, "EEEE, MMM d, yyyy h:mm a");
}

type DayGroup = {
  dateKey: string;
  dayLabel: string;
  date: Date;
  matches: MatchHistory[];
};

function normalizeMatchTime(value?: string) {
  if (!value) return '';
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? '' : format(date, "yyyy-MM-dd'T'HH:mm");
}

function normalizeMatchKey(match: MatchHistory) {
  const teams = match.teams.map((team) => team.name).join('|');
  const inningsSig = match.innings
    .map((inn) => {
      const totals = inningsTotals(inn);
      return `${inn.battingTeamIdx}-${inn.bowlingTeamIdx}-${totals.runs}-${totals.wickets}-${totals.legalBalls}`;
    })
    .join('|');
  return `${teams}|${match.status}|${match.result ?? ''}|${normalizeMatchTime(match.startedAt)}|${normalizeMatchTime(match.completedAt)}|${match.winnerTeamIdx ?? ''}|${inningsSig}`;
}

function dedupeMatches(matches: MatchHistory[]) {
  const seen = new Map<string, MatchHistory>();
  for (const match of matches) {
    const key = normalizeMatchKey(match);
    if (!seen.has(key)) {
      seen.set(key, match);
    }
  }
  return Array.from(seen.values());
}

function groupMatchesByDay(matches: MatchHistory[]) {
  const uniqueMatches = dedupeMatches(matches);
  const grouped = uniqueMatches
    .slice()
    .sort((a, b) => {
      const da = a.startedAt ? parseISO(a.startedAt).getTime() : 0;
      const db = b.startedAt ? parseISO(b.startedAt).getTime() : 0;
      return da - db;
    })
    .reduce<DayGroup[]>((groups, match) => {
      const date = match.startedAt ? parseISO(match.startedAt) : new Date();
      const parsedDate = Number.isNaN(date.getTime()) ? new Date() : date;
      const dateKey = format(parsedDate, "yyyy-MM-dd");
      const dayLabel = DAY_LABELS[parsedDate.getDay()];
      const existing = groups.find((g) => g.dateKey === dateKey);
      if (existing) {
        existing.matches.push(match);
      } else {
        groups.push({ dateKey, dayLabel, date: parsedDate, matches: [match] });
      }
      return groups;
    }, []);

  return grouped.sort((a, b) => b.date.getTime() - a.date.getTime());
}

function HistoryPage() {
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "idle">("loading");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/matches`);
        if (!res.ok) throw new Error("Failed to load history");
        const data = await res.json();
        setMatches(data ?? []);
        setStatus("idle");
      } catch (err) {
        setStatus("error");
      }
    };

    load();
  }, []);

  const groupedMatches = useMemo(() => groupMatchesByDay(matches), [matches]);

  const getPotmForMatch = (match: MatchHistory) => {
    const fakeState = {
      phase: "summary",
      teams: match.teams,
      overs: 0,
      bowlerLimit: 0,
      tossWinnerIdx: 0,
      decision: "bat",
      innings: match.innings,
      currentInningsIdx: Math.max(0, match.innings.length - 1),
      ended: true,
      authUser: null,
      matchSaved: false,
    } as MatchState;
    return playerOfTheMatch(fakeState);
  };

  const renderMatchDetails = (match: MatchHistory) => {
    const potm = getPotmForMatch(match);
    return (
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Match Summary</p>
            <h3 className="mt-3 text-xl font-semibold text-foreground">
              {match.teams[0]?.name ?? "Team A"} vs {match.teams[1]?.name ?? "Team B"}
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-background p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Result</p>
                <p className="mt-2 text-sm text-foreground">{match.result ?? "No result available"}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-background p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Winner</p>
                <p className="mt-2 text-sm text-foreground">
                  {match.winnerTeamIdx != null ? match.teams[match.winnerTeamIdx]?.name : "Draw / Tie"}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-background p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Player of the Match</p>
                <p className="mt-2 text-sm text-foreground">{potm ? match.teams[potm.teamIdx]?.players.find((p) => p.id === potm.playerId)?.name ?? "Unknown" : "N/A"}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-background p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Saved by</p>
                <p className="mt-2 text-sm text-foreground">{match.ownerName ?? "Unknown"}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Started</p>
                <p className="mt-1 text-sm text-foreground">{formatDate(match.startedAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Completed</p>
                <p className="mt-1 text-sm text-foreground">{formatDate(match.completedAt)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Player of the Match</p>
            <div className="mt-4 rounded-3xl border border-white/10 bg-background p-5">
              <p className="text-sm text-muted-foreground">{potm ? potm.reason : "No player selected"}</p>
              <p className="mt-3 text-3xl font-bold text-gold">{potm ? potm.score : "—"}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {match.innings.map((inn, index) => {
            const battingTeam = match.teams[inn.battingTeamIdx];
            const bowlingTeam = match.teams[inn.bowlingTeamIdx];
            const totals = inningsTotals(inn);
            const batStats = batterStats(inn, battingTeam.players);
            const bowlStats = bowlerStats(inn);
            return (
              <div key={index} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Team {battingTeam.name} batting</p>
                    <h4 className="mt-1 text-lg font-semibold text-foreground">{totals.runs}/{totals.wickets} ({oversString(totals.legalBalls)})</h4>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
                    Top batter: {batStats.length ? battingTeam.players.find((p) => p.id === batStats[0].playerId)?.name ?? "—" : "—"}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-background p-4">
                    <p className="text-sm font-semibold text-foreground">Batting</p>
                    <div className="mt-4 space-y-3">
                      {batStats.map((player) => (
                        <div key={player.playerId} className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium">{battingTeam.players.find((p) => p.id === player.playerId)?.name ?? "—"}</span>
                          <span className="text-muted-foreground">{player.runs}/{player.balls}</span>
                          <span className="text-muted-foreground">{player.fours}x4</span>
                          <span className="text-muted-foreground">{player.sixes}x6</span>
                          <span className="text-muted-foreground">{player.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-background p-4">
                    <p className="text-sm font-semibold text-foreground">Bowling</p>
                    <div className="mt-4 space-y-3">
                      {bowlStats.map((player) => (
                        <div key={player.playerId} className="flex items-center justify-between gap-3 text-sm">
                          <span className="font-medium">{bowlingTeam.players.find((p) => p.id === player.playerId)?.name ?? "—"}</span>
                          <span className="text-muted-foreground">{bowlerOversString(player)}</span>
                          <span className="text-muted-foreground">{player.runs}</span>
                          <span className="text-muted-foreground">{player.wickets}w</span>
                          <span className="text-muted-foreground">{bowlerEconomy(player).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const { state, dispatch } = useCricket();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Match History</h1>
          <p className="mt-2 text-sm text-muted-foreground">Matches grouped by day from the current week.</p>
        </div>
        {getAuth() && !state.authUser ? (
          <button
            onClick={() => {
              clearAuth();
              dispatch({ type: 'LOGOUT' });
              window.location.replace('/');
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Logout
          </button>
        ) : (
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
        )}
      </div>

      {status === "loading" ? (
        <div className="glass-card p-8 text-center text-muted-foreground">Loading history…</div>
      ) : status === "error" ? (
        <div className="glass-card p-8 text-center text-danger">Could not load match history. Please check your backend and refresh.</div>
      ) : matches.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          No match history found yet.
          <div className="mt-4 text-sm">
            Finish a match and return here to see saved history.
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedMatches.map((group) => (
            <section key={group.dateKey} className="space-y-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {group.dayLabel} • {format(group.date, "MMM d")}
              </div>
              <Accordion type="multiple" className="space-y-3">
                {group.matches.slice().reverse().map((match, displayIndex) => {
                  const date = match.startedAt ? parseISO(match.startedAt) : new Date();
                  const matchNumber = group.matches.length - displayIndex;
                  return (
                    <AccordionItem key={match._id} value={`${group.dateKey}-${displayIndex}`} className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
                      <AccordionTrigger className="px-6 py-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-wider text-muted-foreground">
                              {group.dayLabel} Match {matchNumber}
                            </p>
                            <div className="flex flex-wrap items-center gap-3">
                              <h2 className="text-lg font-semibold text-foreground">
                                {match.teams[0]?.name ?? "Team A"} vs {match.teams[1]?.name ?? "Team B"}
                              </h2>
                              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                {match.status === "completed" ? "Completed" : "Ongoing"}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">{match.result ?? "No result available"}</p>
                          </div>
                          <div className="flex flex-col items-start gap-1 text-right sm:items-end">
                            <span className="text-sm font-medium text-foreground">{format(date, "EEE, MMM d")}</span>
                            <span className="text-xs text-muted-foreground">{format(date, "h:mm a")}</span>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-6 pb-6 pt-0">
                        {renderMatchDetails(match)}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});
