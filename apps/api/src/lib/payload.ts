import { getPayload } from 'payload'
import config from '@payload-config'

/** Shared Payload Local API instance (cached by Payload internally). */
export async function getPayloadClient() {
  return getPayload({ config })
}
