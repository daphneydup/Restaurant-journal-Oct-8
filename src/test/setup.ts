import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

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
