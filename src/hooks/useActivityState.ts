import { useEffect, useRef } from 'react';

import { handleActivityChange, evaluateInactivity } from '../services/ActivityService';
import { useAccelerometer } from './useAccelerometer';

export const useActivityState = () => {
  const { activityState, confidence } = useAccelerometer();
  const previousState = useRef<typeof activityState | null>(null);

  useEffect(() => {
    if (previousState.current === activityState) {
      return;
    }

    previousState.current = activityState;
    void handleActivityChange(activityState, confidence);
  }, [activityState, confidence]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      void evaluateInactivity();
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, []);
};
