import { TimeRemaining, StatusData } from './types';

export function calculateTimeRemaining(expiresAt: string): TimeRemaining {
  const now = new Date();
  // Robust parsing: handle ISO strings, and numeric seconds/milliseconds if passed
  let expiryTime = new Date(expiresAt);
  if (isNaN(expiryTime.getTime())) {
    const numeric = Number(expiresAt);
    if (!Number.isNaN(numeric)) {
      const ms = numeric > 1e12 ? numeric : numeric * 1000;
      expiryTime = new Date(ms);
    }
  }
  const timeRemaining = expiryTime.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60 * 24)));
  const hoursRemaining = Math.max(0, Math.ceil(timeRemaining / (1000 * 60 * 60)));

  return {
    days: daysRemaining,
    hours: hoursRemaining,
    expired: timeRemaining <= 0,
  };
}

export function formatTimeRemaining(timeRemaining: TimeRemaining): string {
  if (timeRemaining.expired) {
    return 'Expired';
  }

  // Ensure hours don't exceed 24 when days are present
  const normalizedHours = timeRemaining.days > 0 ? timeRemaining.hours % 24 : timeRemaining.hours;

  if (timeRemaining.days > 0) {
    return `${timeRemaining.days}d ${normalizedHours}h`;
  } else {
    return `${timeRemaining.hours}h`;
  }
}

export function getStatusData(timeRemaining: TimeRemaining): StatusData {
  if (timeRemaining.expired) {
    return {
      color: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
      iconType: 'expired',
      label: 'Expired',
    };
  } else if (timeRemaining.days <= 1) {
    return {
      color: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
      iconType: 'warning',
      label: 'Expiring Soon',
    };
  } else {
    return {
      color:
        'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
      iconType: 'active',
      label: 'Active',
    };
  }
}
