import { Key } from '../../../../model/note/key/key'
import { getAudioContext, getMasterGain, dbToGain } from '../../../audio/engine'
import { keyToFrequency } from '../../../audio/note-frequency'
import { Volume } from '../../../volume/volume'
import { ChannelInstrument } from '../channel-instrument'
import { durationStringToSeconds } from '../../../time/utils/time-utils'

// A lightweight FM synth voice roughly modelled on the defaults of Tone.FMSynth:
//   harmonicity = 3 (modulator frequency = carrier * 3)
//   modulation index ~ 10
//   ADSR: attack 0.01s, decay 0.3s, sustain 0.4, release 0.4s
// A fresh voice is allocated per note and torn down when done.
const HARMONICITY = 3
const MOD_INDEX = 10
const ATTACK = 0.01
const DECAY = 0.3
const SUSTAIN = 0.4
const RELEASE = 0.4

export default class SynthInstrument implements ChannelInstrument {
  private _gain: GainNode
  private _connected = false

  constructor() {
    const ctx = getAudioContext()
    this._gain = ctx.createGain()
    this._gain.gain.value = 1
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
      // ignore
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

  play(note: Key, duration: string, time?: number, velocity?: number): void {
    const ctx = getAudioContext()
    const when = Math.max(time ?? ctx.currentTime, ctx.currentTime)
    const durSec = Math.max(durationStringToSeconds(duration), 0.05)
    const vel = velocity ?? 1
    const freq = keyToFrequency(note)

    const carrier = ctx.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = freq

    const modulator = ctx.createOscillator()
    modulator.type = 'sine'
    modulator.frequency.value = freq * HARMONICITY

    const modGain = ctx.createGain()
    modGain.gain.value = freq * MOD_INDEX
    modulator.connect(modGain)
    modGain.connect(carrier.frequency)

    const amp = ctx.createGain()
    amp.gain.value = 0
    carrier.connect(amp)
    amp.connect(this._gain)

    const peak = vel
    const sustainLvl = peak * SUSTAIN
    const releaseEnd = when + durSec + RELEASE

    // ADSR
    amp.gain.setValueAtTime(0, when)
    amp.gain.linearRampToValueAtTime(peak, when + ATTACK)
    amp.gain.linearRampToValueAtTime(sustainLvl, when + ATTACK + DECAY)
    amp.gain.setValueAtTime(sustainLvl, when + durSec)
    amp.gain.linearRampToValueAtTime(0, releaseEnd)

    carrier.start(when)
    modulator.start(when)
    carrier.stop(releaseEnd + 0.01)
    modulator.stop(releaseEnd + 0.01)

    carrier.onended = () => {
      try {
        carrier.disconnect()
        modulator.disconnect()
        modGain.disconnect()
        amp.disconnect()
      } catch {
        // ignore
      }
    }
  }
}
