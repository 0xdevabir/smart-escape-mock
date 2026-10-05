import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icon } from './Icon'

export type SelectOption = {
  value: string
  label: string
  disabled?: boolean
  hint?: string
}

type Props = {
  value: string
  options: SelectOption[]
  placeholder: string
  ariaLabel?: string
  onChange: (value: string) => void
}

/** Custom listbox — matches WayNest glass UI; no native `<select>` menu. */
export function Select({ value, options, placeholder, ariaLabel, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const selected = options.find((o) => o.value === value)

  const enabledIndexes = () => options.flatMap((o, i) => (o.disabled ? [] : [i]))

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDoc, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDoc, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const enabled = enabledIndexes()
    const i = options.findIndex((o) => o.value === value && !o.disabled)
    setActive(i >= 0 ? i : (enabled[0] ?? -1))
    queueMicrotask(() => {
      listRef.current?.focus({ preventScroll: true })
      listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open])

  const move = (dir: 1 | -1) => {
    const enabled = enabledIndexes()
    if (!enabled.length) return
    const at = enabled.indexOf(active)
    const next =
      at < 0
        ? (dir === 1 ? enabled[0] : enabled[enabled.length - 1])
        : enabled[(at + dir + enabled.length) % enabled.length]
    setActive(next)
    queueMicrotask(() => {
      listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
    })
  }

  const pick = (opt: SelectOption) => {
    if (opt.disabled) return
    onChange(opt.value)
    setOpen(false)
  }

  const onTriggerKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen(true)
    }
  }

  const onListKey = (e: ReactKeyboardEvent) => {
    const enabled = enabledIndexes()
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); if (enabled[0] != null) setActive(enabled[0]) }
    else if (e.key === 'End') { e.preventDefault(); if (enabled.length) setActive(enabled[enabled.length - 1]) }
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (active === -1) { onChange(''); setOpen(false); return }
      const opt = options[active]
      if (opt) pick(opt)
    }
    else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <div className={`select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
      >
        <span className={selected ? 'select-value' : 'select-placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <Icon name="chevron" size={16} />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          className="select-menu"
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : `${listId}-empty`}
          onKeyDown={onListKey}
        >
          <li
            id={`${listId}-empty`}
            role="option"
            aria-selected={!value}
            className={!value ? 'is-selected' : undefined}
            data-active={active === -1 ? 'true' : undefined}
            onMouseEnter={() => setActive(-1)}
            onClick={() => { onChange(''); setOpen(false) }}
          >
            <span className="select-placeholder">{placeholder}</span>
          </li>
          {options.map((opt, i) => (
            <li
              key={opt.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={opt.value === value}
              aria-disabled={opt.disabled || undefined}
              className={[
                opt.value === value ? 'is-selected' : '',
                opt.disabled ? 'is-disabled' : '',
              ].filter(Boolean).join(' ') || undefined}
              data-active={active === i ? 'true' : undefined}
              onMouseEnter={() => { if (!opt.disabled) setActive(i) }}
              onClick={() => pick(opt)}
            >
              <span className="select-opt-main">{opt.label}</span>
              {opt.hint && <span className="select-opt-hint">{opt.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
