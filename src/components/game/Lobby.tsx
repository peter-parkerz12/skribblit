import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startGame, updateSettings } from "@/lib/game.functions";
import type { Player, Room } from "@/lib/game-types";
import { RoomCodeChip } from "./RoomCodeChip";
import { Crown, Play, Settings2 } from "lucide-react";

interface Props {
  room: Room;
  players: Player[];
  playerId: string;
}

export function Lobby({ room, players, playerId }: Props) {
  const isHost = room.host_id === playerId;
  const start = useServerFn(startGame);
  const update = useServerFn(updateSettings);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function setSetting(patch: Parameters<typeof update>[0]["data"]) {
    setErr(null);
    try {
      await update({ data: { ...patch, code: room.code, playerId } });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function onStart() {
    setErr(null);
    setBusy(true);
    try {
      await start({ data: { code: room.code, playerId } });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:py-10">
      <div className="brutal-card p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              Lobby
            </p>
            <h1 className="mt-1 text-3xl font-black sm:text-4xl">
              Waiting for players
            </h1>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Share the room code or link to invite friends.
            </p>
          </div>
          <RoomCodeChip code={room.code} />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <SettingRow
            label="Rounds"
            value={room.total_rounds}
            options={[1, 2, 3, 4, 5, 6, 8]}
            disabled={!isHost}
            onChange={(v) => setSetting({ total_rounds: v })}
          />
          <SettingRow
            label="Time / round"
            value={room.round_seconds}
            options={[40, 60, 80, 100, 120, 150]}
            disabled={!isHost}
            onChange={(v) => setSetting({ round_seconds: v })}
            suffix="s"
          />
          <SettingRow
            label="Max players"
            value={room.max_players}
            options={[3, 4, 6, 8, 10, 12]}
            disabled={!isHost}
            onChange={(v) => setSetting({ max_players: v })}
          />
          <DifficultyRow
            value={room.difficulty}
            disabled={!isHost}
            onChange={(v) => setSetting({ difficulty: v })}
          />
        </div>

        {!isHost && (
          <p className="mt-4 flex items-center gap-2 rounded-md border-2 border-foreground bg-muted px-3 py-2 text-xs font-bold">
            <Settings2 className="h-3.5 w-3.5" /> Only the host can change
            settings.
          </p>
        )}
      </div>

      <div className="brutal-card p-5">
        <h2 className="mb-3 text-sm font-extrabold uppercase tracking-widest text-muted-foreground">
          Players ({players.length})
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-md border-2 border-foreground bg-card px-3 py-2 shadow-brutal-sm"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-foreground text-xs font-extrabold"
                style={{ background: p.color }}
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate font-bold">{p.name}</span>
              {p.is_host && <Crown className="h-4 w-4" aria-label="Host" />}
              {p.id === playerId && (
                <span className="ml-auto text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">
                  You
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {err && (
        <p className="rounded-md border-2 border-foreground bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground">
          {err}
        </p>
      )}

      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={busy || players.length < 2}
          className="brutal-press flex h-14 items-center justify-center gap-2 rounded-md border-2 border-foreground bg-accent text-lg font-black uppercase tracking-wider text-accent-foreground shadow-brutal disabled:opacity-50"
        >
          <Play className="h-5 w-5" />
          {players.length < 2 ? "Need 2+ players" : "Start Game"}
        </button>
      ) : (
        <p className="rounded-md border-2 border-foreground bg-muted px-4 py-4 text-center text-sm font-bold">
          Waiting for host to start...
        </p>
      )}
    </div>
  );
}

function SettingRow({
  label,
  value,
  options,
  onChange,
  disabled,
  suffix = "",
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
  disabled: boolean;
  suffix?: string;
}) {
  return (
    <div className="rounded-md border-2 border-foreground bg-card p-3">
      <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`h-8 min-w-9 rounded-md border-2 border-foreground px-2 text-xs font-extrabold tabular-nums disabled:cursor-not-allowed disabled:opacity-50 ${
              value === opt ? "bg-primary" : "bg-background"
            }`}
          >
            {opt}
            {suffix}
          </button>
        ))}
      </div>
    </div>
  );
}

function DifficultyRow({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: "easy" | "medium" | "hard" | "mixed") => void;
  disabled: boolean;
}) {
  const opts: Array<"easy" | "medium" | "hard" | "mixed"> = [
    "easy",
    "medium",
    "hard",
    "mixed",
  ];
  return (
    <div className="rounded-md border-2 border-foreground bg-card p-3">
      <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
        Difficulty
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {opts.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`h-8 rounded-md border-2 border-foreground px-3 text-xs font-extrabold capitalize disabled:cursor-not-allowed disabled:opacity-50 ${
              value === opt ? "bg-primary" : "bg-background"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
