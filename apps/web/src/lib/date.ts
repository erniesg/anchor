export const APP_TIME_ZONE = 'Asia/Singapore';

function getDateParts(date: Date, timeZone: string = APP_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to format date parts');
  }

  return { year, month, day };
}

export function formatDateInAppTimeZone(date: Date): string {
  const { year, month, day } = getDateParts(date);
  return `${year}-${month}-${day}`;
}

export function getCurrentAppDateString(): string {
  return formatDateInAppTimeZone(new Date());
}

export function getCurrentAppDate(): Date {
  const [year, month, day] = getCurrentAppDateString().split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isDateTodayInAppTimeZone(date: Date): boolean {
  return formatDateInAppTimeZone(date) === getCurrentAppDateString();
}

export function formatDateForDisplayInAppTimeZone(
  value: Date | string | number,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    ...options,
  }).format(new Date(value));
}
