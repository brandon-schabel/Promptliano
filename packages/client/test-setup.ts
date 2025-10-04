/**
 * Test setup file for Bun tests
 * Sets up happy-dom for DOM testing
 */
import { Window } from 'happy-dom'

// Create a happy-dom window
const window = new Window({ url: 'http://localhost:3000' })
const document = window.document

// Set up global variables for DOM
globalThis.window = window as any
globalThis.document = document as any
globalThis.navigator = window.navigator as any
globalThis.HTMLElement = window.HTMLElement as any
globalThis.Element = window.Element as any
globalThis.Node = window.Node as any
globalThis.DocumentFragment = window.DocumentFragment as any
globalThis.Text = window.Text as any
globalThis.Comment = window.Comment as any

// Note: Not using automatic cleanup because it breaks React Testing Library's screen object
// Tests that need cleanup should call it manually using { container } from render()
