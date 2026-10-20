import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// The suite runs many jsdom workers at once; a screen with simulated latency can take longer than
// Testing Library's 1s default to appear on a busy machine. Failures still fail, just not falsely.
configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

// jsdom doesn't implement scrolling; react-router's ScrollRestoration calls it.
window.scrollTo = () => {}

// jsdom has no layout engine, so scrolling an element into view is a no-op there.
Element.prototype.scrollIntoView = () => {}

// jsdom has no <dialog> behaviour; emulate the parts the app relies on.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  if (!this.hasAttribute('open')) return
  this.removeAttribute('open')
  this.dispatchEvent(new Event('close'))
}
