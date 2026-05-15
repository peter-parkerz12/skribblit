import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { submitChat } from "@/lib/game.functions";
import type { Message, Player, Room } from "@/lib/game-types";
import { sanitizeChat } from "@/lib/game-utils";
import { Send } from "lucide-react";

interface Props {
  room: Room;
  players: Player[];
  messages: Message[];
  playerId: string;
}

export function ChatPanel({ room, players, messages, playerId }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const send = useServerFn(submitChat);
  const scrollRef = useRef<HTMLDivElement>(null);

  const me = players.find((p) => p.id === playerId);
  const isDrawer = room.current_drawer_id === playerId;
  const isDrawing = room.phase === "drawing";
  const inputDisabled =
    sending || (isDrawer && isDrawing) || (me?.guessed_correctly && isDrawing);
  const placeholder = isDrawer
    ? "You're the drawer — no chat"
    : isDrawing
      ? me?.guessed_correctly
        ? "You guessed it!"
        : "Type your guess..."
      : "Say something...";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = sanitizeChat(text);
    if (!content || inputDisabled) return;
    setSending(true);
    try {
      await send({ data: { code: room.code, playerId, content } });
      setText("");
    } catch {
      /* ignore */
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="brutal-card flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b-2 border-foreground px-3 py-2">
        <h3 className="text-sm font-extrabold uppercase tracking-wide">Chat</h3>
        <span className="text-xs font-semibold text-muted-foreground">
          {messages.length} msg
        </span>
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm"
        aria-live="polite"
      >
        {messages.length === 0 && (
          <p className="py-6 text-center text-xs font-semibold text-muted-foreground">
            No messages yet.
          </p>
        )}
        {messages.map((m) => (
          <ChatLine key={m.id} m={m} mine={m.player_id === playerId} />
        ))}
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t-2 border-foreground p-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={120}
          disabled={inputDisabled}
          placeholder={placeholder}
          className="brutal-input h-10 text-sm disabled:opacity-50"
          aria-label="Chat message"
        />
        <button
          type="submit"
          disabled={inputDisabled || !text.trim()}
          className="brutal-press flex h-10 w-10 shrink-0 items-center justify-center rounded-md border-2 border-foreground bg-primary shadow-brutal-sm disabled:opacity-50"
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function ChatLine({ m, mine }: { m: Message; mine: boolean }) {
  if (m.kind === "system") {
    return (
      <p className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {m.content}
      </p>
    );
  }
  if (m.kind === "correct") {
    return (
      <p className="rounded-md border-2 border-foreground bg-success px-2 py-1 text-xs font-extrabold text-success-foreground">
        ✓ {m.content}
      </p>
    );
  }
  if (m.kind === "close") {
    return (
      <p className="rounded-md border-2 border-foreground bg-warning px-2 py-1 text-xs font-bold text-warning-foreground">
        <span style={{ color: m.player_color }}>{m.player_name}</span>:{" "}
        <span>{m.content}</span>{" "}
        <span className="opacity-70">(so close!)</span>
      </p>
    );
  }
  return (
    <p
      className={`break-words py-0.5 ${mine ? "font-semibold" : ""}`}
    >
      <span className="font-extrabold" style={{ color: m.player_color }}>
        {m.player_name}:
      </span>{" "}
      <span>{m.content}</span>
    </p>
  );
}
