import type { CSSProperties, MouseEventHandler, PointerEventHandler } from "react";
import { formatMonthDay } from "../utils/dateFormat";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const formatClock = (date: Date) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

export function scheduleBlockGeometry(start: Date, end: Date, weekStart: Date) {
  const startDay = startOfDay(start).getTime();
  const endDay = startOfDay(end).getTime();
  const weekStartDay = startOfDay(weekStart).getTime();
  const weekEndDay = weekStartDay + 6 * DAY_MS;
  const visibleStartDay = Math.max(startDay, weekStartDay);
  const visibleEndDay = Math.min(endDay, weekEndDay);
  const left = ((visibleStartDay - weekStartDay) / WEEK_MS) * 100;
  const width = Math.max(100 / 7, ((Math.floor((visibleEndDay - visibleStartDay) / DAY_MS) + 1) / 7) * 100);
  return { left, width };
}

export function scheduleBlockLabel(start: Date, end: Date, weekStart: Date) {
  const weekStartDay = startOfDay(weekStart);
  const weekEnd = new Date(weekStartDay.getTime() + WEEK_MS);
  const visibleStart = start < weekStartDay ? weekStartDay : start;
  const visibleEnd = end > weekEnd ? weekEnd : end;
  const isMidnight = (date: Date) => date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
  const groupingEnd = isMidnight(visibleEnd) && visibleEnd.getTime() > visibleStart.getTime()
    ? new Date(visibleEnd.getTime() - 1)
    : visibleEnd;

  if (startOfDay(visibleStart).getTime() === startOfDay(groupingEnd).getTime()) {
    return `${formatMonthDay(visibleStart)}, ${formatClock(visibleStart)} - ${formatClock(visibleEnd)}`;
  }
  return `${formatMonthDay(visibleStart)}, ${formatClock(visibleStart)} - ${formatMonthDay(visibleEnd)}, ${formatClock(visibleEnd)}`;
}

interface ScheduleBlockProps {
  start: Date;
  end: Date;
  weekStart: Date;
  title: string;
  subtitle?: string;
  toneClassName: string;
  testId?: string;
  className?: string;
  wrapperClassName?: string;
  borderClassName?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onPointerDown?: PointerEventHandler<HTMLButtonElement>;
}

export function ScheduleBlock({ start, end, weekStart, title, subtitle, toneClassName, testId, className, wrapperClassName, borderClassName = "border-slate-200", onClick, onPointerDown }: ScheduleBlockProps) {
  const { left, width } = scheduleBlockGeometry(start, end, weekStart);
  const label = subtitle ?? scheduleBlockLabel(start, end, weekStart);
  const style: CSSProperties = { left: `calc(${left}% + 3px)`, width: `calc(${width}% - 6px)` };

  return (
    <div className={`relative min-h-12 border-l ${borderClassName}${wrapperClassName ? ` ${wrapperClassName}` : ""}`} onClick={(event) => event.stopPropagation()}>
      <div className="absolute inset-0 grid grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => <i key={index} className={`border-r ${borderClassName} last:border-r-0`} />)}
      </div>
      <button
        type="button"
        data-testid={testId}
        className={`absolute top-2 flex h-8 flex-col justify-center gap-0.5 touch-none select-none overflow-hidden rounded px-2 text-left text-3xs font-semibold leading-3 text-white cursor-pointer ${toneClassName}${className ? ` ${className}` : ""}`}
        style={style}
        title={`${start.toLocaleString()} - ${end.toLocaleString()}`}
        onClick={onClick}
        onPointerDown={onPointerDown}
      >
        <span className="truncate">{title}</span>
        {label && <span className="truncate font-normal opacity-90">{label}</span>}
      </button>
    </div>
  );
}
