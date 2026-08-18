'use client'

/**
 * Browser geolocation — Google Maps / web.dev pattern + IP fallback.
 *
 * Multi-click safe: concurrent start() shares one in-flight promise;
 * already-known fixes are reused from positionRef (not React state).
 *
 * @see https://developers.google.com/maps/documentation/javascript/geolocation
 * @see https://web.dev/articles/user-location
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export type GeolocationStatus =
  | 'idle'
  | 'locating'
  | 'active'
  | 'denied'
  | 'unavailable'
  | 'error'

export type UserGeoPosition = {
  latitude: number
  longitude: number
  accuracy: number
  updatedAt: number
  /** browser = W3C Geolocation; ip = server IP approx fallback */
  source?: 'browser' | 'ip'
  label?: string
}

export const GEO_MESSAGES: Record<'denied' | 'unavailable' | 'error', string> = {
  denied:
    'Trình duyệt đang chặn vị trí cho trang này. Bấm ổ khóa cạnh URL → Site settings → Location → Allow, rồi tải lại.',
  unavailable:
    'Không lấy được tín hiệu GPS/Wifi từ trình duyệt. Đã thử ước lượng IP — nếu vẫn lỗi, thử lại sau vài giây.',
  error: 'Không lấy được vị trí — hãy thử lại.',
}

export const GEO_INSECURE =
  'Trình duyệt chỉ cho định vị trên https:// hoặc http://localhost / 127.0.0.1. Đừng mở bằng IP LAN (192.168.x.x).'

/** Google-style first fix: network/wifi OK, allow recent cache. */
export const GEO_OPTIONS_COARSE: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 12_000,
  maximumAge: 300_000,
}

/** Prefer any recent / network fix before giving up. */
export const GEO_OPTIONS_CACHED: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 8_000,
  maximumAge: 86_400_000,
}

/** Refine toward GPS after first paint. */
export const GEO_OPTIONS_WATCH: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 30_000,
  maximumAge: 5_000,
}

/** @deprecated alias — tests / callers */
export const GEO_OPTIONS_QUICK = GEO_OPTIONS_COARSE

export function mapGeolocationError(err: { code: number }): GeolocationStatus {
  if (err.code === 1) return 'denied'
  if (err.code === 2 || err.code === 3) return 'unavailable'
  return 'error'
}

export function toUserGeoPosition(
  coords: { latitude: number; longitude: number; accuracy: number },
  extra?: Pick<UserGeoPosition, 'source' | 'label'>,
): UserGeoPosition {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: Number.isFinite(coords.accuracy) && coords.accuracy > 0 ? coords.accuracy : 100,
    updatedAt: Date.now(),
    source: extra?.source || 'browser',
    label: extra?.label,
  }
}

export function messageForStatus(status: GeolocationStatus): string | null {
  if (status === 'denied' || status === 'unavailable' || status === 'error') {
    return GEO_MESSAGES[status]
  }
  return null
}

export function isGeolocationSecureContext(): boolean {
  if (typeof window === 'undefined') return true
  if (window.isSecureContext) return true
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

export function zoomForAccuracy(accuracy: number): number {
  if (accuracy <= 40) return 18
  if (accuracy <= 100) return 17
  if (accuracy <= 250) return 16
  if (accuracy <= 750) return 15
  if (accuracy <= 2_000) return 14
  if (accuracy <= 5_000) return 13
  if (accuracy <= 25_000) return 11
  return 10
}

export function positionFromGeolocation(pos: GeolocationPosition): UserGeoPosition | null {
  const { latitude, longitude, accuracy } = pos.coords
  if (!isValidLatLng(latitude, longitude)) return null
  return toUserGeoPosition({ latitude, longitude, accuracy }, { source: 'browser' })
}

export function shouldReplaceFix(
  current: UserGeoPosition | null,
  next: UserGeoPosition,
): boolean {
  if (!current) return true
  if (current.source === 'ip' && next.source === 'browser') return true
  if (current.source === 'browser' && next.source === 'ip') return false
  if (next.accuracy <= current.accuracy * 0.85) return true
  if (next.accuracy <= current.accuracy * 1.35) return true
  return false
}

export function readCurrentPosition(
  options: PositionOptions,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(Object.assign(new Error('unsupported'), { code: 2 }))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })
}

export async function acquireBrowserPosition(): Promise<UserGeoPosition> {
  const attempts: PositionOptions[] = [GEO_OPTIONS_COARSE, GEO_OPTIONS_CACHED]
  let lastErr: { code: number; message?: string } | null = null

  for (const opts of attempts) {
    try {
      const raw = await readCurrentPosition(opts)
      const next = positionFromGeolocation(raw)
      if (next) return next
    } catch (e) {
      lastErr = e as { code: number; message?: string }
      if (lastErr.code === 1) throw lastErr
    }
  }

  throw lastErr || Object.assign(new Error('unavailable'), { code: 2 })
}

export async function acquireIpApproxPosition(): Promise<UserGeoPosition> {
  const res = await fetch('/api/geo/approx', { cache: 'no-store' })
  const body = (await res.json()) as {
    success?: boolean
    data?: { latitude: number; longitude: number; accuracy: number; label?: string }
    error?: { message?: string }
  }
  if (!res.ok || !body.success || !body.data) {
    throw Object.assign(new Error(body.error?.message || 'IP approx failed'), { code: 2 })
  }
  const { latitude, longitude, accuracy, label } = body.data
  if (!isValidLatLng(latitude, longitude)) {
    throw Object.assign(new Error('invalid IP coords'), { code: 2 })
  }
  return toUserGeoPosition(
    { latitude, longitude, accuracy: accuracy || 25_000 },
    { source: 'ip', label },
  )
}

export async function acquireUserPosition(): Promise<UserGeoPosition> {
  try {
    return await acquireBrowserPosition()
  } catch (e) {
    const err = e as { code?: number; message?: string }
    if (err.code === 1) throw e
    try {
      return await acquireIpApproxPosition()
    } catch {
      const detail = err.message ? ` (${err.message})` : ''
      throw Object.assign(
        new Error(
          `Không lấy được vị trí từ trình duyệt${detail}. Thử lại sau vài giây (Allow Location đã bật thì đây là lỗi dịch vụ định vị mạng, không phải bạn chưa bật).`,
        ),
        { code: err.code || 2 },
      )
    }
  }
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>('idle')
  const [position, setPosition] = useState<UserGeoPosition | null>(null)
  const [watching, setWatching] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const aliveRef = useRef(true)
  const positionRef = useRef<UserGeoPosition | null>(null)
  const sessionRef = useRef(0)
  const inFlightRef = useRef<Promise<UserGeoPosition> | null>(null)

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setWatching(false)
  }, [])

  const applyFix = useCallback((next: UserGeoPosition) => {
    if (!shouldReplaceFix(positionRef.current, next)) {
      return positionRef.current || next
    }
    positionRef.current = next
    setPosition(next)
    setStatus('active')
    return next
  }, [])

  const startWatch = useCallback(
    (session: number) => {
      if (!navigator.geolocation) return
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }

      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          if (!aliveRef.current || session !== sessionRef.current) return
          const next = positionFromGeolocation(pos)
          if (!next) return
          applyFix(next)
        },
        (err) => {
          if (!aliveRef.current || session !== sessionRef.current) return
          if (err.code === 1 && !positionRef.current) {
            clearWatch()
            setStatus('denied')
          }
        },
        GEO_OPTIONS_WATCH,
      )
      setWatching(true)
    },
    [applyFix, clearWatch],
  )

  const stop = useCallback(() => {
    sessionRef.current += 1
    inFlightRef.current = null
    clearWatch()
    positionRef.current = null
    setPosition(null)
    setStatus('idle')
  }, [clearWatch])

  const start = useCallback((): Promise<UserGeoPosition> => {
    if (!aliveRef.current) {
      return Promise.reject(new Error('cancelled'))
    }

    // Reuse known fix immediately (survives multi-click)
    if (positionRef.current) {
      setStatus('active')
      if (watchIdRef.current == null && typeof navigator !== 'undefined' && navigator.geolocation) {
        startWatch(sessionRef.current)
      }
      return Promise.resolve(positionRef.current)
    }

    // Join in-flight request instead of aborting it (fixes double-click race)
    if (inFlightRef.current) {
      return inFlightRef.current
    }

    if (typeof navigator === 'undefined') {
      setStatus('unavailable')
      return Promise.reject(new Error(GEO_MESSAGES.unavailable))
    }

    if (!isGeolocationSecureContext()) {
      setStatus('unavailable')
      return Promise.reject(new Error(GEO_INSECURE))
    }

    const session = ++sessionRef.current
    setStatus('locating')

    const runPromise = (async (): Promise<UserGeoPosition> => {
      try {
        if (!navigator.geolocation) {
          const approx = await acquireIpApproxPosition()
          if (session !== sessionRef.current) throw new Error('cancelled')
          return applyFix(approx)
        }

        startWatch(session)

        const timeout = new Promise<never>((_, reject) => {
          window.setTimeout(() => {
            reject(Object.assign(new Error(GEO_MESSAGES.unavailable), { code: 2 }))
          }, 40_000)
        })

        try {
          const next = await Promise.race([acquireUserPosition(), timeout])
          if (session !== sessionRef.current) throw new Error('cancelled')
          return applyFix(next)
        } catch (err) {
          if (session !== sessionRef.current) throw new Error('cancelled')
          const code = (err as { code?: number })?.code
          if (code === 1) {
            clearWatch()
            setStatus('denied')
            throw new Error(GEO_MESSAGES.denied)
          }
          if (positionRef.current) return positionRef.current
          clearWatch()
          setStatus('unavailable')
          throw err instanceof Error ? err : new Error(GEO_MESSAGES.unavailable)
        }
      } finally {
        if (inFlightRef.current === runPromise) {
          inFlightRef.current = null
        }
      }
    })()

    inFlightRef.current = runPromise
    return runPromise
  }, [applyFix, clearWatch, startWatch])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      sessionRef.current += 1
      inFlightRef.current = null
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  return {
    status,
    position,
    watching,
    start,
    stop,
    message: messageForStatus(status),
  }
}
