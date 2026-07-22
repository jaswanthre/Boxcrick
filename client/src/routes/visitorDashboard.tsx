import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCricket } from "@/lib/cricket/store";
import { inningsTotals } from "@/lib/cricket/stats";
import { getAuth, clearAuth } from "@/lib/auth";

function VisitorDashboard() {
  const { state } = useCricket();

  useEffect(() => {
    const ok = getAuth();
    if (!ok) {
      window.location.href = "/visitor";
    }
  }, []);

  const hasLive = state.phase === "live" && state.innings && state.innings.length > 0;
  const inn = hasLive ? state.innings[state.currentInningsIdx] : null;
  const currentInn = inn as NonNullable<typeof inn>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold">Visitor Dashboard</h2>
        <div className="flex gap-2">
          <Link
            to="/history"
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            History
          </Link>
          <button
            onClick={() => {
              clearAuth();
              window.location.href = "/";
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="glass-card p-6">
        {hasLive ? (
          <div>
            <p className="text-xs text-muted-foreground">Live Match</p>
            <h3 className="mt-2 text-xl font-semibold">
              {state.teams[currentInn.battingTeamIdx].name} vs{" "}
              {state.teams[currentInn.bowlingTeamIdx].name}
            </h3>
            <p className="mt-2 text-sm">
              {inningsTotals(currentInn).runs}/{inningsTotals(currentInn).wickets} ({state.overs}{" "}
              overs)
            </p>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No live match currently.</div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/visitorDashboard")({
  component: VisitorDashboard,
});
