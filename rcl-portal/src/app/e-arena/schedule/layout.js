import NavBar from '../components/NavBar'
import Footer from '../components/Footer'

export const metadata = {
  title: 'Live Schedule - RCL E-Arena | Rotaract Champions League',
  description: "Track live matches and schedules for Rotaract Champions League E-Arena. View real-time match updates, brackets, and tournament progress for all esports competitions in RID 3220.",
  keywords: [
    'RCL schedule',
    'esports schedule',
    'live matches',
    'tournament bracket',
    'Rotaract Champions League',
    'gaming schedule',
    'match updates',
    'RID 3220',
    'Rotaract3220',
  ],
}

export default function ScheduleLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-black">
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
