import Constants from 'expo-constants';

import { BACKGROUND_TASK_NAME } from '../utils/constants';
import { evaluateInactivity, hydratePersistedRuntime } from './ActivityService';

const isExpoGo =
  Constants.executionEnvironment === 'storeClient' ||
  Constants.appOwnership === 'expo';

export const registerBackgroundMonitoring = async () => {
  if (isExpoGo) {
    return false;
  }

  const BackgroundFetch = await import('expo-background-fetch');
  const TaskManager = await import('expo-task-manager');

  if (!TaskManager.isTaskDefined(BACKGROUND_TASK_NAME)) {
    TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
      try {
        await hydratePersistedRuntime();
        await evaluateInactivity();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }

  const status = await BackgroundFetch.getStatusAsync();
  if (
    status === BackgroundFetch.BackgroundFetchStatus.Denied ||
    status === BackgroundFetch.BackgroundFetchStatus.Restricted
  ) {
    return false;
  }

  const alreadyRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_NAME);
  if (!alreadyRegistered) {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_TASK_NAME, {
      minimumInterval: 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }

  return true;
};
