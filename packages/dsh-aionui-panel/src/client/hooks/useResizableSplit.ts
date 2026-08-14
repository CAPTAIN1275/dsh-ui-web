/**
 * The panel system's single drag engine hook — a thin React wrapper over the
 * framework-free machinery in drag.ts (AionUi's useResizableSplit
 * architecture, re-implemented): px or ratio units, range-validated
 * localStorage persistence, double-click reset to the default width.
 * @module dsh-aionui-panel/client/hooks/useResizableSplit
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { handlePointerDragStart } from '../drag.ts'
import { readStoredNumber, writeStoredNumber } from '../persist.ts'

export interface UseResizableSplitOptions {
  /** Default width (px or percent). */
  defaultWidth?: number
  /** Minimum (same unit). */
  minWidth?: number
  /** Maximum (same unit). */
  maxWidth?: number
  /** localStorage key (preference persistence). */
  storageKey?: string
  /** 'px' for fixed pixel widths, 'ratio' for percents (default 'ratio'). */
  unit?: 'px' | 'ratio'
}

export interface DragHandleProps {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onDoubleClick: () => void
}

/**
 * Resizable-split engine.
 * @param options - width contract + persistence key.
 * @returns current width, the committed setter, handle props, and the clamp.
 */
export function useResizableSplit(options: UseResizableSplitOptions = {}) {
  const {
    defaultWidth = 50,
    minWidth = 20,
    maxWidth = 80,
    storageKey,
    unit = 'ratio',
  } = options
  const isPx = unit === 'px'

  const [width, setWidthState] = useState(() =>
    storageKey === undefined
      ? defaultWidth
      : readStoredNumber(storageKey, minWidth, maxWidth, defaultWidth))

  // The pointer-down closure reads the width at drag START without rebinding.
  const widthRef = useRef(width)
  useEffect(() => {
    widthRef.current = width
  }, [width])

  /** The committed setter: state + storage (validated) + resize event. */
  const setWidth = useCallback((value: number) => {
    setWidthState(value)
    if (storageKey !== undefined) writeStoredNumber(storageKey, value)
    try {
      window.dispatchEvent(new CustomEvent('preview-panel-resize', { detail: { width: value } }))
    } catch {
      // event dispatch is best-effort
    }
  }, [storageKey])

  const clamp = useCallback((value: number): number => {
    return Math.min(maxWidth, Math.max(minWidth, value))
  }, [minWidth, maxWidth])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const el = event.currentTarget as HTMLDivElement
    handlePointerDragStart(event.nativeEvent, el, {
      reverse: el.dataset.reverse === 'true',
      getStartWidth: () => widthRef.current,
      compute: (startWidth, deltaX) => clamp(startWidth + deltaX),
      onFrame: (value) => setWidthState(value),
      onEnd: (value) => setWidth(value),
    })
  }, [clamp, setWidth])

  const handleDoubleClick = useCallback(() => {
    setWidth(defaultWidth)
  }, [defaultWidth, setWidth])

  const handleProps: DragHandleProps = { onPointerDown: handlePointerDown, onDoubleClick: handleDoubleClick }

  return { width, setWidth, handleProps, clamp, isPx }
}
