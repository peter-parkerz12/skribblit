import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Message, Player, Room } from "@/lib/game-types";

interface RoomState {
  room: Room | null;
  players: Player[];
  messages: Message[];
  loading: boolean;
  notFound: boolean;
}

export function useRoom(code: string | undefined): RoomState {
  const [state, setState] = useState<RoomState>({
    room: null,
    players: [],
    messages: [],
    loading: true,
    notFound: false,
  });

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function load() {
      const [{ data: room }, { data: players }, { data: messages }] =
        await Promise.all([
          supabase.from("rooms").select("*").eq("code", code!).maybeSingle(),
          supabase
            .from("players")
            .select("*")
            .eq("room_code", code!)
            .order("joined_at", { ascending: true }),
          supabase
            .from("messages")
            .select("*")
            .eq("room_code", code!)
            .order("created_at", { ascending: true })
            .limit(200),
        ]);
      if (cancelled) return;
      if (!room) {
        setState({
          room: null,
          players: [],
          messages: [],
          loading: false,
          notFound: true,
        });
        return;
      }
      setState({
        room: room as Room,
        players: (players ?? []) as Player[],
        messages: (messages ?? []) as Message[],
        loading: false,
        notFound: false,
      });
    }

    load();

    const channel = supabase
      .channel(`room:${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms", filter: `code=eq.${code}` },
        (payload) => {
          setState((s) => {
            if (payload.eventType === "DELETE") {
              return { ...s, room: null, notFound: true };
            }
            return { ...s, room: payload.new as Room };
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_code=eq.${code}`,
        },
        (payload) => {
          setState((s) => {
            if (payload.eventType === "DELETE") {
              const removed = payload.old as Player;
              return {
                ...s,
                players: s.players.filter((p) => p.id !== removed.id),
              };
            }
            const next = payload.new as Player;
            const exists = s.players.some((p) => p.id === next.id);
            const players = exists
              ? s.players.map((p) => (p.id === next.id ? next : p))
              : [...s.players, next];
            return {
              ...s,
              players: players.sort((a, b) =>
                a.joined_at.localeCompare(b.joined_at),
              ),
            };
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_code=eq.${code}`,
        },
        (payload) => {
          setState((s) => ({
            ...s,
            messages: [...s.messages, payload.new as Message].slice(-200),
          }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [code]);

  return state;
}
