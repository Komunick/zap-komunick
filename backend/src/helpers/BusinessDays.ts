import { addDays } from "date-fns";

// Zap Komunick: business days for scheduled messages (docs/PRD.md, RF-008).
// Calendar without bank service in Brazil: national holidays plus Carnival
// (Monday and Tuesday), Good Friday and Corpus Christi. State and city
// holidays are not included. Dates are checked in the server's local time.

const pad = (value: number) => String(value).padStart(2, "0");
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

// Gregorian Easter Sunday (Meeus/Jones/Butcher algorithm)
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export interface Holiday {
  date: string; // YYYY-MM-DD
  name: string;
}

const holidayCache = new Map<number, Holiday[]>();

export function brazilianHolidays(year: number): Holiday[] {
  if (holidayCache.has(year)) {
    return holidayCache.get(year);
  }

  const fixed: Array<[number, number, string]> = [
    [1, 1, "Confraternização Universal"],
    [4, 21, "Tiradentes"],
    [5, 1, "Dia do Trabalho"],
    [9, 7, "Independência do Brasil"],
    [10, 12, "Nossa Senhora Aparecida"],
    [11, 2, "Finados"],
    [11, 15, "Proclamação da República"],
    [12, 25, "Natal"]
  ];
  // national holiday since law 14.759/2023
  if (year >= 2024) {
    fixed.push([11, 20, "Dia Nacional de Zumbi e da Consciência Negra"]);
  }

  const easter = easterSunday(year);
  const movable: Array<[Date, string]> = [
    [addDays(easter, -48), "Carnaval (segunda-feira)"],
    [addDays(easter, -47), "Carnaval (terça-feira)"],
    [addDays(easter, -2), "Sexta-feira Santa"],
    [addDays(easter, 60), "Corpus Christi"]
  ];

  const holidays = [
    ...fixed.map(([month, day, name]) => ({
      date: `${year}-${pad(month)}-${pad(day)}`,
      name
    })),
    ...movable.map(([date, name]) => ({ date: dayKey(date), name }))
  ].sort((x, y) => x.date.localeCompare(y.date));

  holidayCache.set(year, holidays);
  return holidays;
}

export function holidayOn(date: Date): Holiday | null {
  const key = dayKey(date);
  return (
    brazilianHolidays(date.getFullYear()).find(h => h.date === key) || null
  );
}

export function isBusinessDay(date: Date): boolean {
  const weekday = date.getDay();
  return weekday !== 0 && weekday !== 6 && !holidayOn(date);
}

/**
 * The same moment when it already falls on a business day, otherwise the next
 * business day at the same time.
 */
export function nextBusinessDay(date: Date): Date {
  let candidate = new Date(date.getTime());
  // a year has far fewer than 30 consecutive days off
  for (let step = 0; step < 30 && !isBusinessDay(candidate); step += 1) {
    candidate = addDays(candidate, 1);
  }
  return candidate;
}
