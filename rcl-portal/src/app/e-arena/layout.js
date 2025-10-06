import NavBar from './components/NavBar'

export const metadata = {
  title: 'E-Arena | RCL Portal',
  description: "Rotaract in RID 3220's most electrifying E-sport arena where Rotaractors clash for glory!",
}

export default function EArenaLayout({ children }) {
  return (
    <>
      <NavBar />
      {children}
    </>
  )
}

