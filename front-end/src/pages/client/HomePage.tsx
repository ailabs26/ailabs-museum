import { Container, Title } from '@mantine/core';
import type { CSSProperties } from 'react';
import {
  IconAccessible, IconArrowRight, IconCube, IconDeviceGamepad2,
  IconHeadphones, IconPlayerPlayFilled, IconSparkles,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { HomeFeaturedExhibits } from './HomeFeaturedExhibits';
import classes from './HomePage.module.css';

const STATS = [
  { value: '5+', label: 'Phòng trưng bày ảo' },
  { value: '100%', label: 'Khám phá 3D & WebXR' },
  { value: 'Song ngữ', label: 'Thuyết minh & Phụ đề' },
  { value: '0s', label: 'Không cần cài đặt' },
];

export function HomePage() {
  return (
    <Container size="lg">
      {/* ============================ Hero Banner ============================ */}
      <section className={classes.hero} aria-labelledby="home-title">
        <div className={classes.heroContent}>
          <p className={`${classes.badge} aura-reveal`}>
            <span className={classes.badgeDot} aria-hidden="true" />
            Bảo tàng số 3D WebXR thế hệ mới
          </p>
          <Title order={1} id="home-title" className={`${classes.title} aura-reveal`} style={{ '--aura-delay': '0.05s' } as CSSProperties}>
            <span className={classes.titleGradient}>Chạm vào Di sản.</span><br />
            Khám phá Không giới hạn.
          </Title>
          <p className={`${classes.introduction} aura-reveal`} style={{ '--aura-delay': '0.1s' } as CSSProperties}>
            Bước vào không gian triển lãm 3D tương tác thực tế ảo, lắng nghe câu chuyện nghìn năm
            qua âm thanh thuyết minh sống động — ngay trên trình duyệt của bạn.
          </p>
          <div className={`${classes.ctaRow} aura-reveal`} style={{ '--aura-delay': '0.15s' } as CSSProperties}>
            <Link to="/tour" className={classes.ctaPrimary}>
              <IconCube size={20} aria-hidden="true" />
              Khám phá Không gian 3D (WebXR)
            </Link>
            <Link to="/collection" className={classes.ctaSecondary}>
              Xem Danh mục Bộ sưu tập
              <IconArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>

          <dl className={`${classes.stats} aura-reveal`} style={{ '--aura-delay': '0.2s' } as CSSProperties}>
            {STATS.map((stat) => (
              <div key={stat.label} className={classes.stat}>
                <dt className={classes.statValue}>{stat.value}</dt>
                <dd className={classes.statLabel}>{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Floating Exhibit Showcase — thay thế hình vòm cũ */}
        <div className={classes.heroVisual} aria-hidden="true">
          <div className={classes.showcaseGlow} />
          <div className={classes.showcaseCard}>
            <div className={classes.showcaseScreen}>
              <span className={classes.showcaseOrb} />
              <div className={classes.soundwave}>
                {Array.from({ length: 7 }).map((_, i) => (
                  <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
            </div>
            <div className={classes.showcaseLabel}>
              <div>
                <p className={classes.showcaseName}>Trống đồng Đông Sơn</p>
                <p className={classes.showcaseEra}>Văn hóa Đông Sơn · ~2.500 năm</p>
              </div>
              <span className={classes.showcasePlay}><IconPlayerPlayFilled size={16} /></span>
            </div>
          </div>
          <span className={classes.showcaseTag}>Mô hình 3D tương tác</span>
        </div>
      </section>

      {/* ======================= Bento Grid — Về Aura Museum ======================= */}
      <section className={classes.about} aria-labelledby="about-title">
        <div className={classes.aboutHead}>
          <p className={classes.eyebrow}>Về Aura Museum</p>
          <Title order={2} id="about-title" className={classes.sectionTitle}>
            Không gian số. <span className={classes.titleGradient}>Kết nối thật.</span>
          </Title>
        </div>
        <div className={classes.bento}>
          <article className={`${classes.bentoCard} ${classes.bentoLarge}`}>
            <span className={classes.bentoIcon}><IconCube size={26} /></span>
            <h3 className={classes.bentoTitle}>Không gian thực tế ảo WebXR nhập vai</h3>
            <p className={classes.bentoText}>
              Dạo bước giữa phòng triển lãm 3D ngay trên trình duyệt. Tương thích kính VR
              (Quest, Pico, HTC Vive) và điều khiển linh hoạt WASD / cảm ứng.
            </p>
            <span className={classes.bentoChips}>
              <span><IconDeviceGamepad2 size={14} /> WASD / Touch</span>
              <span>Quest · Pico · Vive</span>
            </span>
          </article>
          <article className={classes.bentoCard}>
            <span className={classes.bentoIcon}><IconHeadphones size={24} /></span>
            <h3 className={classes.bentoTitle}>Thuyết minh âm thanh & sóng nhạc động</h3>
            <p className={classes.bentoText}>Audio Player với phụ đề WebVTT song ngữ đồng bộ từng câu nói.</p>
          </article>
          <article className={classes.bentoCard}>
            <span className={classes.bentoIcon}><IconSparkles size={24} /></span>
            <h3 className={classes.bentoTitle}>Tái hiện di sản độ chi tiết cao</h3>
            <p className={classes.bentoText}>Soi rõ hoa văn, chất liệu gốm sứ / đồng thau cùng các điểm chú thích thông minh.</p>
          </article>
          <article className={`${classes.bentoCard} ${classes.bentoWide}`}>
            <span className={classes.bentoIcon}><IconAccessible size={24} /></span>
            <h3 className={classes.bentoTitle}>Tiếp cận toàn diện (WCAG 2.2 AA)</h3>
            <p className={classes.bentoText}>
              100% điều hướng bàn phím, tương phản đạt chuẩn và chế độ dự phòng 2D mượt mà
              khi thiết bị không hỗ trợ WebGL.
            </p>
          </article>
        </div>
      </section>

      {/* ======================= Hiện vật nổi bật ======================= */}
      <section className={classes.featured} aria-labelledby="featured-title">
        <p className={classes.eyebrow}>Từ bộ sưu tập</p>
        <Title order={2} id="featured-title" className={classes.sectionTitle}>Hiện vật nổi bật</Title>
        <HomeFeaturedExhibits />
      </section>
    </Container>
  );
}
