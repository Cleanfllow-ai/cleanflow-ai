/**
 * quarantine-shortcuts-cheatsheet.tsx
 *
 * Small popover listing the editor keyboard shortcuts.  Mounted from the
 * toolbar via the "⌘ Shortcuts" button AND opened via the `?` key (the
 * shortcut hook calls `onShowCheatsheet` which flips `open` on this
 * component).
 *
 * Controlled so the parent can drive it from either the button click or
 * the `?` hotkey without owning two separate trigger refs.
 */

'use client'

import { Keyboard } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPod|iPhone|iPad/.test(navigator.platform)

const MOD_LABEL = IS_MAC ? '⌘' : 'Ctrl'

interface ShortcutRow {
  keys: string[]
  description: string
}

const SHORTCUTS: ShortcutRow[] = [
  { keys: [MOD_LABEL, 'S'], description: 'Save the current edit' },
  { keys: [MOD_LABEL, 'Enter'], description: 'Apply edit and advance to next quarantined cell' },
  { keys: [MOD_LABEL, 'F'], description: 'Open Find & Replace' },
  { keys: [MOD_LABEL, 'H'], description: 'Toggle Find & Replace panel' },
  { keys: [MOD_LABEL, 'Z'], description: 'Undo last edit' },
  { keys: ['Esc'], description: 'Close topmost dialog or deselect cell' },
  { keys: ['?'], description: 'Show this cheatsheet' },
]

interface QuarantineShortcutsCheatsheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuarantineShortcutsCheatsheet({
  open,
  onOpenChange,
}: QuarantineShortcutsCheatsheetProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs font-medium px-3"
          data-testid="quarantine-shortcuts-trigger"
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className="w-3 h-3 mr-1.5" />
          <span className="hidden sm:inline">{MOD_LABEL} Shortcuts</span>
          <span className="sm:hidden">Keys</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[360px] p-0"
        data-testid="quarantine-shortcuts-cheatsheet"
      >
        <div className="border-b border-border px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-semibold">Keyboard shortcuts</span>
          <span className="text-[10px] text-muted-foreground">
            Power-user only — click anywhere to close
          </span>
        </div>
        <ul className="p-2 space-y-1 max-h-[320px] overflow-auto">
          {SHORTCUTS.map((row) => (
            <li
              key={row.description}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded hover:bg-muted/40"
            >
              <span className="text-xs text-foreground">{row.description}</span>
              <span className="flex items-center gap-1 shrink-0">
                {row.keys.map((k) => (
                  <kbd
                    key={k}
                    className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded border border-border bg-muted text-[10px] font-mono text-muted-foreground"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          Shortcuts ignore typing inside text inputs so {MOD_LABEL}+A / {MOD_LABEL}+C still work normally.
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default QuarantineShortcutsCheatsheet
