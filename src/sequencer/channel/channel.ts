import { Bar } from '../../model/bar/bar'
import { InstrumentPreset } from '../../model/instrument/preset/preset'
import { Note } from '../../model/note/note'
import { Track } from '../../model/track/track'
import { TimeUtils } from '../time/utils/time-utils'
import { ChannelInstrument } from './instrument/channel-instrument'
import { createChannelInstrument } from './instrument/channel-instrument-factory'
import { Key } from '../../model/note/key/key'
import { Part } from '../audio/transport'

type PartNoteValue = {
  duration: string
  note: Key
  velocity: number
}

export class Channel {
  trackId: string

  private _parts: Part<PartNoteValue>[] = []
  private _previewLoopPart: Part<PartNoteValue> | null = null
  private _instrument: ChannelInstrument | null = null
  private _muted: boolean

  private _otherTrackIsPreviewing: boolean = false
  private _isPreviewingLoop: boolean = false

  // Cached references from the last applied track. Compared with the next
  // track via Immer's structural sharing so we only mutate the audio graph
  // for the parts that actually changed (preset / bars / volume / mute).
  private _lastPresetId: string | null = null
  private _lastBars: Readonly<Bar[]> | null = null
  private _lastVolume: number | null = null

  constructor(track: Track) {
    this.trackId = track.id
    this._muted = false
    this.updateFromTrack(track)
  }

  updateFromTrack(track: Track) {
    const presetChanged = this._lastPresetId !== track.instrumentPreset.id
    const barsChanged = this._lastBars !== track.bars
    const volumeChanged = this._lastVolume !== track.volume

    // Mute / solo: cheap flag flip, always safe to apply.
    this.setMuted(
      track.muted || (track.areThereAnyOtherTrackSoloed && !track.soloed)
    )

    if (presetChanged) {
      // Replacing the instrument is the only path that disconnects audio
      // nodes, so confine it to actual preset changes (rare).
      this._instrument?.disconnect()
      this._parts.forEach((p) => p.dispose())
      this._parts = []
      this.setInstrument(track.instrumentPreset)
      this.connect()
      this._lastPresetId = track.instrumentPreset.id
      // After a fresh instrument we must recreate parts and resend volume
      this.generatePartsFromBars(track.bars)
      this._lastBars = track.bars
      this.setVolume(track.volume)
      this._lastVolume = track.volume
      return
    }

    if (barsChanged) {
      // Swap parts in place — instrument stays connected, no audio dropout.
      this._parts.forEach((p) => p.dispose())
      this._parts = []
      this.generatePartsFromBars(track.bars)
      this._lastBars = track.bars
    }

    if (volumeChanged) {
      this.setVolume(track.volume)
      this._lastVolume = track.volume
    }
  }

  setVolume(volume: number) {
    this._instrument?.setVolume(volume)
  }

  setMuted(muted: boolean) {
    this._muted = muted
  }

  setOtherTrackIsPreviewing(otherTrackIsPreviewing: boolean) {
    this._otherTrackIsPreviewing = otherTrackIsPreviewing
  }

  clear() {
    this._parts.forEach((part) => part.dispose())
    this._parts = []
    this._previewLoopPart?.dispose()
    this._previewLoopPart = null
    this._instrument?.disconnect()
    this._lastPresetId = null
    this._lastBars = null
    this._lastVolume = null
  }

  generatePartsFromBars(trackBars: Readonly<Bar[]>) {
    // TODO merge the bars on the same time, taking into consideration start and duration for each bar
    this._parts = trackBars.map((bar) => this.partFromBar(bar))
  }

  partFromBar(bar: Bar, isPreviewLoopBar: boolean = false): Part<PartNoteValue> {
    const events = bar.notes.map((note) => ({
      tick: note.startsAtRelativeTick,
      value: {
        duration: TimeUtils.tickToToneTime(note.durationTicks),
        note: note.key,
        velocity: note.velocity / 100,
      },
    }))
    const part = new Part<PartNoteValue>((time, value) => {
      if (!this._canPlayPartNote(isPreviewLoopBar)) return
      this._instrument?.play(value.note, value.duration, time, value.velocity)
    }, events)
    part.start(bar.startAtTick)
    return part
  }

  _canPlayPartNote(isPreviewLoopNote: boolean) {
    /*
    if the note is a preview loop note, we should check if the track is previewing the loop
    if the note is a normal note, we should check if the track is not muted and no other track is previewing
    */

    if (isPreviewLoopNote) {
      return this._isPreviewingLoop
    } else {
      return !this._muted && !this._otherTrackIsPreviewing
    }
  }

  setInstrument(instrumentPreset: InstrumentPreset) {
    this._instrument = createChannelInstrument(instrumentPreset)
  }

  connect() {
    this._instrument?.connect()
  }

  // kept for parity with the previous API — consumers may still import it.
  noteToTone(note: Note) {
    return {
      time: TimeUtils.tickToToneTime(note.startsAtRelativeTick),
      duration: TimeUtils.tickToToneTime(note.durationTicks),
      note: note.key,
      velocity: note.velocity / 100,
    }
  }

  playKeys(keys: Key[]) {
    keys.forEach((key) => {
      this._instrument?.play(key, '8n')
    })
  }

  setPreviewLoopBar(loopBar: Bar) {
    if (this._previewLoopPart) {
      this._previewLoopPart.dispose()
    }
    this._previewLoopPart = this.partFromBar(loopBar, true)
  }

  stopPreviewLoop() {
    this._isPreviewingLoop = false
  }

  startPreviewLoop() {
    this._isPreviewingLoop = true
  }
}
