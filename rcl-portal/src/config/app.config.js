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
  REGISTRATION_OPENING_DATE: '2025-10-13T00:00:00', // Date and time from which registration is enabled (YYYY-MM-DDTHH:mm:ss)
  REGISTRATION_DEADLINE: '2025-10-20T23:59:59', // Date and time after which registration/deletion is disabled (YYYY-MM-DDTHH:mm:ss)
  CURRENT_SPORT_DAY: SPORT_DAYS.DAY_01.value, // Current sport day for on-the-day registrations
  MEMBERSHIP_CUTOFF_DATE: '2025-09-09T20:25:53.000Z', // Set cutoff date as 'YYYY-MM-DDTHH:mm:ss' or leave empty for current date
  REGISTRATION_FEE: 800, // Registration fee per player in Rs.
  PARTICIPATION_POINTS_PER_SPORT: 15, // Points awarded per sport for participation (50%+ attendance)
  // ...other config values
};
