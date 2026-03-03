import { useCallback } from 'react';
import { Alert } from 'react-native';
import * as Device from 'expo-device';

import { useAppStore } from '../store/useAppStore';
import { requestCalendarPermission } from '../services/CalendarService';
import { requestLocationPermission } from '../services/LocationService';
import { requestNotificationPermission } from '../services/NotificationService';

export const usePermissions = () => {
  const permissions = useAppStore((state) => state.permissions);

  const requestStartupPermissions = useCallback(async () => {
    if (!Device.isDevice) {
      useAppStore.getState().setPermission('notifications', 'granted');
      return;
    }

    Alert.alert(
      'Stay active',
      'StandUpBro needs notification access so it can remind you when you have been inactive.'
    );
    await requestNotificationPermission();
  }, []);

  const requestCalendarAccess = useCallback(async () => {
    Alert.alert(
      'Meeting detection',
      'Calendar access lets StandUpBro suppress reminders while you are in scheduled meetings.'
    );
    return requestCalendarPermission();
  }, []);

  const requestLocationAccess = useCallback(async () => {
    Alert.alert(
      'Location-based suppression',
      'Location access lets StandUpBro suppress reminders at your saved office location.'
    );
    return requestLocationPermission();
  }, []);

  return {
    permissions,
    requestStartupPermissions,
    requestCalendarAccess,
    requestLocationAccess,
  };
};
