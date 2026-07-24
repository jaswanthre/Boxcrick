import { createContext, useContext, useMemo, useReducer, useEffect, type ReactNode } from "react";
import type { Ball, MatchState, Player, Team } from "./types";
import { inningsTotals, isLegalBall, uid } from "./stats";
import { getAuth } from "@/lib/auth";

const emptyTeam = (name: string): Team => ({ name, players: [] });
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
const SNAPSHOT_KEY = "criclive_match_snapshot";
const LAST_TEAMS_KEY = "criclive_last_teams";

const initial: MatchState = {
  phase: "home",
  teams: [emptyTeam("Team A"), emptyTeam("Team B")],
  overs: 6,
  bowlerLimit: 3,
  tossWinnerIdx: 0,
  decision: "bat",
  innings: [],
  currentInningsIdx: 0,
  ended: false,
  authUser: null,
  matchSaved: false,
};

type Action =
  | { type: "SET_TEAM_NAME"; teamIdx: 0 | 1; name: string }
  | { type: "ADD_PLAYER"; teamIdx: 0 | 1; name: string }
  | { type: "UPDATE_PLAYER"; teamIdx: 0 | 1; id: string; name: string }
  | { type: "DELETE_PLAYER"; teamIdx: 0 | 1; id: string }
  | { type: "RESET_HOME" }
  | { type: "GOTO_SETUP" }
  | { type: "SET_TOSS"; tossWinnerIdx: 0 | 1; decision: "bat" | "bowl" }
  | { type: "SET_OVERS"; overs: number }
  | { type: "SET_BOWLER_LIMIT"; bowlerLimit: number }
  | { type: "SET_TEAMS"; teams: [Team, Team]; overs?: number; bowlerLimit?: number }
  | { type: "START_MATCH"; strikerId: string; nonStrikerId: string; bowlerId: string }
  | { type: "LOGIN"; user: import("./types").AuthUser }
  | { type: "LOGOUT" }
  | { type: "SET_MATCH_SAVED" }
  | { type: "ADD_BALL"; ball: Omit<Ball, "id" | "overIdx" | "legalBallInOver"> }
  | { type: "SET_TEAM_NAME"; teamIdx: 0 | 1; name: string }
  | { type: "ADD_PLAYER"; teamIdx: 0 | 1; name: string }
  | { type: "UPDATE_PLAYER"; teamIdx: 0 | 1; id: string; name: string }
  | { type: "DELETE_PLAYER"; teamIdx: 0 | 1; id: string }
  | { type: "RESET_HOME" }
  | { type: "GOTO_SETUP" }
  | { type: "SET_TOSS"; tossWinnerIdx: 0 | 1; decision: "bat" | "bowl" }
  | { type: "SET_OVERS"; overs: number }
  | { type: "START_MATCH"; strikerId: string; nonStrikerId: string; bowlerId: string }
  | { type: "ADD_BALL"; ball: Omit<Ball, "id" | "overIdx" | "legalBallInOver"> }
  | { type: "UNDO_BALL" }
  | { type: "EDIT_BALL"; ballId: string; patch: Partial<Ball> }
  | { type: "DELETE_BALL"; ballId: string }
  | { type: "FINISH_OVER"; nextBowlerId: string }
  | { type: "REPLACE_BATTER"; outId: string; newBatterId: string }
  | { type: "END_INNINGS" }
  | { type: "START_SECOND_INNINGS"; strikerId: string; nonStrikerId: string; bowlerId: string }
  | { type: "END_MATCH" }
  | { type: "SWAP_STRIKE" }
  | {
      type: "RESTORE_SNAPSHOT";
      snapshot: Pick<
        MatchState,
        | "phase"
        | "teams"
        | "overs"
        | "bowlerLimit"
        | "tossWinnerIdx"
        | "decision"
        | "innings"
        | "currentInningsIdx"
        | "ended"
        | "matchSaved"
      >;
    };

function recomputeOverIndices(balls: Omit<Ball, "overIdx" | "legalBallInOver">[]): Ball[] {
  const result: Ball[] = [];
  let overIdx = 0;
  let legalInOver = 0;
  for (const b of balls) {
    const full: Ball = { ...b, overIdx, legalBallInOver: 0 } as Ball;
    if (isLegalBall(full)) {
      legalInOver += 1;
      full.legalBallInOver = legalInOver;
      if (legalInOver === 6) {
        overIdx += 1;
        legalInOver = 0;
      }
    }
    result.push(full);
  }
  return result;
}

function rebuildInningsFromBalls(
  innings: MatchState["innings"][number],
  balls: Ball[],
): Pick<MatchState["innings"][number], "strikerId" | "nonStrikerId" | "outPlayers"> {
  if (balls.length === 0) {
    return {
      strikerId: innings.strikerId,
      nonStrikerId: innings.nonStrikerId,
      outPlayers: [],
    };
  }

  let striker = balls[0].strikerId;
  let nonStriker = balls[0].nonStrikerId;
  let outPlayers: string[] = [];

  for (const b of balls) {
    const startStriker = b.strikerId;
    const startNonStriker = b.nonStrikerId;
    striker = startStriker;
    nonStriker = startNonStriker;

    const isRunOut = b.isWicket && b.dismissalType === "Run Out";
    if (isRunOut) {
      const outId =
        b.batterOutId ?? (b.runOutSide === "non-striker" ? startNonStriker : startStriker);
      const survivorId = outId === startStriker ? startNonStriker : startStriker;
      if (b.runOutSide === "non-striker") {
        striker = survivorId;
        nonStriker = outId;
      } else {
        striker = outId;
        nonStriker = survivorId;
      }
    } else {
      const shouldSwap =
        (!b.isWicket && !b.extra && b.runs % 2 === 1) || (b.extra === "noball" && b.runs % 2 === 1);
      if (shouldSwap) {
        [striker, nonStriker] = [nonStriker, striker];
      }
    }

    if (b.legalBallInOver === 6) {
      [striker, nonStriker] = [nonStriker, striker];
    }

    if (b.isWicket && b.dismissalType !== "Retired Hurt") {
      const outId =
        b.dismissalType === "Run Out"
          ? (b.batterOutId ?? (b.runOutSide === "non-striker" ? b.nonStrikerId : b.strikerId))
          : (b.batterOutId ?? b.strikerId);
      outPlayers = [...outPlayers, outId];
    }
  }

  return { strikerId: striker, nonStrikerId: nonStriker, outPlayers };
}

function reducer(state: MatchState, action: Action): MatchState {
  switch (action.type) {
    case "SET_TEAM_NAME": {
      const teams = [...state.teams] as [Team, Team];
      teams[action.teamIdx] = { ...teams[action.teamIdx], name: action.name };
      return { ...state, teams };
    }
    case "ADD_PLAYER": {
      const teams = [...state.teams] as [Team, Team];
      const p: Player = { id: uid(), name: action.name.trim() || "Player" };
      teams[action.teamIdx] = {
        ...teams[action.teamIdx],
        players: [...teams[action.teamIdx].players, p],
      };
      return { ...state, teams };
    }
    case "UPDATE_PLAYER": {
      const teams = [...state.teams] as [Team, Team];
      teams[action.teamIdx] = {
        ...teams[action.teamIdx],
        players: teams[action.teamIdx].players.map((p) =>
          p.id === action.id ? { ...p, name: action.name } : p,
        ),
      };
      return { ...state, teams };
    }
    case "DELETE_PLAYER": {
      const teams = [...state.teams] as [Team, Team];
      teams[action.teamIdx] = {
        ...teams[action.teamIdx],
        players: teams[action.teamIdx].players.filter((p) => p.id !== action.id),
      };
      return { ...state, teams };
    }
    case "RESET_HOME":
      return { ...initial };
    case "GOTO_SETUP":
      return { ...state, phase: "setup" };
    case "SET_TOSS":
      return { ...state, tossWinnerIdx: action.tossWinnerIdx, decision: action.decision };
    case "SET_OVERS":
      return { ...state, overs: action.overs };
    case "SET_BOWLER_LIMIT":
      return { ...state, bowlerLimit: action.bowlerLimit };
    case "SET_TEAMS":
      return {
        ...state,
        teams: action.teams,
        overs: action.overs ?? state.overs,
        bowlerLimit: action.bowlerLimit ?? state.bowlerLimit,
        phase: "home",
        innings: [],
        currentInningsIdx: 0,
        ended: false,
        matchSaved: false,
      };
    case "START_MATCH": {
      const battingTeamIdx: 0 | 1 =
        action.strikerId && action.nonStrikerId
          ? state.teams[0].players.some((p) => p.id === action.strikerId)
            ? 0
            : 1
          : 0;
      const bowlingTeamIdx: 0 | 1 = battingTeamIdx === 0 ? 1 : 0;
      return {
        ...state,
        phase: "live",
        currentInningsIdx: 0,
        innings: [
          {
            battingTeamIdx,
            bowlingTeamIdx,
            balls: [],
            strikerId: action.strikerId,
            nonStrikerId: action.nonStrikerId,
            bowlerId: action.bowlerId,
            ended: false,
            outPlayers: [],
          },
        ],
      };
    }
    case "LOGIN": {
      return { ...state, authUser: action.user };
    }
    case "LOGOUT": {
      return {
        ...state,
        authUser: null,
        phase: "home",
        innings: [],
        currentInningsIdx: 0,
        ended: false,
      };
    }
    case "ADD_BALL": {
      const inn = state.innings[state.currentInningsIdx];
      const rawBall = { ...action.ball, id: uid() };
      const newBalls = recomputeOverIndices([...inn.balls.map(stripComputed), rawBall]);
      const raw = action.ball;
      const startStriker = inn.strikerId;
      const startNonStriker = inn.nonStrikerId;
      let striker = startStriker;
      let nonStriker = startNonStriker;
      const last = newBalls[newBalls.length - 1];
      const isRunOut = raw.isWicket && raw.dismissalType === "Run Out";
      if (isRunOut) {
        const outId =
          raw.batterOutId ?? (raw.runOutSide === "non-striker" ? startNonStriker : startStriker);
        const survivorId = outId === startStriker ? startNonStriker : startStriker;
        if (raw.runOutSide === "non-striker") {
          striker = survivorId;
          nonStriker = outId;
        } else {
          striker = outId;
          nonStriker = survivorId;
        }
      } else {
        // swap on odd runs (off bat, not on extras' automatic 1)
        const batRuns = raw.extra ? raw.runs : raw.runs;
        const shouldSwap =
          (!raw.isWicket && !raw.extra && batRuns % 2 === 1) ||
          (raw.extra === "noball" && raw.runs % 2 === 1);
        if (shouldSwap) {
          [striker, nonStriker] = [nonStriker, striker];
        }
      }
      // end of over swap
      if (last.legalBallInOver === 6) {
        [striker, nonStriker] = [nonStriker, striker];
      }
      let outPlayers = inn.outPlayers;
      if (raw.isWicket && raw.dismissalType !== "Retired Hurt") {
        const outId =
          raw.dismissalType === "Run Out"
            ? (raw.batterOutId ??
              (raw.runOutSide === "non-striker" ? raw.nonStrikerId : raw.strikerId))
            : (raw.batterOutId ?? raw.strikerId);
        outPlayers = [...outPlayers, outId];
      }
      const newInnings = [...state.innings];
      newInnings[state.currentInningsIdx] = {
        ...inn,
        balls: newBalls,
        strikerId: striker,
        nonStrikerId: nonStriker,
        outPlayers,
      };
      return { ...state, innings: newInnings };
    }
    case "UNDO_BALL": {
      const inn = state.innings[state.currentInningsIdx];
      if (!inn.balls.length) return state;
      const newBalls = recomputeOverIndices(inn.balls.slice(0, -1).map(stripComputed));
      const rebuilt = rebuildInningsFromBalls(inn, newBalls);
      const newInnings = [...state.innings];
      newInnings[state.currentInningsIdx] = { ...inn, balls: newBalls, ...rebuilt };
      return { ...state, innings: newInnings };
    }
    case "EDIT_BALL": {
      const inn = state.innings[state.currentInningsIdx];
      const updated = inn.balls.map((b) =>
        b.id === action.ballId ? { ...b, ...action.patch } : b,
      );
      const newBalls = recomputeOverIndices(updated.map(stripComputed));
      const rebuilt = rebuildInningsFromBalls(inn, newBalls);
      const newInnings = [...state.innings];
      newInnings[state.currentInningsIdx] = { ...inn, balls: newBalls, ...rebuilt };
      return { ...state, innings: newInnings };
    }
    case "DELETE_BALL": {
      const inn = state.innings[state.currentInningsIdx];
      const filtered = inn.balls.filter((b) => b.id !== action.ballId);
      const newBalls = recomputeOverIndices(filtered.map(stripComputed));
      const rebuilt = rebuildInningsFromBalls(inn, newBalls);
      const newInnings = [...state.innings];
      newInnings[state.currentInningsIdx] = { ...inn, balls: newBalls, ...rebuilt };
      return { ...state, innings: newInnings };
    }
    case "FINISH_OVER": {
      const inn = state.innings[state.currentInningsIdx];
      const newInnings = [...state.innings];
      newInnings[state.currentInningsIdx] = { ...inn, bowlerId: action.nextBowlerId };
      return { ...state, innings: newInnings };
    }
    case "REPLACE_BATTER": {
      const inn = state.innings[state.currentInningsIdx];
      const newInnings = [...state.innings];
      const patch: Partial<typeof inn> = {};
      if (inn.strikerId === action.outId) patch.strikerId = action.newBatterId;
      else if (inn.nonStrikerId === action.outId) patch.nonStrikerId = action.newBatterId;
      newInnings[state.currentInningsIdx] = { ...inn, ...patch };
      return { ...state, innings: newInnings };
    }
    case "SWAP_STRIKE": {
      const inn = state.innings[state.currentInningsIdx];
      const newInnings = [...state.innings];
      newInnings[state.currentInningsIdx] = {
        ...inn,
        strikerId: inn.nonStrikerId,
        nonStrikerId: inn.strikerId,
      };
      return { ...state, innings: newInnings };
    }
    case "END_INNINGS": {
      const inn = state.innings[state.currentInningsIdx];
      const newInnings = [...state.innings];
      newInnings[state.currentInningsIdx] = { ...inn, ended: true };
      // if this was second innings, end match
      if (state.currentInningsIdx === 1) {
        return { ...state, innings: newInnings, ended: true, phase: "summary" };
      }
      return { ...state, innings: newInnings };
    }
    case "START_SECOND_INNINGS": {
      const first = state.innings[0];
      const battingTeamIdx: 0 | 1 = first.bowlingTeamIdx;
      const bowlingTeamIdx: 0 | 1 = first.battingTeamIdx;
      return {
        ...state,
        currentInningsIdx: 1,
        innings: [
          state.innings[0],
          {
            battingTeamIdx,
            bowlingTeamIdx,
            balls: [],
            strikerId: action.strikerId,
            nonStrikerId: action.nonStrikerId,
            bowlerId: action.bowlerId,
            ended: false,
            outPlayers: [],
          },
        ],
      };
    }
    case "END_MATCH":
      return { ...state, ended: true, phase: "summary" };
    case "SET_MATCH_SAVED":
      return { ...state, matchSaved: true };
    case "RESTORE_SNAPSHOT":
      return {
        ...state,
        ...action.snapshot,
      };
    default:
      return state;
  }
}

function stripComputed(b: Ball): Omit<Ball, "overIdx" | "legalBallInOver"> {
  const { overIdx: _o, legalBallInOver: _l, ...rest } = b;
  return rest;
}

const Ctx = createContext<{
  state: MatchState;
  dispatch: React.Dispatch<Action>;
} | null>(null);

export function CricketProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        phase?: MatchState["phase"];
        teams?: MatchState["teams"];
        overs?: number;
        bowlerLimit?: number;
        tossWinnerIdx?: 0 | 1;
        decision?: "bat" | "bowl";
        innings?: MatchState["innings"];
        currentInningsIdx?: 0 | 1;
        ended?: boolean;
        matchSaved?: boolean;
      };

      if (!parsed || parsed.phase === undefined) return;

      dispatch({
        type: "RESTORE_SNAPSHOT",
        snapshot: {
          phase: parsed.phase,
          teams: parsed.teams ?? initial.teams,
          overs: parsed.overs ?? initial.overs,
          bowlerLimit: parsed.bowlerLimit ?? initial.bowlerLimit,
          tossWinnerIdx: parsed.tossWinnerIdx ?? initial.tossWinnerIdx,
          decision: parsed.decision ?? initial.decision,
          innings: parsed.innings ?? initial.innings,
          currentInningsIdx: parsed.currentInningsIdx ?? initial.currentInningsIdx,
          ended: parsed.ended ?? initial.ended,
          matchSaved: parsed.matchSaved ?? initial.matchSaved,
        },
      });
    } catch {
      // ignore malformed snapshots
    }
  }, []);

  useEffect(() => {
    const auth = getAuth();
    if (auth && auth.user) {
      dispatch({ type: "LOGIN", user: auth.user });
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const snapshot = {
      phase: state.phase,
      teams: state.teams,
      overs: state.overs,
      bowlerLimit: state.bowlerLimit,
      tossWinnerIdx: state.tossWinnerIdx,
      decision: state.decision,
      innings: state.innings,
      currentInningsIdx: state.currentInningsIdx,
      ended: state.ended,
      authUser: state.authUser,
      matchSaved: state.matchSaved,
    };

    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
        const hasPlayers = state.teams.some((team) => team.players.length > 0);
        if (hasPlayers) {
          window.localStorage.setItem(
            LAST_TEAMS_KEY,
            JSON.stringify({
              teams: state.teams,
              overs: state.overs,
              bowlerLimit: state.bowlerLimit,
            }),
          );
        }
      } catch {
        // ignore storage write errors
      }

      const syncLiveMatch = async () => {
        try {
          if (state.phase === "live" && state.innings.length > 0) {
            await fetch(`${API_BASE}/api/matches/live`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(snapshot),
            });
          } else {
            await fetch(`${API_BASE}/api/matches/live`, { method: "DELETE" });
          }
        } catch {
          // ignore sync errors
        }
      };

      void syncLiveMatch();
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    state.phase,
    state.teams,
    state.overs,
    state.bowlerLimit,
    state.tossWinnerIdx,
    state.decision,
    state.innings,
    state.currentInningsIdx,
    state.ended,
    state.authUser,
    state.matchSaved,
  ]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCricket() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCricket must be used within CricketProvider");
  return c;
}

export { inningsTotals };
