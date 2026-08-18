'use client'

import Link from 'next/link'
import './landing.css'

/** Local plates (reliable) + curated Unsplash (verified 200). */
const IMG = {
  hero: '/landing/landing-hero-map.jpg',
  mapPanel: '/landing/landing-map-panel.jpg',
  mall: '/landing/landing-mall.jpg',
  transit: '/landing/landing-transit.jpg',
  charge:
    'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?auto=format&fit=crop&w=900&q=80',
  service:
    'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=900&q=80',
  store:
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80',
  rescue:
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=80',
  hospital:
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80',
  university:
    'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=900&q=80',
  park:
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=900&q=80',
  route:
    'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=1400&q=80',
  nightDrive:
    'https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=1400&q=80',
  skyline:
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1400&q=80',
} as const

type PlaceCard = {
  title: string
  blurb: string
  img: string
  href: string
  tag: string
}

const PLACE_CARDS: PlaceCard[] = [
  {
    title: 'Trạm sạc',
    blurb: 'Pin yếu → điểm sạc gần nhất theo loại xe điện.',
    img: IMG.charge,
    href: '/map?layer=charging_station',
    tag: 'Năng lượng',
  },
  {
    title: 'Cây xăng',
    blurb: 'Xe xăng/dầu — tìm trạm đổ gần lộ trình.',
    img: IMG.nightDrive,
    href: '/map?layer=gas_station',
    tag: 'Năng lượng',
  },
  {
    title: 'Xưởng dịch vụ',
    blurb: 'Bảo dưỡng, sửa chữa, đại lý trên bản đồ.',
    img: IMG.service,
    href: '/map?layer=service_center',
    tag: 'Xe',
  },
  {
    title: 'Cửa hàng & showroom',
    blurb: 'Mua sắm, trưng bày, điểm bán gần bạn.',
    img: IMG.store,
    href: '/map?layer=store',
    tag: 'Xe',
  },
  {
    title: 'CSKH / Cứu hộ',
    blurb: 'Khi khẩn — định vị đội cứu hộ gần vị trí GPS.',
    img: IMG.rescue,
    href: '/map?layer=rescue_team',
    tag: 'An toàn',
  },
  {
    title: 'Bệnh viện & nhà thuốc',
    blurb: 'Y tế gần nhất khi cần cấp cứu hoặc mua thuốc.',
    img: IMG.hospital,
    href: '/map?layer=hospital',
    tag: 'Đời sống',
  },
  {
    title: 'Đại học & trường học',
    blurb: 'Chỉ đường tới campus, trường — không chỉ «gần đây».',
    img: IMG.university,
    href: '/map?layer=university',
    tag: 'Học tập',
  },
  {
    title: 'TTTM · chợ · vui chơi',
    blurb: 'Vincom, chợ, công viên, điểm tham quan dọc đường.',
    img: IMG.mall,
    href: '/map?layer=marketplace',
    tag: 'Khám phá',
  },
  {
    title: 'Bus · metro · đỗ xe',
    blurb: 'Giao thông công cộng và bãi đỗ quanh đích.',
    img: IMG.transit,
    href: '/map?layer=bus_stop',
    tag: 'Di chuyển',
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Neo vị trí & loại xe',
    detail: 'GPS là điểm xuất phát. Chọn ô tô/xe máy · điện hoặc xăng để hạ tầng khớp ngữ cảnh.',
  },
  {
    n: '02',
    title: 'Hỏi AI hoặc bật lớp bản đồ',
    detail:
      '«Đi Vincom», «pin 12%», «cứu hộ», «ĐH Khoa học Tự nhiên» — hoặc lọc 20+ loại điểm trên map.',
  },
  {
    n: '03',
    title: 'Tuyến đường thật + tiện ích',
    detail: 'Polyline theo mạng đường (OSRM), hướng dẫn rẽ, gợi ý điểm dọc corridor.',
  },
]

const CITIES = ['Hà Nội', 'TP.HCM', 'Đà Nẵng', 'Hải Phòng', 'Cần Thơ', 'Huế']

const HERO_CHIPS = [
  { label: 'Trạm sạc', tone: 'green' as const },
  { label: 'TTTM', tone: 'amber' as const },
  { label: 'Metro', tone: 'teal' as const },
  { label: 'Cứu hộ', tone: 'rose' as const },
]

export function LandingPage({ poiCount }: { poiCount?: number | null }) {
  const countLabel =
    poiCount != null && poiCount > 0
      ? `${poiCount.toLocaleString('vi-VN')}+`
      : 'Hàng nghìn'

  return (
    <div className="lp">
      <header className="lp-nav">
        <a className="lp-logo" href="#top">
          MapPlatform
        </a>
        <nav className="lp-nav-links" aria-label="Điều hướng">
          <a href="#places">Địa điểm</a>
          <a href="#ai">AI quyết định</a>
          <a href="#how">Cách dùng</a>
          <Link className="lp-nav-cta" href="/map">
            Mở bản đồ
          </Link>
        </nav>
      </header>

      {/* —— Hero: brand left + living map stage right —— */}
      <section className="lp-hero" id="top">
        <div
          className="lp-hero-photo"
          style={{ backgroundImage: `url(${IMG.hero})` }}
          role="img"
          aria-label="Bản đồ đô thị về đêm với tuyến đường sáng"
        />
        <div className="lp-hero-veil" aria-hidden />
        <div className="lp-hero-grid">
          <div className="lp-hero-inner">
            <p className="lp-brand-mark">MapPlatform</p>
            <h1 className="lp-headline">Bản đồ quyết định cho mọi điểm cần trên hành trình</h1>
            <p className="lp-sub">
              Từ trạm sạc, cứu hộ đến bệnh viện, đại học, TTTM hay metro — hỏi tiếng Việt, AI chọn
              điểm và chỉ đường theo mạng đường thật.
            </p>
            <div className="lp-cta-row">
              <Link className="lp-btn lp-btn-primary" href="/map">
                Mở bản đồ
              </Link>
              <Link className="lp-btn lp-btn-ghost" href="/map?focus=decide">
                Thử hỏi AI
              </Link>
            </div>
            <p className="lp-proof">
              <strong>{countLabel}</strong> điểm · 6 thành phố · 20+ loại địa điểm
            </p>
          </div>

          <div className="lp-hero-stage" aria-hidden={false}>
            <div className="lp-map-frame">
              <div
                className="lp-map-canvas"
                style={{ backgroundImage: `url(${IMG.mapPanel})` }}
                role="img"
                aria-label="Giao diện bản đồ với tuyến đường và điểm dừng"
              />
              <div className="lp-map-glow" aria-hidden />
              <div className="lp-map-route" aria-hidden />
              <span className="lp-map-pin lp-map-pin-a" aria-hidden />
              <span className="lp-map-pin lp-map-pin-b" aria-hidden />
              <div className="lp-map-card">
                <span className="lp-map-card-kicker">Decision AI</span>
                <strong>Vincom · 12 phút</strong>
                <span>Tuyến theo mạng đường thật · TTTM gần bạn</span>
              </div>
              <ul className="lp-map-chips">
                {HERO_CHIPS.map((c) => (
                  <li key={c.label} className={`lp-chip lp-chip-${c.tone}`}>
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
            <p className="lp-stage-caption">Xem trước sản phẩm — bản đồ + AI chọn điểm</p>
          </div>
        </div>
      </section>

      {/* —— Place mosaic —— */}
      <section className="lp-section" id="places">
        <div className="lp-section-inner">
          <h2 className="lp-h2">Không chỉ sạc hay cứu hộ — cả hệ sinh thái đô thị</h2>
          <p className="lp-lead">
            Năng lượng xe, dịch vụ, an toàn, y tế, học tập, mua sắm, giao thông công cộng và điểm vui
            chơi — một lớp bản đồ, lọc đúng lúc bạn cần.
          </p>
          <div className="lp-mosaic">
            {PLACE_CARDS.map((c) => (
              <Link key={c.title} href={c.href} className="lp-mosaic-card">
                <div
                  className="lp-mosaic-img"
                  style={{ backgroundImage: `url(${c.img})` }}
                  role="img"
                  aria-label={c.title}
                />
                <div className="lp-mosaic-body">
                  <span className="lp-tag">{c.tag}</span>
                  <h3>{c.title}</h3>
                  <p>{c.blurb}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* —— AI feature band with photo —— */}
      <section className="lp-feature" id="ai">
        <div
          className="lp-feature-photo"
          style={{ backgroundImage: `url(${IMG.route})` }}
          role="img"
          aria-label="Bản đồ và lộ trình"
        />
        <div className="lp-feature-veil" aria-hidden />
        <div className="lp-section-inner lp-feature-copy">
          <p className="lp-eyebrow">Decision AI</p>
          <h2 className="lp-h2 lp-h2-light">Hỏi như người — được trả lời như bản đồ thông minh</h2>
          <p className="lp-feature-text">
            «Đi Hồ Hoàn Kiếm», «sắp hết xăng», «ĐHQGHN», «pin 12%» — hệ thống hiểu ngữ cảnh chuyến
            đi (vui chơi / khẩn / chỉ đường), neo GPS làm gốc, đích là địa danh hoặc POI trên map,
            rồi vẽ tuyến OSRM kèm tiện ích dọc đường.
          </p>
          <ul className="lp-bullets">
            <li>Leisure & navigate — đích địa danh, 2 tuyến trải nghiệm</li>
            <li>Need urgent — 1 tuyến nhanh tới gas / sạc / cứu hộ</li>
            <li>Place Intelligence — alias + POI map + geocode</li>
          </ul>
          <Link className="lp-btn lp-btn-primary" href="/map?focus=decide">
            Mở Decision AI
          </Link>
        </div>
      </section>

      {/* —— Cities —— */}
      <section className="lp-section lp-section-alt" id="cities">
        <div className="lp-section-inner">
          <h2 className="lp-h2">Phủ các đô thị lớn Việt Nam</h2>
          <p className="lp-lead">Chuyển thành phố trên bản đồ — dữ liệu crawl và cập nhật theo khu vực.</p>
          <ul className="lp-cities">
            {CITIES.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* —— How —— */}
      <section className="lp-section" id="how">
        <div className="lp-section-inner lp-how-grid">
          <div>
            <h2 className="lp-h2">Ba bước tới điểm phù hợp</h2>
            <p className="lp-lead">Từ vị trí của bạn đến tuyến đường thật.</p>
            <ol className="lp-steps">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="lp-step-n">{s.n}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div
            className="lp-how-photo"
            style={{ backgroundImage: `url(${IMG.skyline})` }}
            role="img"
            aria-label="Skyline đô thị"
          />
        </div>
      </section>

      {/* —— Peace of mind —— */}
      <section className="lp-rescue">
        <div
          className="lp-rescue-photo"
          style={{ backgroundImage: `url(${IMG.nightDrive})` }}
          aria-hidden
        />
        <div className="lp-rescue-veil" aria-hidden />
        <div className="lp-section-inner lp-rescue-inner">
          <p className="lp-eyebrow">An tâm trên đường</p>
          <h2 className="lp-h2 lp-h2-light">Khẩn cấp hay dạo phố — cùng một nền tảng</h2>
          <p className="lp-rescue-copy">
            Cứu hộ và sạc khi cần gấp; Vincom, hồ, campus khi muốn đi chơi. MapPlatform giữ ngữ cảnh
            đúng — không ép tìm xăng khi bạn đang vi vu.
          </p>
          <div className="lp-cta-row">
            <Link className="lp-btn lp-btn-amber" href="/map?layer=rescue_team">
              Tìm cứu hộ
            </Link>
            <Link className="lp-btn lp-btn-ghost" href="/map">
              Khám phá bản đồ
            </Link>
          </div>
        </div>
      </section>

      <section className="lp-closing">
        <div className="lp-section-inner lp-closing-inner">
          <h2 className="lp-h2">Sẵn sàng khám phá bản đồ?</h2>
          <p className="lp-lead">
            Hàng nghìn điểm · AI hiểu tiếng Việt · đường đi theo mạng lưới đô thị.
          </p>
          <Link className="lp-btn lp-btn-primary" href="/map">
            Vào bản đồ ngay
          </Link>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <strong>MapPlatform</strong>
          <span>Bản đồ quyết định đô thị · sạc · dịch vụ · đời sống · cứu hộ</span>
          <div className="lp-footer-links">
            <Link href="/map">Bản đồ</Link>
            <Link href="/ops">Ops</Link>
            <a href="/admin">Admin</a>
          </div>
        </div>
      </footer>

      <div className="lp-sticky">
        <Link className="lp-btn lp-btn-primary lp-sticky-btn" href="/map">
          Mở bản đồ
        </Link>
      </div>
    </div>
  )
}
