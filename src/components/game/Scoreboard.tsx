import type { Player, Room } from "@/lib/game-types";
import { Crown, Palette, Check } from "lucide-react";

interface Props {
  players: Player[];
  room: Room;
  playerId: string;
}

export function Scoreboard({ players, room, playerId }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  return (
    <div className="brutal-card overflow-hidden">
      <div className="flex items-center justify-between border-b-2 border-foreground px-3 py-2">
        <h3 className="text-sm font-extrabold uppercase tracking-wide">
          Players
        </h3>
        <span className="text-xs font-semibold text-muted-foreground">
          {players.length}/{room.max_players}
        </span>
      </div>
      <ul className="divide-y-2 divide-foreground/10">
        {sorted.map((p, i) => {
          const isDrawer = room.current_drawer_id === p.id;
          const isMe = p.id === playerId;
          return (
            <li
              key={p.id}
              className={`flex items-center gap-2 px-3 py-2 ${
                isDrawer ? "bg-primary/40" : ""
              }`}
            >
              <span className="w-5 text-xs font-extrabold text-muted-foreground">
                #{i + 1}
              </span>
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-foreground text-xs font-extrabold text-foreground"
                style={{ background: p.color }}
                aria-hidden
              >
                {p.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-bold">
                    {p.name}
                    {isMe && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </span>
                  {p.is_host && (
                    <Crown
                      className="h-3.5 w-3.5 text-foreground"
                      aria-label="Host"
                    />
                  )}
                  {isDrawer && (
                    <Palette
                      className="h-3.5 w-3.5 text-foreground"
                      aria-label="Drawing"
                    />
                  )}
                  {p.guessed_correctly && room.phase === "drawing" && (
                    <Check
                      className="h-3.5 w-3.5 text-success"
                      aria-label="Guessed"
                    />
                  )}
                </div>
              </div>
              <span className="text-sm font-extrabold tabular-nums">
                {p.score}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
