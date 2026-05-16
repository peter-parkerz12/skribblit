import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useRoom } from "@/hooks/use-room";
import {
  joinRoom,
  leaveRoom,
  tickRoom,
  getDrawerSecret,
} from "@/lib/game.functions";
import {
  getOrCreatePlayerId,
  getStoredName,
  isValidName,
  sanitizeName,
  setStoredName,
} from "@/lib/game-utils";
import { Lobby } from "@/components/game/Lobby";
import { DrawCanvas } from "@/components/game/DrawCanvas";
import { ChatPanel } from "@/components/game/ChatPanel";
import { Scoreboard } from "@/components/game/Scoreboard";
import { RoundTimer } from "@/components/game/RoundTimer";
import { WordChooser } from "@/components/game/WordChooser";
import { RoundSummary } from "@/components/game/RoundSummary";
import { GameEnd } from "@/components/game/GameEnd";
import { RoomCodeChip } from "@/components/game/RoomCodeChip";


export const Route = createFileRoute("/r/$code")({
  head: () => ({
    meta: [{ title: "Skribble — Game Room" }],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { code: rawCode } = Route.useParams();
  const code = rawCode.toUpperCase();
  const navigate = useNavigate();

  const [playerId, setPlayerId] = useState<string>("");
  const [needName, setNeedName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const join = useServerFn(joinRoom);
  const leave = useServerFn(leaveRoom);
  const tick = useServerFn(tickRoom);
  const fetchSecret = useServerFn(getDrawerSecret);
  const [drawerSecret, setDrawerSecret] = useState<{
    secret_word: string | null;
    word_choices: string[];
  }>({ secret_word: null, word_choices: [] });

  const { room, players, messages, loading, notFound } = useRoom(
    playerId ? code : undefined,
  );
  const me = players.find((p) => p.id === playerId);

  // Bootstrap player + try to join
  useEffect(() => {
    const pid = getOrCreatePlayerId();
    setPlayerId(pid);
    const stored = getStoredName();
    setNameInput(stored);
    if (!isValidName(stored)) {
      setNeedName(true);
      return;
    }
    setJoining(true);
    join({ data: { playerId: pid, name: sanitizeName(stored), code } })
      .catch((e: Error) => {
        setJoinErr(e.message);
        setNeedName(true);
      })
      .finally(() => setJoining(false));
  }, [code, join]);

  // Tick timer (any client; server validates)
  useEffect(() => {
    if (!room || room.phase !== "drawing" || !room.round_ends_at) return;
    const remaining =
      new Date(room.round_ends_at).getTime() - Date.now() + 500;
    if (remaining <= 0) {
      tick({ data: { code } }).catch(() => {});
      return;
    }
    const id = setTimeout(() => {
      tick({ data: { code } }).catch(() => {});
    }, remaining);
    return () => clearTimeout(id);
  }, [room, tick, code]);

  // Drawer-only: fetch the actual secret word + choices via server fn.
  // (Column-level revoked from anon so the public room row never carries them.)
  const isDrawerHere = room?.current_drawer_id === playerId;
  const phase = room?.phase;
  useEffect(() => {
    if (!playerId || !room) return;
    if (!isDrawerHere || (phase !== "choosing" && phase !== "drawing")) {
      setDrawerSecret({ secret_word: null, word_choices: [] });
      return;
    }
    let cancelled = false;
    fetchSecret({ data: { code, playerId } })
      .then((res) => {
        if (!cancelled) setDrawerSecret(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code, playerId, isDrawerHere, phase, room?.current_drawer_id, fetchSecret, room]);

  // Leave on unload
  const playerIdRef = useRef(playerId);
  playerIdRef.current = playerId;
  useEffect(() => {
    const handler = () => {
      const pid = playerIdRef.current;
      if (!pid) return;
      try {
        navigator.sendBeacon?.("/api/dummy");
      } catch {
        /* ignore */
      }
      leave({ data: { code, playerId: pid } }).catch(() => {});
    };
    window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, [code, leave]);

  async function submitName() {
    setJoinErr(null);
    const clean = sanitizeName(nameInput);
    if (!isValidName(clean)) {
      setJoinErr("Enter a name (2–16 characters)");
      return;
    }
    setStoredName(clean);
    setJoining(true);
    try {
      await join({ data: { playerId, name: clean, code } });
      setNeedName(false);
    } catch (e) {
      setJoinErr((e as Error).message);
    } finally {
      setJoining(false);
    }
  }

  // ---------- render states ----------

  if (needName) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="brutal-card w-full max-w-md p-6">
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            Joining room {code}
          </p>
          <h1 className="mt-1 text-2xl font-black">Pick a name</h1>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            maxLength={16}
            placeholder="Your name"
            className="brutal-input mt-4 h-12"
          />
          {joinErr && (
            <p className="mt-3 rounded-md border-2 border-foreground bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground">
              {joinErr}
            </p>
          )}
          <button
            type="button"
            onClick={submitName}
            disabled={joining}
            className="brutal-press mt-4 h-12 w-full rounded-md border-2 border-foreground bg-accent font-black uppercase tracking-wider text-accent-foreground shadow-brutal disabled:opacity-50"
          >
            {joining ? "Joining..." : "Join"}
          </button>
          <Link
            to="/"
            className="mt-3 block text-center text-xs font-bold underline"
          >
            Back to home
          </Link>
        </div>
      </main>
    );
  }

  if (loading || joining) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="brutal-card p-6 text-sm font-extrabold uppercase tracking-widest">
          Loading room…
        </div>
      </main>
    );
  }

  if (notFound || !room) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="brutal-card max-w-md p-6 text-center">
          <h1 className="text-2xl font-black">Room not found</h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            "{code}" doesn't exist or has ended.
          </p>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="brutal-press mt-4 h-11 w-full rounded-md border-2 border-foreground bg-primary font-extrabold uppercase tracking-wider shadow-brutal-sm"
          >
            Back to home
          </button>
        </div>
      </main>
    );
  }

  if (room.phase === "lobby") {
    return <Lobby room={room} players={players} playerId={playerId} />;
  }

  if (room.phase === "game_end") {
    return <GameEnd room={room} players={players} playerId={playerId} />;
  }

  // Active gameplay (choosing / drawing / round_end)
  const isDrawer = room.current_drawer_id === playerId;
  const drawer = players.find((p) => p.id === room.current_drawer_id);
  // Drawer / correct guessers see the real word (drawer via server fn, others
  // via system message after they guess). Everyone else sees the public mask.
  const knownWord =
    isDrawer ? drawerSecret.secret_word : me?.guessed_correctly ? null : null;
  const wordDisplay =
    room.phase === "drawing"
      ? knownWord ?? (room.word_mask || "—")
      : "—";
  const letterCount = (room.word_mask || "").replace(/[^a-zA-Z_]/g, "").length;

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 p-3 sm:p-5">
        {/* Top bar */}
        <div className="brutal-card flex flex-wrap items-center gap-3 px-3 py-2 sm:px-4">
          <RoomCodeChip code={room.code} />
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                Round
              </p>
              <p className="text-sm font-extrabold tabular-nums">
                {room.current_round} / {room.total_rounds}
              </p>
            </div>
            {room.phase === "drawing" && (
              <RoundTimer
                endsAt={room.round_ends_at}
                totalSeconds={room.round_seconds}
              />
            )}
          </div>
        </div>

        {/* Word display */}
        <div className="brutal-card-sm flex items-center justify-between gap-3 px-4 py-2">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
              {isDrawer && room.phase === "drawing"
                ? "You're drawing"
                : drawer
                  ? `${drawer.name} is drawing`
                  : "Get ready"}
            </p>
            <p className="font-mono text-lg font-extrabold tracking-[0.3em]">
              {wordDisplay}
            </p>
          </div>
          {room.phase === "drawing" && letterCount > 0 && (
            <span className="text-xs font-bold text-muted-foreground">
              {letterCount} letters
            </span>
          )}
        </div>

        {/* Layout: canvas + side panels */}
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <div className="flex flex-col gap-3">
            {room.phase === "choosing" && (
              <div className="brutal-card min-h-[400px]">
                <WordChooser
                  room={room}
                  isDrawer={isDrawer}
                  drawerName={drawer?.name}
                  playerId={playerId}
                />
              </div>
            )}
            {room.phase === "drawing" && (
              <DrawCanvas
                code={code}
                canDraw={isDrawer}
                drawerId={room.current_drawer_id}
              />
            )}
            {room.phase === "round_end" && (
              <div className="brutal-card min-h-[400px]">
                <RoundSummary
                  room={room}
                  players={players}
                  playerId={playerId}
                />
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-3">
            <Scoreboard
              players={players}
              room={room}
              playerId={playerId}
            />
            <div className="h-[320px] lg:h-[420px]">
              <ChatPanel
                room={room}
                players={players}
                messages={messages}
                playerId={playerId}
              />
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
