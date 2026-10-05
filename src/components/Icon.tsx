/** Tiny stroke icon set (24×24 grid, currentColor) so toolbar buttons can collapse to icons on phones. */
const PATHS = {
  upload: 'M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3',
  sample: 'M4 6h16M4 12h10M4 18h7M17 15l3 3-3 3',
  reset: 'M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01',
  contrast: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0v18',
  help: 'M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4.5M12 18h.01M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z',
  play: 'M7 5v14l11-7z',
  stop: 'M7 7h10v10H7z',
  pin: 'M12 21s-6-5.4-6-11a6 6 0 0 1 12 0c0 5.6-6 11-6 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  hazard: 'M12 4 2.5 20h19zM12 10v4.5M12 17.5h.01',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'M6 9l6 6 6-6',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  )
}

