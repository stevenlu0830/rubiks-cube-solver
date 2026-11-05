/**
 * The phone's camera, for scanning the cube. The first time, the browser
 * asks the user whether the page may use it. Browsers only share the camera
 * with secure pages: https://, or http://localhost while developing.
 */

export type CameraErrorCode =
  /** The page isn't on https://, so the browser hides the camera. */
  | 'insecure'
  /** The user said no, or a browser setting blocks the camera. */
  | 'denied'
  /** There's no camera. */
  | 'missing'
  /** The camera is in use by another app, or wouldn't start. */
  | 'busy'
  /** It was working, then stopped (e.g. a phone call took it over). */
  | 'stopped'
  | 'failed'

export class CameraError extends Error {
  readonly code: CameraErrorCode
  constructor(code: CameraErrorCode) {
    super(`Camera ${code}`)
    this.code = code
  }
}

/** What to tell the user when the camera can't be used. */
export function cameraErrorMessage(error: unknown): string {
  const code = error instanceof CameraError ? error.code : 'failed'
  switch (code) {
    case 'insecure':
      return 'The camera only works when the app is opened from a secure (https://) address.'
    case 'denied':
      return "The camera is blocked. Allow this site to use the camera in your browser's settings, then try again."
    case 'missing':
      return 'No camera was found on this device.'
    case 'busy':
      return 'The camera is being used by another app. Close that app, then try again.'
    case 'stopped':
      return 'The camera stopped. Please try again.'
    case 'failed':
      return "The camera couldn't start. Please try again."
  }
}

/**
 * True if the app should offer to scan. On a page that isn't secure the
 * browser hides its camera completely, so the button is shown anyway, to
 * explain why it can't work; elsewhere only if the browser can use cameras
 * at all. Whether this device really has one is only known once asked.
 */
export function canOfferCamera(): boolean {
  return window.isSecureContext === false || hasCameraSupport()
}

function hasCameraSupport(): boolean {
  return typeof navigator.mediaDevices?.getUserMedia === 'function'
}

/** Starts the camera: the back one on a phone. Rejects with a CameraError. */
export async function openCamera(): Promise<MediaStream> {
  if (window.isSecureContext === false) throw new CameraError('insecure')
  if (!hasCameraSupport()) throw new CameraError('missing')
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // "ideal", not "exact": a laptop's only camera faces the user, and that's fine too.
        facingMode: { ideal: 'environment' },
        // Plenty to read nine squares, without the battery cost of full resolution.
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    })
  } catch (error) {
    throw new CameraError(errorCode(error))
  }
}

/** Switches the camera off, so the phone's camera light goes out. */
export function stopCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}

/** Sorts the browser's reasons for refusing the camera into the cases the user is told about. */
function errorCode(error: unknown): CameraErrorCode {
  const name =
    typeof error === 'object' && error !== null && 'name' in error
      ? error.name
      : ''
  switch (name) {
    case 'NotAllowedError': // the user said no
    case 'SecurityError': // a browser setting or page policy forbids it
      return 'denied'
    case 'NotFoundError':
    case 'OverconstrainedError': // no camera that can do what was asked
      return 'missing'
    case 'NotReadableError': // in use elsewhere, or a hardware problem
    case 'AbortError':
      return 'busy'
    default:
      return 'failed'
  }
}
