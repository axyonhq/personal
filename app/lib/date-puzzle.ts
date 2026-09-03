export const BALI_TIME_ZONE = "Asia/Makassar";
export const UNLOCK_HOUR = 6;

export type DateDecision = "accepted" | "rejected";

export type Hint =
  | { id: string; kind: "text"; text: string }
  | { id: string; kind: "emoji"; emoji: string; label: string }
  | { id: string; kind: "image"; src: string; alt: string };

export type PuzzleDate = {
  id: string;
  startsAt: string;
  hints: Hint[];
  /** Sealed until 24 hours before `startsAt`. Omitted dates hide the button. */
  instructions?: string;
};

export type PuzzleState = {
  decisions: Record<string, DateDecision>;
  unlockedHintIds: string[];
  /** Bali puzzle-day id of the last unlock, shared across every date. */
  lastUnlockDay: string | null;
  /** Puzzle-day id of the last unlock, keyed by date id. Used until the shared-credit cutover. */
  lastUnlockDays: Record<string, string>;
  epoch: string;
};

/** Bump this to wipe accepts and unlocks on the next load. */
export const STATE_EPOCH = "v3-one-daily-credit";

/**
 * First Bali puzzle day (06:00→06:00) with one unlock credit for the whole board.
 * Until then each accepted date still has its own daily piece.
 */
export const SHARED_CREDIT_START_DAY = "2026-09-04";

export type UnlockError =
  | "unknown_hint"
  | "not_accepted"
  | "already_unlocked"
  | "no_credit"
  | "unknown_date"
  | "already_decided";

/** The instructions map unseals this long before the date starts. */
export const INSTRUCTIONS_LEAD_MS = 86_400_000;

const MONDAY_INSTRUCTIONS = `Caitlyn, my love, the wait is finally over. Our disney movie starts tonight 😉

The team wanted to congratulate you for being shortlisted for date, truly an astounding accomplishment.

The instructions are simple:

Be ready by 5pm. Daddy will arrive at your abode on his green charriot. Wear something classy & beautiful, so it matches your personality. Heels are welcome but not required. Recommended colours: black, white, or red.

Please be prepared for a bashful encounter, as daddy plans on bringing out your shy side.

Just incase he invites you over for a mean girls slumber party, he recommends packing some morning coffee-appopriate clothing.

The evening will begin in the Daddy Batcave, for some pre-dinner get to know you activities. Such as 'pin the tail on the donkey', 'pass the parcel', and of course, 2-person duck duck goose.

We will then proceed to our dinner date, at approximately 6:30pm. As you likely guessed, we will be attending a fine established located in the heart of Pererererererererererererererernan, called Shelter; providing a variety of cuisine & a wide array of cocktails.

The next step: please disclose your AirBnb address to daddy via an encrypted WhatsApp message at your earliest possible convenience. This must be done before 3pm on Monday, or the date will be canceled.

NOTE: if you are a good girl for the entirety of the date, you will likely be provided soft post-date care, as daddy understands you will have had a tiring day of travel.

Here is a short summary so you can turn your brain off:

1. Be ready by 5pm
2. Wear something classy (red, white or black)
3. Pack some morning coffee clothes

Warm regards,

King/prince/master/daddy Nick`;

export const DATES: PuzzleDate[] = [
  {
    id: "2026-09-07",
    startsAt: "2026-09-07T17:00:00+08:00",
    instructions: MONDAY_INSTRUCTIONS,
    hints: [
      {
        id: "d1-locations",
        kind: "text",
        text: "Three locations. One of them at the start of the evening — and again at the end.",
      },
      { id: "d1-strawberry", kind: "emoji", emoji: "🍓", label: "A strawberry." },
      { id: "d1-icecream", kind: "emoji", emoji: "🍦", label: "Ice cream." },
      {
        id: "d1-shelter",
        kind: "image",
        src: "/discovery/shelter-couple.png",
        alt: "Two people standing close under a shelter",
      },
    ],
  },
  {
    id: "2026-09-09",
    startsAt: "2026-09-09T12:00:00+08:00",
    hints: [
      {
        id: "d2-sunrise",
        kind: "image",
        src: "/discovery/sunrise.png",
        alt: "A spectacular sunrise",
      },
      {
        id: "d2-compass",
        kind: "image",
        src: "/discovery/compass-north.png",
        alt: "A compass with a red needle pointing straight up at NORTH",
      },
      {
        id: "d2-helmet",
        kind: "image",
        src: "/discovery/pink-helmet.png",
        alt: "A pink helmet",
      },
      {
        id: "d2-trip",
        kind: "image",
        src: "/discovery/tripping.png",
        alt: "Someone tripping over",
      },
    ],
  },
];

export const emptyState = (): PuzzleState => ({
  decisions: {},
  unlockedHintIds: [],
  lastUnlockDay: null,
  lastUnlockDays: {},
  epoch: STATE_EPOCH,
});

type ZoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: string;
};

export function zonedParts(date: Date, timeZone = BALI_TIME_ZONE): ZoneParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "long",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: get("weekday"),
  };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Calendar id of the current 06:00→06:00 Bali puzzle day. */
export function puzzleDayId(now: Date, timeZone = BALI_TIME_ZONE): string {
  const parts = zonedParts(now, timeZone);
  if (parts.hour < UNLOCK_HOUR) {
    const previous = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - 86_400_000);
    return isoDate(previous.getUTCFullYear(), previous.getUTCMonth() + 1, previous.getUTCDate());
  }
  return isoDate(parts.year, parts.month, parts.day);
}

/** Instant for a Bali wall-clock time. WITA is UTC+8 with no DST. */
export function baliWallTime(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
}

export function nextCreditAt(now: Date, timeZone = BALI_TIME_ZONE): Date {
  const parts = zonedParts(now, timeZone);
  const sixToday = baliWallTime(parts.year, parts.month, parts.day, UNLOCK_HOUR);
  if (now.getTime() < sixToday.getTime()) return sixToday;
  const tomorrow = new Date(Date.UTC(parts.year, parts.month - 1, parts.day) + 86_400_000);
  return baliWallTime(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    UNLOCK_HOUR,
  );
}

export function findDate(dateId: string, dates = DATES): PuzzleDate | undefined {
  return dates.find((date) => date.id === dateId);
}

export function findHint(
  hintId: string,
  dates = DATES,
): { date: PuzzleDate; hint: Hint } | undefined {
  for (const date of dates) {
    const hint = date.hints.find((item) => item.id === hintId);
    if (hint) return { date, hint };
  }
  return undefined;
}

export function pendingDate(state: PuzzleState, dates = DATES): PuzzleDate | null {
  return dates.find((date) => !state.decisions[date.id]) ?? null;
}

export function acceptedDates(state: PuzzleState, dates = DATES): PuzzleDate[] {
  return dates.filter((date) => state.decisions[date.id] === "accepted");
}

export function lockedHintsOnDate(state: PuzzleState, date: PuzzleDate): Hint[] {
  return date.hints.filter((hint) => !state.unlockedHintIds.includes(hint.id));
}

export function lockedHintsOnAccepted(state: PuzzleState, dates = DATES): Hint[] {
  return acceptedDates(state, dates).flatMap((date) => lockedHintsOnDate(state, date));
}

export function usesSharedDailyCredit(now: Date, timeZone = BALI_TIME_ZONE): boolean {
  return puzzleDayId(now, timeZone) >= SHARED_CREDIT_START_DAY;
}

function spentPuzzleDays(state: PuzzleState): string[] {
  const days: string[] = [];
  if (state.lastUnlockDay) days.push(state.lastUnlockDay);
  for (const value of Object.values(state.lastUnlockDays ?? {})) {
    if (value) days.push(value);
  }
  return days;
}

/** Whether today's shared (or, before the cutover, per-date) credit is still unspent on this date. */
export function dateCreditAvailable(
  state: PuzzleState,
  dateId: string,
  now: Date,
  dates = DATES,
): boolean {
  const date = findDate(dateId, dates);
  if (!date) return false;
  if (state.decisions[dateId] !== "accepted") return false;
  if (lockedHintsOnDate(state, date).length === 0) return false;
  const day = puzzleDayId(now);
  if (day >= SHARED_CREDIT_START_DAY) {
    return !spentPuzzleDays(state).includes(day);
  }
  return (state.lastUnlockDays ?? {})[dateId] !== day;
}

export function readyCreditCount(state: PuzzleState, now: Date, dates = DATES): number {
  if (lockedHintsOnAccepted(state, dates).length === 0) return 0;
  if (usesSharedDailyCredit(now)) {
    return spentPuzzleDays(state).includes(puzzleDayId(now)) ? 0 : 1;
  }
  return dates.filter((date) => dateCreditAvailable(state, date.id, now, dates)).length;
}

/** True when at least one accepted date can still spend today's credit. */
export function creditAvailable(state: PuzzleState, now: Date, dates = DATES): boolean {
  return readyCreditCount(state, now, dates) > 0;
}

export function applyDecision(
  state: PuzzleState,
  dateId: string,
  decision: DateDecision,
  dates = DATES,
): { ok: true; state: PuzzleState } | { ok: false; error: UnlockError } {
  if (!findDate(dateId, dates)) return { ok: false, error: "unknown_date" };
  if (state.decisions[dateId]) return { ok: false, error: "already_decided" };
  return {
    ok: true,
    state: {
      ...state,
      decisions: { ...state.decisions, [dateId]: decision },
    },
  };
}

export function applyUnlock(
  state: PuzzleState,
  hintId: string,
  now: Date,
  dates = DATES,
): { ok: true; state: PuzzleState } | { ok: false; error: UnlockError } {
  const found = findHint(hintId, dates);
  if (!found) return { ok: false, error: "unknown_hint" };
  if (state.decisions[found.date.id] !== "accepted") {
    return { ok: false, error: "not_accepted" };
  }
  if (state.unlockedHintIds.includes(hintId)) {
    return { ok: false, error: "already_unlocked" };
  }
  if (!dateCreditAvailable(state, found.date.id, now, dates)) {
    return { ok: false, error: "no_credit" };
  }
  const day = puzzleDayId(now);
  return {
    ok: true,
    state: {
      ...state,
      unlockedHintIds: [...state.unlockedHintIds, hintId],
      lastUnlockDay: day,
      lastUnlockDays: {
        ...(state.lastUnlockDays ?? {}),
        [found.date.id]: day,
      },
    },
  };
}

export function ordinal(n: number): string {
  const teens = n % 100;
  if (teens >= 11 && teens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatDateTitle(startsAt: string, timeZone = BALI_TIME_ZONE): string {
  const parts = zonedParts(new Date(startsAt), timeZone);
  return `${parts.weekday}, ${ordinal(parts.day)} ${monthName(parts.month)}`;
}

export function formatStartTime(startsAt: string, timeZone = BALI_TIME_ZONE): string {
  const parts = zonedParts(new Date(startsAt), timeZone);
  const suffix = parts.hour >= 12 ? "PM" : "AM";
  const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  return `${hour12}:${pad(parts.minute)} ${suffix}`;
}

function monthName(month: number): string {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][month - 1]!;
}

export type Remaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
};

export function remainingUntil(now: Date, target: Date): Remaining {
  const ms = Math.max(0, target.getTime() - now.getTime());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { days, hours, minutes, seconds, done: now.getTime() >= target.getTime() };
}

export function instructionsUnlockAt(startsAt: string): Date {
  return new Date(new Date(startsAt).getTime() - INSTRUCTIONS_LEAD_MS);
}

/** True once we are inside the 24-hour window (and the date was not declined). */
export function instructionsUnlocked(
  startsAt: string,
  now: Date,
  decision?: DateDecision,
): boolean {
  if (decision === "rejected") return false;
  return now.getTime() >= instructionsUnlockAt(startsAt).getTime();
}

export function instructionParagraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function allHints(dates = DATES): Hint[] {
  return dates.flatMap((date) => date.hints);
}

export function hintById(hintId: string, dates = DATES): Hint | undefined {
  return findHint(hintId, dates)?.hint;
}
