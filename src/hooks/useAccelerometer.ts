import { useEffect, useRef, useState } from 'react';
import { Accelerometer } from 'expo-sensors';

import {
  classifyActivity,
  pushRollingSample,
  toMotionSample,
} from '../utils/motionUtils';
import { DEFAULT_ACTIVITY_STATE, SENSOR_INTERVAL_MS, TRANSITION_STREAK_REQUIRED } from '../utils/constants';
import { ActivityState, MotionInsight, MotionSample } from '../types';

type AccelerometerState = {
  activityState: ActivityState;
  confidence: number;
  insight: MotionInsight;
  isAvailable: boolean;
};

const defaultInsight: MotionInsight = {
  averageNet: 0,
  peakNet: 0,
  variance: 0,
  stepCount: 0,
};

export const useAccelerometer = (): AccelerometerState => {
  const [activityState, setActivityState] = useState<ActivityState>(DEFAULT_ACTIVITY_STATE);
  const [confidence, setConfidence] = useState(0);
  const [insight, setInsight] = useState(defaultInsight);
  const [isAvailable, setIsAvailable] = useState(true);

  const samplesRef = useRef<MotionSample[]>([]);
  const candidateStateRef = useRef<ActivityState>(DEFAULT_ACTIVITY_STATE);
  const streakRef = useRef(0);
  const currentStateRef = useRef<ActivityState>(DEFAULT_ACTIVITY_STATE);

  useEffect(() => {
    let subscription: ReturnType<typeof Accelerometer.addListener> | null = null;
    let mounted = true;

    Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);

    const subscribe = async () => {
      const available = await Accelerometer.isAvailableAsync();
      if (!mounted) {
        return;
      }

      setIsAvailable(available);
      if (!available) {
        return;
      }

      subscription = Accelerometer.addListener((reading) => {
        const sample = toMotionSample(reading.x, reading.y, reading.z);
        samplesRef.current = pushRollingSample(samplesRef.current, sample);
        const result = classifyActivity(samplesRef.current, currentStateRef.current);

        setInsight(result.insight);
        setConfidence(result.confidence);

        if (result.nextState === currentStateRef.current) {
          candidateStateRef.current = result.nextState;
          streakRef.current = 0;
          return;
        }

        if (candidateStateRef.current === result.nextState) {
          streakRef.current += 1;
        } else {
          candidateStateRef.current = result.nextState;
          streakRef.current = 1;
        }

        if (streakRef.current >= TRANSITION_STREAK_REQUIRED) {
          currentStateRef.current = result.nextState;
          setActivityState(result.nextState);
          streakRef.current = 0;
        }
      });
    };

    void subscribe();

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return {
    activityState,
    confidence,
    insight,
    isAvailable,
  };
};
