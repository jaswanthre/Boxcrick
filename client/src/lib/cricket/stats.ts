import type { Ball, Innings, MatchState, Player } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function ballRunsTotal(b: Ball): number {
  // wide/no-ball add 1 extra + any runs field represents additional runs
  if (b.extra === "wide" || b.extra === "noball") return 1 + b.runs;
  return b.runs;
}

export function isLegalBall(b: Ball): boolean {
  return !b.extra; // wides & no-balls are illegal
}

export function inningsTotals(innings: Innings) {
  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  for (const b of innings.balls) {
    runs += ballRunsTotal(b);
    if (b.isWicket && b.dismissalType !== "Retired Hurt") wickets++;
    if (isLegalBall(b)) legalBalls++;
  }
  return { runs, wickets, legalBalls };
}

export function oversString(legalBalls: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

export function runRate(runs: number, legalBalls: number): number {
  if (legalBalls === 0) return 0;
  return (runs / legalBalls) * 6;
}

export type BatterStat = {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  status: string;
  out: boolean;
};

export function batterStats(innings: Innings, teamPlayers: Player[]): BatterStat[] {
  const map = new Map<string, BatterStat>();
  const ensure = (id: string) => {
    if (!map.has(id)) {
      map.set(id, {
        playerId: id,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        status: "did not bat",
        out: false,
      });
    }
    return map.get(id)!;
  };

  // seed all who came to crease
  for (const b of innings.balls) {
    ensure(b.strikerId);
    ensure(b.nonStrikerId);
  }
  ensure(innings.strikerId);
  ensure(innings.nonStrikerId);

  for (const b of innings.balls) {
    const s = ensure(b.strikerId);
    if (b.extra === "wide") {
      // no ball faced, no runs to batter
    } else {
      s.balls += 1;
      // runs off bat: b.runs (for no-ball, b.runs is bat runs)
      s.runs += b.runs;
      if (b.runs === 4) s.fours += 1;
      if (b.runs === 6) s.sixes += 1;
    }
    if (b.isWicket) {
      const outId = b.batterOutId ?? b.strikerId;
      const p = ensure(outId);
      p.out = true;
      const name = (id: string) => teamPlayers.find((x) => x.id === id)?.name ?? "";
      const bowler = name(b.bowlerId);
      switch (b.dismissalType) {
        case "Bowled":
          p.status = `b ${bowler}`;
          break;
        case "Caught":
          p.status = `c ${b.fielderName || "fielder"} b ${bowler}`;
          break;
        case "Run Out":
          p.status = `run out${b.fielderName ? ` (${b.fielderName})` : ""}`;
          break;
        case "Stumping":
          p.status = `st ${b.fielderName || "wk"} b ${bowler}`;
          break;
        case "Retired Hurt":
          p.status = `retired hurt`;
          break;
      }
    }
  }

  // remaining crease
  const strikerStat = map.get(innings.strikerId);
  if (strikerStat && !strikerStat.out) strikerStat.status = "not out*";
  const nsStat = map.get(innings.nonStrikerId);
  if (nsStat && !nsStat.out) nsStat.status = "not out";

  // ordering by first appearance
  const order: string[] = [];
  const push = (id: string) => {
    if (!order.includes(id) && map.has(id)) order.push(id);
  };
  for (const b of innings.balls) {
    push(b.strikerId);
    push(b.nonStrikerId);
  }
  push(innings.strikerId);
  push(innings.nonStrikerId);
  return order.map((id) => map.get(id)!).filter(Boolean);
}

export type BowlerStat = {
  playerId: string;
  legalBalls: number;
  runs: number;
  wickets: number;
  maidens: number;
  dots: number;
};

export function bowlerStats(innings: Innings): BowlerStat[] {
  const map = new Map<string, BowlerStat>();
  const ensure = (id: string) => {
    if (!map.has(id)) {
      map.set(id, { playerId: id, legalBalls: 0, runs: 0, wickets: 0, maidens: 0, dots: 0 });
    }
    return map.get(id)!;
  };

  // group by overIdx per bowler for maidens
  const overRuns = new Map<string, Map<number, number>>(); // bowlerId -> over -> runs conceded
  const overLegal = new Map<string, Map<number, number>>();

  for (const b of innings.balls) {
    const s = ensure(b.bowlerId);
    s.runs += ballRunsTotal(b);
    if (isLegalBall(b)) {
      s.legalBalls += 1;
      if (b.runs === 0 && !b.extra) s.dots += 1;
    }
    if (
      b.isWicket &&
      b.dismissalType &&
      ["Bowled", "Caught", "Stumping"].includes(b.dismissalType)
    ) {
      s.wickets += 1;
    }
    if (!overRuns.has(b.bowlerId)) overRuns.set(b.bowlerId, new Map());
    if (!overLegal.has(b.bowlerId)) overLegal.set(b.bowlerId, new Map());
    const or = overRuns.get(b.bowlerId)!;
    or.set(b.overIdx, (or.get(b.overIdx) ?? 0) + ballRunsTotal(b));
    const ol = overLegal.get(b.bowlerId)!;
    if (isLegalBall(b)) ol.set(b.overIdx, (ol.get(b.overIdx) ?? 0) + 1);
  }

  for (const [bid, oMap] of overRuns) {
    const ol = overLegal.get(bid)!;
    let maidens = 0;
    for (const [ov, r] of oMap) {
      if ((ol.get(ov) ?? 0) === 6 && r === 0) maidens += 1;
    }
    map.get(bid)!.maidens = maidens;
  }

  return Array.from(map.values());
}

export function bowlerEconomy(s: { legalBalls: number; runs: number }) {
  if (s.legalBalls === 0) return 0;
  return (s.runs / s.legalBalls) * 6;
}

export function bowlerOversString(s: { legalBalls: number }) {
  return `${Math.floor(s.legalBalls / 6)}.${s.legalBalls % 6}`;
}

export function currentPartnership(innings: Innings) {
  // walk backwards from last wicket
  let runs = 0;
  let balls = 0;
  for (let i = innings.balls.length - 1; i >= 0; i--) {
    const b = innings.balls[i];
    if (b.isWicket && b.dismissalType !== "Retired Hurt") break;
    runs += ballRunsTotal(b);
    if (isLegalBall(b)) balls += 1;
  }
  return { runs, balls };
}

export function lastSixBalls(innings: Innings): Ball[] {
  return innings.balls.slice(-6);
}

export function playerOfTheMatch(state: MatchState): {
  playerId: string;
  teamIdx: 0 | 1;
  score: number;
  reason: string;
  breakdown: string[];
} | null {
  if (!state.ended) return null;
  const winnerIdx = getWinnerIdx(state);

  type Score = { id: string; teamIdx: 0 | 1; score: number; parts: string[] };
  const scores = new Map<string, Score>();

  const add = (id: string, teamIdx: 0 | 1, delta: number, note: string) => {
    if (!scores.has(id)) scores.set(id, { id, teamIdx, score: 0, parts: [] });
    const s = scores.get(id)!;
    s.score += delta;
    if (delta !== 0) s.parts.push(note);
  };

  for (const inn of state.innings) {
    const players = state.teams[inn.battingTeamIdx].players;
    const bat = batterStats(inn, players);
    for (const b of bat) {
      const sr = b.balls > 0 ? (b.runs / b.balls) * 100 : 0;
      const pts = b.runs * 1 + (b.balls >= 10 ? sr * 0.2 : 0);
      if (pts > 0) add(b.playerId, inn.battingTeamIdx, pts, `${b.runs}(${b.balls})`);
    }
    const bowl = bowlerStats(inn);
    for (const bw of bowl) {
      const econ = bowlerEconomy(bw);
      const wktPts = bw.wickets * 20;
      const econPts = bw.legalBalls >= 12 ? Math.max(0, (8 - econ) * 3) : 0;
      const dotPts = bw.dots * 0.5;
      const total = wktPts + econPts + dotPts;
      if (total > 0) add(bw.playerId, inn.bowlingTeamIdx, total, `${bw.wickets}/${bw.runs}`);
    }
    // catches / run outs (fielders — but fielder is by name; approximate by matching to team names)
    for (const b of inn.balls) {
      if (
        b.isWicket &&
        (b.dismissalType === "Caught" ||
          b.dismissalType === "Stumping" ||
          b.dismissalType === "Run Out") &&
        b.fielderName
      ) {
        const fieldingTeam = state.teams[inn.bowlingTeamIdx];
        const fielder = fieldingTeam.players.find(
          (p) => p.name.toLowerCase() === b.fielderName!.toLowerCase(),
        );
        if (fielder)
          add(
            fielder.id,
            inn.bowlingTeamIdx,
            b.dismissalType === "Run Out" ? 8 : 10,
            b.dismissalType,
          );
      }
    }
  }

  // winning team bonus
  if (winnerIdx !== null) {
    for (const s of scores.values()) {
      if (s.teamIdx === winnerIdx) s.score += 10;
    }
  }

  const list = Array.from(scores.values()).sort((a, b) => b.score - a.score);
  if (!list.length) return null;
  const top = list[0];
  const player = state.teams[top.teamIdx].players.find((p) => p.id === top.id);
  return {
    playerId: top.id,
    teamIdx: top.teamIdx,
    score: Math.round(top.score * 10) / 10,
    reason: `${player?.name ?? ""} — ${top.parts.slice(0, 3).join(", ")}`,
    breakdown: top.parts,
  };
}

export function getWinnerIdx(state: MatchState): 0 | 1 | null {
  if (!state.ended || state.innings.length < 2) return null;
  const t1 = inningsTotals(state.innings[0]);
  const t2 = inningsTotals(state.innings[1]);
  if (t2.runs > t1.runs) return state.innings[1].battingTeamIdx;
  if (t1.runs > t2.runs) return state.innings[0].battingTeamIdx;
  return null;
}

export function winningMargin(state: MatchState): string {
  if (!state.ended || state.innings.length < 2) return "";
  const first = state.innings[0];
  const second = state.innings[1];
  const t1 = inningsTotals(first);
  const t2 = inningsTotals(second);
  if (t2.runs > t1.runs) {
    const totalPlayers = state.teams[second.battingTeamIdx].players.length;
    const wicketsLeft = totalPlayers - 1 - t2.wickets;
    return `by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
  }
  if (t1.runs > t2.runs) {
    return `by ${t1.runs - t2.runs} run${t1.runs - t2.runs === 1 ? "" : "s"}`;
  }
  return "Match Tied";
}
