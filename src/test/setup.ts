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
