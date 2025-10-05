// app.config.js
// Centralized app constraints and feature flags

export const APP_CONFIG = {
  GENERAL_MEMBER_WARNING_THRESHOLD: 70, // % threshold for PieStatCard warning
  REGISTRATION_DEADLINE: '2025-11-01T23:59:59', // Date and time after which registration/deletion is disabled (YYYY-MM-DDTHH:mm:ss)
  CURRENT_SPORT_DAY: 'D-01', // Current sport day for on-the-day registrations
  // ...other config values
};
