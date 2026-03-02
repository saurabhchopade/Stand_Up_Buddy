import { Alert, Platform, Vibration } from 'react-native';
import Constants from 'expo-constants';

import { useAppStore } from '../store/useAppStore';
import { NotificationActionKey } from '../types';
import { NOTIFICATION_CATEGORY_ID, NOTIFICATION_CHANNEL_ID } from '../utils/constants';

type NotificationActionHandler = (
  action: NotificationActionKey,
  notificationId?: string
) => Promise<void> | void;

const ACTION_IDS = {
  startWalk: 'SITALERT_START_WALK',
  snooze: 'SITALERT_SNOOZE',
  inMeeting: 'SITALERT_IN_MEETING',
} as const;

let responseSubscription: { remove: () => void } | null = null;
const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

const mapAction = (actionIdentifier: string): NotificationActionKey => {
  switch (actionIdentifier) {
    case ACTION_IDS.startWalk:
      return 'START_WALK';
    case ACTION_IDS.snooze:
      return 'SNOOZE';
    case ACTION_IDS.inMeeting:
      return 'IN_MEETING';
    case 'expo.notifications.actions.dismiss':
      return 'DISMISSED';
    default:
      return 'OPEN_APP';
  }
};

export const requestNotificationPermission = async () => {
  if (isExpoGo) {
    useAppStore.getState().setPermission('notifications', 'denied');
    return 'denied';
  }

  const Notifications = await import('expo-notifications');
  const result = await Notifications.requestPermissionsAsync();
  useAppStore.getState().setPermission('notifications', result.status);
  return result.status;
};

export const initializeNotifications = async (onAction: NotificationActionHandler) => {
  if (isExpoGo) {
    return;
  }

  const Notifications = await import('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Sit reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'alert.mp3',
      vibrationPattern: [0, 500, 200, 500],
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
    {
      identifier: ACTION_IDS.startWalk,
      buttonTitle: 'Start Walk',
      options: {
        opensAppToForeground: true,
      },
    },
    {
      identifier: ACTION_IDS.snooze,
      buttonTitle: 'Snooze 10 min',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: ACTION_IDS.inMeeting,
      buttonTitle: 'In a Meeting',
      options: {
        opensAppToForeground: false,
      },
    },
  ]);

  responseSubscription?.remove();
  responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      void onAction(
        mapAction(response.actionIdentifier),
        response.notification.request.identifier
      );
    }
  );

  const initialResponse = await Notifications.getLastNotificationResponseAsync();
  if (initialResponse) {
    void onAction(
      mapAction(initialResponse.actionIdentifier),
      initialResponse.notification.request.identifier
    );
  }
};

export const sendInactivityNotification = async (minutesInactive: number) => {
  if (isExpoGo) {
    Vibration.vibrate([0, 500, 200, 500]);
    Alert.alert(
      'Time to move',
      `You have been still for ${minutesInactive} minutes. A short walk will reset the timer.`
    );
    return null;
  }

  const Notifications = await import('expo-notifications');
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to move',
      body: `You have been still for ${minutesInactive} minutes. A short walk will reset the timer.`,
      sound: 'alert.mp3',
      categoryIdentifier: NOTIFICATION_CATEGORY_ID,
      data: {
        screen: 'Home',
      },
    },
    trigger: null,
  });
};
