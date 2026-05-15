import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { advanceFromRoundEnd } from "@/lib/game.functions";
import type { Player, Room } from "@/lib/game-types";

interface Props {
  room: Room;
  players: Player[];
  playerId: string;
}

export function RoundSummary({ room, players, playerId }: Props) {
  const isHost = room.host_id === playerId;
  const advance = useServerFn(advanceFromRoundEnd);

  useEffect(() => {
    if (!isHost) return;
    const id = setTimeout(() => {
      advance({ data: { code: room.code, playerId } }).catch(() => {});
    }, 4000);
    return () => clearTimeout(id);
  }, [isHost, room.code, playerId, advance]);

  const sorted = [...players].sort((a, b) => b.round_score - a.round_score);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 p-6 text-center">
      <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
        Round {room.current_round} / {room.total_rounds}
      </p>
      <h2 className="text-3xl font-black sm:text-4xl">
        Word was{" "}
        <span className="rounded-md border-2 border-foreground bg-primary px-3 py-1 capitalize">
          {room.secret_word ?? "—"}
        </span>
      </h2>
      <ul className="w-full max-w-md space-y-2">
        {sorted.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-md border-2 border-foreground bg-card px-3 py-2 shadow-brutal-sm"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-6 w-6 rounded-full border-2 border-foreground"
                style={{ background: p.color }}
              />
              <span className="font-extrabold">{p.name}</span>
            </span>
            <span className="font-extrabold tabular-nums">
              {p.round_score > 0 ? `+${p.round_score}` : "—"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs font-bold text-muted-foreground">
        Next round starting...
      </p>
    </div>
  );
}
