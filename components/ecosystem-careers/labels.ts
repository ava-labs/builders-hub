export function prettyRemoteType(value: string | null | undefined): string {
  if (!value) return '';
  switch (value) {
    case 'remote':
      return 'Remote';
    case 'onsite':
      return 'On-site';
    case 'hybrid':
      return 'Hybrid';
    default:
      return value;
  }
}

export function prettySeniority(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/_/g, ' ');
}

export function formatPostedAt(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const ms = Date.now() - d.getTime();
  if (ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
