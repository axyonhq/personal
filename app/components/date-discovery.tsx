"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DATES,
  allHints,
  dateCreditAvailable,
  formatDateTitle,
  formatStartTime,
  instructionParagraphs,
  instructionsUnlockAt,
  instructionsUnlocked,
  nextCreditAt,
  pendingDate,
  readyCreditCount,
  remainingUntil,
  usesSharedDailyCredit,
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
  readyCredits?: number;
  nextCreditAt: string;
  sharedDailyCredit?: boolean;
  persisted: boolean;
  vault?: boolean;
};

type Cinema = {
  hint: Hint;
  phase: "windup" | "crack" | "reveal";
};

const HEARTS = [
  { left: "6%", top: "12%", char: "♡", delay: "0s", size: "1.2rem" },
  { left: "18%", top: "78%", char: "✨", delay: "1.2s", size: "1rem" },
  { left: "28%", top: "22%", char: "💕", delay: "0.4s", size: "1.3rem" },
  { left: "42%", top: "88%", char: "♡", delay: "2s", size: "1.1rem" },
  { left: "58%", top: "8%", char: "🌸", delay: "0.8s", size: "1.15rem" },
  { left: "72%", top: "64%", char: "💖", delay: "1.6s", size: "1.25rem" },
  { left: "84%", top: "18%", char: "✨", delay: "0.2s", size: "0.95rem" },
  { left: "90%", top: "82%", char: "♡", delay: "2.4s", size: "1.2rem" },
  { left: "8%", top: "48%", char: "🎀", delay: "1.8s", size: "1.1rem" },
  { left: "50%", top: "40%", char: "💗", delay: "0.6s", size: "1rem" },
];

const CONFETTI = ["💕", "✨", "🌸", "💖", "🎀", "⭐", "💘", "🩷"];
const MAP_CONFETTI = ["🗺️", "💌", "💖", "✨", "🧭", "👑", "🎀", "💕", "⭐", "🌸"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function playChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77, 1318.5];
    for (const [index, freq] of notes.entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.02 + index * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5 + index * 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * 0.07);
      osc.stop(now + 0.65 + index * 0.07);
    }
  } catch {
    /* autoplay / unsupported */
  }
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
    return (
      <span className="dx-hint-image">
        <img src={hint.src} alt={hint.alt} />
        {hint.id === "d2-compass" ? (
          <span className="dx-north-tag" aria-hidden="true">
            ↑ NORTH
          </span>
        ) : null}
      </span>
    );
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
  const [openMap, setOpenMap] = useState<PuzzleDate | null>(null);
  const [instrShakeId, setInstrShakeId] = useState("");
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

  const post = useCallback(async (body: Record<string, string>) => {
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
  }, []);

  const state = view?.state;
  const invite = state ? pendingDate(state) : null;
  const nextAt = useMemo(() => nextCreditAt(now), [now]);
  const nextParts = remainingUntil(now, nextAt);
  const shared = usesSharedDailyCredit(now);
  const readyCredits = state ? readyCreditCount(state, now) : (view?.readyCredits ?? 0);
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
      window.setTimeout(() => setCinema(null), 1800);
      return;
    }
    setCinema({ hint, phase: "windup" });
    window.setTimeout(() => setCinema({ hint, phase: "crack" }), 800);
    window.setTimeout(() => {
      playChime();
      setCinema({ hint, phase: "reveal" });
    }, 1450);
    window.setTimeout(() => setCinema(null), 4300);
  }

  async function tryUnlock(date: PuzzleDate, hint: Hint) {
    if (!state || cinema || busy) return;
    if (state.unlockedHintIds.includes(hint.id)) {
      setError("already_unlocked");
      return;
    }
    if (state.decisions[date.id] !== "accepted") {
      setError("not_accepted");
      setShakeId(hint.id);
      window.setTimeout(() => setShakeId(""), 450);
      return;
    }
    if (!dateCreditAvailable(state, date.id, now)) {
      setError("no_credit");
      setShakeId(hint.id);
      window.setTimeout(() => setShakeId(""), 450);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await post({ action: "unlock", hintId: hint.id });
      const unlocked = allHints().find((item) => item.id === hint.id);
      if (unlocked && next.state.unlockedHintIds.includes(hint.id)) {
        runCinema(unlocked);
      } else {
        setError("That piece stayed sealed.");
        await refresh().catch(() => undefined);
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
          <h2>Wait for it… 💕</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="dx-shell">
      <div className="dx-floaters" aria-hidden="true">
        {HEARTS.map((heart, index) => (
          <span
            key={index}
            className="dx-floater"
            style={{
              left: heart.left,
              top: heart.top,
              animationDelay: heart.delay,
              fontSize: heart.size,
            }}
          >
            {heart.char}
          </span>
        ))}
      </div>

      <p className="dx-kicker">A cute little secret · Bali time</p>
      <h1 className="dx-title">Date Discovery Puzzle</h1>
      <p className="dx-lede">
        {shared ? (
          <>
            Each date is its own little puzzle. Every morning at 6:00 you get{" "}
            <em>one</em> unlock for the whole board — spend it on whichever piece you
            want.
          </>
        ) : (
          <>
            Each date still has its own daily piece until 6:00 AM Thursday.
            After that you get <em>one</em> unlock a day across every date —
            you choose where it goes.
          </>
        )}
      </p>

      <div className="dx-hud">
        <div>
          <div className="dx-hud-label">Pieces found</div>
          <div className="dx-hud-value">
            {unlockedCount} / {total} 💕
          </div>
        </div>
        <div className="dx-credit" data-ready={readyCredits > 0 ? "true" : "false"}>
          {readyCredits > 0
            ? `${readyCredits} unlock${readyCredits === 1 ? "" : "s"} ready ✨`
            : `Next drop ${pad(nextParts.hours)}:${pad(nextParts.minutes)}:${pad(nextParts.seconds)}`}
        </div>
      </div>

      {error ? <p className="dx-error">{humanError(error)}</p> : null}

      {DATES.map((date) => (
        <DateCard
          key={date.id}
          date={date}
          now={now}
          state={state}
          shakeId={shakeId}
          onUnlock={tryUnlock}
          instrShake={instrShakeId === date.id}
          onOpenInstructions={() => {
            if (!date.instructions) return;
            const decision = state?.decisions[date.id];
            if (!instructionsUnlocked(date.startsAt, now, decision)) {
              setInstrShakeId(date.id);
              window.setTimeout(() => setInstrShakeId(""), 450);
              return;
            }
            setOpenMap(date);
          }}
        />
      ))}

      {view && view.persisted === false ? (
        <p className="dx-note">
          Progress will save on this phone after your first tap — shared vault still warming up.
        </p>
      ) : view && view.vault === false ? (
        <p className="dx-note">Saved on this phone for now. Shared vault still warming up.</p>
      ) : null}

      {invite ? (
        <div className="dx-gate" role="dialog" aria-modal="true">
          <div className="dx-gate-card">
            <p className="dx-kicker">You&apos;re invited</p>
            <h2>{formatDateTitle(invite.startsAt)}</h2>
            <p>
              {formatStartTime(invite.startsAt)} · Bali. Say yes and this date becomes
              a puzzle. From Thursday 6:00 AM you get one flirty piece a day to spend
              on whichever evening you like.
            </p>
            {confirmReject ? (
              <>
                <p className="dx-confirm">If you decline, the hints stay sealed forever.</p>
                <div className="dx-actions">
                  <button type="button" className="dx-btn" onClick={() => setConfirmReject(false)}>
                    Wait, go back
                  </button>
                  <button
                    type="button"
                    className="dx-btn dx-btn-ghost"
                    onClick={() => void decide("rejected")}
                    disabled={busy}
                  >
                    Decline anyway
                  </button>
                </div>
              </>
            ) : (
              <div className="dx-actions">
                <button type="button" className="dx-btn" onClick={() => void decide("accepted")} disabled={busy}>
                  Yes please 💕
                </button>
                <button
                  type="button"
                  className="dx-btn dx-btn-ghost"
                  onClick={() => setConfirmReject(true)}
                  disabled={busy}
                >
                  Not this one
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {openMap?.instructions ? (
        <InstructionsMap date={openMap} onClose={() => setOpenMap(null)} />
      ) : null}

      {cinema ? (
        <div className="dx-cinema" data-phase={cinema.phase}>
          {cinema.phase === "reveal" ? (
            <div className="dx-confetti" aria-hidden="true">
              {Array.from({ length: 22 }, (_, index) => (
                <span
                  key={index}
                  style={{
                    left: `${(index * 17) % 100}%`,
                    animationDelay: `${(index % 7) * 0.08}s`,
                  }}
                >
                  {CONFETTI[index % CONFETTI.length]}
                </span>
              ))}
            </div>
          ) : null}
          <div className="dx-cinema-card">
            {cinema.phase !== "reveal" ? (
              <>
                <div className="dx-cinema-lock">💖</div>
                <p className="dx-kicker">
                  {cinema.phase === "windup" ? "Heart racing" : "It&apos;s opening"}
                </p>
                <h2>{cinema.phase === "windup" ? "Hold still…" : "Almost!!"}</h2>
              </>
            ) : (
              <>
                <p className="dx-kicker">A piece of the evening</p>
                <h2>OMG. Yours.</h2>
                <div className="dx-date" style={{ marginTop: "1.1rem" }}>
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
  shakeId,
  instrShake,
  onUnlock,
  onOpenInstructions,
}: {
  date: PuzzleDate;
  now: Date;
  state?: PuzzleState;
  shakeId: string;
  instrShake: boolean;
  onUnlock: (date: PuzzleDate, hint: Hint) => void;
  onOpenInstructions: () => void;
}) {
  const decision = state?.decisions[date.id];
  const start = new Date(date.startsAt);
  const left = remainingUntil(now, start);
  const unlockedHere = date.hints.filter((hint) => state?.unlockedHintIds.includes(hint.id)).length;
  const canUnlock = state ? dateCreditAvailable(state, date.id, now) : false;
  const mapReady =
    Boolean(date.instructions) && instructionsUnlocked(date.startsAt, now, decision);
  const mapUnlockAt = date.instructions ? instructionsUnlockAt(date.startsAt) : null;

  return (
    <article
      className="dx-date"
      data-declined={decision === "rejected" ? "true" : "false"}
      data-ready={canUnlock ? "true" : "false"}
    >
      <div className="dx-date-head">
        <p className="dx-kicker">
          {decision === "accepted"
            ? `${unlockedHere} / ${date.hints.length} unlocked`
            : decision === "rejected"
              ? "Declined"
              : "Pending"}
        </p>
        <div className="dx-date-headline">
          <h2 className="dx-date-title">{formatDateTitle(date.startsAt)}</h2>
          {date.instructions && mapUnlockAt ? (
            <button
              type="button"
              className="dx-instr"
              data-locked={mapReady ? "false" : "true"}
              data-shake={instrShake ? "true" : "false"}
              onClick={onOpenInstructions}
              aria-haspopup={mapReady ? "dialog" : undefined}
              aria-disabled={mapReady ? undefined : true}
              aria-label={
                mapReady
                  ? "Open date instructions"
                  : decision === "rejected"
                    ? "Date instructions locked. This evening was declined."
                    : `Date instructions locked. Unlocks ${formatDateTitle(mapUnlockAt.toISOString())} at ${formatStartTime(mapUnlockAt.toISOString())}`
              }
              title={
                mapReady
                  ? "Open your date instructions"
                  : `Sealed until ${formatDateTitle(mapUnlockAt.toISOString())} · ${formatStartTime(mapUnlockAt.toISOString())}`
              }
            >
              <span className="dx-instr-mark" aria-hidden="true">
                {mapReady ? "🗺️" : "🔒"}
              </span>
              Date Instructions
            </button>
          ) : null}
          <p className="dx-date-meta">{formatStartTime(date.startsAt)} · Bali</p>
        </div>
        {instrShake && mapUnlockAt ? (
          <p className="dx-instr-nudge">
            {decision === "rejected"
              ? "This evening was turned down — the map stays sealed."
              : `Sealed until ${formatDateTitle(mapUnlockAt.toISOString())} · ${formatStartTime(mapUnlockAt.toISOString())}`}
          </p>
        ) : null}
      </div>

      {left.done ? <p className="dx-now">It&apos;s time, baby.</p> : <Count remaining={left} />}

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
                    <span className="dx-lock-mark">🔒</span>
                    {can ? <span className="dx-tap">tap me</span> : null}
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

function InstructionsMap({
  date,
  onClose,
}: {
  date: PuzzleDate;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"seal" | "open">("seal");
  const letter = instructionParagraphs(date.instructions ?? "");

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const crack = window.setTimeout(
      () => {
        playChime();
        setPhase("open");
      },
      reduced ? 0 : 1100,
    );
    return () => window.clearTimeout(crack);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && phase === "open") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, phase]);

  return (
    <div
      className="dx-map"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dx-map-title"
      data-phase={phase}
      onClick={(event) => {
        if (event.target === event.currentTarget && phase === "open") onClose();
      }}
    >
      {phase === "open" ? (
        <div className="dx-confetti" aria-hidden="true">
          {Array.from({ length: 26 }, (_, index) => (
            <span
              key={index}
              style={{
                left: `${(index * 19) % 100}%`,
                animationDelay: `${(index % 8) * 0.07}s`,
              }}
            >
              {MAP_CONFETTI[index % MAP_CONFETTI.length]}
            </span>
          ))}
        </div>
      ) : null}

      <div className="dx-map-scroll" data-phase={phase}>
        {phase !== "open" ? (
          <>
            <div className="dx-map-seal" aria-hidden="true">
              <span>💌</span>
            </div>
            <p className="dx-kicker">A sealed dispatch</p>
            <h2>The wax is warming</h2>
            <p className="dx-map-whisper">Your map is almost yours, my love.</p>
          </>
        ) : (
          <>
            <button
              type="button"
              className="dx-map-close"
              onClick={onClose}
              aria-label="Close date instructions"
            >
              ✕
            </button>
            <div className="dx-map-compass" aria-hidden="true">
              🧭
            </div>
            <div className="dx-map-trail" aria-hidden="true">
              <span>✨</span>
              <span className="dx-map-dots" />
              <span>💌</span>
              <span className="dx-map-dots" />
              <span>🗺️</span>
              <span className="dx-map-dots" />
              <span>💖</span>
              <span className="dx-map-dots" />
              <span className="dx-map-x">✕</span>
            </div>
            <p className="dx-kicker">X marks the evening</p>
            <h2 id="dx-map-title">Date Instructions</h2>
            <p className="dx-map-when">
              {formatDateTitle(date.startsAt)} · {formatStartTime(date.startsAt)} · Bali
            </p>
            <div className="dx-map-letter">
              {letter.map((paragraph, index) => (
                <p
                  key={index}
                  className={paragraph.startsWith("NOTE:") ? "dx-map-note" : undefined}
                >
                  {paragraph}
                </p>
              ))}
            </div>
            <button type="button" className="dx-btn" onClick={onClose}>
              Seal it back 💌
            </button>
          </>
        )}
      </div>
    </div>
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
      return "The vault table is not created yet.";
    case "store_failed":
      return "The vault could not be reached.";
    default:
      return code.replaceAll("_", " ");
  }
}
