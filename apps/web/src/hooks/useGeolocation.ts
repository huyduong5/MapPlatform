'use client'

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
}

export const GEO_MESSAGES: Record<'denied' | 'unavailable' | 'error', string> = {
  denied:
    'Không thể lấy vị trí của bạn. Vui lòng cấp quyền truy cập vị trí để sử dụng tính năng này.',
  unavailable: 'Không xác định được vị trí — thử lại ở nơi có GPS/Wifi tốt hơn.',
  error: 'Không lấy được vị trí — hãy thử lại.',
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 12_000,
  maximumAge: 10_000,
}

/** Exported for unit tests */
export function mapGeolocationError(err: { code: number }): GeolocationStatus {
  // GeolocationPositionError codes: 1 denied, 2 unavailable, 3 timeout
  if (err.code === 1) return 'denied'
  if (err.code === 2 || err.code === 3) return 'unavailable'
  return 'error'
}

export function toUserGeoPosition(coords: {
  latitude: number
  longitude: number
  accuracy: number
}): UserGeoPosition {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
    updatedAt: Date.now(),
  }
}

export function messageForStatus(status: GeolocationStatus): string | null {
  if (status === 'denied' || status === 'unavailable' || status === 'error') {
    return GEO_MESSAGES[status]
  }
  return null
}

export function useGeolocation() {
  const [status, setStatus] = useState<GeolocationStatus>('idle')
  const [position, setPosition] = useState<UserGeoPosition | null>(null)
  const [watching, setWatching] = useState(false)
  const watchIdRef = useRef<number | null>(null)
  const aliveRef = useRef(true)

  const clearWatch = useCallback(() => {
    if (watchIdRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setWatching(false)
  }, [])

  const stop = useCallback(() => {
    clearWatch()
    setPosition(null)
    setStatus('idle')
  }, [clearWatch])

  const startWatch = useCallback(() => {
    if (!navigator.geolocation) return
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!aliveRef.current) return
        setPosition(toUserGeoPosition(pos.coords))
        setStatus('active')
      },
      (err) => {
        if (!aliveRef.current) return
        setStatus(mapGeolocationError(err))
      },
      GEO_OPTIONS,
    )
    setWatching(true)
  }, [])

  const start = useCallback((): Promise<UserGeoPosition> => {
    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setStatus('unavailable')
        reject(new Error(GEO_MESSAGES.unavailable))
        return
      }

      setStatus('locating')

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!aliveRef.current) return
          const next = toUserGeoPosition(pos.coords)
          setPosition(next)
          setStatus('active')
          startWatch()
          resolve(next)
        },
        (err) => {
          if (!aliveRef.current) return
          const st = mapGeolocationError(err)
          setStatus(st)
          clearWatch()
          setPosition(null)
          reject(new Error(messageForStatus(st) || GEO_MESSAGES.error))
        },
        GEO_OPTIONS,
      )
    })
  }, [clearWatch, startWatch])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
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
