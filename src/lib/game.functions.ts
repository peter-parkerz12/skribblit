import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateRoomCode, pickPlayerColor, isCloseGuess } from "./game-utils";
import { pickWordChoices, maskWord } from "./words";

// ---------- helpers ----------

const NAME_RE = /^[\p{L}\p{N} _.\-!?]{2,16}$/u;
const CODE_RE = /^[A-Z2-9]{4,8}$/;
const PID_RE = /^[a-zA-Z0-9_]{6,40}$/;

function clean(s: string) {
  return s.replace(/[\u0000-\u001F\u007F<>]/g, "").trim();
}

async function loadRoom(code: string) {
  const { data, error } = await supabaseAdmin
    .from("rooms")
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Room not found");
  return data;
}

async function loadPlayers(code: string) {
  const { data, error } = await supabaseAdmin
    .from("players")
    .select("*")
    .eq("room_code", code)
    .order("joined_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function postSystemMessage(room: string, content: string) {
  await supabaseAdmin.from("messages").insert({
    room_code: room,
    player_id: "system",
    player_name: "System",
    player_color: "#000000",
    content,
    kind: "system",
  });
}

// ---------- create room ----------

export const createRoom = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId: string; name: string }) => {
    const schema = z.object({
      playerId: z.string().regex(PID_RE),
      name: z.string().regex(NAME_RE),
    });
    return schema.parse(input);
  })
  .handler(async ({ data }) => {
    const name = clean(data.name);

    // Try a few codes to avoid collisions
    let code = "";
    for (let i = 0; i < 6; i++) {
      const candidate = generateRoomCode(5);
      const { data: existing } = await supabaseAdmin
        .from("rooms")
        .select("code")
        .eq("code", candidate)
        .maybeSingle();
      if (!existing) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Could not generate room code");

    const { error: roomErr } = await supabaseAdmin.from("rooms").insert({
      code,
      host_id: data.playerId,
      phase: "lobby",
    });
    if (roomErr) throw new Error(roomErr.message);

    const color = pickPlayerColor([]);
    const { error: pErr } = await supabaseAdmin.from("players").upsert({
      id: data.playerId,
      room_code: code,
      name,
      color,
      is_host: true,
      score: 0,
      round_score: 0,
      guessed_correctly: false,
      guess_order: null,
      last_seen: new Date().toISOString(),
    });
    if (pErr) throw new Error(pErr.message);

    return { code };
  });

// ---------- join room ----------

export const joinRoom = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { playerId: string; name: string; code: string }) => {
      const schema = z.object({
        playerId: z.string().regex(PID_RE),
        name: z.string().regex(NAME_RE),
        code: z.string().regex(CODE_RE),
      });
      return schema.parse(input);
    },
  )
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const room = await loadRoom(code);
    const players = await loadPlayers(code);
    const name = clean(data.name);

    const existing = players.find((p) => p.id === data.playerId);
    if (existing) {
      // Reconnect
      await supabaseAdmin
        .from("players")
        .update({ last_seen: new Date().toISOString(), name })
        .eq("id", data.playerId);
      return { code };
    }

    if (players.length >= room.max_players) {
      throw new Error("Room is full");
    }
    if (
      players.some((p) => p.name.toLowerCase() === name.toLowerCase())
    ) {
      throw new Error("That name is already taken in this room");
    }

    // Player IDs are primary keys — purge any stale row in another room
    // (e.g. the user previously played in a different room and never cleaned up).
    await supabaseAdmin
      .from("players")
      .delete()
      .eq("id", data.playerId)
      .neq("room_code", code);

    const color = pickPlayerColor(players.map((p) => p.color));
    const { error } = await supabaseAdmin.from("players").upsert(
      {
        id: data.playerId,
        room_code: code,
        name,
        color,
        is_host: false,
        score: 0,
        round_score: 0,
        guessed_correctly: false,
        guess_order: null,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);

    await postSystemMessage(code, `${name} joined`);
    return { code };
  });

// ---------- leave room ----------

export const leaveRoom = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId: string; code: string }) => {
    const schema = z.object({
      playerId: z.string().regex(PID_RE),
      code: z.string().regex(CODE_RE),
    });
    return schema.parse(input);
  })
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const room = await loadRoom(code);
    const players = await loadPlayers(code);
    const me = players.find((p) => p.id === data.playerId);
    if (!me) return { ok: true };

    await supabaseAdmin.from("players").delete().eq("id", data.playerId);
    await postSystemMessage(code, `${me.name} left`);

    const remaining = players.filter((p) => p.id !== data.playerId);

    if (remaining.length === 0) {
      // Room empty: delete
      await supabaseAdmin.from("rooms").delete().eq("code", code);
      return { ok: true };
    }

    // Transfer host
    if (room.host_id === data.playerId) {
      const newHost = remaining[0];
      await supabaseAdmin
        .from("rooms")
        .update({ host_id: newHost.id, updated_at: new Date().toISOString() })
        .eq("code", code);
      await supabaseAdmin
        .from("players")
        .update({ is_host: true })
        .eq("id", newHost.id);
      await postSystemMessage(code, `${newHost.name} is the new host`);
    }

    // If active drawer left during a round, end it
    if (
      (room.phase === "drawing" || room.phase === "choosing") &&
      room.current_drawer_id === data.playerId
    ) {
      await endRoundInternal(code, "Drawer left the room");
    }

    return { ok: true };
  });

// ---------- update settings (host only) ----------

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      playerId: string;
      code: string;
      total_rounds?: number;
      round_seconds?: number;
      max_players?: number;
      difficulty?: "easy" | "medium" | "hard" | "mixed";
    }) => {
      const schema = z.object({
        playerId: z.string().regex(PID_RE),
        code: z.string().regex(CODE_RE),
        total_rounds: z.number().int().min(1).max(10).optional(),
        round_seconds: z.number().int().min(30).max(180).optional(),
        max_players: z.number().int().min(2).max(12).optional(),
        difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
      });
      return schema.parse(input);
    },
  )
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const room = await loadRoom(code);
    if (room.host_id !== data.playerId) throw new Error("Not host");
    if (room.phase !== "lobby") throw new Error("Settings locked after start");

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        updated_at: new Date().toISOString(),
        ...(data.total_rounds !== undefined ? { total_rounds: data.total_rounds } : {}),
        ...(data.round_seconds !== undefined ? { round_seconds: data.round_seconds } : {}),
        ...(data.max_players !== undefined ? { max_players: data.max_players } : {}),
        ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
      })
      .eq("code", code);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- start game ----------

export const startGame = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId: string; code: string }) => {
    const schema = z.object({
      playerId: z.string().regex(PID_RE),
      code: z.string().regex(CODE_RE),
    });
    return schema.parse(input);
  })
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const room = await loadRoom(code);
    if (room.host_id !== data.playerId) throw new Error("Not host");
    if (room.phase !== "lobby") throw new Error("Already started");
    const players = await loadPlayers(code);
    if (players.length < 2) throw new Error("Need at least 2 players");

    // Reset all scores
    await supabaseAdmin
      .from("players")
      .update({ score: 0, round_score: 0, guessed_correctly: false, guess_order: null })
      .eq("room_code", code);

    await beginNextRoundInternal(code, players.map((p) => p.id));
    return { ok: true };
  });

// ---------- choose word ----------

export const chooseWord = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { playerId: string; code: string; word: string }) => {
      const schema = z.object({
        playerId: z.string().regex(PID_RE),
        code: z.string().regex(CODE_RE),
        word: z.string().min(1).max(40),
      });
      return schema.parse(input);
    },
  )
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const room = await loadRoom(code);
    if (room.phase !== "choosing") throw new Error("Not choosing phase");
    if (room.current_drawer_id !== data.playerId) throw new Error("Not drawer");
    if (!room.word_choices.includes(data.word)) throw new Error("Invalid word");

    const endsAt = new Date(Date.now() + room.round_seconds * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from("rooms")
      .update({
        phase: "drawing",
        secret_word: data.word,
        word_choices: [],
        word_mask: maskWord(data.word, 0),
        round_ends_at: endsAt,
        used_words: [...room.used_words, data.word],
        updated_at: new Date().toISOString(),
      })
      .eq("code", code);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- submit chat / guess ----------

export const submitChat = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { playerId: string; code: string; content: string }) => {
      const schema = z.object({
        playerId: z.string().regex(PID_RE),
        code: z.string().regex(CODE_RE),
        content: z.string().min(1).max(120),
      });
      return schema.parse(input);
    },
  )
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const room = await loadRoom(code);
    const players = await loadPlayers(code);
    const me = players.find((p) => p.id === data.playerId);
    if (!me) throw new Error("Not in room");
    const content = clean(data.content).slice(0, 120);
    if (!content) return { ok: true };

    const isDrawer = room.current_drawer_id === data.playerId;
    const isDrawing = room.phase === "drawing";

    // Drawer can't talk during drawing
    if (isDrawer && isDrawing) {
      return { ok: true };
    }

    // If already guessed correctly during drawing — they can chat with other guessers but it stays normal
    if (
      isDrawing &&
      room.secret_word &&
      !me.guessed_correctly &&
      content.toLowerCase() === room.secret_word.toLowerCase()
    ) {
      // Correct guess — score and post system message; do not reveal text to other players
      const guessedSoFar = players.filter((p) => p.guessed_correctly).length;
      const guessOrder = guessedSoFar + 1;

      // Time-decayed scoring
      const totalMs = room.round_seconds * 1000;
      const remainingMs = room.round_ends_at
        ? Math.max(0, new Date(room.round_ends_at).getTime() - Date.now())
        : 0;
      const fraction = Math.max(0.2, remainingMs / totalMs);
      const guesserPoints = Math.round(200 + 600 * fraction);

      await supabaseAdmin
        .from("players")
        .update({
          guessed_correctly: true,
          guess_order: guessOrder,
          score: me.score + guesserPoints,
          round_score: guesserPoints,
          last_seen: new Date().toISOString(),
        })
        .eq("id", me.id);

      // Drawer earns a smaller per-correct-guess reward
      const drawer = players.find((p) => p.id === room.current_drawer_id);
      if (drawer) {
        const drawerPoints = 100;
        await supabaseAdmin
          .from("players")
          .update({
            score: drawer.score + drawerPoints,
            round_score: drawer.round_score + drawerPoints,
          })
          .eq("id", drawer.id);
      }

      await supabaseAdmin.from("messages").insert({
        room_code: code,
        player_id: me.id,
        player_name: me.name,
        player_color: me.color,
        content: `${me.name} guessed the word!`,
        kind: "correct",
      });

      // Check if everyone (except drawer) has guessed
      const guessersTotal = players.filter(
        (p) => p.id !== room.current_drawer_id,
      ).length;
      if (guessOrder >= guessersTotal) {
        await endRoundInternal(code, null);
      }
      return { ok: true };
    }

    // Close guess hint (only to that player visually — but for v1 we mark message kind close)
    let kind: "chat" | "close" = "chat";
    if (
      isDrawing &&
      room.secret_word &&
      !me.guessed_correctly &&
      isCloseGuess(content, room.secret_word)
    ) {
      kind = "close";
    }

    await supabaseAdmin.from("messages").insert({
      room_code: code,
      player_id: me.id,
      player_name: me.name,
      player_color: me.color,
      content,
      kind,
    });
    return { ok: true };
  });

// ---------- tick: end-of-timer or skip ----------

export const tickRoom = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => {
    const schema = z.object({ code: z.string().regex(CODE_RE) });
    return schema.parse(input);
  })
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const room = await loadRoom(code);
    if (room.phase !== "drawing") return { ok: true };
    if (!room.round_ends_at) return { ok: true };
    if (new Date(room.round_ends_at).getTime() > Date.now()) return { ok: true };
    await endRoundInternal(code, null);
    return { ok: true };
  });

export const advanceFromRoundEnd = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; playerId: string }) => {
    const schema = z.object({
      code: z.string().regex(CODE_RE),
      playerId: z.string().regex(PID_RE),
    });
    return schema.parse(input);
  })
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const room = await loadRoom(code);
    if (room.host_id !== data.playerId) throw new Error("Not host");
    if (room.phase !== "round_end") return { ok: true };

    const players = await loadPlayers(code);
    if (room.drawer_queue.length === 0) {
      // End of round cycle — advance round counter or end game
      if (room.current_round >= room.total_rounds) {
        await supabaseAdmin
          .from("rooms")
          .update({
            phase: "game_end",
            current_drawer_id: null,
            secret_word: null,
            word_choices: [],
            word_mask: "",
            round_ends_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("code", code);
        await postSystemMessage(code, "Game over!");
        return { ok: true };
      }
      // Start a new full round
      await beginNextRoundInternal(code, players.map((p) => p.id));
      return { ok: true };
    }
    await beginNextDrawerInternal(code);
    return { ok: true };
  });

export const playAgain = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; playerId: string }) => {
    const schema = z.object({
      code: z.string().regex(CODE_RE),
      playerId: z.string().regex(PID_RE),
    });
    return schema.parse(input);
  })
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const room = await loadRoom(code);
    if (room.host_id !== data.playerId) throw new Error("Not host");

    await supabaseAdmin
      .from("players")
      .update({ score: 0, round_score: 0, guessed_correctly: false, guess_order: null })
      .eq("room_code", code);

    await supabaseAdmin
      .from("rooms")
      .update({
        phase: "lobby",
        current_round: 0,
        current_drawer_id: null,
        secret_word: null,
        word_choices: [],
        word_mask: "",
        round_ends_at: null,
        used_words: [],
        drawer_queue: [],
        updated_at: new Date().toISOString(),
      })
      .eq("code", code);
    return { ok: true };
  });

// ---------- internals ----------

async function beginNextRoundInternal(code: string, playerIds: string[]) {
  const room = await loadRoom(code);
  const queue = [...playerIds].sort(() => Math.random() - 0.5);
  await supabaseAdmin
    .from("rooms")
    .update({
      current_round: room.current_round + 1,
      drawer_queue: queue,
      phase: "choosing",
      updated_at: new Date().toISOString(),
    })
    .eq("code", code);
  await beginNextDrawerInternal(code);
}

async function beginNextDrawerInternal(code: string) {
  const room = await loadRoom(code);
  const queue = [...room.drawer_queue];
  const players = await loadPlayers(code);
  let drawerId: string | undefined;
  while (queue.length > 0) {
    const candidate = queue.shift()!;
    if (players.some((p) => p.id === candidate)) {
      drawerId = candidate;
      break;
    }
  }
  if (!drawerId) {
    // No valid drawers — end round cycle
    await supabaseAdmin
      .from("rooms")
      .update({
        drawer_queue: [],
        phase: "round_end",
        updated_at: new Date().toISOString(),
      })
      .eq("code", code);
    return;
  }

  // Reset per-round state
  await supabaseAdmin
    .from("players")
    .update({ guessed_correctly: false, guess_order: null, round_score: 0 })
    .eq("room_code", code);

  const choices = pickWordChoices(
    room.difficulty as "easy" | "medium" | "hard" | "mixed",
    room.used_words,
    3,
  );
  await supabaseAdmin
    .from("rooms")
    .update({
      phase: "choosing",
      current_drawer_id: drawerId,
      secret_word: null,
      word_choices: choices,
      word_mask: "",
      round_ends_at: null,
      drawer_queue: queue,
      updated_at: new Date().toISOString(),
    })
    .eq("code", code);

  const drawer = players.find((p) => p.id === drawerId);
  if (drawer) await postSystemMessage(code, `${drawer.name} is drawing`);
}

async function endRoundInternal(code: string, reason: string | null) {
  const room = await loadRoom(code);
  if (room.secret_word) {
    await postSystemMessage(
      code,
      reason
        ? `Round ended — ${reason}. Word was "${room.secret_word}"`
        : `Word was "${room.secret_word}"`,
    );
  } else if (reason) {
    await postSystemMessage(code, `Round ended — ${reason}`);
  }
  await supabaseAdmin
    .from("rooms")
    .update({
      phase: "round_end",
      round_ends_at: null,
      // Reveal the word publicly now that the round is over.
      word_mask: room.secret_word ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("code", code);
}

// ---------- drawer-only secret retrieval ----------
// secret_word and word_choices are revoked from anon/authenticated at the
// column level so guessers can't read them via the API or realtime.
// The drawer fetches them via this server function, which checks the player
// is actually the current drawer for that room.

export const getDrawerSecret = createServerFn({ method: "POST" })
  .inputValidator((input: { playerId: string; code: string }) => {
    const schema = z.object({
      playerId: z.string().regex(PID_RE),
      code: z.string().regex(CODE_RE),
    });
    return schema.parse(input);
  })
  .handler(async ({ data }) => {
    const code = data.code.toUpperCase();
    const { data: row, error } = await supabaseAdmin
      .from("rooms")
      .select("current_drawer_id, phase, secret_word, word_choices")
      .eq("code", code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Room not found");
    if (row.current_drawer_id !== data.playerId) {
      // Don't leak whether choosing/drawing — just return empty.
      return { secret_word: null as string | null, word_choices: [] as string[] };
    }
    return {
      secret_word: (row.secret_word ?? null) as string | null,
      word_choices: (row.word_choices ?? []) as string[],
    };
  });
