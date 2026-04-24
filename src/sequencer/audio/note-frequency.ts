import { Key } from '../../model/note/key/key'

// MIDI number for C1 in the KEYS array (KEYS[0]). We use the common mapping where
// A4 = MIDI 69 = 440 Hz, so C1 = MIDI 24.
const C1_MIDI = 24
const NOTE_INDEX: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
}

export function keyToMidi(key: Key): number {
  // key is like "C1", "C#1", "D2", "F#10"
  const match = /^([A-G]#?)(-?\d+)$/.exec(key)
  if (!match) return C1_MIDI
  const noteIdx = NOTE_INDEX[match[1]]
  const octave = parseInt(match[2], 10)
  // In the KEYS array, "C1" is octave label "1", but in MIDI convention
  // C1 = 24. Maintain that mapping consistently.
  return (octave + 1) * 12 + noteIdx
}

export function keyToFrequency(key: Key): number {
  const midi = keyToMidi(key)
  return 440 * Math.pow(2, (midi - 69) / 12)
}
