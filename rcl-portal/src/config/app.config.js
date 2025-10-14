// app.config.js
// Centralized app constraints and feature flags

export const APP_CONFIG = {
  GENERAL_MEMBER_WARNING_THRESHOLD: 70, // % threshold for PieStatCard warning
  REGISTRATION_OPENING_DATE: '2025-10-13T00:00:00', // Date and time from which registration is enabled (YYYY-MM-DDTHH:mm:ss)
  REGISTRATION_DEADLINE: '2025-10-20T23:59:59', // Date and time after which registration/deletion is disabled (YYYY-MM-DDTHH:mm:ss)
  CURRENT_SPORT_DAY: 'D-01', // Current sport day for on-the-day registrations
  MEMBERSHIP_CUTOFF_DATE: '2025-09-09T20:25:53.000Z', // Set cutoff date as 'YYYY-MM-DDTHH:mm:ss' or leave empty for current date
  REGISTRATION_FEE: 800, // Registration fee per player in Rs.
  // ...other config values
};
