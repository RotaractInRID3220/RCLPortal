// app.config.js
// Centralized app constraints and feature flags

// Dates are NOT configured here any more. Registration open/close, replacement window, membership
// cutoff and event start are settings edited by a super admin (Admin > Configurations > Event settings)
// and read through /api/public/event-info (pages) or the settings table (server). Event days live in
// the event_days table. Fee, points and penalty values are also settings (defaults seeded).
// Event days come from the event_days table and the day being checked in from `checkin.current_day`
// (see useSportDays in hooks/useEventInfo.js).
export const APP_CONFIG = {
  GENERAL_MEMBER_WARNING_THRESHOLD: 70, // % threshold for PieStatCard warning
  REGISTRATION_FEE: 800, // Registration fee per player in Rs.
  PARTICIPATION_POINTS_PER_SPORT: 15, // Points awarded per sport for participation (50%+ attendance)

  // Tournament Placement Points
  FIRST_PLACE_POINTS: 100, // Points awarded for 1st place
  SECOND_PLACE_POINTS: 75, // Points awarded for 2nd place
  THIRD_PLACE_POINTS: 50, // Points awarded for 3rd place

  // Track Individual Placement Points (different from regular tournaments)
  TRACK_INDIVIDUAL_FIRST_PLACE_POINTS: 85, // Points awarded for 1st place in track individual
  TRACK_INDIVIDUAL_SECOND_PLACE_POINTS: 50, // Points awarded for 2nd place in track individual
  TRACK_INDIVIDUAL_THIRD_PLACE_POINTS: 30, // Points awarded for 3rd place in track individual
  // ...other config values
};
