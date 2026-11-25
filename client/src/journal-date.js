const manilaCalendar = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Manila',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayInManila(now = new Date()) {
  const { year, month, day } = Object.fromEntries(
    manilaCalendar.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return `${year}-${month}-${day}`;
}

export function journalDateError(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return 'Enter a valid date.';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return 'Enter a valid date.';
  }
  return value < todayInManila() ? 'Choose today’s date or a future date.' : '';
}
