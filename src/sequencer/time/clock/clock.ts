import { RootStore } from '../../../store'
import { setCurrentTickFromSequencer } from '../../../features/daw/playlist-header/store/playlist-header-slice'
import { setTime } from '../../../features/daw/player-bar/store/playerBarSlice'
import { observeStore } from '../../../store/observers'
import { selectRequestedNewTickPosition } from '../../../features/daw/playlist-header/store/selectors'
import { selectBpm } from '../../../features/daw/player-bar/store/selectors'
import { transport } from '../../audio/transport'

// Emit UI updates on every 16th note (1 tick).
const UI_TICK_INTERVAL = 1

export class Clock {
  currentTick: number

  private _bpm: number
  private _time: number
  private _store: RootStore

  constructor(store: RootStore) {
    this._store = store
    this._bpm = store.getState().playerBar.bpm
    this._time = 0
    this.currentTick = 0

    transport.setBpm(this._bpm)

    transport.scheduleRepeat(() => {
      this.handleTick()
    }, UI_TICK_INTERVAL)

    this.registerStoreListeners()
  }

  requestNewTickPosition(newTick: number | null) {
    if (newTick === null) return

    transport.seekTicks(newTick)
    this.readPositionFromTransport()

    if (transport.state !== 'started') {
      // will trigger store update ONLY if transport is not playing so to not collide with the handleTick method
      this.notifyStore()
    }
  }

  private registerStoreListeners() {
    observeStore(
      this._store,
      selectRequestedNewTickPosition,
      this.requestNewTickPosition.bind(this)
    )

    observeStore(this._store, selectBpm, this.handleRequestedNewBpm.bind(this))
  }

  private handleRequestedNewBpm(newBpm: number) {
    this._bpm = newBpm
    transport.setBpm(this._bpm)
  }

  private handleTick() {
    this.readPositionFromTransport()
    this.notifyStore()
  }

  private readPositionFromTransport() {
    this.currentTick = Math.floor(transport.positionTicks)
    this._time = Math.max(transport.seconds, 0)
  }

  private notifyStore() {
    this._store.dispatch(setTime(this._time))
    this._store.dispatch(setCurrentTickFromSequencer(this.currentTick))
  }
}
