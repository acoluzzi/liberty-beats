import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { TrackDrumPatternSound } from '../../../../../model/track/drums/track-drums'
import { selectCurrentTick } from '../../../playlist-header/store/selectors'
import { DrumMachinePadPattern } from './pattern/drum-machine-pad-pattern'
import { DrumSound } from '../../../../../model/drums/sound/drums-sound'

export type DrumMachinePadGridProps = {
  selectedSounds: DrumSound[]
  selectedPatternBeats: TrackDrumPatternSound[][]

  previewLoopPlayingTrackId: string | null

  onUpdateCurrentPattern: (newPattern: TrackDrumPatternSound[][]) => void
}

export const DrumMachinePadGrid = ({
  selectedPatternBeats,
  onUpdateCurrentPattern,
  previewLoopPlayingTrackId,
}: DrumMachinePadGridProps) => {
  const currentTick = useSelector(selectCurrentTick)

  const activeTickBar = previewLoopPlayingTrackId ? currentTick : null

  const handleSoundChange = useCallback(
    (
      toChangeSoundIndex: number,
      toChangeBeatIndex: number,
      newValue: TrackDrumPatternSound
    ) => {
      const newPattern = selectedPatternBeats.map((soundBeats, soundIndex) =>
        soundIndex === toChangeSoundIndex
          ? soundBeats.map((sound, beatIndex) =>
              beatIndex === toChangeBeatIndex ? newValue : sound
            )
          : soundBeats
      )
      onUpdateCurrentPattern(newPattern)
    },
    [selectedPatternBeats, onUpdateCurrentPattern]
  )

  return (
    <div className="flex flex-col gap-1">
      {selectedPatternBeats.map((patternSounds, soundIndex) => (
        <DrumMachinePadPattern
          key={soundIndex}
          patternSounds={patternSounds}
          activeTickBar={activeTickBar}
          soundIndex={soundIndex}
          onSoundChange={handleSoundChange}
        />
      ))}
    </div>
  )
}
