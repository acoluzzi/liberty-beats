import { RootStore } from '../../store'
import { observeStore } from '../../store/observers'
import { selectVolume } from '../../features/daw/player-bar/store/selectors'
import {
  dbToGain,
  gainToDb,
  getAudioContext,
  getMasterGain,
} from '../audio/engine'

export class Volume {
  private _store: RootStore

  constructor(store: RootStore) {
    this._store = store
    this.registerStoreListeners()
  }

  registerStoreListeners() {
    observeStore(this._store, selectVolume, this.setVolume.bind(this))
  }

  setVolume(volume: number) {
    const db = Volume.transformVolumeToToneVolume(volume)
    const master = getMasterGain()
    master.gain.setTargetAtTime(
      dbToGain(db),
      getAudioContext().currentTime,
      0.01
    )
  }

  /**
   * Retained name for compatibility with callers that display volume in dB.
   * Converts the 0..N linear volume value into decibels (log scale).
   */
  static transformVolumeToToneVolume(volume: number) {
    return gainToDb(volume / 100)
  }
}
