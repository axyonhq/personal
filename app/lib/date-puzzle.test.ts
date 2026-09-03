import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDecision,
  applyUnlock,
  baliWallTime,
  creditAvailable,
  dateCreditAvailable,
  emptyState,
  formatDateTitle,
  formatStartTime,
  instructionParagraphs,
  instructionsUnlockAt,
  instructionsUnlocked,
  pendingDate,
  puzzleDayId,
  nextCreditAt,
  readyCreditCount,
  remainingUntil,
  usesSharedDailyCredit,
  DATES,
} from "./date-puzzle";

describe("puzzleDayId (Bali 6am boundary)", () => {
  it("is still the previous calendar day at 05:59 Bali", () => {
    const now = baliWallTime(2026, 9, 3, 5, 59, 0);
    assert.equal(puzzleDayId(now), "2026-09-02");
  });

  it("rolls at 06:00 Bali", () => {
    const now = baliWallTime(2026, 9, 3, 6, 0, 0);
    assert.equal(puzzleDayId(now), "2026-09-03");
  });

  it("stays on the same puzzle day at 21:00 Bali", () => {
    const now = baliWallTime(2026, 9, 7, 21, 0, 0);
    assert.equal(puzzleDayId(now), "2026-09-07");
  });
});

describe("nextCreditAt", () => {
  it("points at today's 6am when it is still before 6am", () => {
    const now = baliWallTime(2026, 9, 3, 5, 0, 0);
    assert.equal(nextCreditAt(now).toISOString(), baliWallTime(2026, 9, 3, 6).toISOString());
  });

  it("points at tomorrow's 6am once 6am has passed", () => {
    const now = baliWallTime(2026, 9, 3, 6, 0, 0);
    assert.equal(nextCreditAt(now).toISOString(), baliWallTime(2026, 9, 4, 6).toISOString());
  });
});

function acceptBoth(now = baliWallTime(2026, 9, 3, 10)) {
  const first = applyDecision(emptyState(), "2026-09-07", "accepted");
  assert.equal(first.ok, true);
  if (!first.ok) throw new Error("accept 1");
  const both = applyDecision(first.state, "2026-09-09", "accepted");
  assert.equal(both.ok, true);
  if (!both.ok) throw new Error("accept 2");
  return { now, state: both.state };
}

describe("RSVP and daily credits", () => {
  it("blocks hints until a date is accepted", () => {
    const now = baliWallTime(2026, 9, 3, 10);
    const state = emptyState();
    assert.equal(pendingDate(state)?.id, "2026-09-07");
    assert.equal(creditAvailable(state, now), false);
    const unlocked = applyUnlock(state, "d1-strawberry", now);
    assert.equal(unlocked.ok, false);
    if (!unlocked.ok) assert.equal(unlocked.error, "not_accepted");
  });

  it("before the cutover, each accepted date still gets its own daily unlock", () => {
    const now = baliWallTime(2026, 9, 3, 10);
    assert.equal(usesSharedDailyCredit(now), false);
    const { state } = acceptBoth(now);
    assert.equal(readyCreditCount(state, now), 2);

    const first = applyUnlock(state, "d1-strawberry", now);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.state.lastUnlockDays["2026-09-07"], "2026-09-03");
    assert.equal(dateCreditAvailable(first.state, "2026-09-07", now), false);
    assert.equal(dateCreditAvailable(first.state, "2026-09-09", now), true);
    assert.equal(readyCreditCount(first.state, now), 1);

    const sameDate = applyUnlock(first.state, "d1-icecream", now);
    assert.equal(sameDate.ok, false);
    if (!sameDate.ok) assert.equal(sameDate.error, "no_credit");

    const otherDate = applyUnlock(first.state, "d2-sunrise", now);
    assert.equal(otherDate.ok, true);
    if (!otherDate.ok) return;
    assert.equal(readyCreditCount(otherDate.state, now), 0);
  });

  it("still uses per-date credits at 05:59 Bali on 4 Sep (end of the 3 Sep puzzle day)", () => {
    const now = baliWallTime(2026, 9, 4, 5, 59, 0);
    assert.equal(puzzleDayId(now), "2026-09-03");
    assert.equal(usesSharedDailyCredit(now), false);
    const { state } = acceptBoth(now);
    const a = applyUnlock(state, "d1-strawberry", now);
    assert.equal(a.ok, true);
    if (!a.ok) return;
    const b = applyUnlock(a.state, "d2-sunrise", now);
    assert.equal(b.ok, true);
  });

  it("from 6:00 AM Bali on 4 Sep, one unlock is shared across every date", () => {
    const now = baliWallTime(2026, 9, 4, 6, 0, 0);
    assert.equal(usesSharedDailyCredit(now), true);
    const { state } = acceptBoth(now);
    assert.equal(readyCreditCount(state, now), 1);
    assert.equal(creditAvailable(state, now), true);

    const first = applyUnlock(state, "d2-sunrise", now);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.state.lastUnlockDay, "2026-09-04");
    assert.equal(creditAvailable(first.state, now), false);
    assert.equal(dateCreditAvailable(first.state, "2026-09-07", now), false);

    const second = applyUnlock(first.state, "d1-strawberry", now);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.error, "no_credit");
  });

  it("grants a fresh shared credit at 6:00 AM even if both dates were unlocked yesterday", () => {
    const yesterday = baliWallTime(2026, 9, 3, 10);
    const { state } = acceptBoth(yesterday);
    const a = applyUnlock(state, "d1-strawberry", yesterday);
    assert.equal(a.ok, true);
    if (!a.ok) return;
    const b = applyUnlock(a.state, "d2-sunrise", yesterday);
    assert.equal(b.ok, true);
    if (!b.ok) return;
    assert.equal(creditAvailable(b.state, yesterday), false);

    const morning = baliWallTime(2026, 9, 4, 6, 0, 0);
    assert.equal(creditAvailable(b.state, morning), true);
    const next = applyUnlock(b.state, "d1-icecream", morning);
    assert.equal(next.ok, true);
    if (!next.ok) return;
    const extra = applyUnlock(next.state, "d2-compass", morning);
    assert.equal(extra.ok, false);
    if (!extra.ok) assert.equal(extra.error, "no_credit");
  });

  it("counts a persisted per-date lastUnlockDays entry for today as the shared credit", () => {
    const now = baliWallTime(2026, 9, 4, 10);
    const { state } = acceptBoth(now);
    const persisted = {
      ...state,
      lastUnlockDay: null,
      lastUnlockDays: { "2026-09-07": "2026-09-04" },
    };
    assert.equal(creditAvailable(persisted, now), false);
    const extra = applyUnlock(persisted, "d2-sunrise", now);
    assert.equal(extra.ok, false);
    if (!extra.ok) assert.equal(extra.error, "no_credit");
  });

  it("does not stack unused days — only today's credit exists", () => {
    const accepted = applyDecision(emptyState(), "2026-09-07", "accepted");
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    const later = baliWallTime(2026, 9, 5, 10);
    assert.equal(creditAvailable(accepted.state, later), true);
    const first = applyUnlock(accepted.state, "d1-strawberry", later);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(creditAvailable(first.state, later), false);
  });

  it("rejects a declined date's hints forever", () => {
    const now = baliWallTime(2026, 9, 4, 10);
    const rejected = applyDecision(emptyState(), "2026-09-07", "rejected");
    assert.equal(rejected.ok, true);
    if (!rejected.ok) return;
    const unlocked = applyUnlock(rejected.state, "d1-strawberry", now);
    assert.equal(unlocked.ok, false);
    if (!unlocked.ok) assert.equal(unlocked.error, "not_accepted");
  });

  it("refuses a second decision on the same date", () => {
    const accepted = applyDecision(emptyState(), "2026-09-07", "accepted");
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    const again = applyDecision(accepted.state, "2026-09-07", "rejected");
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.error, "already_decided");
  });
});

describe("copy", () => {
  it("titles dates the way a person would say them", () => {
    assert.equal(formatDateTitle(DATES[0]!.startsAt), "Monday, 7th September");
    assert.equal(formatStartTime(DATES[0]!.startsAt), "5:00 PM");
    assert.equal(formatDateTitle(DATES[1]!.startsAt), "Wednesday, 9th September");
    assert.equal(formatStartTime(DATES[1]!.startsAt), "12:00 PM");
  });
});

describe("remainingUntil", () => {
  it("counts down and clamps at zero", () => {
    const start = baliWallTime(2026, 9, 6, 17);
    const target = new Date(DATES[0]!.startsAt);
    const left = remainingUntil(start, target);
    assert.equal(left.days, 1);
    assert.equal(left.hours, 0);
    assert.equal(left.done, false);
    const after = remainingUntil(new Date(target.getTime() + 1000), target);
    assert.equal(after.done, true);
    assert.equal(after.days + after.hours + after.minutes + after.seconds, 0);
  });
});

describe("date instructions", () => {
  it("unseals Monday 7 Sep 5pm at 5pm the day before", () => {
    const unlockAt = instructionsUnlockAt(DATES[0]!.startsAt);
    assert.equal(formatDateTitle(unlockAt.toISOString()), "Sunday, 6th September");
    assert.equal(formatStartTime(unlockAt.toISOString()), "5:00 PM");
    assert.equal(unlockAt.toISOString(), baliWallTime(2026, 9, 6, 17).toISOString());
  });

  it("stays sealed until the exact 24-hour mark", () => {
    const startsAt = DATES[0]!.startsAt;
    const justBefore = new Date(baliWallTime(2026, 9, 6, 17).getTime() - 1);
    const exactly = baliWallTime(2026, 9, 6, 17);
    const afterStart = baliWallTime(2026, 9, 7, 17, 1);
    assert.equal(instructionsUnlocked(startsAt, justBefore), false);
    assert.equal(instructionsUnlocked(startsAt, exactly), true);
    assert.equal(instructionsUnlocked(startsAt, afterStart), true);
  });

  it("unseals Wednesday noon at Tuesday noon", () => {
    const unlockAt = instructionsUnlockAt(DATES[1]!.startsAt);
    assert.equal(unlockAt.toISOString(), baliWallTime(2026, 9, 8, 12).toISOString());
    assert.equal(instructionsUnlocked(DATES[1]!.startsAt, baliWallTime(2026, 9, 8, 11, 59)), false);
    assert.equal(instructionsUnlocked(DATES[1]!.startsAt, baliWallTime(2026, 9, 8, 12)), true);
  });

  it("never unseals a declined date", () => {
    const duringWindow = baliWallTime(2026, 9, 6, 18);
    assert.equal(instructionsUnlocked(DATES[0]!.startsAt, duringWindow, "rejected"), false);
    assert.equal(instructionsUnlocked(DATES[0]!.startsAt, duringWindow, "accepted"), true);
  });

  it("keeps Monday's letter as paragraphs, including the sign-off", () => {
    assert.ok(DATES[0]!.instructions);
    assert.equal(DATES[1]!.instructions, undefined);
    const parts = instructionParagraphs(DATES[0]!.instructions!);
    assert.equal(parts[0], "Caitlyn, my love, the wait is finally over. Our disney movie starts tonight 😉");
    assert.ok(parts.some((part) => part.startsWith("NOTE:")));
    assert.ok(parts.some((part) => part.includes("Shelter") && part.includes("Pererererererererererererererernan")));
    assert.ok(parts.some((part) => part.includes("1. Be ready by 5pm")));
    assert.equal(parts.at(-1), "King/prince/master/daddy Nick");
  });
});
