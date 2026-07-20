import { useEffect, useMemo, useState } from "react";
import {
  Undo2, Trash2, Pencil, ChevronRight, Flag, StopCircle, X,
} from "lucide-react";
import { useCricket } from "@/lib/cricket/store";
import type { Ball, DismissalType } from "@/lib/cricket/types";
import {
  batterStats, bowlerEconomy, bowlerOversString, bowlerStats,
  currentPartnership, inningsTotals, isLegalBall, lastSixBalls,
  oversString, runRate,
} from "@/lib/cricket/stats";
import { SearchSelect } from "./SearchSelect";

const DISMISSALS: DismissalType[] = ["Bowled", "Caught", "Run Out", "Stumping", "Retired Hurt"];

export function LiveView() {
  const { state, dispatch } = useCricket();
  const inn = state.innings[state.currentInningsIdx];
  const battingTeam = state.teams[inn.battingTeamIdx];
  const bowlingTeam = state.teams[inn.bowlingTeamIdx];

  const totals = inningsTotals(inn);
  const bowlerLimit = state.bowlerLimit ?? 3;
  const rr = runRate(totals.runs, totals.legalBalls);
  const overStr = oversString(totals.legalBalls);
  const totalBalls = state.overs * 6;
  const ballsRemaining = Math.max(0, totalBalls - totals.legalBalls);
  const totalWickets = battingTeam.players.length - 1;

  const target = state.currentInningsIdx === 1 ? inningsTotals(state.innings[0]).runs + 1 : null;
  const runsNeeded = target !== null ? Math.max(0, target - totals.runs) : null;
  const rrr = target !== null && ballsRemaining > 0 ? (runsNeeded! / ballsRemaining) * 6 : 0;

  const partnership = currentPartnership(inn);

  const playerName = (id: string) => battingTeam.players.find((p) => p.id === id)?.name ?? "—";
  const bowlerName = (id: string) => bowlingTeam.players.find((p) => p.id === id)?.name ?? "—";

  const oversByBowler = useMemo(() => {
    const stats = bowlerStats(inn);
    return stats.reduce((acc, bowler) => ({
      ...acc,
      [bowler.playerId]: Math.floor(bowler.legalBalls / 6),
    }), {} as Record<string, number>);
  }, [inn.balls]);

  const [wicketOpen, setWicketOpen] = useState(false);
  const [pendingBall, setPendingBall] = useState<Partial<Ball> | null>(null);
  const [newBatterOpen, setNewBatterOpen] = useState<{ outId: string } | null>(null);
  const [ignoredNewBatterId, setIgnoredNewBatterId] = useState<string | null>(null);
  const [newBowlerOpen, setNewBowlerOpen] = useState(false);
  const [awaitingNextBowler, setAwaitingNextBowler] = useState(false);
  const [cancelledNewBowler, setCancelledNewBowler] = useState(false);
  const [noBallDialogOpen, setNoBallDialogOpen] = useState(false);
  const [editingBall, setEditingBall] = useState<Ball | null>(null);
  const [newPlayerTeamIdx, setNewPlayerTeamIdx] = useState<0 | 1>(inn.battingTeamIdx);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<{ teamIdx: 0 | 1; id: string; name: string } | null>(null);

  // detect need for new batter (after wicket)
  const needsNewBatter = useMemo(() => {
    // if striker or non-striker is in outPlayers list, need replacement
    const out = inn.outPlayers;
    if (out.includes(inn.strikerId)) return inn.strikerId;
    if (out.includes(inn.nonStrikerId)) return inn.nonStrikerId;
    return null;
  }, [inn]);

  const overComplete = totals.legalBalls > 0 && totals.legalBalls % 6 === 0;
  const inningsShouldEnd =
    totals.legalBalls >= totalBalls ||
    totals.wickets >= totalWickets ||
    (target !== null && totals.runs >= target);
  const lastBall = inn.balls[inn.balls.length - 1];
  const overCompleteNeedsNewBowler = overComplete && lastBall?.bowlerId === inn.bowlerId;

  useEffect(() => {
    if (needsNewBatter && !newBatterOpen && ignoredNewBatterId !== needsNewBatter) {
      setNewBatterOpen({ outId: needsNewBatter });
      setIgnoredNewBatterId(null);
    }
  }, [needsNewBatter, newBatterOpen, ignoredNewBatterId]);

  useEffect(() => {
    if (
      overCompleteNeedsNewBowler &&
      !needsNewBatter &&
      !inningsShouldEnd &&
      !newBowlerOpen &&
      !awaitingNextBowler &&
      !cancelledNewBowler
    ) {
      setNewBowlerOpen(true);
      setAwaitingNextBowler(true);
    }
  }, [overCompleteNeedsNewBowler, needsNewBatter, inningsShouldEnd, newBowlerOpen, awaitingNextBowler, cancelledNewBowler]);

  const addBall = (partial: Omit<Ball, "id" | "overIdx" | "legalBallInOver">) => {
    if (needsNewBatter || inn.ended || inningsShouldEnd || (overComplete && awaitingNextBowler)) return;
    dispatch({ type: "ADD_BALL", ball: partial });
  };

  const scoreRuns = (runs: number, extra?: "wide" | "noball") => {
    addBall({
      runs,
      extra,
      strikerId: inn.strikerId,
      nonStrikerId: inn.nonStrikerId,
      bowlerId: inn.bowlerId,
    });
  };

  const openNoBallDialog = () => {
    if (needsNewBatter || inn.ended || inningsShouldEnd || (overComplete && awaitingNextBowler)) return;
    setNoBallDialogOpen(true);
  };

  const openWicket = () => {
    if (needsNewBatter || inn.ended || inningsShouldEnd || (overComplete && awaitingNextBowler)) return;

    setPendingBall({
      runs: 0,
      strikerId: inn.strikerId,
      nonStrikerId: inn.nonStrikerId,
      bowlerId: inn.bowlerId,
      isWicket: true,
    });
    setWicketOpen(true);
  };

  const availableNewBatters = battingTeam.players.filter(
    (p) => !inn.outPlayers.includes(p.id) && p.id !== inn.strikerId && p.id !== inn.nonStrikerId,
  );

  return (
    <div className="pb-32">
      {/* Sticky Scoreboard */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[oklch(0.12_0.005_260)]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {battingTeam.name} — {state.currentInningsIdx === 0 ? "1st" : "2nd"} innings
              </p>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold gold-text sm:text-6xl">
                  {totals.runs}/{totals.wickets}
                </span>
                <span className="text-lg text-muted-foreground">
                  ({overStr}/{state.overs})
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right text-xs">
              <span className="text-muted-foreground">Run Rate</span>
              <span className="font-semibold">{rr.toFixed(2)}</span>
              {target !== null && (
                <>
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-semibold text-gold">{target}</span>
                  <span className="text-muted-foreground">Need</span>
                  <span className="font-semibold">
                    {runsNeeded} off {ballsRemaining}
                  </span>
                  <span className="text-muted-foreground">Req RR</span>
                  <span className="font-semibold">{rrr.toFixed(2)}</span>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Chip>👤 {playerName(inn.strikerId)} *</Chip>
            <Chip>{playerName(inn.nonStrikerId)}</Chip>
            <Chip>🎯 {bowlerName(inn.bowlerId)}</Chip>
            <Chip>P’ship {partnership.runs}({partnership.balls})</Chip>
          </div>

          {/* Last 6 balls */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">This over</span>
            {lastSixBalls(inn).map((b) => (
              <BallBadge key={b.id} b={b} />
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Prompts */}
        {inningsShouldEnd && !inn.ended && (
          <ActionPrompt
            label={
              target !== null && totals.runs >= target
                ? "Target reached — end innings"
                : totals.wickets >= totalWickets
                ? "All out — end innings"
                : "Overs complete — end innings"
            }
            variant="danger"
            onClick={() => dispatch({ type: "END_INNINGS" })}
          />
        )}

        {/* Ball Entry */}
        <section className="glass-card mb-6 p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Ball Entry
          </h3>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
              <button
                key={r}
                onClick={() => scoreRuns(r)}
                disabled={!!needsNewBatter || inn.ended || inningsShouldEnd || (overComplete && awaitingNextBowler)}
                className={`btn-score h-16 text-2xl ${
                  r === 4 ? "text-gold" : r === 6 ? "text-gold" : ""
                }`}
              >
                {r === 0 ? "•" : r}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              onClick={() => scoreRuns(0, "wide")}
              disabled={!!needsNewBatter || inn.ended || inningsShouldEnd || (overComplete && awaitingNextBowler)}
              className="btn-score h-14 text-sm"
            >
              Wide +1
            </button>
            <button
              onClick={openNoBallDialog}
              disabled={!!needsNewBatter || inn.ended || inningsShouldEnd || (overComplete && awaitingNextBowler)}
              className="btn-score h-14 text-sm"
            >
              No Ball
            </button>
            <button
              onClick={openWicket}
              disabled={!!needsNewBatter || inn.ended || inningsShouldEnd || (overComplete && awaitingNextBowler)}
              className="btn-score h-14 text-sm text-danger"
            >
              Wicket
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <ControlBtn onClick={() => dispatch({ type: "UNDO_BALL" })} icon={<Undo2 className="h-4 w-4" />}>
              Undo Last Ball
            </ControlBtn>
            <ControlBtn onClick={() => dispatch({ type: "SWAP_STRIKE" })}>Swap Strike</ControlBtn>
            {overComplete && (
              <ControlBtn onClick={() => { setNewBowlerOpen(true); setAwaitingNextBowler(true); }} icon={<ChevronRight className="h-4 w-4" />}>
                Finish Over
              </ControlBtn>
            )}
            <ControlBtn
              onClick={() => dispatch({ type: "END_INNINGS" })}
              icon={<Flag className="h-4 w-4" />}
              variant="ghost"
            >
              End Innings
            </ControlBtn>
            <ControlBtn
              onClick={() => dispatch({ type: "END_MATCH" })}
              icon={<StopCircle className="h-4 w-4" />}
              variant="danger"
            >
              End Match
            </ControlBtn>
          </div>
        </section>

        {/* Second innings prompt when first ended */}
        {state.currentInningsIdx === 0 && inn.ended && (
          <StartSecondInnings />
        )}

        {/* Scorecards */}
        <div className="grid gap-6 lg:grid-cols-2">
          <BattingScorecard />
          <BowlingScorecard />
        </div>

        {/* Ball history */}
        <BallHistory onEdit={setEditingBall} />

        <section className="glass-card mb-6 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Live Roster
              </h3>
              <p className="text-xs text-muted-foreground">
                Add or rename players for the current batting or bowling team.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewPlayerTeamIdx(inn.battingTeamIdx)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${newPlayerTeamIdx === inn.battingTeamIdx ? "border-gold/30 bg-gold-soft text-gold" : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"}`}
              >
                {battingTeam.name}
              </button>
              <button
                type="button"
                onClick={() => setNewPlayerTeamIdx(inn.bowlingTeamIdx)}
                className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${newPlayerTeamIdx === inn.bowlingTeamIdx ? "border-gold/30 bg-gold-soft text-gold" : "border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10"}`}
              >
                {bowlingTeam.name}
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Current {battingTeam.name} roster</p>
              {battingTeam.players.length === 0 ? (
                <p className="text-sm text-muted-foreground">No players yet</p>
              ) : (
                <div className="space-y-2">
                  {battingTeam.players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/5 px-3 py-2">
                      <span className="truncate text-sm">{player.name}</span>
                      <button
                        type="button"
                        onClick={() => setEditingPlayer({ teamIdx: inn.battingTeamIdx, id: player.id, name: player.name })}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-white/10"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Current {bowlingTeam.name} roster</p>
              {bowlingTeam.players.length === 0 ? (
                <p className="text-sm text-muted-foreground">No players yet</p>
              ) : (
                <div className="space-y-2">
                  {bowlingTeam.players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/5 px-3 py-2">
                      <span className="truncate text-sm">{player.name}</span>
                      <button
                        type="button"
                        onClick={() => setEditingPlayer({ teamIdx: inn.bowlingTeamIdx, id: player.id, name: player.name })}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-muted-foreground hover:bg-white/10"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = newPlayerName.trim();
              if (!name) return;
              dispatch({ type: "ADD_PLAYER", teamIdx: newPlayerTeamIdx, name });
              setNewPlayerName("");
            }}
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]"
          >
            <input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder={`Add player to ${state.teams[newPlayerTeamIdx].name}`}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-gold/40"
            />
            <button
              type="submit"
              className="rounded-xl bg-gold-soft px-4 py-3 text-sm font-semibold text-gold transition hover:bg-gold/25"
            >
              Add player
            </button>
          </form>
          {editingPlayer && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const name = editingPlayer.name.trim();
                if (!name) return;
                dispatch({ type: "UPDATE_PLAYER", teamIdx: editingPlayer.teamIdx, id: editingPlayer.id, name });
                setEditingPlayer(null);
              }}
              className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <p className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">Rename player</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  value={editingPlayer.name}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-gold/40"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-gold-soft px-4 py-3 text-sm font-semibold text-gold transition hover:bg-gold/25"
                >
                  Save
                </button>
              </div>
              <button
                type="button"
                onClick={() => setEditingPlayer(null)}
                className="mt-3 rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm text-muted-foreground hover:bg-white/5"
              >
                Cancel
              </button>
            </form>
          )}
        </section>
      </div>

      {wicketOpen && pendingBall && (
        <WicketDialog
          onCancel={() => { setWicketOpen(false); setPendingBall(null); }}
          onConfirm={(ball) => {
            dispatch({ type: "ADD_BALL", ball });
            setWicketOpen(false);
            setPendingBall(null);
          }}
        />
      )}
      {noBallDialogOpen && (
        <NoBallDialog
          onCancel={() => setNoBallDialogOpen(false)}
          onConfirm={(ball) => {
            dispatch({
              type: "ADD_BALL",
              ball: {
                ...ball,
                extra: "noball",
                strikerId: inn.strikerId,
                nonStrikerId: inn.nonStrikerId,
                bowlerId: inn.bowlerId,
              },
            });
            setNoBallDialogOpen(false);
          }}
        />
      )}
      {newBatterOpen && (
        <NewBatterDialog
          outId={newBatterOpen.outId}
          options={availableNewBatters.map((p) => ({ value: p.id, label: p.name }))}
          onCancel={() => {
            setIgnoredNewBatterId(newBatterOpen.outId);
            setNewBatterOpen(null);
          }}
          onConfirm={(newId) => {
            dispatch({ type: "REPLACE_BATTER", outId: newBatterOpen.outId, newBatterId: newId });
            setNewBatterOpen(null);
            setIgnoredNewBatterId(null);
          }}
        />
      )}
      {newBowlerOpen && (
        <NewBowlerDialog
          options={bowlingTeam.players
            .filter((p) => p.id !== inn.bowlerId)
            .filter((p) => (oversByBowler[p.id] ?? 0) < bowlerLimit)
            .map((p) => ({
              value: p.id,
              label: `${p.name} (${oversByBowler[p.id] ?? 0}/${bowlerLimit} overs)`,
            }))}
          onCancel={() => {
            setNewBowlerOpen(false);
            setAwaitingNextBowler(false);
            setCancelledNewBowler(true);
          }}
          onConfirm={(id) => {
            dispatch({ type: "FINISH_OVER", nextBowlerId: id });
            setNewBowlerOpen(false);
            setAwaitingNextBowler(false);
            setCancelledNewBowler(false);
          }}
        />
      )}
      {editingBall && (
        <EditBallDialog
          ball={editingBall}
          onCancel={() => setEditingBall(null)}
          onSave={(patch) => {
            dispatch({ type: "EDIT_BALL", ballId: editingBall.id, patch });
            setEditingBall(null);
          }}
          onDelete={() => {
            dispatch({ type: "DELETE_BALL", ballId: editingBall.id });
            setEditingBall(null);
          }}
        />
      )}
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

function ControlBtn({
  onClick, children, icon, variant = "default",
}: {
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "default" | "danger" | "ghost";
}) {
  const cls =
    variant === "danger"
      ? "border-danger/20 bg-danger/10 text-danger hover:bg-danger/20"
      : variant === "ghost"
      ? "border-white/10 bg-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground"
      : "border-white/10 bg-white/5 hover:bg-white/10";
  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${cls}`}>
      {icon}
      {children}
    </button>
  );
}

function ActionPrompt({
  label, onClick, variant = "gold",
}: {
  label: string;
  onClick: () => void;
  variant?: "gold" | "danger";
}) {
  const cls =
    variant === "danger"
      ? "border-danger/30 bg-danger/10 text-danger"
      : "border-gold/30 bg-gold-soft text-gold";
  return (
    <div className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${cls}`}>
      <span className="text-sm font-medium">{label}</span>
      <button onClick={onClick} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition hover:bg-white/20">
        Continue
      </button>
    </div>
  );
}

function BallBadge({ b }: { b: Ball }) {
  let label = "";
  let cls = "bg-white/5 text-foreground";
  if (b.isWicket) { label = "W"; cls = "bg-danger/20 text-danger"; }
  else if (b.extra === "wide") { label = `Wd${b.runs ? `+${b.runs}` : ""}`; cls = "bg-white/10 text-muted-foreground"; }
  else if (b.extra === "noball") { label = `Nb${b.runs ? `+${b.runs}` : ""}`; cls = "bg-white/10 text-muted-foreground"; }
  else if (b.runs === 0) { label = "•"; }
  else if (b.runs === 4 || b.runs === 6) { label = String(b.runs); cls = "bg-gold-soft text-gold"; }
  else label = String(b.runs);
  return (
    <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

function BattingScorecard() {
  const { state } = useCricket();
  const inn = state.innings[state.currentInningsIdx];
  const team = state.teams[inn.battingTeamIdx];
  const rows = batterStats(inn, team.players);
  const nameOf = (id: string) => team.players.find((p) => p.id === id)?.name ?? "";

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
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-4 text-center text-muted-foreground">No batters yet</td></tr>
            )}
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
                <td className="px-2 py-2 text-right">{r.balls ? ((r.runs / r.balls) * 100).toFixed(1) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BowlingScorecard() {
  const { state } = useCricket();
  const inn = state.innings[state.currentInningsIdx];
  const bowlTeam = state.teams[inn.bowlingTeamIdx];
  const rows = bowlerStats(inn);
  const nameOf = (id: string) => bowlTeam.players.find((p) => p.id === id)?.name ?? "";
  return (
    <section className="glass-card overflow-hidden">
      <div className="border-b border-white/10 px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Bowling — {bowlTeam.name}
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
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-4 text-center text-muted-foreground">No bowling yet</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.playerId} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2 font-medium">{nameOf(r.playerId)}</td>
                <td className="px-2 py-2 text-right">{bowlerOversString(r)}</td>
                <td className="px-2 py-2 text-right">{r.runs}</td>
                <td className="px-2 py-2 text-right font-semibold text-gold">{r.wickets}</td>
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

function BallHistory({ onEdit }: { onEdit: (b: Ball) => void }) {
  const { state, dispatch } = useCricket();
  const inn = state.innings[state.currentInningsIdx];
  const balls = inn.balls;
  const label = (b: Ball) => {
    if (b.isWicket) return "W";
    if (b.extra === "wide") return `Wd${b.runs ? `+${b.runs}` : ""}`;
    if (b.extra === "noball") return `Nb${b.runs ? `+${b.runs}` : ""}`;
    if (b.runs === 0) return "•";
    return String(b.runs);
  };
  const num = (b: Ball, idx: number) => {
    // running ball number in over
    let over = 0;
    let ballNo = 0;
    for (let i = 0; i <= idx; i++) {
      const x = balls[i];
      if (isLegalBall(x)) {
        ballNo += 1;
        if (ballNo === 7) { over += 1; ballNo = 1; }
      } else {
        // illegal
      }
    }
    // simpler: use overIdx + legalBallInOver, but illegal has 0
    return `${b.overIdx}.${b.legalBallInOver || "+"}`;
  };

  return (
    <section className="glass-card mt-6 overflow-hidden">
      <div className="border-b border-white/10 px-5 py-3">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Ball History
        </h3>
      </div>
      <div className="max-h-72 overflow-auto p-4">
        {balls.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">No balls bowled yet</p>
        )}
        <div className="space-y-1">
          {balls.map((b, i) => (
            <div key={b.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5">
              <span className="w-12 text-xs font-mono text-muted-foreground">{num(b, i)}</span>
              <BallBadge b={b} />
              <span className="flex-1 truncate text-xs text-muted-foreground">
                {b.extra
                  ? b.extra === "wide"
                    ? "wide"
                    : b.isWicket && b.dismissalType === "Run Out"
                    ? `no ball${b.runs ? ` +${b.runs}` : ""} run out${b.runOutAt ? ` (${b.runOutAt}${b.runOutAt === 1 ? "st" : "nd"} run)` : ""}`
                    : `no ball${b.runs ? ` +${b.runs}` : ""}`
                  : b.isWicket
                  ? b.dismissalType
                  : `${b.runs} run${b.runs === 1 ? "" : "s"}`}
              </span>
              <button onClick={() => onEdit(b)} className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => dispatch({ type: "DELETE_BALL", ballId: b.id })} className="rounded p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-danger">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StartSecondInnings() {
  const { state, dispatch } = useCricket();
  const first = state.innings[0];
  const battingIdx: 0 | 1 = first.bowlingTeamIdx;
  const bowlingIdx: 0 | 1 = first.battingTeamIdx;
  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");
  const batting = state.teams[battingIdx];
  const bowling = state.teams[bowlingIdx];

  useEffect(() => {
    setStrikerId("");
    setNonStrikerId("");
    setBowlerId("");
  }, [battingIdx, bowlingIdx]);

  const battingOptions = batting.players.map((p) => ({ value: p.id, label: p.name }));
  const nonStrikerOptions = battingOptions.filter((o) => o.value !== strikerId);
  const bowlingOptions = bowling.players.map((p) => ({ value: p.id, label: p.name }));
  const can = strikerId && nonStrikerId && bowlerId && strikerId !== nonStrikerId;

  return (
    <section className="glass-card mb-6 p-6 overflow-visible">
      <h3 className="mb-2 text-lg font-semibold gold-text">Innings Break</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Target for {batting.name}: <b className="text-foreground">{inningsTotals(first).runs + 1}</b> in {state.overs} overs
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <SearchSelect
          value={strikerId}
          onChange={setStrikerId}
          placeholder={`Opening striker — ${batting.name}`}
          options={battingOptions}
          modal
        />
        <SearchSelect
          value={nonStrikerId}
          onChange={setNonStrikerId}
          placeholder={`Opening non-striker — ${batting.name}`}
          options={nonStrikerOptions}
          modal
        />
        <SearchSelect
          value={bowlerId}
          onChange={setBowlerId}
          placeholder={`Opening bowler — ${bowling.name}`}
          options={bowlingOptions}
          modal
        />
      </div>
      <button
        disabled={!can}
        onClick={() => dispatch({ type: "START_SECOND_INNINGS", strikerId, nonStrikerId, bowlerId })}
        className="mt-4 rounded-xl bg-gradient-to-br from-gold to-[oklch(0.72_0.16_70)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-gold/20 transition hover:brightness-110 disabled:opacity-40"
      >
        Start 2nd Innings
      </button>
    </section>
  );
}

/* ---------------- Dialogs ---------------- */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-white/10 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function WicketDialog({
  onCancel, onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (b: Omit<Ball, "id" | "overIdx" | "legalBallInOver">) => void;
}) {
  const { state } = useCricket();
  const inn = state.innings[state.currentInningsIdx];
  const battingTeam = state.teams[inn.battingTeamIdx];
  const bowlingTeam = state.teams[inn.bowlingTeamIdx];
  const [dismissal, setDismissal] = useState<DismissalType>("Bowled");
  const [runs, setRuns] = useState(0);
  const [batterOutId, setBatterOutId] = useState(inn.strikerId);
  const [fielderName, setFielderName] = useState("");

  const needsFielder = dismissal === "Caught" || dismissal === "Run Out" || dismissal === "Stumping";

  return (
    <Modal title="Wicket" onClose={onCancel}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Dismissal type</p>
          <div className="grid grid-cols-2 gap-2">
            {DISMISSALS.map((d) => (
              <button key={d} onClick={() => setDismissal(d)}
                className={`rounded-lg border px-3 py-2 text-sm ${dismissal === d
                  ? "border-gold/40 bg-gold-soft text-gold"
                  : "border-white/10 bg-white/5 hover:bg-white/10"}`}>{d}</button>
            ))}
          </div>
        </div>
        {dismissal === "Run Out" && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Batter out</p>
            <SearchSelect
              value={batterOutId}
              onChange={setBatterOutId}
              options={[inn.strikerId, inn.nonStrikerId].map((id) => ({
                value: id,
                label: battingTeam.players.find((p) => p.id === id)?.name ?? "",
              }))}
            />
            <p className="mb-2 mt-3 text-xs uppercase tracking-wider text-muted-foreground">Runs completed</p>
            <input
              type="number" min={0} value={runs}
              onChange={(e) => setRuns(Math.max(0, Number(e.target.value) || 0))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-gold/40"
            />
          </div>
        )}
        {needsFielder && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Fielder</p>
            <SearchSelect
              value={fielderName}
              onChange={setFielderName}
              options={bowlingTeam.players.map((p) => ({ value: p.name, label: p.name }))}
              placeholder="Select fielder"
              portal
            />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Cancel</button>
          <button
            onClick={() =>
              onConfirm({
                runs: dismissal === "Run Out" ? runs : 0,
                isWicket: true,
                dismissalType: dismissal,
                batterOutId: dismissal === "Run Out" ? batterOutId : inn.strikerId,
                fielderName: needsFielder ? fielderName : undefined,
                strikerId: inn.strikerId,
                nonStrikerId: inn.nonStrikerId,
                bowlerId: inn.bowlerId,
              })
            }
            className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-danger-foreground hover:brightness-110"
          >
            Confirm Wicket
          </button>
        </div>
      </div>
    </Modal>
  );
}

function NewBatterDialog({
  options, onCancel, onConfirm,
}: {
  options: { value: string; label: string }[];
  outId: string;
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  const [id, setId] = useState("");
  return (
    <Modal title="Next Batter" onClose={onCancel}>
      <SearchSelect value={id} onChange={setId} options={options} placeholder="Select batter" portal />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Cancel</button>
        <button disabled={!id} onClick={() => onConfirm(id)}
          className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40 hover:brightness-110">Confirm</button>
      </div>
    </Modal>
  );
}

function NewBowlerDialog({
  options, onCancel, onConfirm,
}: {
  options: { value: string; label: string }[];
  onCancel: () => void;
  onConfirm: (id: string) => void;
}) {
  return (
    <Modal title="Choose Next Bowler" onClose={onCancel}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Select a bowler to continue the innings.</p>
        <div className="grid gap-2">
          {options.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
              No available bowlers left.
            </div>
          ) : options.map((option) => (
            <button
              key={option.value}
              onClick={() => onConfirm(option.value)}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium transition hover:bg-white/10"
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

function NoBallDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (ball: Omit<Ball, "id" | "overIdx" | "legalBallInOver" | "strikerId" | "nonStrikerId" | "bowlerId">) => void;
}) {
  const { state } = useCricket();
  const inn = state.innings[state.currentInningsIdx];
  const battingTeam = state.teams[inn.battingTeamIdx];
  const bowlingTeam = state.teams[inn.bowlingTeamIdx];
  const [runs, setRuns] = useState(0);
  const [isWicket, setIsWicket] = useState(false);
  const [dismissal, setDismissal] = useState<"Run Out" | "Stumping">("Stumping");
  const [runOutAt, setRunOutAt] = useState<1 | 2>(1);
  const [batterOutId, setBatterOutId] = useState(inn.strikerId);
  const [fielderName, setFielderName] = useState("");

  const noBallDismissals: Array<"Run Out" | "Stumping"> = ["Run Out", "Stumping"];
  const needsFielder = dismissal === "Run Out";

  const canConfirm = !isWicket || dismissal !== "Run Out" || !!batterOutId;

  return (
    <Modal title="No Ball" onClose={onCancel}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Runs off no-ball</p>
          <div className="grid grid-cols-7 gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((value) => (
              <button
                key={value}
                onClick={() => setRuns(value)}
                className={`rounded-lg py-2 text-sm ${runs === value ? "bg-gold-soft text-gold" : "bg-white/5 hover:bg-white/10"}`}>
                {value === 0 ? "•" : value}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isWicket} onChange={(e) => setIsWicket(e.target.checked)} />
          Wicket?
        </label>
        {isWicket && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Dismissal type</p>
              <div className="grid grid-cols-2 gap-2">
                {noBallDismissals.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDismissal(d)}
                    className={`rounded-lg border px-3 py-2 text-sm ${dismissal === d
                      ? "border-gold/40 bg-gold-soft text-gold"
                      : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            {dismissal === "Run Out" && (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Run out on</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[1, 2].map((value) => (
                      <button
                        key={value}
                        onClick={() => setRunOutAt(value as 1 | 2)}
                        className={`rounded-lg py-2 text-sm ${runOutAt === value ? "bg-gold-soft text-gold" : "bg-white/5 hover:bg-white/10"}`}>
                        {value === 1 ? "1st run" : "2nd run"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Batter out</p>
                  <SearchSelect
                    value={batterOutId}
                    onChange={setBatterOutId}
                    options={[inn.strikerId, inn.nonStrikerId].map((id) => ({
                      value: id,
                      label: battingTeam.players.find((p) => p.id === id)?.name ?? "",
                    }))}
                    portal
                  />
                </div>
                {needsFielder && (
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Fielder</p>
                    <SearchSelect
                      value={fielderName}
                      onChange={setFielderName}
                      options={bowlingTeam.players.map((p) => ({ value: p.name, label: p.name }))}
                      placeholder="Select fielder"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Cancel</button>
          <button
            disabled={!canConfirm}
            onClick={() => onConfirm({
              runs,
              isWicket: isWicket || undefined,
              dismissalType: isWicket ? dismissal : undefined,
              runOutAt: isWicket && dismissal === "Run Out" ? runOutAt : undefined,
              batterOutId: isWicket && dismissal === "Run Out" ? batterOutId : undefined,
              fielderName: needsFielder ? fielderName : undefined,
            })}
            className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40 hover:brightness-110"
          >
            Confirm
          </button>
        </div>
      </div>
    </Modal>
  );
}

function EditBallDialog({
  ball, onCancel, onSave, onDelete,
}: {
  ball: Ball;
  onCancel: () => void;
  onSave: (patch: Partial<Ball>) => void;
  onDelete: () => void;
}) {
  const [runs, setRuns] = useState(ball.runs);
  const [extra, setExtra] = useState<Ball["extra"] | undefined>(ball.extra);
  const [isWicket, setIsWicket] = useState(!!ball.isWicket);
  return (
    <Modal title={`Edit Ball ${ball.overIdx}.${ball.legalBallInOver || "+"}`} onClose={onCancel}>
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Runs</p>
          <div className="grid grid-cols-7 gap-1">
            {[0, 1, 2, 3, 4, 5, 6].map((r) => (
              <button key={r} onClick={() => setRuns(r)}
                className={`rounded-lg py-2 text-sm ${runs === r ? "bg-gold-soft text-gold" : "bg-white/5 hover:bg-white/10"}`}>
                {r === 0 ? "•" : r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Extra</p>
          <div className="grid grid-cols-3 gap-2">
            {([undefined, "wide", "noball"] as const).map((e) => (
              <button key={String(e)} onClick={() => setExtra(e)}
                className={`rounded-lg py-2 text-sm capitalize ${extra === e ? "bg-gold-soft text-gold" : "bg-white/5 hover:bg-white/10"}`}>
                {e ? (e === "wide" ? "Wide" : "No Ball") : "None"}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isWicket} onChange={(e) => setIsWicket(e.target.checked)} />
          Wicket
        </label>
        <div className="flex justify-between gap-2 pt-2">
          <button onClick={onDelete} className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/20">
            Delete
          </button>
          <div className="flex gap-2">
            <button onClick={onCancel} className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5">Cancel</button>
            <button
              onClick={() => onSave({ runs, extra, isWicket })}
              className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
