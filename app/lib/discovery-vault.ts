/** Vault is configured but unreachable — keep the puzzle playable via cookies. */
export function isVaultUnreachable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message) return true;
  if (message === "table_missing") return true;
  return /fetch failed|fetch_failed|failed to fetch|network|econnrefused|enotfound|etimedout|certificate|http_0|read_failed|write_failed|insert_failed/i.test(
    message,
  );
}
