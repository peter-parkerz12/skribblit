export type GamePhase =
  | "lobby"
  | "choosing"
  | "drawing"
  | "round_end"
  | "game_end";

export interface Room {
  code: string;
  host_id: string;
  phase: GamePhase;
  current_round: number;
  total_rounds: number;
  round_seconds: number;
  max_players: number;
  current_drawer_id: string | null;
  secret_word: string | null;
  word_choices: string[];
  round_ends_at: string | null;
  used_words: string[];
  drawer_queue: string[];
  difficulty: "easy" | "medium" | "hard" | "mixed";
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  room_code: string;
  name: string;
  color: string;
  score: number;
  round_score: number;
  is_host: boolean;
  guessed_correctly: boolean;
  guess_order: number | null;
  joined_at: string;
  last_seen: string;
}

export interface Message {
  id: string;
  room_code: string;
  player_id: string;
  player_name: string;
  player_color: string;
  content: string;
  kind: "chat" | "correct" | "system" | "close";
  created_at: string;
}

export interface StrokePoint {
  x: number; // 0-1 normalized
  y: number;
}

export interface StrokePayload {
  type: "stroke";
  color: string;
  size: number;
  tool: "pen" | "eraser";
  points: StrokePoint[];
  drawerId: string;
}

export interface ClearPayload {
  type: "clear";
  drawerId: string;
}

export type DrawEvent = StrokePayload | ClearPayload;
