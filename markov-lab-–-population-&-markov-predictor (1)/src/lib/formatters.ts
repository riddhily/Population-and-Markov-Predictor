export function parseSqliteDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  // SQLite datetime('now') produces 'YYYY-MM-DD HH:MM:SS' in UTC
  const iso = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function formatDisplayDateTime(dateStr: string): string {
  const d = parseSqliteDate(dateStr);
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${datePart} \u2022 ${timePart}`;
}

export function formatRelativeActivityDate(dateStr: string): string {
  const d = parseSqliteDate(dateStr);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  if (sameDay) {
    return `Today, ${timePart}`;
  }
  const datePart = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${datePart}, ${timePart}`;
}

export function formatNumberValue(val: number, mode: 'probability' | 'counts'): string {
  if (mode === 'probability') {
    return val.toFixed(4);
  }
  return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
