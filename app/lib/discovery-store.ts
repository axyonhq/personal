import { cookies } from "next/headers";
import {
  applyDecision,
  applyUnlock,
  creditAvailable,
  emptyState,
  nextCreditAt,
  puzzleDayId,
  readyCreditCount,
  STATE_EPOCH,
  usesSharedDailyCredit,
  type DateDecision,
  type PuzzleState,
} from "./date-puzzle";

type DbRow = {
  id: string;
  decisions: Record<string, DateDecision> | null;
  unlocked_hint_ids: string[] | null;
  last_unlock_day: string | null;
  last_unlock_days: Record<string, string> | null;
  updated_at: string;
};

type StoreConfig = { url: string; key: string };

const COOKIE_NAME = "dx_puzzle_v3";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

const globalStore = globalThis as typeof globalThis & {
  __dateDiscoveryMemoryV3?: PuzzleState;
  __dateDiscoveryFallback?: boolean;
  __dateDiscoveryUsingCookie?: boolean;
};

function config(): StoreConfig | null {
  const url = process.env.DISCOVERY_SUPABASE_URL?.trim();
  const key = process.env.DISCOVERY_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

export function discoveryConfigured(): boolean {
  return config() !== null;
}

function memoryState(): PuzzleState {
  globalStore.__dateDiscoveryMemoryV3 ??= emptyState();
  return globalStore.__dateDiscoveryMemoryV3;
}

function setMemory(state: PuzzleState): PuzzleState {
  globalStore.__dateDiscoveryMemoryV3 = state;
  return state;
}

function headers(key: string): HeadersInit {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

function dateKeysFromDays(raw: Record<string, string> | null | undefined): Record<string, string> {
  const days: Record<string, string> = {};
  if (!raw || typeof raw !== "object") return days;
  for (const [key, value] of Object.entries(raw)) {
    if (key === "epoch" || key === "global") continue;
    if (typeof value === "string" && value) days[key] = value;
  }
  return days;
}

function latestDay(days: string[]): string | null {
  let latest: string | null = null;
  for (const day of days) {
    if (!latest || day > latest) latest = day;
  }
  return latest;
}

function fromRow(row: DbRow): PuzzleState {
  const lastUnlockDays = dateKeysFromDays(row.last_unlock_days);
  const storedGlobal = row.last_unlock_day || row.last_unlock_days?.global || "";
  return {
    decisions: row.decisions ?? {},
    unlockedHintIds: row.unlocked_hint_ids ?? [],
    lastUnlockDay: storedGlobal || latestDay(Object.values(lastUnlockDays)),
    lastUnlockDays,
    epoch: row.last_unlock_days?.epoch ?? "",
  };
}

function encodeCookie(state: PuzzleState): string {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

function decodeCookie(raw: string): PuzzleState | null {
  try {
    const json = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<PuzzleState> & {
      lastUnlockDays?: Record<string, string>;
    };
    if (!parsed || typeof parsed !== "object") return null;
    const lastUnlockDays = dateKeysFromDays(parsed.lastUnlockDays);
    const lastUnlockDay =
      typeof parsed.lastUnlockDay === "string" && parsed.lastUnlockDay
        ? parsed.lastUnlockDay
        : latestDay(Object.values(lastUnlockDays));
    return {
      decisions:
        parsed.decisions && typeof parsed.decisions === "object" ? parsed.decisions : {},
      unlockedHintIds: Array.isArray(parsed.unlockedHintIds)
        ? parsed.unlockedHintIds.filter((id): id is string => typeof id === "string")
        : [],
      lastUnlockDay,
      lastUnlockDays,
      epoch: STATE_EPOCH,
    };
  } catch {
    return null;
  }
}

async function readCookieState(): Promise<PuzzleState | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(COOKIE_NAME)?.value;
    if (!raw) return null;
    return decodeCookie(raw);
  } catch {
    return null;
  }
}

async function writeCookieState(state: PuzzleState): Promise<PuzzleState> {
  try {
    const jar = await cookies();
    jar.set(COOKIE_NAME, encodeCookie(state), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.VERCEL === "1" || process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    globalStore.__dateDiscoveryUsingCookie = true;
  } catch {
    globalStore.__dateDiscoveryUsingCookie = false;
  }
  return setMemory(state);
}

async function rest<T>(
  conf: StoreConfig,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: T | null; error: string }> {
  const response = await fetch(`${conf.url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(conf.key), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await response.text();
  let data: T | null = null;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      return { ok: false, status: response.status, data: null, error: text.slice(0, 400) };
    }
  }
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : text.slice(0, 400) || `http_${response.status}`;
    return { ok: false, status: response.status, data: null, error: message };
  }
  return { ok: true, status: response.status, data, error: "" };
}

function isMissingTable(error: string): boolean {
  return /could not find the table|relation .* does not exist|schema cache/i.test(error);
}

function persistBody(state: PuzzleState) {
  return {
    decisions: state.decisions,
    unlocked_hint_ids: state.unlockedHintIds,
    last_unlock_day: state.lastUnlockDay,
    last_unlock_days: {
      ...state.lastUnlockDays,
      epoch: state.epoch,
      global: state.lastUnlockDay ?? "",
    },
    updated_at: new Date().toISOString(),
  };
}

async function readRow(conf: StoreConfig): Promise<PuzzleState> {
  const result = await rest<DbRow[]>(
    conf,
    "date_discovery_state?id=eq.singleton&select=id,decisions,unlocked_hint_ids,last_unlock_day,last_unlock_days,updated_at",
  );
  if (!result.ok) {
    if (isMissingTable(result.error) || /last_unlock_day/i.test(result.error)) {
      const fallback = await rest<DbRow[]>(
        conf,
        "date_discovery_state?id=eq.singleton&select=id,decisions,unlocked_hint_ids,last_unlock_days,updated_at",
      );
      if (!fallback.ok) {
        if (isMissingTable(fallback.error)) throw new Error("table_missing");
        throw new Error(fallback.error || "read_failed");
      }
      if (fallback.data?.[0]) return fromRow(fallback.data[0]);
    } else {
      throw new Error(result.error || "read_failed");
    }
  }
  const row = result.data?.[0];
  if (row) return fromRow(row);

  const inserted = await rest<DbRow[]>(conf, "date_discovery_state", {
    method: "POST",
    body: JSON.stringify({
      id: "singleton",
      ...persistBody(emptyState()),
    }),
  });
  if (!inserted.ok || !inserted.data?.[0]) {
    throw new Error(inserted.error || "insert_failed");
  }
  return fromRow(inserted.data[0]);
}

async function writeRow(conf: StoreConfig, state: PuzzleState): Promise<PuzzleState> {
  const result = await rest<DbRow[]>(conf, "date_discovery_state?id=eq.singleton", {
    method: "PATCH",
    body: JSON.stringify(persistBody(state)),
  });
  if (result.ok && result.data?.[0]) return fromRow(result.data[0]);

  const { last_unlock_day: _day, ...withoutDay } = persistBody(state);
  const retry = await rest<DbRow[]>(conf, "date_discovery_state?id=eq.singleton", {
    method: "PATCH",
    body: JSON.stringify(withoutDay),
  });
  if (!retry.ok || !retry.data?.[0]) {
    throw new Error(retry.error || result.error || "write_failed");
  }
  return fromRow(retry.data[0]);
}

async function readLocal(): Promise<PuzzleState> {
  const fromCookie = await readCookieState();
  if (fromCookie) {
    globalStore.__dateDiscoveryUsingCookie = true;
    return setMemory(fromCookie);
  }
  // No cookie = this browser is fresh. Do not reuse another visitor's in-memory state.
  return setMemory(emptyState());
}

async function writeLocal(state: PuzzleState): Promise<PuzzleState> {
  return writeCookieState(state);
}

async function withStore<T>(fn: (conf: StoreConfig | null, current: PuzzleState) => Promise<T>): Promise<T> {
  const conf = config();
  if (!conf) {
    globalStore.__dateDiscoveryFallback = true;
    globalStore.__dateDiscoveryUsingCookie = false;
    return fn(null, await readLocal());
  }
  try {
    let current = await readRow(conf);
    globalStore.__dateDiscoveryFallback = false;
    globalStore.__dateDiscoveryUsingCookie = false;
    if (current.epoch !== STATE_EPOCH) {
      // Stamp the epoch without wiping accepts or unlocks.
      current = await writeRow(conf, { ...current, epoch: STATE_EPOCH });
    }
    return fn(conf, current);
  } catch (error) {
    if (error instanceof Error && error.message === "table_missing") {
      globalStore.__dateDiscoveryFallback = true;
      globalStore.__dateDiscoveryUsingCookie = false;
      return fn(null, await readLocal());
    }
    throw error;
  }
}

export async function loadPuzzleState(): Promise<PuzzleState> {
  return withStore(async (_conf, current) => current);
}

export async function resetPuzzleState(): Promise<PuzzleState> {
  return withStore(async (conf) => {
    const fresh = emptyState();
    return conf ? writeRow(conf, fresh) : writeLocal(fresh);
  });
}

export async function decideDate(dateId: string, decision: DateDecision): Promise<PuzzleState> {
  return withStore(async (conf, current) => {
    const next = applyDecision(current, dateId, decision);
    if (!next.ok) {
      const error = new Error(next.error);
      error.name = next.error;
      throw error;
    }
    return conf ? writeRow(conf, next.state) : writeLocal(next.state);
  });
}

export async function unlockHint(hintId: string, now = new Date()): Promise<PuzzleState> {
  return withStore(async (conf, current) => {
    const next = applyUnlock(current, hintId, now);
    if (!next.ok) {
      const error = new Error(next.error);
      error.name = next.error;
      throw error;
    }
    return conf ? writeRow(conf, next.state) : writeLocal(next.state);
  });
}

export function viewFor(state: PuzzleState, now = new Date()) {
  const vault = discoveryConfigured() && !globalStore.__dateDiscoveryFallback;
  const cookie = Boolean(globalStore.__dateDiscoveryUsingCookie);
  return {
    state,
    creditAvailable: creditAvailable(state, now),
    readyCredits: readyCreditCount(state, now),
    puzzleDay: puzzleDayId(now),
    nextCreditAt: nextCreditAt(now).toISOString(),
    sharedDailyCredit: usesSharedDailyCredit(now),
    /** Unlocks stick for this browser (vault and/or cookie). */
    persisted: vault || cookie,
    vault,
  };
}
