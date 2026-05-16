// Avoid confusing chars: 0/O, 1/I/L
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 5): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

export const PLAYER_COLORS = [
  "#FF5A5F",
  "#FFB400",
  "#3DDC97",
  "#4F8BFF",
  "#A66CFF",
  "#FF7AC6",
  "#00C2A8",
  "#FF8B3D",
];

export function pickPlayerColor(taken: string[]): string {
  const free = PLAYER_COLORS.find((c) => !taken.includes(c));
  return free ?? PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
}

export function sanitizeName(input: string): string {
  return input.replace(/[\u0000-\u001F\u007F<>]/g, "").trim().slice(0, 16);
}

export function sanitizeChat(input: string): string {
  return input.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 120);
}

export function isValidName(name: string): boolean {
  const t = sanitizeName(name);
  return t.length >= 2 && t.length <= 16;
}

export function isValidCode(code: string): boolean {
  return /^[A-Z2-9]{4,8}$/.test(code);
}

/** Levenshtein-1 closeness — used for "close guess" hints. */
export function isCloseGuess(guess: string, word: string): boolean {
  const g = guess.toLowerCase();
  const w = word.toLowerCase();
  if (Math.abs(g.length - w.length) > 1) return false;
  if (g === w) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < g.length && j < w.length) {
    if (g[i] === w[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return false;
      if (g.length === w.length) {
        i++;
        j++;
      } else if (g.length > w.length) {
        i++;
      } else {
        j++;
      }
    }
  }
  edits += g.length - i + (w.length - j);
  return edits === 1;
}

export function getOrCreatePlayerId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "skribblit.playerId";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      "p_" +
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 6);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function getStoredName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("skribblit.name") ?? "";
}

export function setStoredName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("skribblit.name", name);
}
