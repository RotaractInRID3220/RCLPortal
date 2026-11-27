import LandingBackground from './LandingBackground'

/** Full-viewport RCL 2026-27 blue background for inner public pages (schedule, leaderboard, player). */
export default function PageBackground() {
  return (
    <div aria-hidden className="@container pointer-events-none fixed inset-0 z-0">
      <LandingBackground topShade />
    </div>
  )
}
