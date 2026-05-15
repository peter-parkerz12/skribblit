// Curated word bank for Skribble. Balanced, drawable, family-friendly.
export type Difficulty = "easy" | "medium" | "hard";

const EASY = [
  "apple","banana","cat","dog","sun","moon","star","tree","car","house",
  "fish","hat","ball","book","cup","key","door","clock","cake","pizza",
  "shoe","sock","bed","chair","table","spoon","fork","knife","plate","bowl",
  "egg","milk","bread","cheese","grape","lemon","orange","pear","carrot","corn",
  "cow","pig","sheep","duck","frog","bee","ant","fox","owl","bear",
  "snake","mouse","rabbit","horse","lion","tiger","monkey","whale","shark","dolphin",
  "boat","plane","train","bike","bus","truck","kite","drum","guitar","piano",
  "flower","cloud","rain","snow","fire","ice","river","mountain","beach","island",
  "smile","heart","eye","hand","foot","ear","nose","mouth","tooth","hair",
  "shirt","pants","jacket","scarf","glove","ring","crown","robot","ghost","alien",
];

const MEDIUM = [
  "airport","bicycle","castle","dragon","elephant","factory","glasses","hammer","igloo","jellyfish",
  "kangaroo","lighthouse","microphone","necklace","octopus","pancake","penguin","rainbow","sandwich","telescope",
  "umbrella","volcano","windmill","xylophone","zebra","backpack","balloon","binoculars","bridge","camera",
  "campfire","candle","carousel","chimney","compass","cookie","crayon","crocodile","cupcake","dinosaur",
  "doctor","dragonfly","drum kit","feather","firefly","fireplace","football","fountain","garden","giraffe",
  "globe","goggles","grill","guitar","hamburger","headphones","helicopter","hospital","ladder","lantern",
  "lipstick","lobster","mailbox","map","mermaid","microscope","mirror","muffin","mushroom","newspaper",
  "ocean","pencil","pillow","pirate","planet","popcorn","postcard","puzzle","pyramid","queen",
  "rocket","sailboat","sandcastle","saxophone","scarecrow","scissors","seashell","skateboard","skyscraper","sledge",
  "soccer","stairs","statue","stethoscope","stopwatch","strawberry","submarine","sunglasses","sushi","swing",
  "tornado","tractor","traffic light","treasure","trumpet","tulip","unicorn","vampire","violin","waffle",
  "wallet","watermelon","wheelbarrow","whistle","witch","wizard","yo-yo","zipper",
];

const HARD = [
  "anchor","archery","astronaut","avalanche","bagpipes","beehive","blueprint","boomerang","calculator","calendar",
  "carpenter","chandelier","chessboard","conductor","constellation","contortionist","corkscrew","crossword","crystal","detective",
  "diplomat","dragonfruit","earthquake","eclipse","escalator","fingerprint","fossil","galaxy","gargoyle","glacier",
  "graffiti","greenhouse","hourglass","hummingbird","iceberg","jigsaw","juggler","kaleidoscope","keyboard","labyrinth",
  "ladybug","lasagna","lemonade","librarian","lightning","magician","marathon","matador","metronome","microscope",
  "monocle","mosaic","mountain range","nightmare","obelisk","origami","parachute","pharaoh","photograph","pickpocket",
  "pinwheel","plumber","podium","porcupine","puppeteer","quarry","quicksand","racetrack","raccoon","raindrop",
  "rhinoceros","robot arm","rollercoaster","sandstorm","scavenger","scorpion","seismograph","silhouette","skydiver","sloth",
  "snowflake","spaghetti","spider web","stagecoach","starfish","stethoscope","stopwatch","sunflower","tambourine","taxidermy",
  "telegraph","thunderstorm","timeline","tightrope","torpedo","tugboat","turntable","tweezers","ukulele","vending machine",
  "ventriloquist","walrus","weather vane","wheelchair","whirlpool","wishbone","woodpecker","wristwatch",
];

export const WORD_BANK: Record<Difficulty, string[]> = {
  easy: EASY,
  medium: MEDIUM,
  hard: HARD,
};

export function getWordPool(difficulty: "easy" | "medium" | "hard" | "mixed"): string[] {
  if (difficulty === "mixed") return [...EASY, ...MEDIUM, ...HARD];
  return WORD_BANK[difficulty];
}

export function pickWordChoices(
  difficulty: "easy" | "medium" | "hard" | "mixed",
  used: string[],
  count = 3,
): string[] {
  const pool = getWordPool(difficulty).filter((w) => !used.includes(w));
  const source = pool.length >= count ? pool : getWordPool(difficulty);
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const w of shuffled) {
    if (seen.has(w)) continue;
    seen.add(w);
    result.push(w);
    if (result.length >= count) break;
  }
  return result;
}

/** Hint mask like "_ _ _ _" with some letters revealed based on elapsed fraction. */
export function maskWord(word: string, revealFraction = 0): string {
  const chars = word.split("");
  const letterIdx = chars
    .map((c, i) => (/[a-zA-Z]/.test(c) ? i : -1))
    .filter((i) => i >= 0);
  const revealCount = Math.min(
    letterIdx.length,
    Math.floor(letterIdx.length * revealFraction),
  );
  const revealed = new Set(
    [...letterIdx].sort(() => Math.random() - 0.5).slice(0, revealCount),
  );
  return chars
    .map((c, i) => (!/[a-zA-Z]/.test(c) ? c : revealed.has(i) ? c : "_"))
    .join(" ");
}
