export const HOUR = 3_600_000
export const DAY = 24 * HOUR
/** Bangladesh Standard Time is UTC+6 with no daylight saving. */
const BST_OFFSET = 6 * HOUR

export const bstHour = (ts: number) => Math.floor((((ts + BST_OFFSET) % DAY) + DAY) % DAY / HOUR)
export const bstDayStart = (ts: number) => Math.floor((ts + BST_OFFSET) / DAY) * DAY - BST_OFFSET
/** Timestamp for a BST calendar day offset + fractional hour. */
export const bstTime = (startDay: number, dayOffset: number, hour: number) => startDay + dayOffset * DAY + hour * HOUR
