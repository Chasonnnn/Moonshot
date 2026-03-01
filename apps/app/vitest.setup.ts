import "@testing-library/jest-dom/vitest"

// jsdom does not provide ResizeObserver — needed by react-resizable-panels
globalThis.ResizeObserver ??= class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof globalThis.ResizeObserver

// jsdom does not provide Element.getAnimations — needed by @base-ui/react scroll-area
if (!Element.prototype.getAnimations) {
  Element.prototype.getAnimations = () => []
}
