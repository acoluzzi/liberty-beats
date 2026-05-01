import { memo } from 'react'
import { TrackDrumPatternSound } from '../../../../../../model/track/drums/track-drums'
import { TRACK_COLORS } from '../../../../../../model/track/track-color'

export type DrumMachinePadPatternProps = {
  patternSounds: TrackDrumPatternSound[]
  soundIndex: number
  activeTickBar: number | null
  onSoundChange: (
    toChangeSoundIndex: number,
    toChangeBeatIndex: number,
    newValue: TrackDrumPatternSound
  ) => void
}

const DrumMachinePadPatternComponent = ({
  patternSounds,
  soundIndex,
  onSoundChange,
  activeTickBar,
}: DrumMachinePadPatternProps) => {
  const getItemBackgroundClasses = (indexCol: number) => {
    const hoverClasses = `hover:bg-${TRACK_COLORS[soundIndex]}-100 dark:hover:bg-${TRACK_COLORS[soundIndex]}-900`
    if (indexCol === activeTickBar) {
      return `bg-black dark:bg-white ${hoverClasses}`
    }
    return Math.floor(indexCol / 4) % 2 === 0
      ? `bg-zinc-300 dark:bg-zinc-600 ${hoverClasses}`
      : `bg-zinc-400 dark:bg-zinc-700 ${hoverClasses}`
  }

  return (
    <div className="flex flex-row gap-1">
      {patternSounds.map((sound, indexCol) => (
        <div
          className={`cursor-pointer h-8 w-8 p-[2px] ${getItemBackgroundClasses(
            indexCol
          )}`}
          key={indexCol}
          onClick={() =>
            onSoundChange(soundIndex, indexCol, sound === 'on' ? 'off' : 'on')
          }
        >
          {sound === 'on' && (
            <div
              className={`w-full h-full bg-${TRACK_COLORS[soundIndex]}-500 rounded-full`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export const DrumMachinePadPattern = memo(DrumMachinePadPatternComponent)
