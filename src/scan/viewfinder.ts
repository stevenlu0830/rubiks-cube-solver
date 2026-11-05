/**
 * Geometry for the viewfinder: where the on-screen guide falls in the
 * camera's own picture, so the squares inside it can be read later.
 */

export interface Size {
  width: number
  height: number
}

export interface Rect extends Size {
  x: number
  y: number
}

/**
 * The part of the camera's picture (in its own pixels) that shows under
 * `area`, a box in CSS pixels measured from the video element's top-left.
 *
 * The picture is shown with object-fit: cover, so it's scaled up just enough
 * to fill the element, then centred, and whatever hangs over the edges is
 * cut off. On a phone held upright, a wide camera picture in a tall element
 * loses both sides. The scale is the same both ways, so a square guide on
 * screen is a square in the picture too.
 */
export function shownPart(area: Rect, element: Size, picture: Size): Rect {
  const scale = Math.max(
    element.width / picture.width,
    element.height / picture.height,
  )
  // How far the scaled picture hangs over each side of the element.
  const overhangX = (picture.width * scale - element.width) / 2
  const overhangY = (picture.height * scale - element.height) / 2
  return {
    x: (area.x + overhangX) / scale,
    y: (area.y + overhangY) / scale,
    width: area.width / scale,
    height: area.height / scale,
  }
}
