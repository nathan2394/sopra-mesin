const dateOnly = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const monthDay = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  month: "short",
  day: "numeric",
});

const scheduleDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDate(value: string | number | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : dateOnly.format(date);
}

export function formatDateTime(value: string | number | Date): string {
  return dateTime.format(new Date(value));
}

export function formatMonthDay(value: string | number | Date): string {
  return monthDay.format(new Date(value));
}

export function formatScheduleDateTime(value: string | number | Date): string {
  return scheduleDateTime.format(new Date(value));
}

export function toJakartaDateTime(value: string | number | Date): string {
  const local = typeof value === "string" && value.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?$/);
  if (local) return `${local[1]}+07:00`;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}+07:00`;
}

export function wibInputDate(value: string | number | Date = Date.now()): string {
  return toJakartaDateTime(value).slice(0, 10);
}

export function wibInputTime(value: string | number | Date): string {
  return toJakartaDateTime(value).slice(11, 16);
}

export function wibInputDateTime(date: string, time: string): string {
  return `${date}T${time}:00+07:00`;
}

export function wibStartOfDay(value: string | number | Date = Date.now()): Date {
  return new Date(wibInputDateTime(wibInputDate(value), "00:00"));
}

export function addWibDays(value: string | number | Date, days: number): Date {
  return new Date(new Date(value).getTime() + days * 86_400_000);
}

export function wibDayOfWeek(value: string | number | Date): number {
  return new Date(`${wibInputDate(value)}T00:00:00Z`).getUTCDay();
}
