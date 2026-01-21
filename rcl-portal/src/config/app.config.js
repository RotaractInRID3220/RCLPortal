// app.config.js
// Centralized app constraints and feature flags

// Sport Days Enum
export const SPORT_DAYS = {
  E_SPORT: { value: 'D-00', label: 'E-Sport', place: -1 },
  DAY_01: { value: 'D-01', label: 'Day 01', place: -2 },
  DAY_02: { value: 'D-02', label: 'Day 02', place: -3 },
  DAY_03: { value: 'D-03', label: 'Day 03', place: -4 },
};

// Helper function to get sport day place value for participation points
export const getSportDayPlace = (sportDayValue) => {
  const sportDay = Object.values(SPORT_DAYS).find(day => day.value === sportDayValue);
  return sportDay ? sportDay.place : null;
};

// Helper function to get sport day from place value
export const getSportDayFromPlace = (place) => {
  const sportDay = Object.values(SPORT_DAYS).find(day => day.place === place);
  return sportDay ? sportDay.value : null;
};

export const APP_CONFIG = {
  GENERAL_MEMBER_WARNING_THRESHOLD: 70, // % threshold for PieStatCard warning
  REGISTRATION_OPENING_DATE: '2025-10-19T10:00:00', // Date and time from which registration is enabled (YYYY-MM-DDTHH:mm:ss)
  // REGISTRATION_DEADLINE: '2025-11-03T00:30:00', // Date and time after which registration/deletion is disabled (YYYY-MM-DDTHH:mm:ss)
  REPLACEMENT_OPENING: '2025-11-22T00:00:00', // Date and time from which replacements are enabled (YYYY-MM-DDTHH:mm:ss)
  REPLACEMENT_DEADLINE: '2025-11-23T23:59:59', // Date and time after which player replacements are disabled (YYYY-MM-DDTHH:mm:ss)
  CURRENT_SPORT_DAY: SPORT_DAYS.E_SPORT.value, // Current sport day for on-the-day registrations
  MEMBERSHIP_CUTOFF_DATE: '2026-01-15T00:30:00.000Z', // Set cutoff date as 'YYYY-MM-DDTHH:mm:ss' or leave empty for current date
  REGISTRATION_FEE: 800, // Registration fee per player in Rs.
  PARTICIPATION_POINTS_PER_SPORT: 15, // Points awarded per sport for participation (50%+ attendance)
  EVENT_DAY: '2025-11-30T07:00:00', // Date and time of the main event (YYYY-MM-DDTHH:mm:ss)

  // Tournament Placement Points
  FIRST_PLACE_POINTS: 50, // Points awarded for 1st place
  SECOND_PLACE_POINTS: 30, // Points awarded for 2nd place
  THIRD_PLACE_POINTS: 20, // Points awarded for 3rd place
  // ...other config values
};
