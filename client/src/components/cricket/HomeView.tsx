import { useState, useEffect } from "react";
import { getAuth, clearAuth } from "@/lib/auth";
import { Plus, Trash2, Pencil, Check, X, Users, Play, RotateCcw, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCricket } from "@/lib/cricket/store";
import type { Team } from "@/lib/cricket/types";

function TeamCard({ teamIdx }: { teamIdx: 0 | 1 }) {
  const { state, dispatch } = useCricket();
  const team: Team = state.teams[teamIdx];
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  return (
    <div className="glass-card p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold">
          <Users className="h-5 w-5" />
        </div>
        <input
          value={team.name}
          onChange={(e) => dispatch({ type: "SET_TEAM_NAME", teamIdx, name: e.target.value })}
          className="flex-1 min-w-0 rounded-lg bg-transparent px-2 py-1 text-lg font-semibold outline-none focus:bg-white/5"
        />
        <span className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs text-muted-foreground">
          {team.players.length} players
        </span>
      </div>

      <div className="space-y-2">
        {team.players.map((p, i) => (
          <div key={p.id} className="group flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
            <span className="w-6 text-xs text-muted-foreground">{i + 1}.</span>
            {editingId === p.id ? (
              <>
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="flex-1 min-w-0 rounded bg-white/5 px-2 py-1 text-sm outline-none"
                />
                <button
                  onClick={() => {
                    dispatch({ type: "UPDATE_PLAYER", teamIdx, id: p.id, name: editingName.trim() || p.name });
                    setEditingId(null);
                  }}
                  className="rounded p-1.5 text-success hover:bg-white/10"
                ><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditingId(null)} className="rounded p-1.5 text-muted-foreground hover:bg-white/10">
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 min-w-0 truncate text-sm">{p.name}</span>
                <button
                  onClick={() => { setEditingId(p.id); setEditingName(p.name); }}
                  className="rounded p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-foreground"
                ><Pencil className="h-4 w-4" /></button>
                <button
                  onClick={() => dispatch({ type: "DELETE_PLAYER", teamIdx, id: p.id })}
                  className="rounded p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-white/10 hover:text-danger"
                ><Trash2 className="h-4 w-4" /></button>
              </>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          dispatch({ type: "ADD_PLAYER", teamIdx, name: newName.trim() });
          setNewName("");
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Player name"
          className="flex-1 min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-gold/40"
        />
        <button
          type="submit"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gold-soft px-3 py-2 text-sm font-medium text-gold transition hover:bg-gold/25"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>
    </div>
  );
}

export function HomeView() {
  const { state, dispatch } = useCricket();
  const canStart =
    state.teams[0].players.length >= 2 && state.teams[1].players.length >= 2;
  const [isVisitor, setIsVisitor] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    setIsVisitor(Boolean(auth && auth.user && auth.user.id === 'visitor'));
  }, []);

  const [isFlipping, setIsFlipping] = useState(false);
  const [tossResultLabel, setTossResultLabel] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold-soft px-4 py-1.5 text-xs font-medium text-gold">
          <Sparkles className="h-3.5 w-3.5" /> Fast local match scoring
        </div>
        <h1 className="text-4xl font-bold sm:text-5xl">
          <span className="gold-text">CricLive</span> Scoreboard
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Create a match, add your players, and start scoring in seconds.
        </p>
      </div>

      <div className="glass-card p-6 sm:p-8">
        <h2 className="mb-6 text-xl font-semibold">Create Match</h2>
        <div className="grid gap-5 md:grid-cols-2">
          <TeamCard teamIdx={0} />
          <TeamCard teamIdx={1} />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {canStart ? "Ready to set up your match." : "Add at least 2 players per team to continue."}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`coin ${isFlipping ? 'flipping' : ''}`}
                role="img"
                aria-label={tossResultLabel ? `Toss: ${tossResultLabel}` : 'Coin'}
                style={{ width: 44, height: 44 }}
              >
                <div className="coin-face coin-heads">H</div>
                <div className="coin-face coin-tails">T</div>
              </div>
              <div className="text-sm text-muted-foreground">
                {tossResultLabel ? <span>Result: <strong className="ml-1">{tossResultLabel}</strong></span> : <span>Flip to decide toss</span>}
              </div>
              <button
                disabled={isFlipping}
                onClick={async () => {
                  if (isFlipping) return;
                  setIsFlipping(true);
                  setTossResultLabel(null);
                  await new Promise((res) => setTimeout(res, 1200));
                  let head = false;
                  try {
                    const arr = new Uint32Array(1);
                    crypto.getRandomValues(arr);
                    head = (arr[0] / 0xffffffff) < 0.5;
                  } catch (e) {
                    head = Math.random() < 0.5;
                  }
                  const label = head ? 'Heads' : 'Tails';
                  setTossResultLabel(label);
                  dispatch({ type: 'SET_TOSS', tossWinnerIdx: head ? 0 : 1, decision: 'bat' });
                  setIsFlipping(false);
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium hover:bg-white/10 disabled:opacity-40"
              >
                Toss Coin
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => dispatch({ type: "RESET_HOME" })}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </button>
              <button
                disabled={!canStart}
                onClick={() => dispatch({ type: "GOTO_SETUP" })}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-gold to-[oklch(0.72_0.16_70)] px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-gold/20 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
              >
                <Play className="h-4 w-4" /> Start Match
              </button>
              <Link
                to="/history"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-white/10"
              >
                History
              </Link>
              {!isVisitor ? (
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-white/10"
                >
                  Visitor
                </Link>
              ) : (
                <button
                  onClick={() => {
                    clearAuth();
                    setIsVisitor(false);
                    window.location.href = '/';
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-white/10"
                >
                  Visitor Logout
                </button>
              )}
            </div>
          </div>
        </div>
        <style>{`
          .coin { position: relative; perspective: 800px; display: inline-block; }
          .coin .coin-face { position: absolute; inset: 0; display:flex;align-items:center;justify-content:center;border-radius:9999px;background:linear-gradient(180deg,#f6c85f,#c6881f);color:#111;font-weight:700; }
          .coin .coin-tails { transform: rotateY(180deg); background:linear-gradient(180deg,#fff,#ddd); }
          .coin.flipping { animation: coinFlip 1.2s cubic-bezier(.2,.9,.2,1); }
          @keyframes coinFlip { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(1080deg); } }
        `}</style>
      </div>
    </div>
  );
}
