import React, { PropsWithChildren, useEffect } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import * as ExpoLinking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AppNavigator, { navigateToHome } from './src/navigation/AppNavigator';
import { initializeDatabase } from './src/database/db';
import { useActivityState } from './src/hooks/useActivityState';
import { usePermissions } from './src/hooks/usePermissions';
import { hydratePersistedRuntime, handleNotificationAction } from './src/services/ActivityService';
import { registerBackgroundMonitoring } from './src/services/BackgroundTaskService';
import { initializeNotifications } from './src/services/NotificationService';
import { NotificationActionKey } from './src/types';

const getAlarmActionFromUrl = (url: string | null): NotificationActionKey | null => {
  if (!url) {
    return null;
  }

  const parsed = ExpoLinking.parse(url);
  const alarmRoute = parsed.hostname === 'alarm' || parsed.path === 'alarm';
  const rawAction = parsed.queryParams?.action;
  const actionValue = Array.isArray(rawAction) ? rawAction[0] : rawAction;

  if (!alarmRoute || typeof actionValue !== 'string') {
    return null;
  }

  switch (actionValue) {
    case 'start_walk':
      return 'START_WALK';
    case 'snooze':
      return 'SNOOZE';
    default:
      return null;
  }
};

function AppRuntime({ children }: PropsWithChildren) {
  const { requestStartupPermissions } = usePermissions();
  const isExpoGo =
    Constants.executionEnvironment === 'storeClient' ||
    Constants.appOwnership === 'expo';

  useActivityState();

  useEffect(() => {
    let cancelled = false;

    const handleAlarmActionUrl = async (url: string | null) => {
      const action = getAlarmActionFromUrl(url);
      if (!action) {
        return;
      }

      navigateToHome();
      await handleNotificationAction(action);
    };

    const bootstrap = async () => {
      await initializeDatabase();
      await hydratePersistedRuntime();
      await handleAlarmActionUrl(await Linking.getInitialURL());
      if (!isExpoGo) {
        await initializeNotifications(async (action, notificationId) => {
          navigateToHome();
          await handleNotificationAction(action, notificationId);
        });
        await registerBackgroundMonitoring();
        await requestStartupPermissions();
      }

      if (!cancelled && Platform.OS === 'android') {
        Alert.alert(
          'Battery optimization',
          'For reliable background reminders, exclude SitAlert from battery optimization in Android settings.'
        );
      }
    };

    void bootstrap();

    const subscription = Linking.addEventListener('url', ({ url }) => {
      void handleAlarmActionUrl(url);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [isExpoGo, requestStartupPermissions]);

  return <>{children}</>;
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <View style={styles.container}>
          <AppRuntime>
            <AppNavigator />
          </AppRuntime>
          <StatusBar style="dark" />
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6EFE3',
  },
});
