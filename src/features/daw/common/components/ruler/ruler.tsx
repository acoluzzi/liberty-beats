import { memo, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RULER_BAR_WIDTH, SUB_BAR_NUM } from './constants'
import { selectMaxBars } from '../../../playlist-header/store/selectors'
import { requestNewTickPosition } from '../../../playlist-header/store/playlist-header-slice'
import { TICK_WIDTH_PIXEL } from '../../../playlist/constants'
import { usePreviewLoopSafeTransportPosition } from '../../hooks/use-preview-loop-safe-transport-position'

type RulerSubBarProps = {
  barIndex: number
  subBarIndex: number
  onSelectTick: (tick: number) => void
}

const RulerSubBar = memo(
  ({ barIndex, subBarIndex, onSelectTick }: RulerSubBarProps) => {
    const tick = barIndex * SUB_BAR_NUM * 4 + subBarIndex * 4
    return (
      <div
        className={`w-full relative border-slate-400 ${
          subBarIndex == SUB_BAR_NUM - 1 ? '' : 'border-r'
        }`}
        onClick={() => onSelectTick(tick)}
      ></div>
    )
  }
)

type RulerBarProps = {
  barIndex: number
  maxBars: number
  onSelectTick: (tick: number) => void
}

const RulerBar = memo(
  ({ barIndex, maxBars, onSelectTick }: RulerBarProps) => {
    return (
      <div
        className={`flex flex-col justify-end gap-4 w-[${RULER_BAR_WIDTH}px] border-l border-slate-700 dark:border-slate-400 ${
          barIndex == maxBars - 1 ? 'border-r' : ''
        }`}
      >
        <div className="px-2 text-slate-700 dark:text-slate-400  select-none">
          {barIndex + 1}
        </div>

        <div className="flex flex-row h-[40%]">
          {Array.from({ length: SUB_BAR_NUM }).map((_, j) => (
            <RulerSubBar
              key={j}
              barIndex={barIndex}
              subBarIndex={j}
              onSelectTick={onSelectTick}
            />
          ))}
        </div>
      </div>
    )
  }
)

// Self-subscribing playhead — isolates per-tick re-renders away from the grid.
const RulerThumb = () => {
  const { tick } = usePreviewLoopSafeTransportPosition()
  // -7 is the offset to center the thumb (probably depending on the border width)
  const leftOffset = tick * TICK_WIDTH_PIXEL - 7
  return (
    <div
      className="absolute bottom-0 w-0 h-0
  border-l-[8px] border-l-transparent
  border-t-[17px] border-t-black dark:border-t-white
  border-r-[8px] border-r-transparent"
      style={{ left: `${leftOffset}px` }}
    />
  )
}

const RulerGrid = memo(
  ({
    maxBars,
    onSelectTick,
  }: {
    maxBars: number
    onSelectTick: (tick: number) => void
  }) => {
    return (
      <div className="h-full flex flex-row bg-slate-100 dark:bg-slate-900">
        {Array.from({ length: maxBars }).map((_, i) => (
          <RulerBar
            key={i}
            barIndex={i}
            maxBars={maxBars}
            onSelectTick={onSelectTick}
          />
        ))}
      </div>
    )
  }
)

export const Ruler = () => {
  const maxBars = useSelector(selectMaxBars)
  const dispatch = useDispatch()

  const handleSelectTick = useCallback(
    (tick: number) => {
      dispatch(requestNewTickPosition(tick))
    },
    [dispatch]
  )

  return (
    <div className="relative">
      <RulerGrid maxBars={maxBars} onSelectTick={handleSelectTick} />
      <RulerThumb />
    </div>
  )
}
