import { transport } from '../../audio/transport'

// 1 tick = 1 sixteenth note. 16 ticks per measure, 4 ticks per quarter note.
const TICKS_PER_MEASURE = 16
const TICKS_PER_QUARTER = 4

export class TimeUtils {
  /**
   * Format a tick count as a "measure:quarter:sixteenth" string to keep parity
   * with the string representation used elsewhere in the UI state.
   */
  static tickToToneTime(tick: number): string {
    const measure = Math.floor(tick / TICKS_PER_MEASURE)
    const quarters = Math.floor((tick % TICKS_PER_MEASURE) / TICKS_PER_QUARTER)
    const sixteenths = tick % TICKS_PER_QUARTER
    return `${measure}:${quarters}:${sixteenths}`
  }

  /**
   * Parse the same bar:quarter:sixteenth string format back into a tick count.
   */
  static toneTimeToTicks(time: string | number): number {
    if (typeof time === 'number') return time
    const [measures = 0, quarters = 0, sixteenths = 0] = time
      .toString()
      .split(':')
      .map(Number)
    return measures * TICKS_PER_MEASURE + quarters * TICKS_PER_QUARTER + sixteenths
  }
}

/**
 * Convert a duration string (either "m:q:16" or a Tone-style short notation such
 * as "8n", "4n", "1m") to seconds using the current transport tempo.
 */
export function durationStringToSeconds(duration: string): number {
  const spt = transport.secondsPerTick()
  const shortMatch = /^(\d+)(n|m)$/.exec(duration)
  if (shortMatch) {
    const value = parseInt(shortMatch[1], 10)
    const unit = shortMatch[2]
    if (unit === 'm') {
      return value * TICKS_PER_MEASURE * spt
    }
    // "n" == note division (4n = quarter note, 8n = eighth, 16n = sixteenth)
    const ticks = (TICKS_PER_MEASURE * 4) / value
    return ticks * spt
  }
  return TimeUtils.toneTimeToTicks(duration) * spt
}
