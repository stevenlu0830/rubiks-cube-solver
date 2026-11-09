/**
 * Sharing things out at the lowest total cost: the "Hungarian algorithm".
 *
 * Given a table of costs, with a row for each thing to place (a square)
 * and a column for each place (one of the 9 slots for each colour), it
 * picks a different column for every row so the costs add up to as little
 * as possible. Trying every way would take forever (there are more ways to
 * colour 48 squares than atoms on Earth); this finds the best one in a
 * fraction of a millisecond.
 *
 * How it works, roughly: rows are added one at a time. Each new row takes
 * its cheapest column; if another row already has that column, that row
 * moves to its next best, and so on down a chain. Running "discounts" on
 * every row and column (u and v below) keep track of how much each move
 * costs, so the chain it picks is always the cheapest one.
 */

/**
 * For each row of `cost`, the column it gets. Needs at least as many
 * columns as rows; extra columns are left unused.
 */
export function cheapestAssignment(
  cost: readonly (readonly number[])[],
): number[] {
  const rows = cost.length
  if (rows === 0) return []
  const columns = cost[0].length
  if (columns < rows) throw new RangeError('Needs a column for every row')

  // Arrays count from 1 here; position 0 is a placeholder "no row/column".
  const u = Array<number>(rows + 1).fill(0) // discount per row
  const v = Array<number>(columns + 1).fill(0) // discount per column
  const owner = Array<number>(columns + 1).fill(0) // the row each column went to
  const cameFrom = Array<number>(columns + 1).fill(0)

  for (let row = 1; row <= rows; row++) {
    owner[0] = row
    let column = 0
    const cheapest = Array<number>(columns + 1).fill(Infinity)
    const visited = Array<boolean>(columns + 1).fill(false)
    // Grow a chain of moves until it reaches a column nobody has yet.
    do {
      visited[column] = true
      const current = owner[column]
      let step = Infinity
      let next = 0
      for (let j = 1; j <= columns; j++) {
        if (visited[j]) continue
        const reduced = cost[current - 1][j - 1] - u[current] - v[j]
        if (reduced < cheapest[j]) {
          cheapest[j] = reduced
          cameFrom[j] = column
        }
        if (cheapest[j] < step) {
          step = cheapest[j]
          next = j
        }
      }
      for (let j = 0; j <= columns; j++) {
        if (visited[j]) {
          u[owner[j]] += step
          v[j] -= step
        } else {
          cheapest[j] -= step
        }
      }
      column = next
    } while (owner[column] !== 0)
    // Walk back along the chain, moving each row one column along.
    do {
      const previous = cameFrom[column]
      owner[column] = owner[previous]
      column = previous
    } while (column !== 0)
  }

  const result = Array<number>(rows)
  for (let j = 1; j <= columns; j++) {
    if (owner[j] !== 0) result[owner[j] - 1] = j - 1
  }
  return result
}
