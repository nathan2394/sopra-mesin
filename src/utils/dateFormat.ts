const dateOnly = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const monthDay = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const scheduleDateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDate(value: string | number | Date): string {
  return dateOnly.format(new Date(value));
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
