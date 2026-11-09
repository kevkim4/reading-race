export const AR_BOOKFINDER_URL = "https://www.arbookfind.com/";

/**
 * Opens AR BookFinder in a new tab and copies the title so the teacher can
 * paste it into the site's search box. (AR BookFinder has no stable public
 * search link to deep-link into, so copy + open is the reliable route.)
 * Resolves to whether the title made it onto the clipboard.
 */
export function lookUpArLevel(title: string): Promise<boolean> {
  const trimmed = title.trim();
  // Start the clipboard write while this tab still has focus, then open the
  // tab synchronously inside the click so popup blockers allow it.
  const copied = trimmed
    ? navigator.clipboard?.writeText(trimmed).then(
        () => true,
        () => false,
      ) ?? Promise.resolve(false)
    : Promise.resolve(false);
  window.open(AR_BOOKFINDER_URL, "_blank", "noopener");
  return copied;
}

/** "" → null; otherwise a number rounded to one decimal, or undefined if invalid. */
export function parseArInput(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n < 0 || n > 20) return undefined;
  return Math.round(n * 10) / 10;
}
