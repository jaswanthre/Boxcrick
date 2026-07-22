import { useState } from "react";
import { useCricket } from "@/lib/cricket/store";
import { saveAuth } from "@/lib/auth";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

type Role = "admin" | "visitor";

export function LoginView() {
  const { dispatch } = useCricket();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<Role>("admin");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (role === "admin") {
        // Local admin check (no backend). Credentials: box / cricket
        await new Promise((resolve) => setTimeout(resolve, 200));
        if (username !== "box" || password !== "cricket") {
          throw new Error("Invalid admin username or password");
        }
        const user = { id: "box", name: "Box", email: "box@example.com" };
        const token = "hardcoded-admin-token";
        saveAuth(token, user, "admin");
        dispatch({ type: "LOGIN", user });
        // Replace history so Back doesn't return to login
        window.location.replace("/");
      } else {
        // Visitor flow: call backend visitor endpoint which returns { token, user }
        const res = await fetch(`${API_BASE}/api/auth/visitor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          throw new Error(err?.message || `Invalid visitor credentials (status ${res.status})`);
        }
        const data = await res.json();
        if (!data.token || !data.user) throw new Error("Invalid response from server");
        saveAuth(data.token, data.user, "visitor");
        // For visitors do NOT dispatch LOGIN (no admin privileges). Replace history and redirect to visitor page.
        window.location.replace("/visitor");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="glass-card p-6">
        <h1 className="text-2xl font-bold">Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to manage your match and scoring.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-background px-4 py-3 text-sm text-foreground outline-none appearance-none focus:border-gold/40"
            >
              <option className="text-foreground" value="admin">
                Admin
              </option>
              <option className="text-foreground" value="visitor">
                Visitor
              </option>
            </select>
          </label>
          {role !== "visitor" && (
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Username
              </span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-gold/40"
              />
            </label>
          )}
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-gold/40"
            />
          </label>
          {error && (
            <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
          >
            Login
          </button>
        </form>
        {/* Toss UI removed as requested */}
        {/* Credentials removed from UI for security */}
      </div>
    </div>
  );
}
