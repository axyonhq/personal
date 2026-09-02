import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDecision,
  applyUnlock,
  baliWallTime,
  creditAvailable,
  emptyState,
  formatDateTitle,
  formatStartTime,
  pendingDate,
  puzzleDayId,
  nextCreditAt,
  remainingUntil,
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

describe("RSVP and credits", () => {
  it("blocks hints until a date is accepted", () => {
    const now = baliWallTime(2026, 9, 2, 10);
    const state = emptyState();
    assert.equal(pendingDate(state)?.id, "2026-09-07");
    assert.equal(creditAvailable(state, now), false);
    const unlocked = applyUnlock(state, "d1-strawberry", now);
    assert.equal(unlocked.ok, false);
    if (!unlocked.ok) assert.equal(unlocked.error, "not_accepted");
  });

  it("grants one unlock after accept, then refuses a second the same puzzle day", () => {
    const now = baliWallTime(2026, 9, 2, 10);
    const accepted = applyDecision(emptyState(), "2026-09-07", "accepted");
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(creditAvailable(accepted.state, now), true);

    const first = applyUnlock(accepted.state, "d1-strawberry", now);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.deepEqual(first.state.unlockedHintIds, ["d1-strawberry"]);
    assert.equal(first.state.lastUnlockDay, "2026-09-02");
    assert.equal(creditAvailable(first.state, now), false);

    const second = applyUnlock(first.state, "d1-icecream", now);
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.error, "no_credit");
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
    const now = baliWallTime(2026, 9, 2, 10);
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

  it("lets a later puzzle day unlock a different date's hint", () => {
    let state = emptyState();
    const firstDate = applyDecision(state, "2026-09-07", "accepted");
    assert.equal(firstDate.ok, true);
    if (!firstDate.ok) return;
    const secondDate = applyDecision(firstDate.state, "2026-09-09", "accepted");
    assert.equal(secondDate.ok, true);
    if (!secondDate.ok) return;
    const dayOne = applyUnlock(secondDate.state, "d1-strawberry", baliWallTime(2026, 9, 2, 10));
    assert.equal(dayOne.ok, true);
    if (!dayOne.ok) return;
    const dayTwo = applyUnlock(dayOne.state, "d2-sunrise", baliWallTime(2026, 9, 3, 10));
    assert.equal(dayTwo.ok, true);
    if (!dayTwo.ok) return;
    assert.deepEqual(dayTwo.state.unlockedHintIds, ["d1-strawberry", "d2-sunrise"]);
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
