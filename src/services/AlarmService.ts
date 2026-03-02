import { Vibration } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

import { useAppStore } from '../store/useAppStore';

const VIBRATION_PATTERN = [0, 800, 250, 800];

let activeSound: Audio.Sound | null = null;
let starting = false;

const setAlarmActive = (active: boolean) => {
  useAppStore.getState().patchRuntime({
    alarmActive: active,
  });
};

export const startAlarmLoop = async () => {
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
