/**
 * Shared Constants for Anchor Platform
 */

export const TIME_PERIODS = ['morning', 'afternoon', 'evening', 'night'] as const;

export const MOODS = ['alert', 'confused', 'sleepy', 'agitated', 'calm'] as const;

export const MEDICATION_TIME_SLOTS = [
  'before_breakfast',
  'after_breakfast',
  'afternoon',
  'after_dinner',
  'before_bedtime',
] as const;

export const ALERT_TYPES = [
  'emergency',
  'fall',
  'missed_medication',
  'vitals_anomaly',
  'trend_warning',
] as const;

export const ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export const SCALES = {
  APPETITE: {
    1: 'No appetite, not hungry, refused food',
    2: 'Poor appetite, ate very little',
    3: 'Fair appetite, ate some food',
    4: 'Good appetite, ate most food',
    5: 'Excellent appetite, very hungry, ate all food well',
  },
  BALANCE: {
    1: 'No balance problems',
    2: 'Slight unsteadiness occasionally',
    3: 'Moderate balance problems, careful walking',
    4: 'Severe balance problems, needs constant support',
    5: 'Cannot maintain balance, wheelchair/bed bound',
  },
  COMMUNICATION: {
    1: 'Cannot communicate at all',
    2: 'Very difficult to understand',
    3: 'Somewhat difficult to understand',
    4: 'Mostly clear communication',
    5: 'Clear and easy communication',
  },
  PARTICIPATION: {
    1: 'Refused to participate',
    2: 'Very poor participation, minimal effort',
    3: 'Fair participation, some effort',
    4: 'Good participation, tried most exercises',
    5: 'Excellent participation, completed all exercises with effort',
  },
} as const;

export const WALKING_PATTERNS = [
  'normal',
  'shuffling',
  'uneven',
  'slow',
  'stumbling',
  'cannot_lift_feet',
] as const;

export const FREEZING_EPISODES = ['none', 'mild', 'severe'] as const;

export const SWALLOWING_ISSUES = ['none', 'coughing', 'choking', 'slow'] as const;

export const FALL_TYPES = ['none', 'near_fall', 'actual_fall'] as const;

export const USER_ROLES = ['family', 'admin'] as const;