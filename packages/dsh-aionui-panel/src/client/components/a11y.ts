import type { KeyboardEvent } from 'react'

/**
 * Keyboard activation parity for focusable rows/divs styled as buttons
 * (role="button" + tabIndex={0}): Enter and Space trigger the same action as
 * a click, and events bubbling out of nested interactive elements (a row's
 * inline action buttons, a tab's close control) are ignored so they never
 * double-activate the row.
 * @param handler - the activation handler (the element's click action).
 * @returns a keydown handler for the focusable element.
 */
export function activateOnKey(handler: () => void) {
  return (event: KeyboardEvent<HTMLElement>): void => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handler()
    }
  }
}
