import * as Calendar from 'expo-calendar';

import { useAppStore } from '../store/useAppStore';

export const requestCalendarPermission = async () => {
  const result = await Calendar.requestCalendarPermissionsAsync();
  useAppStore.getState().setPermission('calendar', result.status);
  return result.status;
};

export const isCalendarBusy = async (referenceTime: number = Date.now()) => {
  const { permissions, settings } = useAppStore.getState();

  if (!settings.meetingDetectionEnabled || permissions.calendar !== 'granted') {
    return false;
  }

  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    if (!calendars.length) {
      return false;
    }

    const startDate = new Date(referenceTime - 5 * 60 * 1000);
    const endDate = new Date(referenceTime + 30 * 60 * 1000);
    const events = await Calendar.getEventsAsync(
      calendars.map((calendar) => calendar.id),
      startDate,
      endDate
    );

    return events.some((event) => {
      if (event.allDay) {
        return false;
      }

      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();
      return eventStart <= referenceTime && eventEnd >= referenceTime;
    });
  } catch {
    return false;
  }
};
