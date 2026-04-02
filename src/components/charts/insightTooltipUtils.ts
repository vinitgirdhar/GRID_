export const asNumber = (value: number | string | undefined) => {
  if (typeof value === 'number') {
    return value;
  }

  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const padHour = (hour: number) => hour.toString().padStart(2, '0');

export const formatHourLabel = (label: string | number | undefined) => {
  const hour = Number.parseInt(String(label ?? '').split(':')[0] ?? '', 10);

  if (Number.isNaN(hour)) {
    return String(label ?? 'Unknown hour');
  }

  return `${padHour(hour)}:00`;
};

export const formatBucketLabel = (label: string | number | undefined) => {
  const hour = Number.parseInt(String(label ?? '').split(':')[0] ?? '', 10);

  if (Number.isNaN(hour)) {
    return String(label ?? 'Unknown window');
  }

  return `${padHour(hour)}:00 - ${padHour((hour + 3) % 24)}:59`;
};

export const formatRideCount = (value: number | string | undefined) => {
  return `${Math.round(asNumber(value)).toLocaleString()} rides`;
};

export const formatTripsPerHour = (value: number | string | undefined) => {
  return `${Math.round(asNumber(value)).toLocaleString()} trips/hr`;
};

export const formatR2Score = (value: number | string | undefined) => {
  return `${asNumber(value).toFixed(4)} R²`;
};

export const formatInfluenceScore = (value: number | string | undefined) => {
  return `${asNumber(value).toFixed(3)} score`;
};

export const getDemandWindowInsight = (value: number, maxValue: number) => {
  if (!maxValue) {
    return 'Use this forecast to balance driver coverage before demand shifts.';
  }

  const ratio = value / maxValue;

  if (ratio >= 0.85) {
    return 'Position drivers actively during this high-volume window.';
  }

  if (ratio >= 0.55) {
    return 'Keep solid coverage here because demand is building but not yet at peak.';
  }

  return 'This is a quieter period, so lighter coverage is usually sufficient.';
};

export const getZoneDemandInsight = (value: number, maxValue: number) => {
  if (!maxValue) {
    return 'Use zone demand to decide where live supply should concentrate first.';
  }

  const ratio = value / maxValue;

  if (ratio >= 0.8) {
    return 'Deploy supply here to capture concentrated ride requests.';
  }

  if (ratio >= 0.55) {
    return 'Maintain nearby driver coverage because this zone should still convert well.';
  }

  return 'Lower yield versus the lead hotspot, so treat this as overflow coverage.';
};

export const getZoneShareInsight = (value: number, totalValue: number) => {
  if (!totalValue) {
    return 'Share shows how concentrated active demand is across the top zones.';
  }

  const share = value / totalValue;

  if (share >= 0.3) {
    return 'This zone captures a major share of hotspot demand and deserves priority coverage.';
  }

  if (share >= 0.18) {
    return 'This zone contributes meaningful overflow demand and supports nearby dispatch.';
  }

  return 'This is a smaller share of hotspot demand, so staff it after the core zones.';
};

export const getPeriodIntensityInsight = (windowLabel: string, value: number, maxValue: number) => {
  if (!maxValue) {
    return 'Compare the windows to decide where dispatch pressure is building first.';
  }

  const ratio = value / maxValue;

  if (value === maxValue) {
    return `${windowLabel} is the stronger dispatch window right now, so bias supply toward it.`;
  }

  if (ratio >= 0.85) {
    return `${windowLabel} trails the peak window only slightly, so keep strong coverage here too.`;
  }

  return `${windowLabel} is lighter than the peak window, so use it as secondary coverage.`;
};

export const getR2Insight = (value: number) => {
  if (value >= 0.98) {
    return 'Scores this close to 1.0 signify highly reliable demand predictions.';
  }

  if (value >= 0.95) {
    return 'Forecast reliability is strong here, with most demand variance explained.';
  }

  return 'This is usable accuracy, but there is still room to improve forecast reliability.';
};

export const getFeatureInfluenceInsight = (value: number, maxValue: number) => {
  if (!maxValue) {
    return 'Compare scores to see which signals drive the model most strongly.';
  }

  const ratio = value / maxValue;

  if (ratio >= 0.85) {
    return 'Strongest predictor of ride volume in the current model.';
  }

  if (ratio >= 0.55) {
    return 'Material driver of predictions, but not the dominant signal.';
  }

  return 'Secondary signal that adds nuance rather than driving the forecast on its own.';
};
