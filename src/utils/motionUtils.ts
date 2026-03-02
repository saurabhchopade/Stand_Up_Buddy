import {
  DEFAULT_ACTIVITY_STATE,
  ROLLING_SAMPLE_WINDOW,
  SENSOR_INTERVAL_MS,
} from './constants';
import { ActivityState, MotionInsight, MotionSample } from '../types';

export const toMotionSample = (x: number, y: number, z: number): MotionSample => {
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  const netMagnitude = Math.abs(magnitude - 1);

  return {
    x,
    y,
    z,
    timestamp: Date.now(),
    magnitude,
    netMagnitude,
  };
};

export const pushRollingSample = (samples: MotionSample[], sample: MotionSample) => {
  const nextSamples = [...samples, sample];

  if (nextSamples.length > ROLLING_SAMPLE_WINDOW) {
    nextSamples.shift();
  }

  return nextSamples;
};

export const analyzeWindow = (samples: MotionSample[]): MotionInsight => {
  if (!samples.length) {
    return {
      averageNet: 0,
      peakNet: 0,
      variance: 0,
      stepCount: 0,
    };
  }

  const netValues = samples.map((sample) => sample.netMagnitude);
  const averageNet =
    netValues.reduce((total, value) => total + value, 0) / netValues.length;
  const peakNet = Math.max(...netValues);
  const variance =
    netValues.reduce((total, value) => total + (value - averageNet) ** 2, 0) /
    netValues.length;

  let stepCount = 0;
  for (let index = 1; index < netValues.length - 1; index += 1) {
    const previous = netValues[index - 1] ?? 0;
    const current = netValues[index] ?? 0;
    const next = netValues[index + 1] ?? 0;

    if (current > previous && current > next && current > 0.25) {
      stepCount += 1;
    }
  }

  return {
    averageNet,
    peakNet,
    variance,
    stepCount,
  };
};

export const classifyActivity = (
  samples: MotionSample[],
  previousState: ActivityState = DEFAULT_ACTIVITY_STATE
): { nextState: ActivityState; confidence: number; insight: MotionInsight } => {
  const insight = analyzeWindow(samples);

  if (samples.length < ROLLING_SAMPLE_WINDOW) {
    return {
      nextState: previousState,
      confidence: 0.25,
      insight,
    };
  }

  if (insight.averageNet < 0.15 && insight.variance < 0.015) {
    return {
      nextState: 'STILL',
      confidence: 0.94,
      insight,
    };
  }

  if (insight.peakNet > 1.1 || insight.averageNet > 0.7) {
    return {
      nextState: 'RUNNING',
      confidence: 0.88,
      insight,
    };
  }

  if (
    insight.stepCount >= 1 &&
    (insight.averageNet > 0.18 || insight.peakNet > 0.35)
  ) {
    return {
      nextState: 'WALKING',
      confidence: 0.82,
      insight,
    };
  }

  if (
    insight.averageNet > 0.08 &&
    insight.averageNet < 0.4 &&
    insight.variance < 0.035
  ) {
    return {
      nextState: 'IN_VEHICLE',
      confidence: 0.7,
      insight,
    };
  }

  return {
    nextState: previousState,
    confidence: 0.45,
    insight,
  };
};

export const samplesPerMinute = Math.round((60 * 1000) / SENSOR_INTERVAL_MS);
