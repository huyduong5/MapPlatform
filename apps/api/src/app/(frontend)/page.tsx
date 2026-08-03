export default function HomePage() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>MapPlatform API</h1>
      <p>Payload Admin: <a href="/admin">/admin</a></p>
      <ul>
        <li>
          <a href="/api/locations">GET /api/locations</a>
        </li>
        <li>
          <a href="/api/locations/nearby?latitude=20.995&longitude=105.862&radius=5000">
            GET /api/locations/nearby
          </a>
        </li>
      </ul>
    </main>
  )
}
