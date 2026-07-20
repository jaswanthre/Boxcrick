export type Player = { id: string; name: string };
export type Team = { name: string; players: Player[] };

export type DismissalType =
  | "Bowled"
  | "Caught"
  | "Run Out"
  | "Stumping"
  | "Retired Hurt";

export type Ball = {
  id: string;
  runs: number; // runs off bat (or run extras for wides/no-balls, we treat runs as total runs added except that a wide/no-ball automatically adds 1)
  extra?: "wide" | "noball";
  runOutAt?: 1 | 2;
  isWicket?: boolean;
  dismissalType?: DismissalType;
  batterOutId?: string; // for run outs may be non-striker
  fielderName?: string;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  overIdx: number; // 0-based
  legalBallInOver: number; // 1..6, or 0 if illegal (wide/no-ball)
};

export type Innings = {
  battingTeamIdx: 0 | 1;
  bowlingTeamIdx: 0 | 1;
  balls: Ball[];
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  ended: boolean;
  outPlayers: string[]; // batter ids that are out (not retired hurt for counting? retired hurt too excluded from crease)
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type MatchState = {
  phase: "home" | "setup" | "live" | "summary";
  teams: [Team, Team];
  overs: number;
  bowlerLimit: number;
  tossWinnerIdx: 0 | 1;
  decision: "bat" | "bowl";
  innings: Innings[];
  currentInningsIdx: 0 | 1;
  ended: boolean;
  authUser: AuthUser | null;
  matchSaved: boolean;
};
