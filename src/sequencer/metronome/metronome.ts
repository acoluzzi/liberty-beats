import metronomeDown from '../../assets/metronome_down.wav'
import metronomeUp from '../../assets/metronome_up.wav'
import { RootStore } from '../../store'
import { observeStore } from '../../store/observers'
import { selectMetronomeActive } from '../../features/daw/player-bar/store/selectors'
import { getAudioContext, getMasterGain } from '../audio/engine'
import { loadSample } from '../audio/buffer-cache'
import { transport } from '../audio/transport'

// Ticks per quarter note — the metronome fires on every beat.
const TICKS_PER_BEAT = 4

export class Metronome {
  private _store: RootStore
  private _active = false
  private _upBuffer: AudioBuffer | null = null
  private _downBuffer: AudioBuffer | null = null

  constructor(store: RootStore) {
    this._store = store
    this._preloadSamples()

    transport.scheduleRepeat((time) => {
      if (!this._active) return
      const tick = Math.round(transport.positionTicks)
      const isDownbeat = tick % 16 === 0
      const buffer = isDownbeat ? this._upBuffer : this._downBuffer
      if (!buffer) return
      this._playBuffer(buffer, time)
    }, TICKS_PER_BEAT)

    this.registerStoreListeners()
  }

  private async _preloadSamples() {
    const [up, down] = await Promise.all([
      loadSample(metronomeUp),
      loadSample(metronomeDown),
    ])
    this._upBuffer = up
    this._downBuffer = down
  }

  private _playBuffer(buffer: AudioBuffer, when: number) {
    const ctx = getAudioContext()
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.connect(getMasterGain())
    try {
      source.start(when)
    } catch {
      source.start()
    }
    source.onended = () => {
      try {
        source.disconnect()
      } catch {
        // ignore
      }
    }
  }

  registerStoreListeners() {
    observeStore(
      this._store,
      selectMetronomeActive,
      this.changeMetronomeState.bind(this)
    )
  }

  changeMetronomeState(isActive: boolean) {
    this._active = isActive
  }
}
