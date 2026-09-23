import { toJakartaDateTime, wibInputDate, wibInputTime } from "./dateFormat";

// Attribute each setup once, to the shift in which it starts (WIB).
export function setupShift(value: string | number | Date = Date.now()) {
  const instant = new Date(typeof value === "string" ? toJakartaDateTime(value) : value);
  const hour = Number(wibInputTime(instant).slice(0, 2));
  return {
    date: wibInputDate(instant.getTime() - 8 * 60 * 60 * 1000),
    shift: hour >= 8 && hour < 20 ? 1 : 2,
  };
}
