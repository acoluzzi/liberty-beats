import { getAudioContext } from './engine'

export type PartEvent<T = unknown> = {
  tick: number
  value: T
}

export type PartCallback<T = unknown> = (time: number, value: T) => void

export class Part<T = unknown> {
  startAtTick: number = 0
  events: PartEvent<T>[] = []
  callback: PartCallback<T>

  constructor(callback: PartCallback<T>, events: PartEvent<T>[] = []) {
    this.callback = callback
    this.events = events.slice().sort((a, b) => a.tick - b.tick)
  }

  start(startAtTick: number): this {
    this.startAtTick = startAtTick
    transport.addPart(this as Part<unknown>)
    return this
  }

  dispose(): void {
    transport.removePart(this as Part<unknown>)
    this.events = []
  }
}

type RepeatEntry = {
  id: number
  intervalTicks: number
  startTick: number
  callback: (time: number) => void
  muted: boolean
}

const LOOKAHEAD_SEC = 0.1
const SCHEDULE_INTERVAL_MS = 25
// Number of 16th-note ticks per whole note. `tick` in this codebase is a 16th note.
const TICKS_PER_BEAT = 4

class Transport {
  bpm = 120
  loop = false
  loopStartTicks = 0
  loopEndTicks = 16

  state: 'started' | 'stopped' | 'paused' = 'stopped'

  // origin = at audioTime `_originAudioTime`, the playback position was `_originTick`
  private _originAudioTime = 0
  private _originTick = 0

  // scheduler cursor
  private _nextTick = 0
  private _nextTickTime = 0

  private _nextRepeatId = 1
  private _repeats: Map<number, RepeatEntry> = new Map()
  private _parts: Set<Part<unknown>> = new Set()

  private _schedulerHandle: ReturnType<typeof setInterval> | null = null

  secondsPerTick(): number {
    return 60 / this.bpm / TICKS_PER_BEAT
  }

  get positionTicks(): number {
    if (this.state !== 'started') return this._originTick
    const ctx = getAudioContext()
    const elapsed = ctx.currentTime - this._originAudioTime
    const raw = this._originTick + elapsed / this.secondsPerTick()
    if (this.loop) {
      const len = this.loopEndTicks - this.loopStartTicks
      if (len > 0 && raw >= this.loopEndTicks) {
        return ((raw - this.loopStartTicks) % len) + this.loopStartTicks
      }
    }
    return raw
  }

  get seconds(): number {
    return Math.max(this.positionTicks * this.secondsPerTick(), 0)
  }

  setBpm(bpm: number): void {
    if (bpm <= 0) return
    if (this.state === 'started') {
      // preserve current position when tempo changes
      const current = this.positionTicks
      const ctx = getAudioContext()
      this._originAudioTime = ctx.currentTime
      this._originTick = current
      this.bpm = bpm
      // re-align the scheduler cursor to the current time
      const spt = this.secondsPerTick()
      this._nextTick = Math.ceil(current)
      this._nextTickTime =
        this._originAudioTime + (this._nextTick - current) * spt
    } else {
      this.bpm = bpm
    }
  }

  seekTicks(tick: number): void {
    const ctx = getAudioContext()
    this._originTick = Math.max(0, tick)
    this._originAudioTime = ctx.currentTime
    this._nextTick = Math.ceil(this._originTick)
    this._nextTickTime =
      this._originAudioTime +
      (this._nextTick - this._originTick) * this.secondsPerTick()
  }

  start(): void {
    if (this.state === 'started') return
    const ctx = getAudioContext()
    // lookahead start so we don't miss the first beat
    const startDelay = 0.02
    this._originAudioTime = ctx.currentTime + startDelay
    // keep _originTick — resume from current position
    this._nextTick = Math.ceil(this._originTick)
    this._nextTickTime =
      this._originAudioTime +
      (this._nextTick - this._originTick) * this.secondsPerTick()
    this.state = 'started'
    this._startSchedulerLoop()
  }

  stop(): void {
    const ctx = getAudioContext()
    this.state = 'stopped'
    this._originTick = 0
    this._originAudioTime = ctx.currentTime
    this._nextTick = 0
    this._nextTickTime = ctx.currentTime
    this._stopSchedulerLoop()
  }

  pause(): void {
    if (this.state !== 'started') return
    const current = this.positionTicks
    const ctx = getAudioContext()
    this._originTick = current
    this._originAudioTime = ctx.currentTime
    this.state = 'paused'
    this._stopSchedulerLoop()
  }

  scheduleRepeat(
    callback: (time: number) => void,
    intervalTicks: number,
    startTick = 0
  ): number {
    const id = this._nextRepeatId++
    this._repeats.set(id, {
      id,
      intervalTicks: Math.max(1, Math.round(intervalTicks)),
      startTick,
      callback,
      muted: false,
    })
    return id
  }

  clearRepeat(id: number): void {
    this._repeats.delete(id)
  }

  muteRepeat(id: number, muted: boolean): void {
    const rep = this._repeats.get(id)
    if (rep) rep.muted = muted
  }

  addPart(part: Part<unknown>): void {
    this._parts.add(part)
  }

  removePart(part: Part<unknown>): void {
    this._parts.delete(part)
  }

  private _startSchedulerLoop(): void {
    if (this._schedulerHandle !== null) return
    // Prime run to schedule immediate events before the first interval tick
    this._scheduleTick()
    this._schedulerHandle = setInterval(
      () => this._scheduleTick(),
      SCHEDULE_INTERVAL_MS
    )
  }

  private _stopSchedulerLoop(): void {
    if (this._schedulerHandle !== null) {
      clearInterval(this._schedulerHandle)
      this._schedulerHandle = null
    }
  }

  private _scheduleTick(): void {
    const ctx = getAudioContext()
    const deadline = ctx.currentTime + LOOKAHEAD_SEC
    const spt = this.secondsPerTick()

    while (this._nextTickTime < deadline) {
      const currentTick = this._nextTick
      const time = this._nextTickTime

      // Repeats
      for (const rep of this._repeats.values()) {
        if (rep.muted) continue
        if (currentTick < rep.startTick) continue
        if ((currentTick - rep.startTick) % rep.intervalTicks === 0) {
          rep.callback(time)
        }
      }

      // Parts
      for (const part of this._parts) {
        const relTick = currentTick - part.startAtTick
        if (relTick < 0) continue
        // linear scan — parts are small in practice (<= a bar of notes)
        const events = part.events
        for (let i = 0; i < events.length; i++) {
          if (events[i].tick === relTick) {
            part.callback(time, events[i].value)
          } else if (events[i].tick > relTick) {
            break
          }
        }
      }

      // Advance
      this._nextTick += 1
      this._nextTickTime += spt

      // Loop wrap
      if (this.loop && this._nextTick >= this.loopEndTicks) {
        this._nextTick = this.loopStartTicks
        // anchor the origin so `positionTicks` stays accurate after the wrap
        this._originAudioTime = this._nextTickTime
        this._originTick = this.loopStartTicks
      }
    }
  }
}

export const transport = new Transport()
