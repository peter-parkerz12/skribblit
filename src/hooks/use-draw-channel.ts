import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DrawEvent } from "@/lib/game-types";

export function useDrawChannel(
  code: string | undefined,
  onEvent: (e: DrawEvent) => void,
) {
  const sendRef = useRef<(e: DrawEvent) => void>(() => {});
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!code) return;
    const channel = supabase.channel(`draw:${code}`, {
      config: { broadcast: { self: false } },
    });
    channel.on("broadcast", { event: "draw" }, ({ payload }) => {
      cbRef.current(payload as DrawEvent);
    });
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        sendRef.current = (e) => {
          channel.send({ type: "broadcast", event: "draw", payload: e });
        };
      }
    });
    return () => {
      supabase.removeChannel(channel);
      sendRef.current = () => {};
    };
  }, [code]);

  return (e: DrawEvent) => sendRef.current(e);
}
