"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DATES,
  allHints,
  creditAvailable,
  formatDateTitle,
  formatStartTime,
  nextCreditAt,
  pendingDate,
  remainingUntil,
  type Hint,
  type PuzzleDate,
  type PuzzleState,
  type Remaining,
} from "@/app/lib/date-puzzle";

type View = {
  ok: boolean;
  error?: string;
  state: PuzzleState;
  creditAvailable: boolean;
  nextCreditAt: string;
  persisted: boolean;
};

type Cinema = {
  hint: Hint;
  phase: "windup" | "crack" | "reveal";
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function playChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (const [index, freq] of notes.entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.02 + index * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55 + index * 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * 0.09);
      osc.stop(now + 0.7 + index * 0.09);
    }
  } catch {
    /* autoplay / unsupported */
  }
}

function LockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <rect x="5" y="11" width="14" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 15v2.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function HintFace({ hint }: { hint: Hint }) {
  if (hint.kind === "emoji") {
    return (
      <span className="dx-hint-emoji" aria-label={hint.label}>
        {hint.emoji}
      </span>
    );
  }
  if (hint.kind === "image") {
    return <img src={hint.src} alt={hint.alt} />;
  }
  return <p className="dx-hint-text">{hint.text}</p>;
}

function Count({ remaining }: { remaining: Remaining }) {
  const cells = [
    [remaining.days, "days"],
    [remaining.hours, "hrs"],
    [remaining.minutes, "min"],
    [remaining.seconds, "sec"],
  ] as const;
  return (
    <div className="dx-count">
      {cells.map(([value, label]) => (
        <div className="dx-count-cell" key={label}>
          <div className="dx-count-num">{pad(value)}</div>
          <div className="dx-count-lbl">{label}</div>
        </div>
      ))}
    </div>
  );
}

export function DateDiscovery() {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);
  const [cinema, setCinema] = useState<Cinema | null>(null);
  const [shakeId, setShakeId] = useState("");
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = window.setInterval(() => setNow(new Date()), 250);
    return () => window.clearInterval(tick);
  }, []);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/discovery", { cache: "no-store" });
    const data = (await response.json()) as View;
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "load_failed");
    }
    setView(data);
    setError("");
  }, []);

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not open the vault.");
    });
  }, [refresh]);

  const post = useCallback(
    async (body: Record<string, string>) => {
      const response = await fetch("/api/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as View;
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "save_failed");
      }
      setView(data);
      return data;
    },
    [],
  );

  const state = view?.state;
  const invite = state ? pendingDate(state) : null;
  const canUnlock = state ? creditAvailable(state, now) : false;
  const nextAt = useMemo(() => nextCreditAt(now), [now]);
  const nextParts = remainingUntil(now, nextAt);
  const unlockedCount = state?.unlockedHintIds.length ?? 0;
  const total = allHints().length;

  async function decide(decision: "accepted" | "rejected") {
    if (!invite || busy) return;
    setBusy(true);
    try {
      await post({ action: "decide", dateId: invite.id, decision });
      setConfirmReject(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that.");
    } finally {
      setBusy(false);
    }
  }

  function runCinema(hint: Hint) {
    if (reduced.current) {
      setCinema({ hint, phase: "reveal" });
      window.setTimeout(() => setCinema(null), 1600);
      return;
    }
    setCinema({ hint, phase: "windup" });
    window.setTimeout(() => setCinema({ hint, phase: "crack" }), 900);
    window.setTimeout(() => {
      playChime();
      setCinema({ hint, phase: "reveal" });
    }, 1600);
    window.setTimeout(() => setCinema(null), 4200);
  }

  async function tryUnlock(date: PuzzleDate, hint: Hint) {
    if (!state || cinema) return;
    if (state.unlockedHintIds.includes(hint.id)) return;
    if (state.decisions[date.id] !== "accepted") return;
    if (!canUnlock) {
      setShakeId(hint.id);
      window.setTimeout(() => setShakeId(""), 450);
      return;
    }
    setBusy(true);
    try {
      const next = await post({ action: "unlock", hintId: hint.id });
      const unlocked = allHints().find((item) => item.id === hint.id);
      if (unlocked && next.state.unlockedHintIds.includes(hint.id)) {
        runCinema(unlocked);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That piece stayed sealed.");
      refresh().catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }

  if (!view && !error) {
    return (
      <div className="dx-boot">
        <div className="dx-cinema-card">
          <p className="dx-kicker">Date Discovery Puzzle</p>
          <h2>Hold still.</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dx-shell">
      <p className="dx-kicker">A private evening · Bali time</p>
      <h1 className="dx-title">Date Discovery Puzzle</h1>
      <p className="dx-lede">
        Every morning at 6:00, one new piece can be turned. Choose carefully.
        Once it is yours, it stays.
      </p>

      <div className="dx-hud">
        <div>
          <div className="dx-hud-label">The puzzle</div>
          <div className="dx-hud-value">
            {unlockedCount} / {total} pieces
          </div>
        </div>
        <div className="dx-credit" data-ready={canUnlock ? "true" : "false"}>
          {canUnlock
            ? "1 unlock ready"
            : `Next credit ${pad(nextParts.hours)}:${pad(nextParts.minutes)}:${pad(nextParts.seconds)}`}
        </div>
      </div>

      {error ? <p className="dx-error">{humanError(error)}</p> : null}

      {DATES.map((date) => (
        <DateCard
          key={date.id}
          date={date}
          now={now}
          state={state}
          canUnlock={canUnlock}
          shakeId={shakeId}
          onUnlock={tryUnlock}
        />
      ))}

      {view && !view.persisted ? (
        <p className="dx-note">
          Vault keys are not on this machine yet — progress is held in this session until
          Supabase is connected.
        </p>
      ) : null}

      {invite ? (
        <div className="dx-gate" role="dialog" aria-modal="true">
          <div className="dx-gate-card">
            <p className="dx-kicker">An invitation</p>
            <h2>{formatDateTitle(invite.startsAt)}</h2>
            <p>
              {formatStartTime(invite.startsAt)} · Bali. Accept, and a new hint can be
              turned each morning. Decline, and this evening stays sealed.
            </p>
            {confirmReject ? (
              <>
                <p className="dx-confirm">If you decline, the hints stay sealed.</p>
                <div className="dx-actions">
                  <button type="button" className="dx-btn-ghost dx-btn" onClick={() => setConfirmReject(false)}>
                    Wait
                  </button>
                  <button type="button" className="dx-btn" onClick={() => void decide("rejected")} disabled={busy}>
                    Decline anyway
                  </button>
                </div>
              </>
            ) : (
              <div className="dx-actions">
                <button type="button" className="dx-btn" onClick={() => void decide("accepted")} disabled={busy}>
                  Accept
                </button>
                <button
                  type="button"
                  className="dx-btn dx-btn-ghost"
                  onClick={() => setConfirmReject(true)}
                  disabled={busy}
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {cinema ? (
        <div className="dx-cinema" data-phase={cinema.phase}>
          {cinema.phase === "reveal" ? <div className="dx-dust" aria-hidden="true" /> : null}
          <div className="dx-cinema-card">
            {cinema.phase !== "reveal" ? (
              <>
                <div className="dx-cinema-lock">
                  <LockIcon />
                </div>
                <p className="dx-kicker">
                  {cinema.phase === "windup" ? "The seal is warming" : "Almost"}
                </p>
                <h2>{cinema.phase === "windup" ? "Hold still." : "It gives."}</h2>
              </>
            ) : (
              <>
                <p className="dx-kicker">A piece of the evening</p>
                <h2>Yours.</h2>
                <div className="dx-date" style={{ marginTop: "1.2rem" }}>
                  <div className="dx-hint" data-locked="false" data-kind={cinema.hint.kind}>
                    <div className="dx-hint-body">
                      <HintFace hint={cinema.hint} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DateCard({
  date,
  now,
  state,
  canUnlock,
  shakeId,
  onUnlock,
}: {
  date: PuzzleDate;
  now: Date;
  state?: PuzzleState;
  canUnlock: boolean;
  shakeId: string;
  onUnlock: (date: PuzzleDate, hint: Hint) => void;
}) {
  const decision = state?.decisions[date.id];
  const start = new Date(date.startsAt);
  const left = remainingUntil(now, start);
  const unlockedHere = date.hints.filter((hint) => state?.unlockedHintIds.includes(hint.id)).length;

  return (
    <article className="dx-date" data-declined={decision === "rejected" ? "true" : "false"}>
      <div className="dx-date-head">
        <div>
          <p className="dx-kicker">
            {decision === "accepted"
              ? `${unlockedHere} / ${date.hints.length} unlocked`
              : decision === "rejected"
                ? "Declined"
                : "Pending"}
          </p>
          <h2 className="dx-date-title">{formatDateTitle(date.startsAt)}</h2>
        </div>
        <p className="dx-date-meta">{formatStartTime(date.startsAt)} · Bali</p>
      </div>

      {left.done ? (
        <p className="dx-now">It&apos;s time.</p>
      ) : (
        <Count remaining={left} />
      )}

      {decision === "rejected" ? (
        <p className="dx-declined">The hints stay sealed. This evening was turned down.</p>
      ) : (
        <div className="dx-hints">
          {date.hints.map((hint) => {
            const unlocked = Boolean(state?.unlockedHintIds.includes(hint.id));
            const can = decision === "accepted" && !unlocked && canUnlock;
            return (
              <button
                key={hint.id}
                type="button"
                className="dx-hint"
                data-locked={unlocked ? "false" : "true"}
                data-can={can ? "true" : "false"}
                data-kind={hint.kind}
                data-shake={shakeId === hint.id ? "true" : "false"}
                onClick={() => onUnlock(date, hint)}
                aria-label={unlocked ? "Unlocked hint" : "Locked hint"}
              >
                <div className="dx-hint-body">
                  <HintFace hint={hint} />
                </div>
                {!unlocked ? (
                  <span className="dx-lock">
                    <span className="dx-lock-mark">
                      <LockIcon />
                    </span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

function humanError(code: string): string {
  switch (code) {
    case "no_credit":
      return "Today’s piece is already spent. Come back at 6:00 AM Bali.";
    case "already_unlocked":
      return "That piece is already yours.";
    case "not_accepted":
      return "That evening was not accepted.";
    case "table_missing":
      return "The vault table is not created yet. Run the date_discovery_state migration in the new Supabase project.";
    case "store_failed":
      return "The vault could not be reached.";
    default:
      return code.replaceAll("_", " ");
  }
}
