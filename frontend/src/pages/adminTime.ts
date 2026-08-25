/**
 * Converts an instant from the API into the value a `datetime-local` input
 * wants: naive `YYYY-MM-DDTHH:mm`, in the browser's own timezone.
 *
 * The round trip has an asymmetry worth stating, because it is the exact shape
 * of a one-hour bug on a night that runs across a British summer evening:
 *
 * - going out, `new Date(value).toISOString()` reads the naive box value in the
 *   browser's zone and converts to UTC — correct, and already what the save
 *   button does;
 * - coming back, the server's instant has to be rendered in that same zone, or
 *   the box would show 16:00 for a 17:00 BST cutover and the admin would
 *   "correct" it into being genuinely wrong.
 *
 * The defensive part is the missing-designator case. A .NET `DateTime` whose
 * Kind is Unspecified serialises with no trailing `Z`, and JavaScript then
 * parses that as *local* rather than UTC — so a server storing UTC and a client
 * assuming local disagree by exactly the BST offset, silently, and only between
 * March and October. Anything without a designator is therefore read as UTC,
 * which is what the server actually stores.
 */
export function toLocalInputValue(iso: string | undefined | null): string {
  if (!iso) return "";

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  const instant = new Date(hasTimezone ? iso : `${iso}Z`);

  if (Number.isNaN(instant.getTime())) return "";

  // Built from the local-time parts rather than by slicing toISOString(), which
  // would hand back UTC and reintroduce the very offset this exists to avoid.
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${instant.getFullYear()}-${pad(instant.getMonth() + 1)}-${pad(instant.getDate())}` +
    `T${pad(instant.getHours())}:${pad(instant.getMinutes())}`
  );
}
