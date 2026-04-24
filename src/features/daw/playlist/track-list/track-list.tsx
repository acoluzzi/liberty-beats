import { useCallback } from 'react'
import { TrackItem } from './track-item/track-item'
import { useDispatch, useSelector } from 'react-redux'
import { selectSelectedTrack, selectTracks } from '../store/selectors'
import { Track } from '../../../../model/track/track'
import {
  selectTrack,
  toggleTrackMute,
  toggleTrackSolo,
} from '../store/playlist-slice'

export const TrackList = () => {
  const tracks = useSelector(selectTracks)
  const selectedTrack = useSelector(selectSelectedTrack)
  const dispatch = useDispatch()

  const handleSelectTrack = useCallback(
    (track: Track) => {
      dispatch(selectTrack(track))
    },
    [dispatch]
  )

  return (
    <div className="flex flex-col gap-1 w-full">
      {tracks.map((track: Track) => (
        <TrackListRow
          key={track.id}
          track={track}
          selectedTrack={selectedTrack}
          onSelectTrack={handleSelectTrack}
        />
      ))}
    </div>
  )
}

// Row wrapper so each row's mute/solo callbacks are stable per-track and
// a `TrackItem` render is not caused by unrelated rows dispatching actions.
const TrackListRow = ({
  track,
  selectedTrack,
  onSelectTrack,
}: {
  track: Track
  selectedTrack?: Track | null
  onSelectTrack: (track: Track) => void
}) => {
  const dispatch = useDispatch()
  const handleToggleMute = useCallback(
    () => dispatch(toggleTrackMute(track.id)),
    [dispatch, track.id]
  )
  const handleToggleSolo = useCallback(
    () => dispatch(toggleTrackSolo(track.id)),
    [dispatch, track.id]
  )
  return (
    <TrackItem
      track={track}
      selectedTrack={selectedTrack}
      onSelectTrack={onSelectTrack}
      onToggleMute={handleToggleMute}
      onToggleSolo={handleToggleSolo}
    />
  )
}
