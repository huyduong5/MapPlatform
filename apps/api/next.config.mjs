import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Do NOT set Permissions-Policy: geolocation=(self) here.
  // Default browser policy already allows same-origin geolocation; an explicit
  // header is unnecessary and has caused confusion while debugging locate failures.
}

export default withPayload(nextConfig)
