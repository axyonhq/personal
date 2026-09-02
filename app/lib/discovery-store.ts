import {
  applyDecision,
  applyUnlock,
  creditAvailable,
  emptyState,
  nextCreditAt,
  puzzleDayId,
  type DateDecision,
  type PuzzleState,
} from "./date-puzzle";

type DbRow = {
  id: string;
  decisions: Record<string, DateDecision> | null;
  unlocked_hint_ids: string[] | null;
  last_unlock_day: string | null;
  updated_at: string;
};

type StoreConfig = { url: string; key: string };

const globalStore = globalThis as typeof globalThis & {
  __dateDiscoveryMemory?: PuzzleState;
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
  globalStore.__dateDiscoveryMemory ??= emptyState();
  return globalStore.__dateDiscoveryMemory;
}

function setMemory(state: PuzzleState): PuzzleState {
  globalStore.__dateDiscoveryMemory = state;
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

function fromRow(row: DbRow): PuzzleState {
  return {
    decisions: row.decisions ?? {},
    unlockedHintIds: row.unlocked_hint_ids ?? [],
    lastUnlockDay: row.last_unlock_day,
  };
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

async function readRow(conf: StoreConfig): Promise<PuzzleState> {
  const result = await rest<DbRow[]>(
    conf,
    "date_discovery_state?id=eq.singleton&select=id,decisions,unlocked_hint_ids,last_unlock_day,updated_at",
  );
  if (!result.ok) {
    if (/could not find the table|relation .* does not exist/i.test(result.error)) {
      throw new Error("table_missing");
    }
    throw new Error(result.error || "read_failed");
  }
  const row = result.data?.[0];
  if (row) return fromRow(row);

  const inserted = await rest<DbRow[]>(conf, "date_discovery_state", {
    method: "POST",
    body: JSON.stringify({
      id: "singleton",
      decisions: {},
      unlocked_hint_ids: [],
      last_unlock_day: null,
    }),
  });
  if (!inserted.ok || !inserted.data?.[0]) {
    throw new Error(inserted.error || "insert_failed");
  }
  return fromRow(inserted.data[0]);
}

async function writeRow(conf: StoreConfig, state: PuzzleState): Promise<PuzzleState> {
  const result = await rest<DbRow[]>(
    conf,
    "date_discovery_state?id=eq.singleton",
    {
      method: "PATCH",
      body: JSON.stringify({
        decisions: state.decisions,
        unlocked_hint_ids: state.unlockedHintIds,
        last_unlock_day: state.lastUnlockDay,
        updated_at: new Date().toISOString(),
      }),
    },
  );
  if (!result.ok || !result.data?.[0]) {
    throw new Error(result.error || "write_failed");
  }
  return fromRow(result.data[0]);
}

export async function loadPuzzleState(): Promise<PuzzleState> {
  const conf = config();
  if (!conf) return memoryState();
  return readRow(conf);
}

export async function decideDate(dateId: string, decision: DateDecision): Promise<PuzzleState> {
  const conf = config();
  const current = conf ? await readRow(conf) : memoryState();
  const next = applyDecision(current, dateId, decision);
  if (!next.ok) {
    const error = new Error(next.error);
    error.name = next.error;
    throw error;
  }
  return conf ? writeRow(conf, next.state) : setMemory(next.state);
}

export async function unlockHint(hintId: string, now = new Date()): Promise<PuzzleState> {
  const conf = config();
  const current = conf ? await readRow(conf) : memoryState();
  const next = applyUnlock(current, hintId, now);
  if (!next.ok) {
    const error = new Error(next.error);
    error.name = next.error;
    throw error;
  }
  return conf ? writeRow(conf, next.state) : setMemory(next.state);
}

export function viewFor(state: PuzzleState, now = new Date()) {
  return {
    state,
    creditAvailable: creditAvailable(state, now),
    puzzleDay: puzzleDayId(now),
    nextCreditAt: nextCreditAt(now).toISOString(),
    persisted: discoveryConfigured(),
  };
}
