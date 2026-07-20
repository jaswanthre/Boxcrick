import { useMemo, useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { useCricket } from "@/lib/cricket/store";
import { SearchSelect } from "./SearchSelect";

export function SetupView() {
  const { state, dispatch } = useCricket();
  const [tossWinner, setTossWinner] = useState<0 | 1>(0);
  const [decision, setDecision] = useState<"bat" | "bowl">("bat");
  const [isFlipping, setIsFlipping] = useState(false);
  const [tossResultLabel, setTossResultLabel] = useState<string | null>(null);
  const [overs, setOvers] = useState(state.overs || 6);
  const [bowlerLimit, setBowlerLimit] = useState(state.bowlerLimit || 3);
  const [strikerId, setStrikerId] = useState("");
  const [nonStrikerId, setNonStrikerId] = useState("");
  const [bowlerId, setBowlerId] = useState("");

  const battingIdx: 0 | 1 = useMemo(() => {
    return decision === "bat" ? tossWinner : (tossWinner === 0 ? 1 : 0);
  }, [tossWinner, decision]);
  const bowlingIdx: 0 | 1 = battingIdx === 0 ? 1 : 0;

  const battingTeam = state.teams[battingIdx];
  const bowlingTeam = state.teams[bowlingIdx];

  const batterOptions = battingTeam.players.map((p) => ({ value: p.id, label: p.name }));
  const nonStrikerOptions = batterOptions.filter((o) => o.value !== strikerId);
  const bowlerOptions = bowlingTeam.players.map((p) => ({ value: p.id, label: p.name }));

  const canStart = strikerId && nonStrikerId && bowlerId && strikerId !== nonStrikerId && overs > 0;

  const start = () => {
    dispatch({ type: "SET_TOSS", tossWinnerIdx: tossWinner, decision });
    dispatch({ type: "SET_OVERS", overs });
    dispatch({ type: "SET_BOWLER_LIMIT", bowlerLimit });
    dispatch({ type: "START_MATCH", strikerId, nonStrikerId, bowlerId });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button
        onClick={() => dispatch({ type: "RESET_HOME" })}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="glass-card p-6 sm:p-8">
        <h2 className="mb-1 text-2xl font-bold">Match Setup</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {state.teams[0].name} vs {state.teams[1].name}
        </p>

        <div className="space-y-6">
          <Field label="Toss Winner">
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((i) => (
                <button
                  key={i}
                  onClick={() => setTossWinner(i as 0 | 1)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${
                    tossWinner === i
                      ? "border-gold/50 bg-gold-soft text-gold"
                      : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
                  }`}
                >
                  {state.teams[i].name}
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`coin ${isFlipping ? 'flipping' : ''}`}
                  role="img"
                  aria-label={tossResultLabel ? `Toss: ${tossResultLabel}` : 'Coin'}
                  style={{ width: 48, height: 48 }}
                >
                  <div className="coin-face coin-heads">H</div>
                  <div className="coin-face coin-tails">T</div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {tossResultLabel ? <span>Result: <strong className="ml-1">{tossResultLabel}</strong></span> : <span>Flip to decide toss</span>}
                </div>
              </div>
              <div>
                <button
                  type="button"
                  disabled={isFlipping}
                  onClick={async () => {
                    if (isFlipping) return;
                    setIsFlipping(true);
                    setTossResultLabel(null);
                    // wait to allow CSS animation to play
                    // use crypto randomness for better unpredictability
                    await new Promise((res) => setTimeout(res, 1200));
                    let head = false;
                    try {
                      const arr = new Uint32Array(1);
                      crypto.getRandomValues(arr);
                      // convert to 0..1
                      head = (arr[0] / 0xffffffff) < 0.5;
                    } catch (e) {
                      // fallback to Math.random if crypto unavailable
                      head = Math.random() < 0.5;
                    }
                    const label = head ? 'Heads' : 'Tails';
                    setTossResultLabel(label);
                    // Map Heads to team 0, Tails to team 1
                    setTossWinner(head ? 0 : 1);
                    setIsFlipping(false);
                  }}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 disabled:opacity-40"
                >
                  Toss Coin
                </button>
              </div>
            </div>
          </Field>

          <Field label="Elected to">
            <div className="grid grid-cols-2 gap-2">
              {(["bat", "bowl"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDecision(d)}
                  className={`rounded-xl border px-4 py-3 text-sm font-medium capitalize transition ${
                    decision === d
                      ? "border-gold/50 bg-gold-soft text-gold"
                      : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
                  }`}
                >
                  {d} first
                </button>
              ))}
            </div>
          </Field>

          <Field label="Number of Overs">
            <input
              type="number"
              min={1}
              max={50}
              value={overs}
              onChange={(e) => {
                const next = Math.max(1, Number(e.target.value) || 1);
                setOvers(next);
                if (bowlerLimit > next) setBowlerLimit(next);
              }}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-gold/40"
            />
          </Field>

          <Field label="Bowler over limit">
            <input
              type="number"
              min={1}
              max={overs}
              value={bowlerLimit}
              onChange={(e) => setBowlerLimit(Math.max(1, Math.min(Number(e.target.value) || 1, overs)))}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-gold/40"
            />
          </Field>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">
              {battingTeam.name} batting
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Opening Striker">
                <SearchSelect
                  value={strikerId}
                  onChange={(v) => {
                    setStrikerId(v);
                    if (v === nonStrikerId) setNonStrikerId("");
                  }}
                  options={batterOptions}
                  placeholder="Select batter"
                  modal
                />
              </Field>
              <Field label="Opening Non-Striker">
                <SearchSelect
                  value={nonStrikerId}
                  onChange={setNonStrikerId}
                  options={nonStrikerOptions}
                  placeholder="Select batter"
                  modal
                />
              </Field>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <p className="mb-4 text-xs uppercase tracking-wider text-muted-foreground">
              {bowlingTeam.name} bowling
            </p>
            <Field label="Opening Bowler">
              <SearchSelect
                value={bowlerId}
                onChange={setBowlerId}
                options={bowlerOptions}
                placeholder="Select bowler"
                modal
              />
            </Field>
          </div>
        </div>

        <style>{`
          .coin { position: relative; perspective: 800px; display: inline-block; }
          .coin .coin-face { position: absolute; inset: 0; display:flex;align-items:center;justify-content:center;border-radius:9999px;background:linear-gradient(180deg,#f6c85f,#c6881f);color:#111;font-weight:700; }
          .coin .coin-tails { transform: rotateY(180deg); background:linear-gradient(180deg,#fff,#ddd); }
          .coin.flipping { animation: coinFlip 1.2s cubic-bezier(.2,.9,.2,1); }
          @keyframes coinFlip { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(1080deg); } }
        `}</style>

        <button
          onClick={start}
          disabled={!canStart}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold to-[oklch(0.72_0.16_70)] px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-gold/20 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
        >
          <Play className="h-4 w-4" /> Start Match
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
