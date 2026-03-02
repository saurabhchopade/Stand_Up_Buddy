import { Alert, AppState, Platform, Vibration } from 'react-native';
import Constants from 'expo-constants';
import * as TaskManager from 'expo-task-manager';

import { useAppStore } from '../store/useAppStore';
import { NotificationActionKey } from '../types';
import {
  NOTIFICATION_ACTION_TASK_NAME,
  NOTIFICATION_CATEGORY_ID,
  NOTIFICATION_CHANNEL_ID,
  SNOOZE_DURATION_MINUTES,
} from '../utils/constants';

type NotificationActionHandler = (
  action: NotificationActionKey,
  notificationId?: string
) => Promise<void> | void;

const ACTION_IDS = {
  stopAlarm: 'SITALERT_STOP_ALARM',
  startWalk: 'SITALERT_START_WALK',
  snooze: 'SITALERT_SNOOZE',
  inMeeting: 'SITALERT_IN_MEETING',
} as const;
const NOTIFICATION_VIBRATION_PATTERN = [0, 800, 250, 800] as const;

let responseSubscription: { remove: () => void } | null = null;
const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

const mapAction = (actionIdentifier: string): NotificationActionKey => {
  switch (actionIdentifier) {
    case ACTION_IDS.stopAlarm:
      return 'STOP_ALARM';
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

type NotificationTaskPayload = {
  actionIdentifier?: string;
  notification?: {
    request?: {
      identifier?: string;
    };
  };
};

if (!isExpoGo && Platform.OS === 'android') {
  if (!TaskManager.isTaskDefined(NOTIFICATION_ACTION_TASK_NAME)) {
    TaskManager.defineTask(
      NOTIFICATION_ACTION_TASK_NAME,
      async ({ data, error }: TaskManager.TaskManagerTaskBody<unknown>) => {
        if (error) {
          return;
        }

        const payload = data as NotificationTaskPayload | undefined;
        const actionIdentifier = payload?.actionIdentifier;

        if (!actionIdentifier) {
          return;
        }

        const action = mapAction(actionIdentifier);

        if (action === 'OPEN_APP' || action === 'DISMISSED') {
          return;
        }

        const { handleNotificationAction } = await import('./ActivityService');
        await handleNotificationAction(action, payload?.notification?.request?.identifier);
      }
    );
  }
}

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
      description: 'High-priority inactivity reminders that stay visible on the lock screen.',
      importance: Notifications.AndroidImportance.MAX,
      bypassDnd: true,
      sound: 'alert.mp3',
      vibrationPattern: [...NOTIFICATION_VIBRATION_PATTERN],
      enableVibrate: true,
      enableLights: true,
      lightColor: '#D96B2B',
      audioAttributes: {
        usage: Notifications.AndroidAudioUsage.ALARM,
        contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        flags: {
          enforceAudibility: true,
          requestHardwareAudioVideoSynchronization: false,
        },
      },
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  await Notifications.setNotificationCategoryAsync(NOTIFICATION_CATEGORY_ID, [
    {
      identifier: ACTION_IDS.startWalk,
      buttonTitle: 'Go for walk',
      options: {
        opensAppToForeground: false,
      },
    },
    {
      identifier: ACTION_IDS.snooze,
      buttonTitle: `Snooze ${SNOOZE_DURATION_MINUTES} min`,
      options: {
        opensAppToForeground: false,
      },
    },
  ]);

  if (Platform.OS === 'android') {
    await Notifications.registerTaskAsync(NOTIFICATION_ACTION_TASK_NAME);
  }

  responseSubscription?.remove();
  responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const isDefaultAction =
        response.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER;

      if (!isDefaultAction && AppState.currentState !== 'active') {
        return;
      }

      void onAction(
        mapAction(response.actionIdentifier),
        response.notification.request.identifier
      );
    }
  );

  const initialResponse = await Notifications.getLastNotificationResponseAsync();
  if (
    initialResponse &&
    initialResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
  ) {
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
      priority: Notifications.AndroidNotificationPriority.MAX,
      sticky: true,
      autoDismiss: false,
      vibrate: [...NOTIFICATION_VIBRATION_PATTERN],
      categoryIdentifier: NOTIFICATION_CATEGORY_ID,
      data: {
        screen: 'Home',
        urgent: true,
      },
    },
    trigger: {
      channelId: NOTIFICATION_CHANNEL_ID,
    },
  });
};
