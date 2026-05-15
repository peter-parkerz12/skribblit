import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { playAgain } from "@/lib/game.functions";
import type { Player, Room } from "@/lib/game-types";
import { RoomCodeChip } from "./RoomCodeChip";
import { Trophy } from "lucide-react";

interface Props {
  room: Room;
  players: Player[];
  playerId: string;
}

export function GameEnd({ room, players, playerId }: Props) {
  const isHost = room.host_id === playerId;
  const again = useServerFn(playAgain);
  const [busy, setBusy] = useState(false);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  async function onAgain() {
    setBusy(true);
    try {
      await again({ data: { code: room.code, playerId } });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-4 py-10 text-center">
      <Trophy className="h-14 w-14" />
      <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
        Game over
      </p>
      <h1 className="text-4xl font-black sm:text-5xl">
        {winner ? `${winner.name} wins!` : "Game finished"}
      </h1>

      <div className="brutal-card w-full p-4">
        <ul className="space-y-2">
          {sorted.map((p, i) => (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-md border-2 border-foreground px-3 py-2 ${
                i === 0 ? "bg-primary" : "bg-card"
              }`}
            >
              <span className="w-6 text-sm font-black">#{i + 1}</span>
              <span
                className="h-8 w-8 rounded-full border-2 border-foreground"
                style={{ background: p.color }}
              />
              <span className="flex-1 truncate text-left font-extrabold">
                {p.name}
              </span>
              <span className="font-black tabular-nums">{p.score}</span>
            </li>
          ))}
        </ul>
      </div>

      <RoomCodeChip code={room.code} />

      {isHost ? (
        <button
          type="button"
          onClick={onAgain}
          disabled={busy}
          className="brutal-press h-12 rounded-md border-2 border-foreground bg-accent px-6 font-black uppercase tracking-wider text-accent-foreground shadow-brutal disabled:opacity-50"
        >
          Play again
        </button>
      ) : (
        <p className="text-sm font-bold text-muted-foreground">
          Waiting for host...
        </p>
      )}

      <Link
        to="/"
        className="text-sm font-bold underline underline-offset-4"
      >
        Back to home
      </Link>
    </div>
  );
}
