import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { createRoom, joinRoom } from "@/lib/game.functions";
import {
  getOrCreatePlayerId,
  getStoredName,
  isValidName,
  sanitizeName,
  setStoredName,
} from "@/lib/game-utils";
import { Palette, Users, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Skribble — Real-time multiplayer drawing & guessing" },
      {
        name: "description",
        content:
          "A premium, fast, mobile-friendly multiplayer drawing & guessing game. Create a room, share a code, draw and guess in real time.",
      },
      { property: "og:title", content: "Skribble" },
      {
        property: "og:description",
        content: "Multiplayer drawing & guessing — done right.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const create = useServerFn(createRoom);
  const join = useServerFn(joinRoom);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setName(getStoredName());
  }, []);

  async function handleCreate() {
    setErr(null);
    const cleanName = sanitizeName(name);
    if (!isValidName(cleanName)) {
      setErr("Enter a name (2–16 characters)");
      return;
    }
    setBusy("create");
    setStoredName(cleanName);
    try {
      const playerId = getOrCreatePlayerId();
      const res = await create({ data: { playerId, name: cleanName } });
      navigate({ to: "/r/$code", params: { code: res.code } });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }

  async function handleJoin() {
    setErr(null);
    const cleanName = sanitizeName(name);
    const cleanCode = code.toUpperCase().trim();
    if (!isValidName(cleanName)) {
      setErr("Enter a name (2–16 characters)");
      return;
    }
    if (!/^[A-Z2-9]{4,8}$/.test(cleanCode)) {
      setErr("Enter a valid room code");
      return;
    }
    setBusy("join");
    setStoredName(cleanName);
    try {
      const playerId = getOrCreatePlayerId();
      await join({ data: { playerId, name: cleanName, code: cleanCode } });
      navigate({ to: "/r/$code", params: { code: cleanCode } });
    } catch (e) {
      setErr((e as Error).message);
      setBusy(null);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10 sm:py-16">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-foreground bg-primary shadow-brutal-sm">
              <Palette className="h-5 w-5" />
            </span>
            <span className="text-xl font-black tracking-tight">Skribble</span>
          </div>
          <span className="hidden rounded-md border-2 border-foreground bg-card px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest sm:inline-block">
            v1 · realtime
          </span>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="flex flex-col gap-5">
            <h1 className="text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl lg:text-7xl">
              Draw it.
              <br />
              <span className="inline-block bg-primary px-3 py-1 -rotate-1 border-2 border-foreground rounded-md shadow-brutal-sm">
                Guess it.
              </span>
              <br />
              Win it.
            </h1>
            <p className="max-w-md text-lg font-semibold text-muted-foreground">
              A premium real-time drawing & guessing game. Create a room, share
              the code, play with friends — anywhere.
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              <span className="rounded-md border-2 border-foreground bg-card px-2 py-1">
                <Zap className="-mt-0.5 mr-1 inline h-3 w-3" /> Real-time
              </span>
              <span className="rounded-md border-2 border-foreground bg-card px-2 py-1">
                <Users className="-mt-0.5 mr-1 inline h-3 w-3" /> Up to 12
              </span>
              <span className="rounded-md border-2 border-foreground bg-card px-2 py-1">
                <Sparkles className="-mt-0.5 mr-1 inline h-3 w-3" /> No signup
              </span>
            </div>
          </div>

          <div className="brutal-card p-5 sm:p-6">
            <label className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              Your name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={16}
              placeholder="e.g. Alex"
              className="brutal-input mt-2 h-12 text-base"
              aria-label="Your name"
            />

            <button
              type="button"
              onClick={handleCreate}
              disabled={busy !== null}
              className="brutal-press mt-4 flex h-14 w-full items-center justify-center rounded-md border-2 border-foreground bg-accent text-base font-black uppercase tracking-wider text-accent-foreground shadow-brutal disabled:opacity-50"
            >
              {busy === "create" ? "Creating..." : "Create room"}
            </button>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-foreground/20" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                Or join
              </span>
              <span className="h-px flex-1 bg-foreground/20" />
            </div>

            <div className="flex gap-2">
              <input
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))
                }
                maxLength={8}
                placeholder="ROOM CODE"
                className="brutal-input h-12 font-mono text-base tracking-[0.3em]"
                aria-label="Room code"
              />
              <button
                type="button"
                onClick={handleJoin}
                disabled={busy !== null}
                className="brutal-press h-12 shrink-0 rounded-md border-2 border-foreground bg-primary px-5 font-extrabold uppercase tracking-wider shadow-brutal-sm disabled:opacity-50"
              >
                {busy === "join" ? "..." : "Join"}
              </button>
            </div>

            {err && (
              <p className="mt-3 rounded-md border-2 border-foreground bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground">
                {err}
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <FeatureCard
            title="Share a code"
            body="Friends join in seconds. No accounts, no apps."
          />
          <FeatureCard
            title="Draw, guess, score"
            body="Earlier guesses score more. Drawer earns when others guess."
          />
          <FeatureCard
            title="Built for mobile"
            body="Smooth touch drawing. Installable like a native app."
          />
        </section>

        <footer className="mt-2 text-center text-xs font-bold text-muted-foreground">
          Made for friends. <Link to="/" className="underline">Home</Link>
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="brutal-card-sm p-4">
      <h3 className="text-sm font-black uppercase tracking-widest">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-muted-foreground">{body}</p>
    </div>
  );
}
