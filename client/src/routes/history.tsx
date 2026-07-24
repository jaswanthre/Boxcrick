import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { getAuth, clearAuth } from "@/lib/auth";
import { useCricket } from "@/lib/cricket/store";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  innings: MatchState["innings"];
};

type PlayerAggregate = {
  key: string;
  name: string;
  batting: {
    innings: number;
    runs: number;
    balls: number;
    innings25: number;
    innings50: number;
    bestScore: number;
    fours: number;
    sixes: number;
  };
  bowling: {
    innings: number;
    wickets: number;
    runs: number;
    legalBalls: number;
    innings3W: number;
    innings5W: number;
    maidenOvers: number;
    bestWickets: number;
    bestRuns: number;
  };
  momCount: number;
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
  if (!value) return "";
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? "" : format(date, "yyyy-MM-dd'T'HH:mm");
}

function normalizeMatchKey(match: MatchHistory) {
  const teams = match.teams.map((team) => team.name).join("|");
  const inningsSig = match.innings
    .map((inn) => {
      const totals = inningsTotals(inn);
      return `${inn.battingTeamIdx}-${inn.bowlingTeamIdx}-${totals.runs}-${totals.wickets}-${totals.legalBalls}`;
    })
    .join("|");
  return `${teams}|${match.status}|${match.result ?? ""}|${normalizeMatchTime(match.startedAt)}|${normalizeMatchTime(match.completedAt)}|${match.winnerTeamIdx ?? ""}|${inningsSig}`;
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

function playerKey(name: string) {
  return name.trim().toLowerCase();
}

function createPlayerAggregate(name: string): PlayerAggregate {
  return {
    key: playerKey(name),
    name: name.trim(),
    batting: {
      innings: 0,
      runs: 0,
      balls: 0,
      innings25: 0,
      innings50: 0,
      bestScore: 0,
      fours: 0,
      sixes: 0,
    },
    bowling: {
      innings: 0,
      wickets: 0,
      runs: 0,
      legalBalls: 0,
      innings3W: 0,
      innings5W: 0,
      maidenOvers: 0,
      bestWickets: 0,
      bestRuns: Number.POSITIVE_INFINITY,
    },
    momCount: 0,
  };
}

function HistoryPage() {
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "idle">("loading");
  const [view, setView] = useState<"matches" | "players">("matches");
  const [playerSearch, setPlayerSearch] = useState("");

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

  const playerHistory = useMemo(() => {
    const map = new Map<string, PlayerAggregate>();
    const ensurePlayer = (name: string) => {
      const key = playerKey(name);
      if (!map.has(key)) {
        map.set(key, createPlayerAggregate(name));
      }
      return map.get(key)!;
    };

    for (const match of matches) {
      for (const team of match.teams) {
        for (const player of team.players) {
          ensurePlayer(player.name || "Unknown");
        }
      }

      const potm = getPotmForMatch(match);
      if (potm) {
        const potmName =
          match.teams[potm.teamIdx]?.players.find((p) => p.id === potm.playerId)?.name ?? "Unknown";
        ensurePlayer(potmName).momCount += 1;
      }

      for (const inn of match.innings) {
        const battingTeam = match.teams[inn.battingTeamIdx];
        const bowlingTeam = match.teams[inn.bowlingTeamIdx];

        const batRows = batterStats(inn, battingTeam.players);
        for (const row of batRows) {
          const name = battingTeam.players.find((p) => p.id === row.playerId)?.name ?? "Unknown";
          const player = ensurePlayer(name);
          player.batting.innings += 1;
          player.batting.runs += row.runs;
          player.batting.balls += row.balls;
          player.batting.fours += row.fours;
          player.batting.sixes += row.sixes;
          if (row.runs >= 25) player.batting.innings25 += 1;
          if (row.runs >= 50) player.batting.innings50 += 1;
          if (row.runs > player.batting.bestScore) player.batting.bestScore = row.runs;
        }

        const bowlRows = bowlerStats(inn);
        for (const row of bowlRows) {
          const name = bowlingTeam.players.find((p) => p.id === row.playerId)?.name ?? "Unknown";
          const player = ensurePlayer(name);
          player.bowling.innings += 1;
          player.bowling.wickets += row.wickets;
          player.bowling.runs += row.runs;
          player.bowling.legalBalls += row.legalBalls;
          player.bowling.maidenOvers += row.maidens;
          if (row.wickets >= 3) player.bowling.innings3W += 1;
          if (row.wickets >= 5) player.bowling.innings5W += 1;
          if (
            row.wickets > player.bowling.bestWickets ||
            (row.wickets === player.bowling.bestWickets && row.runs < player.bowling.bestRuns)
          ) {
            player.bowling.bestWickets = row.wickets;
            player.bowling.bestRuns = row.runs;
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [matches]);

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    if (!q) return playerHistory;
    return playerHistory.filter((player) => player.name.toLowerCase().includes(q));
  }, [playerHistory, playerSearch]);

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
                <p className="mt-2 text-sm text-foreground">
                  {match.result ?? "No result available"}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-background p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Winner</p>
                <p className="mt-2 text-sm text-foreground">
                  {match.winnerTeamIdx != null
                    ? match.teams[match.winnerTeamIdx]?.name
                    : "Draw / Tie"}
                </p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-background p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Player of the Match
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {potm
                    ? (match.teams[potm.teamIdx]?.players.find((p) => p.id === potm.playerId)
                        ?.name ?? "Unknown")
                    : "N/A"}
                </p>
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
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Player of the Match
            </p>
            <div className="mt-4 rounded-3xl border border-white/10 bg-background p-5">
              <p className="text-sm text-muted-foreground">
                {potm ? potm.reason : "No player selected"}
              </p>
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
            const topBatter = batStats.length
              ? batStats.reduce((best, current) => {
                  if (!best) return current;
                  if (current.runs > best.runs) return current;
                  if (current.runs === best.runs && current.balls < best.balls) return current;
                  return best;
                }, batStats[0])
              : null;
            const topBowler = bowlStats.length
              ? bowlStats.reduce((best, current) => {
                  if (!best) return current;
                  if (current.wickets > best.wickets) return current;
                  if (current.wickets === best.wickets) {
                    const currentEcon = bowlerEconomy(current);
                    const bestEcon = bowlerEconomy(best);
                    if (currentEcon < bestEcon) return current;
                    if (currentEcon === bestEcon && current.runs < best.runs) return current;
                  }
                  return best;
                }, bowlStats[0])
              : null;
            return (
              <div key={index} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Team {battingTeam.name} batting
                    </p>
                    <h4 className="mt-1 text-lg font-semibold text-foreground">
                      {totals.runs}/{totals.wickets} ({oversString(totals.legalBalls)})
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
                      Top batter:{" "}
                      {topBatter
                        ? (battingTeam.players.find((p) => p.id === topBatter.playerId)?.name ??
                          "—")
                        : "—"}
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
                      Top bowler:{" "}
                      {topBowler
                        ? (bowlingTeam.players.find((p) => p.id === topBowler.playerId)?.name ??
                          "—")
                        : "—"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border border-white/10 bg-background p-4">
                    <p className="text-sm font-semibold text-foreground">Batting</p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs uppercase text-muted-foreground">
                          <tr className="border-b border-white/10">
                            <th className="px-2 py-2 text-left">Playername</th>
                            <th className="px-2 py-2 text-right">Score</th>
                            <th className="px-2 py-2 text-right">4s</th>
                            <th className="px-2 py-2 text-right">6s</th>
                            <th className="px-2 py-2 text-right">Out/Not</th>
                            <th className="px-2 py-2 text-right">Strikerate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batStats.map((player) =>
                            (() => {
                              const rawStatus = (player.status || "").toLowerCase();
                              const statusDisplay = rawStatus.includes("retired hurt")
                                ? "retired hurt"
                                : rawStatus.startsWith("not out")
                                  ? player.status
                                  : "out";
                              return (
                                <tr
                                  key={player.playerId}
                                  className="border-b border-white/5 last:border-0"
                                >
                                  <td className="px-2 py-2 font-medium">
                                    {battingTeam.players.find((p) => p.id === player.playerId)
                                      ?.name ?? "—"}
                                  </td>
                                  <td className="px-2 py-2 text-right text-muted-foreground">
                                    {player.runs}({player.balls})
                                  </td>
                                  <td className="px-2 py-2 text-right text-muted-foreground">
                                    {player.fours}
                                  </td>
                                  <td className="px-2 py-2 text-right text-muted-foreground">
                                    {player.sixes}
                                  </td>
                                  <td className="px-2 py-2 text-right text-muted-foreground">
                                    {statusDisplay}
                                  </td>
                                  <td className="px-2 py-2 text-right text-muted-foreground">
                                    {player.balls
                                      ? ((player.runs / player.balls) * 100).toFixed(1)
                                      : "—"}
                                  </td>
                                </tr>
                              );
                            })(),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-background p-4">
                    <p className="text-sm font-semibold text-foreground">Bowling</p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="text-xs uppercase text-muted-foreground">
                          <tr className="border-b border-white/10">
                            <th className="px-2 py-2 text-left">Playername</th>
                            <th className="px-2 py-2 text-right">Overs</th>
                            <th className="px-2 py-2 text-right">Runs</th>
                            <th className="px-2 py-2 text-right">Wickets</th>
                            <th className="px-2 py-2 text-right">Maidenovers</th>
                            <th className="px-2 py-2 text-right">Runrate</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bowlStats.map((player) => (
                            <tr
                              key={player.playerId}
                              className="border-b border-white/5 last:border-0"
                            >
                              <td className="px-2 py-2 font-medium">
                                {bowlingTeam.players.find((p) => p.id === player.playerId)?.name ??
                                  "—"}
                              </td>
                              <td className="px-2 py-2 text-right text-muted-foreground">
                                {bowlerOversString(player)}
                              </td>
                              <td className="px-2 py-2 text-right text-muted-foreground">
                                {player.runs}
                              </td>
                              <td className="px-2 py-2 text-right text-muted-foreground">
                                {player.wickets}
                              </td>
                              <td className="px-2 py-2 text-right text-muted-foreground">
                                {player.maidens}
                              </td>
                              <td className="px-2 py-2 text-right text-muted-foreground">
                                {bowlerEconomy(player).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
          <p className="mt-2 text-sm text-muted-foreground">
            Matches grouped by day from the current week.
          </p>
        </div>
        {getAuth() && !state.authUser ? (
          <button
            onClick={() => {
              clearAuth();
              dispatch({ type: "LOGOUT" });
              window.location.replace("/");
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" /> Logout
          </button>
        ) : null}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("matches")}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
            view === "matches"
              ? "border-gold/40 bg-gold-soft text-gold"
              : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
          }`}
        >
          Match History
        </button>
        <button
          type="button"
          onClick={() => setView("players")}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
            view === "players"
              ? "border-gold/40 bg-gold-soft text-gold"
              : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
          }`}
        >
          Player History
        </button>
      </div>

      {status === "loading" ? (
        <div className="glass-card p-8 text-center text-muted-foreground">Loading history…</div>
      ) : status === "error" ? (
        <div className="glass-card p-8 text-center text-danger">
          Could not load match history. Please check your backend and refresh.
        </div>
      ) : matches.length === 0 ? (
        <div className="glass-card p-8 text-center text-muted-foreground">
          No match history found yet.
          <div className="mt-4 text-sm">Finish a match and return here to see saved history.</div>
        </div>
      ) : view === "players" ? (
        <div className="space-y-4">
          <div className="glass-card p-4">
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Search player
            </label>
            <input
              value={playerSearch}
              onChange={(e) => setPlayerSearch(e.target.value)}
              placeholder="Type player name..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-gold/40"
            />
          </div>

          {filteredPlayers.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">
              No players found for this search.
            </div>
          ) : (
            <Accordion type="multiple" className="space-y-3">
              {filteredPlayers.map((player) => {
                const battingSr =
                  player.batting.balls > 0
                    ? ((player.batting.runs / player.batting.balls) * 100).toFixed(2)
                    : "0.00";
                const bowlingEcon =
                  player.bowling.legalBalls > 0
                    ? ((player.bowling.runs / player.bowling.legalBalls) * 6).toFixed(2)
                    : "0.00";
                const bestBowling =
                  player.bowling.bestRuns === Number.POSITIVE_INFINITY
                    ? "0/0"
                    : `${player.bowling.bestRuns}/${player.bowling.bestWickets}`;

                return (
                  <AccordionItem
                    key={player.key}
                    value={player.key}
                    className="overflow-hidden rounded-3xl border border-white/10 bg-white/5"
                  >
                    <AccordionTrigger className="px-6 py-4">
                      <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-left text-base font-semibold text-foreground">
                          {player.name}
                        </h3>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                            Runs {player.batting.runs}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                            Wickets {player.bowling.wickets}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                            MOM {player.momCount}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6 pt-0">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-3xl border border-white/10 bg-background p-4">
                          <p className="text-sm font-semibold text-foreground">Batting Stats</p>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="text-xs uppercase text-muted-foreground">
                                <tr className="border-b border-white/10">
                                  <th className="px-2 py-2 text-left">Innings</th>
                                  <th className="px-2 py-2 text-right">Runs</th>
                                  <th className="px-2 py-2 text-right">SR</th>
                                  <th className="px-2 py-2 text-right">25+</th>
                                  <th className="px-2 py-2 text-right">50+</th>
                                  <th className="px-2 py-2 text-right">MOM</th>
                                  <th className="px-2 py-2 text-right">Best</th>
                                  <th className="px-2 py-2 text-right">4s</th>
                                  <th className="px-2 py-2 text-right">6s</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="px-2 py-2">{player.batting.innings}</td>
                                  <td className="px-2 py-2 text-right">{player.batting.runs}</td>
                                  <td className="px-2 py-2 text-right">{battingSr}</td>
                                  <td className="px-2 py-2 text-right">
                                    {player.batting.innings25}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    {player.batting.innings50}
                                  </td>
                                  <td className="px-2 py-2 text-right">{player.momCount}</td>
                                  <td className="px-2 py-2 text-right">
                                    {player.batting.bestScore}
                                  </td>
                                  <td className="px-2 py-2 text-right">{player.batting.fours}</td>
                                  <td className="px-2 py-2 text-right">{player.batting.sixes}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-background p-4">
                          <p className="text-sm font-semibold text-foreground">Bowling Stats</p>
                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="text-xs uppercase text-muted-foreground">
                                <tr className="border-b border-white/10">
                                  <th className="px-2 py-2 text-left">Innings</th>
                                  <th className="px-2 py-2 text-right">Wickets</th>
                                  <th className="px-2 py-2 text-right">Economy</th>
                                  <th className="px-2 py-2 text-right">3+ W</th>
                                  <th className="px-2 py-2 text-right">5+ W</th>
                                  <th className="px-2 py-2 text-right">Maidens</th>
                                  <th className="px-2 py-2 text-right">Best</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="px-2 py-2">{player.bowling.innings}</td>
                                  <td className="px-2 py-2 text-right">{player.bowling.wickets}</td>
                                  <td className="px-2 py-2 text-right">{bowlingEcon}</td>
                                  <td className="px-2 py-2 text-right">
                                    {player.bowling.innings3W}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    {player.bowling.innings5W}
                                  </td>
                                  <td className="px-2 py-2 text-right">
                                    {player.bowling.maidenOvers}
                                  </td>
                                  <td className="px-2 py-2 text-right">{bestBowling}</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedMatches.map((group) => (
            <section key={group.dateKey} className="space-y-4">
              <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                {group.dayLabel} • {format(group.date, "MMM d")}
              </div>
              <Accordion type="multiple" className="space-y-3">
                {group.matches
                  .slice()
                  .reverse()
                  .map((match, displayIndex) => {
                    const date = match.startedAt ? parseISO(match.startedAt) : new Date();
                    const matchNumber = group.matches.length - displayIndex;
                    return (
                      <AccordionItem
                        key={match._id}
                        value={`${group.dateKey}-${displayIndex}`}
                        className="overflow-hidden rounded-3xl border border-white/10 bg-white/5"
                      >
                        <AccordionTrigger className="px-6 py-5">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-2">
                              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                {group.dayLabel} Match {matchNumber}
                              </p>
                              <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-lg font-semibold text-foreground">
                                  {match.teams[0]?.name ?? "Team A"} vs{" "}
                                  {match.teams[1]?.name ?? "Team B"}
                                </h2>
                                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                                  {match.status === "completed" ? "Completed" : "Ongoing"}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {match.result ?? "No result available"}
                              </p>
                            </div>
                            <div className="flex flex-col items-start gap-1 text-right sm:items-end">
                              <span className="text-sm font-medium text-foreground">
                                {format(date, "EEE, MMM d")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {format(date, "h:mm a")}
                              </span>
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
