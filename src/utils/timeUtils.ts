export const dayKeyFor = (timestamp: number = Date.now()) => new Date(timestamp).toDateString();

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const formatMinutes = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

export const formatElapsed = (timestamp: number | null, now: number = Date.now()) => {
  if (!timestamp) {
    return 'Just now';
  }

  const diffMs = Math.max(0, now - timestamp);
  const minutes = Math.floor(diffMs / 60000);

  if (minutes < 1) {
    return 'Under a minute';
  }

  return formatMinutes(minutes);
};

export const formatClockLabel = (timeValue: string) => {
  const [hoursText = '0', minutesText = '0'] = timeValue.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 || 12;
  const paddedMinutes = minutes.toString().padStart(2, '0');
  return `${normalizedHours}:${paddedMinutes} ${suffix}`;
};

const toMinutesSinceMidnight = (timeValue: string) => {
  const [hoursText = '0', minutesText = '0'] = timeValue.split(':');
  return Number(hoursText) * 60 + Number(minutesText);
};

export const isInTimeRange = (
  timestamp: number,
  startTime: string,
  endTime: string
) => {
  const now = new Date(timestamp);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = toMinutesSinceMidnight(startTime);
  const endMinutes = toMinutesSinceMidnight(endTime);

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
};

export const secondsRemaining = (targetAt: number | null, now: number = Date.now()) => {
  if (!targetAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((targetAt - now) / 1000));
};

export const minutesBetween = (from: number, to: number = Date.now()) =>
  Math.max(0, Math.round((to - from) / 60000));
