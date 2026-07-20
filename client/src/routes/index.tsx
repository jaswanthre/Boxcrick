import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CricketProvider, useCricket } from "@/lib/cricket/store";
import { HomeView } from "@/components/cricket/HomeView";
import { SetupView } from "@/components/cricket/SetupView";
import { LiveView } from "@/components/cricket/LiveView";
import { SummaryView } from "@/components/cricket/SummaryView";
import { LoginView } from "@/components/auth/LoginView";
import { getAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Router() {
  const { state } = useCricket();
  if (!state.authUser) return <LoginView />;
  if (state.phase === "home") return <HomeView />;
  if (state.phase === "setup") return <SetupView />;
  if (state.phase === "live") return <LiveView />;
  return <SummaryView />;
}

function AuthLoader() {
  const { state, dispatch } = useCricket();

  useEffect(() => {
    const auth = getAuth();
    if (auth && !state.authUser) {
      dispatch({ type: 'LOGIN', user: auth.user });
    }
  }, [state.authUser, dispatch]);

  return null;
}

function Index() {
  return (
    <CricketProvider>
      <AuthLoader />
      <Router />
    </CricketProvider>
  );
}
