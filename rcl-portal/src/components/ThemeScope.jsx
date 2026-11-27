'use client'

import { useEffect } from 'react'

/**
 * Switches the brand accent to RCL blue for the public website (landing, e-arena, player).
 * `.theme-blue` (globals.css) overrides `--brand`, which every `cranberry` utility reads.
 *
 * - The wrapper (display: contents, so it doesn't affect layout) themes the server-rendered tree.
 * - The html/body class themes things that render outside it: Radix dialogs, toasts, the page scrollbar.
 * Admin and council portals never render this, so they stay cranberry.
 */
export default function ThemeScope({ children }) {
  useEffect(() => {
    // <html> too, so the page scrollbar (styled from :root) follows the theme
    const targets = [document.documentElement, document.body]
    targets.forEach((el) => el.classList.add('theme-blue'))
    return () => targets.forEach((el) => el.classList.remove('theme-blue'))
  }, [])
  return <div className="theme-blue contents">{children}</div>
}
