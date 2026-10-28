let supported: boolean | undefined

/**
 * True if this browser can draw the 3D cube. three.js needs WebGL 2, which
 * nearly every phone from the last several years has, but it can be missing
 * on old devices or turned off (some browsers' privacy settings, or a
 * graphics driver the browser doesn't trust).
 */
export function canDraw3D(): boolean {
  if (supported === undefined) {
    const context = document.createElement('canvas').getContext('webgl2')
    supported = context !== null
    // Only a test: hand the graphics memory straight back.
    context?.getExtension('WEBGL_lose_context')?.loseContext()
  }
  return supported
}
