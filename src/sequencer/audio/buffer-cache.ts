import { getAudioContext } from './engine'

const _cache: Map<string, Promise<AudioBuffer>> = new Map()

export function loadSample(url: string): Promise<AudioBuffer> {
  const cached = _cache.get(url)
  if (cached) return cached
  const promise = (async () => {
    const response = await fetch(url)
    const arrayBuffer = await response.arrayBuffer()
    const ctx = getAudioContext()
    return await ctx.decodeAudioData(arrayBuffer)
  })()
  _cache.set(url, promise)
  // If the fetch fails, drop the rejection from the cache so a retry is possible
  promise.catch(() => _cache.delete(url))
  return promise
}
