export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export const DEFAULT_TIMEZONE = "Asia/Jerusalem";
export const DEFAULT_SEND_HOUR = 10;

export function getZonedParts(date: Date, timezone: string): ZonedParts {
  try {
    const dtf = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour),
      minute: Number(map.minute),
      second: Number(map.second),
    };
  } catch {
    if (timezone === DEFAULT_TIMEZONE) {
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
      };
    }
    return getZonedParts(date, DEFAULT_TIMEZONE);
  }
}

export function compareLocalParts(a: ZonedParts, b: ZonedParts): number {
  const toValue = (p: ZonedParts) =>
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return toValue(a) - toValue(b);
}

export function zonedToUtc(target: ZonedParts, timezone: string): Date {
  let guess = new Date(
    Date.UTC(
      target.year,
      target.month - 1,
      target.day,
      target.hour,
      target.minute,
      target.second,
    ),
  );

  for (let i = 0; i < 4; i++) {
    const actual = getZonedParts(guess, timezone);
    const diffMs = compareLocalParts(target, actual);
    if (Math.abs(diffMs) < 1000) break;
    guess = new Date(guess.getTime() + diffMs);
  }

  return guess;
}

export function addOneDay(parts: ZonedParts): ZonedParts {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  d.setUTCDate(d.getUTCDate() + 1);
  return {
    ...parts,
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

export function isSaturday(parts: ZonedParts): boolean {
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
  return weekday === 6;
}

export function clampToPreferredSendTime(
  inputUtc: Date,
  timezone: string,
  windowStartHour: number,
  windowEndHour: number,
  preferredHour: number,
): Date {
  const local = getZonedParts(inputUtc, timezone);
  const safePreferred = Number.isFinite(preferredHour) ? preferredHour : DEFAULT_SEND_HOUR;
  const baseHour =
    safePreferred >= windowStartHour && safePreferred < windowEndHour ? safePreferred : windowStartHour;

  let target: ZonedParts = {
    ...local,
    hour: baseHour,
    minute: 0,
    second: 0,
  };

  if (compareLocalParts(target, local) <= 0) {
    const next = addOneDay(local);
    target = {
      ...next,
      hour: baseHour,
      minute: 0,
      second: 0,
    };
  }

  if (isSaturday(target)) {
    const next = addOneDay(target);
    target = {
      ...next,
      hour: baseHour,
      minute: 0,
      second: 0,
    };
  }

  return zonedToUtc(target, timezone);
}

export function normalizeTimezone(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : DEFAULT_TIMEZONE;
}

export function normalizeCountryCode(value: string | null | undefined): string {
  return value?.trim()?.toUpperCase() || "unknown";
}

export function pickPreferredHour(countryCode: string, overrides: Record<string, number>): number {
  const mapped = overrides[countryCode];
  if (Number.isFinite(mapped) && mapped >= 0 && mapped <= 23) {
    return mapped;
  }
  return DEFAULT_SEND_HOUR;
}

export async function loadCountrySendHours(adminClient: any): Promise<Record<string, number>> {
  const { data } = await adminClient
    .from("platform_settings")
    .select("key, value")
    .eq("key", "lead_country_send_hours")
    .maybeSingle();

  if (!data?.value) return {} as Record<string, number>;
  try {
    const parsed = JSON.parse(data.value);
    if (!parsed || typeof parsed !== "object") return {} as Record<string, number>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const hour = Number(value);
      if (!Number.isFinite(hour)) continue;
      const code = key.trim().toUpperCase();
      if (!code) continue;
      out[code] = Math.max(0, Math.min(23, hour));
    }
    return out;
  } catch {
    return {} as Record<string, number>;
  }
}
