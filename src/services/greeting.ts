/**
 * ATABUL DRIVING CENTER — GREETING SERVICE
 * IP-based geolocation + local time detection for personalized greetings.
 * City cached for 24h; time-of-day ALWAYS computed fresh per visit.
 */

const CITY_CACHE_KEY = 'atabul:greeting:city';
const CITY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const GEO_API = 'https://ipapi.co/json/';

export type TimeOfDay = 'Morning' | 'Afternoon' | 'Evening' | 'Night';

export interface GreetingResult {
  city: string;
  greeting: TimeOfDay;
  text: string;
  fromCityCache: boolean;
}

/** Determine time-of-day from a Date in the visitor's local timezone. */
function getTimeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
}

/** Format greeting text from city and time-of-day. */
function formatGreeting(city: string, timeOfDay: TimeOfDay): string {
  return `Hello ${city}! Good ${timeOfDay}`;
}

/** Check if cached city is still valid. */
function isCityCacheValid(cached: { city: string; timestamp: number } | null): boolean {
  if (!cached) return false;
  return Date.now() - cached.timestamp < CITY_CACHE_TTL_MS;
}

/** Fetch geolocation from ipapi.co. Returns city or null on failure. */
async function fetchCity(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(GEO_API, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return data.city ?? null;
  } catch {
    return null;
  }
}

/** Get visitor's IANA timezone (e.g., "Asia/Kolkata", "Europe/London"). */
function getVisitorTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

/** Create a Date in the visitor's timezone. */
function getLocalDate(timezone: string): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
}

/** Get cached city if valid, otherwise fetch fresh. */
async function getCity(): Promise<string> {
  // 1. Check city cache first
  try {
    const raw = localStorage.getItem(CITY_CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw);
      if (isCityCacheValid(cached)) {
        return cached.city;
      }
    }
  } catch {
    // Cache corrupted — continue to fresh fetch
  }

  // 2. Fresh geolocation fetch
  const city = await fetchCity();
  const resolvedCity = city ?? 'Visitor';

  // 3. Update city cache (fire-and-forget)
  try {
    localStorage.setItem(CITY_CACHE_KEY, JSON.stringify({
      city: resolvedCity,
      timestamp: Date.now(),
    }));
  } catch {
    // Storage full — not critical
  }

  return resolvedCity;
}

/** Main entry: returns greeting with fresh time-of-day, cached city. */
export async function getGreeting(): Promise<GreetingResult> {
  const [city, timezone] = await Promise.all([getCity(), Promise.resolve(getVisitorTimezone())]);
  const localDate = getLocalDate(timezone);
  const timeOfDay = getTimeOfDay(localDate);

  return {
    city,
    greeting: timeOfDay,
    text: formatGreeting(city, timeOfDay),
    fromCityCache: true, // city was from cache (or fresh fetch)
  };
}

/** Clear cached city (useful for testing). */
export function clearGreetingCache(): void {
  try {
    localStorage.removeItem(CITY_CACHE_KEY);
  } catch {
    // ignore
  }
}