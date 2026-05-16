import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { chooseWord } from "@/lib/game.functions";
import type { Room } from "@/lib/game-types";

interface Props {
  room: Room;
  isDrawer: boolean;
  drawerName: string | undefined;
  playerId: string;
  /** Word choices fetched via the drawer-only server function. */
  choices: string[];
}

export function WordChooser({ room, isDrawer, drawerName, playerId, choices }: Props) {
  const choose = useServerFn(chooseWord);
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(word: string) {
    setBusy(word);
    try {
      await choose({ data: { code: room.code, playerId, word } });
    } catch {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      {isDrawer ? (
        <>
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            Choose a word
          </p>
          <h2 className="text-2xl font-black sm:text-3xl">Pick what to draw</h2>
          <div className="mt-2 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
            {choices.map((w) => (
              <button
                key={w}
                type="button"
                disabled={busy !== null}
                onClick={() => pick(w)}
                className="brutal-press rounded-lg border-2 border-foreground bg-card px-4 py-6 text-lg font-extrabold capitalize shadow-brutal disabled:opacity-50 hover:bg-primary"
              >
                {w}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
            Get ready
          </p>
          <h2 className="text-2xl font-black sm:text-3xl">
            {drawerName ?? "Drawer"} is choosing a word…
          </h2>
          <div className="mt-3 flex gap-2">
            <span className="h-3 w-3 animate-bounce rounded-full bg-foreground" />
            <span
              className="h-3 w-3 animate-bounce rounded-full bg-foreground"
              style={{ animationDelay: "120ms" }}
            />
            <span
              className="h-3 w-3 animate-bounce rounded-full bg-foreground"
              style={{ animationDelay: "240ms" }}
            />
          </div>
        </>
      )}
    </div>
  );
}
