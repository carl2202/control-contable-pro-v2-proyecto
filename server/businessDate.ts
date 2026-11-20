const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/El_Salvador',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getBusinessDate(date = new Date()): string {
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error('No se pudo determinar la fecha de El Salvador.');
  }
  return `${year}-${month}-${day}`;
}
