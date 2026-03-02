import { NativeModules, Platform, Vibration } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

import { useAppStore } from '../store/useAppStore';

const VIBRATION_PATTERN = [0, 800, 250, 800];

let activeSound: Audio.Sound | null = null;
let starting = false;
const nativeAlarmModule = NativeModules.SitAlertAlarmModule as
  | {
      startAlarm: (title: string, body: string) => Promise<void>;
      stopAlarm: () => Promise<void>;
    }
  | undefined;
const supportsNativeAndroidAlarm = Platform.OS === 'android' && Boolean(nativeAlarmModule);

const setAlarmActive = (active: boolean) => {
  useAppStore.getState().patchRuntime({
    alarmActive: active,
  });
};

export const startAlarmLoop = async () => {
  if (supportsNativeAndroidAlarm && nativeAlarmModule) {
    await nativeAlarmModule.startAlarm(
      'Time to move',
      'You have been still too long. Go for a walk or snooze the alert.'
    );
    setAlarmActive(true);
    return;
  }

  if (activeSound || starting) {
    setAlarmActive(true);
    return;
  }

  starting = true;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      shouldDuckAndroid: true,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      playThroughEarpieceAndroid: false,
    });

    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/alert.mp3'),
      {
        isLooping: true,
        shouldPlay: true,
        volume: 1,
      }
    );

    activeSound = sound;
    setAlarmActive(true);
    Vibration.vibrate(VIBRATION_PATTERN, true);
  } finally {
    starting = false;
  }
};

export const stopAlarmLoop = async () => {
  if (supportsNativeAndroidAlarm && nativeAlarmModule) {
    try {
      await nativeAlarmModule.stopAlarm();
    } catch {
      // Best-effort stop.
    }
  }

  Vibration.cancel();
  setAlarmActive(false);

  if (!activeSound) {
    return;
  }

  const sound = activeSound;
  activeSound = null;

  try {
    await sound.stopAsync();
  } catch {
    // Best-effort stop.
  }

  try {
    await sound.unloadAsync();
  } catch {
    // Best-effort cleanup.
  }
};
