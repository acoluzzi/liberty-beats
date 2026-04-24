let _ctx: AudioContext | null = null
let _master: GainNode | null = null

type WindowWithWebkit = Window & {
  webkitAudioContext?: typeof AudioContext
}

export function getAudioContext(): AudioContext {
  if (!_ctx) {
    const Ctor =
      window.AudioContext || (window as WindowWithWebkit).webkitAudioContext
    if (!Ctor) {
      throw new Error('Web Audio API is not supported in this browser')
    }
    _ctx = new Ctor()
  }
  return _ctx
}

export function getMasterGain(): GainNode {
  if (!_master) {
    const ctx = getAudioContext()
    _master = ctx.createGain()
    _master.gain.value = 1
    _master.connect(ctx.destination)
  }
  return _master
}

export async function startAudio(): Promise<void> {
  const ctx = getAudioContext()
  // Ensure master gain is created eagerly so it's ready to connect to
  getMasterGain()
  if (ctx.state === 'suspended') {
    await ctx.resume()
  }
}

export function gainToDb(gain: number): number {
  if (gain <= 0) return -Infinity
  return 20 * Math.log10(gain)
}

export function dbToGain(db: number): number {
  if (!isFinite(db)) return 0
  return Math.pow(10, db / 20)
}
