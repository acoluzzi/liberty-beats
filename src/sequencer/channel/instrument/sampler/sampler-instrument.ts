import { Key } from '../../../../model/note/key/key'
import { getAudioContext, getMasterGain, dbToGain } from '../../../audio/engine'
import { loadSample } from '../../../audio/buffer-cache'
import { keyToMidi } from '../../../audio/note-frequency'
import { Volume } from '../../../volume/volume'
import { ChannelInstrument } from '../channel-instrument'

export type SamplerInstrumentSound = {
  key: Key
  sampleUrl: string
}

type SamplerSlot = {
  key: Key
  midi: number
  url: string
  buffer: AudioBuffer | null
}

export default class SamplerInstrument implements ChannelInstrument {
  private _gain: GainNode
  private _slots: SamplerSlot[] = []
  private _slotsByKey: Map<Key, SamplerSlot> = new Map()
  private _connected = false

  constructor(sounds: SamplerInstrumentSound[]) {
    const ctx = getAudioContext()
    this._gain = ctx.createGain()
    this._gain.gain.value = 1
    this._loadSounds(sounds)
  }

  connect(): void {
    if (this._connected) return
    this._gain.connect(getMasterGain())
    this._connected = true
  }

  disconnect(): void {
    if (!this._connected) return
    try {
      this._gain.disconnect()
    } catch {
      // already disconnected
    }
    this._connected = false
  }

  setVolume(volume: number): void {
    const db = Volume.transformVolumeToToneVolume(volume)
    this._gain.gain.setTargetAtTime(
      dbToGain(db),
      getAudioContext().currentTime,
      0.01
    )
  }

  play(note: Key, _duration: string, time?: number, velocity?: number): void {
    const ctx = getAudioContext()
    const when = time ?? ctx.currentTime
    const slot = this._findClosestSlot(note)
    if (!slot || !slot.buffer) return

    const source = ctx.createBufferSource()
    source.buffer = slot.buffer
    // Pitch-shift if an exact key match is not available
    const midi = keyToMidi(note)
    if (midi !== slot.midi) {
      source.playbackRate.value = Math.pow(2, (midi - slot.midi) / 12)
    }

    const gain = ctx.createGain()
    gain.gain.value = velocity ?? 1
    source.connect(gain)
    gain.connect(this._gain)

    try {
      source.start(when)
    } catch {
      // start time was in the past, fall back to immediate playback
      source.start()
    }
    source.onended = () => {
      try {
        source.disconnect()
        gain.disconnect()
      } catch {
        // ignore
      }
    }
  }

  private _loadSounds(sounds: SamplerInstrumentSound[]): void {
    sounds.forEach((sound) => {
      const slot: SamplerSlot = {
        key: sound.key,
        midi: keyToMidi(sound.key),
        url: sound.sampleUrl,
        buffer: null,
      }
      this._slots.push(slot)
      this._slotsByKey.set(sound.key, slot)
      loadSample(sound.sampleUrl).then((buf) => {
        slot.buffer = buf
      })
    })
  }

  private _findClosestSlot(key: Key): SamplerSlot | null {
    const exact = this._slotsByKey.get(key)
    if (exact) return exact
    if (this._slots.length === 0) return null
    const midi = keyToMidi(key)
    let best = this._slots[0]
    let bestDist = Math.abs(best.midi - midi)
    for (let i = 1; i < this._slots.length; i++) {
      const d = Math.abs(this._slots[i].midi - midi)
      if (d < bestDist) {
        best = this._slots[i]
        bestDist = d
      }
    }
    return best
  }
}
