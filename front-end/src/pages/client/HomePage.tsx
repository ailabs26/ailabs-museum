import { useEffect, useRef, useState } from 'react';
import { Container, Title } from '@mantine/core';
import { IconArrowRight, IconChevronLeft, IconChevronRight, IconCube, IconHeadphones, IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { useHomeHeroSlides } from '@/hooks/useHomeHeroSlides';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { ExhibitImage } from '@/shared/components/media/ExhibitImage';
import { HomeFeaturedExhibits } from './HomeFeaturedExhibits';
import classes from './HomePage.module.css';

export function HomePage() {
  const { t } = usePublicLocale();
  const { rooms, room, selectedRoom } = useMuseumRooms(null);
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const exhibits = detail ? [...detail.exhibits]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id)) : [];
  const heroSlides = useHomeHeroSlides({ rooms, room, selectedRoom });
  const [activeSlideKey, setActiveSlideKey] = useState<string | null>(null);
  const [autoplayPaused, setAutoplayPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [reducedMotionOverride, setReducedMotionOverride] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(() => !document.hidden);
  const [heroVisible, setHeroVisible] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [outgoingSlide, setOutgoingSlide] = useState<typeof heroSlides[number] | null>(null);
  const [readySlideKey, setReadySlideKey] = useState<string | null>(null);
  const heroRef = useRef<HTMLElement>(null);
  const activeIndex = Math.max(0, heroSlides.findIndex((slide) => slide.key === activeSlideKey));
  const heroSlide = heroSlides[activeIndex];
  const slideKeys = heroSlides.map((slide) => slide.key).join('|');
  const nextSlide = heroSlides.length > 1 ? heroSlides[(activeIndex + 1) % heroSlides.length] : undefined;
  const nextSlideImageUrl = nextSlide?.imageUrl;
  const heroSlidesRef = useRef(heroSlides);
  const activeSlideKeyRef = useRef(activeSlideKey);
  const heroSlideRef = useRef<typeof heroSlide>(heroSlide);
  const visibleSlideRef = useRef<typeof heroSlide>(undefined);
  const transitionTimerRef = useRef<number | null>(null);
  heroSlidesRef.current = heroSlides;
  activeSlideKeyRef.current = activeSlideKey;
  heroSlideRef.current = heroSlide;
  const featured = exhibits.slice(0, 3);
  usePageTitle(null);

  const selectSlide = (key: string) => {
    if (key === activeSlideKeyRef.current) return;
    const current = visibleSlideRef.current ?? heroSlideRef.current;
    if (current) setOutgoingSlide(current);
    setReadySlideKey(null);
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    activeSlideKeyRef.current = key;
    setActiveSlideKey(key);
  };
  const selectSlideRef = useRef(selectSlide);
  selectSlideRef.current = selectSlide;
  const moveSlide = (direction: number) => {
    const slides = heroSlidesRef.current;
    if (!slides.length) return;
    const currentIndex = slides.findIndex((slide) => slide.key === activeSlideKeyRef.current);
    selectSlide(slides[(Math.max(0, currentIndex) + direction + slides.length) % slides.length].key);
  };
  const finishSlideLoad = (key: string) => {
    const loaded = heroSlidesRef.current.find((slide) => slide.key === key);
    if (!loaded || activeSlideKeyRef.current !== key) return;
    visibleSlideRef.current = loaded;
    setReadySlideKey(key);
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = window.setTimeout(() => {
      setOutgoingSlide((slide) => slide?.key === key ? null : slide);
      transitionTimerRef.current = null;
    }, 620);
  };

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => {
      setPrefersReducedMotion(motion.matches);
      if (motion.matches) {
        setAutoplayPaused(true);
        setReducedMotionOverride(false);
      }
    };
    const syncVisibility = () => setDocumentVisible(!document.hidden);
    syncMotion();
    document.addEventListener('visibilitychange', syncVisibility);
    motion.addEventListener('change', syncMotion);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
      motion.removeEventListener('change', syncMotion);
    };
  }, []);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const syncHeroVisibility = () => {
      const bounds = hero.getBoundingClientRect();
      setHeroVisible(bounds.bottom > 0 && bounds.top < window.innerHeight);
    };
    syncHeroVisibility();
    window.addEventListener('scroll', syncHeroVisibility, { passive: true });
    window.addEventListener('resize', syncHeroVisibility);
    return () => {
      window.removeEventListener('scroll', syncHeroVisibility);
      window.removeEventListener('resize', syncHeroVisibility);
    };
  }, []);

  useEffect(() => {
    if (heroSlidesRef.current.length < 2 || autoplayPaused || (prefersReducedMotion && !reducedMotionOverride)
      || !documentVisible || !heroVisible || hovered || focused) return;
    const timer = window.setTimeout(() => {
      const slides = heroSlidesRef.current;
      const currentIndex = slides.findIndex((slide) => slide.key === activeSlideKeyRef.current);
      const next = slides[(Math.max(0, currentIndex) + 1) % slides.length];
      if (next) selectSlideRef.current(next.key);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [activeSlideKey, autoplayPaused, documentVisible, focused, heroVisible, hovered, prefersReducedMotion, reducedMotionOverride, slideKeys]);

  useEffect(() => {
    if (!nextSlideImageUrl || outgoingSlide) return;
    const image = new Image();
    image.fetchPriority = 'low';
    image.src = nextSlideImageUrl;
    return () => {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
    };
  }, [nextSlideImageUrl, outgoingSlide]);

  useEffect(() => () => {
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current);
  }, []);

  const toggleAutoplay = () => {
    setAutoplayPaused(!autoplayPaused);
    if (prefersReducedMotion) setReducedMotionOverride(autoplayPaused);
  };

  return (
    <div className={classes.page}>
      <section ref={heroRef} className={classes.hero} aria-labelledby="home-title"
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setFocused(false);
        }}>
        <div className={classes.heroInner}>
          <div className={classes.heroContent}>
            <p className={classes.badge}>{t('ui.home.badge', 'Bộ sưu tập di sản số')}</p>
            <Title order={1} id="home-title" className={classes.title}>
              {t('ui.home.title.first', 'Chạm vào di sản.')}{' '}
              <span className={classes.titleHighlight}>{t('ui.home.title.second', 'Khám phá theo cách của bạn.')}</span>
            </Title>
            <p className={classes.introduction}>
              {t('ui.home.intro', 'Khám phá các hiện vật đã xuất bản và chọn cách trải nghiệm phù hợp với bạn.')}
            </p>
            <div className={classes.ctaRow}>
              <Link to="/tour" className={classes.ctaPrimary}>
                <IconCube size={20} aria-hidden="true" />
                {t('ui.home.cta.tour', 'Khám phá Không gian 3D (WebXR)')}
              </Link>
              <Link to="/collection" className={classes.ctaSecondary}>
                {t('ui.home.cta.collection', 'Xem Danh mục Bộ sưu tập')}
                <IconArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className={classes.heroStage} aria-hidden={!heroSlide}>
            {heroSlide ? (
              <>
                {outgoingSlide && <div className={`${classes.heroPosterLayer} ${readySlideKey === heroSlide.key ? classes.heroPosterLeaving : classes.heroPosterVisible}`}>
                  <ExhibitImage image={{ url: outgoingSlide.imageUrl, alt: outgoingSlide.imageAlt }}
                    shape={outgoingSlide.shape} color={outgoingSlide.color} className={classes.heroImage} />
                </div>}
                <div className={`${classes.heroPosterLayer} ${readySlideKey === heroSlide.key || !outgoingSlide ? classes.heroPosterVisible : classes.heroPosterWaiting}`}>
                  <ExhibitImage image={{ url: heroSlide.imageUrl, alt: heroSlide.imageAlt }}
                    loading="eager" fetchPriority="high" onLoad={() => finishSlideLoad(heroSlide.key)}
                    onError={() => finishSlideLoad(heroSlide.key)} shape={heroSlide.shape} color={heroSlide.color}
                    className={classes.heroImage} />
                </div>
                {heroSlides.length > 1 && <div className={classes.heroControls} role="group"
                  aria-label={t('ui.home.hero.carousel.controls', 'Điều khiển hiện vật nổi bật')}>
                  <button type="button" className={classes.heroControlButton}
                    aria-label={t('ui.home.hero.carousel.previous', 'Hiện vật trước')} onClick={() => moveSlide(-1)}>
                    <IconChevronLeft aria-hidden="true" size={20} />
                  </button>
                  {heroSlides.map((slide, index) => (
                    <button key={slide.key} type="button" className={classes.heroControlButton}
                      aria-label={t('ui.home.hero.carousel.go-to-slide', 'Đến hiện vật {index}', { index: index + 1 })}
                      aria-pressed={slide.key === (readySlideKey === heroSlide.key ? heroSlide.key : outgoingSlide?.key ?? heroSlide.key)}
                      onClick={() => selectSlide(slide.key)}>
                      <span className={classes.heroDot} aria-hidden="true" />
                    </button>
                  ))}
                  <button type="button" className={classes.heroControlButton}
                    aria-label={t('ui.home.hero.carousel.next', 'Hiện vật tiếp theo')} onClick={() => moveSlide(1)}>
                    <IconChevronRight aria-hidden="true" size={20} />
                  </button>
                  <button type="button" className={classes.heroControlButton}
                    aria-label={t(autoplayPaused ? 'ui.home.hero.carousel.resume' : 'ui.home.hero.carousel.pause', autoplayPaused ? 'Tiếp tục tự chuyển' : 'Tạm dừng tự chuyển')}
                    aria-pressed={autoplayPaused} onClick={toggleAutoplay}>
                    {autoplayPaused
                      ? <IconPlayerPlay aria-hidden="true" size={18} />
                      : <IconPlayerPause aria-hidden="true" size={18} />}
                  </button>
                </div>}
              </>
            ) : (
              <>
                <span className={classes.artworkMedallion} />
                <span className={classes.artworkOrbit} />
                <span className={classes.artworkAccent} />
              </>
            )}
          </div>

          <aside className={classes.heroMetadata} aria-labelledby="home-hero-exhibit-title">
            {outgoingSlide && <div className={`${classes.heroMetadataLayer} ${readySlideKey === heroSlide?.key ? classes.heroMetadataLeaving : classes.heroMetadataVisible}`}
              aria-hidden={readySlideKey === heroSlide?.key}>
              <Title order={2} id={readySlideKey === heroSlide?.key ? undefined : 'home-hero-exhibit-title'} className={classes.heroMetaTitle}>{outgoingSlide.name}</Title>
              <p className={classes.heroMetaDescription}>{outgoingSlide.description}</p>
              <Link className={classes.heroMetaLink} to={outgoingSlide.detailHref} tabIndex={readySlideKey === heroSlide?.key ? -1 : undefined}
                aria-label={t('ui.collection.details-aria', 'Xem chi tiết {name}', { name: outgoingSlide.name })}>
                {t('ui.collection.details', 'Xem chi tiết')} <IconArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>}
            {heroSlide && <div className={`${classes.heroMetadataLayer} ${readySlideKey === heroSlide.key || !outgoingSlide ? classes.heroMetadataVisible : classes.heroMetadataWaiting}`}
              aria-hidden={!!outgoingSlide && readySlideKey !== heroSlide.key}>
              <Title order={2} id={readySlideKey === heroSlide.key || !outgoingSlide ? 'home-hero-exhibit-title' : undefined} className={classes.heroMetaTitle}>{heroSlide.name}</Title>
              <p className={classes.heroMetaDescription}>{heroSlide.description}</p>
              <Link className={classes.heroMetaLink} to={heroSlide.detailHref}
                tabIndex={outgoingSlide && readySlideKey !== heroSlide.key ? -1 : undefined}
                aria-label={t('ui.collection.details-aria', 'Xem chi tiết {name}', { name: heroSlide.name })}>
                {t('ui.collection.details', 'Xem chi tiết')} <IconArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>}
          </aside>
        </div>
      </section>

      <section className={classes.featured} aria-labelledby="featured-title">
        <Container size="xl">
          <div className={classes.featuredHeader}>
            <p className={classes.eyebrow}>{t('ui.home.featured.eyebrow', 'Từ bộ sưu tập')}</p>
            <Title order={2} id="featured-title" className={classes.sectionTitle}>{t('ui.home.featured.title', 'Hiện vật nổi bật')}</Title>
            <p className={classes.featuredIntro}>{t('ui.home.featured.description', 'Một số hiện vật theo thứ tự trưng bày')}</p>
          </div>
          <HomeFeaturedExhibits rooms={rooms} room={room} detail={detail} exhibits={featured} />
        </Container>
      </section>

      <Container size="xl" className={classes.content}>
        <section className={classes.immersive} aria-labelledby="immersive-title">
          <div className={classes.immersiveGrid}>
            <div className={classes.immersiveCopy}>
              <Title order={2} id="immersive-title" className={classes.immersiveTitle}>
                {t('ui.home.story.title', 'Hai cách khám phá di sản')}
              </Title>
              <p className={classes.immersiveIntro}>
                {t('ui.home.story.intro', 'Chọn tham quan 3D hoặc xem bộ sưu tập hiện vật ở dạng 2D.')}
              </p>
              <ul className={classes.storyPoints}>
                <li className={classes.storyPoint}>
                  <IconCube size={22} aria-hidden="true" />
                  <div>
                    <h3 className={classes.storyPointTitle}>{t('ui.home.story.tour.title', 'Tham quan trong không gian 3D')}</h3>
                    <p className={classes.storyPointText}>{t('ui.home.story.tour.text', 'Khám phá các phòng và hiện vật qua trang Tham quan 3D.')}</p>
                  </div>
                </li>
                <li className={classes.storyPoint}>
                  <IconHeadphones size={22} aria-hidden="true" />
                  <div>
                    <h3 className={classes.storyPointTitle}>{t('ui.home.story.audio.title', 'Lắng nghe thuyết minh')}</h3>
                    <p className={classes.storyPointText}>{t('ui.home.story.audio.text', 'Một số hiện vật có thuyết minh âm thanh trên trang chi tiết.')}</p>
                  </div>
                </li>
              </ul>
              <div className={classes.storyActions}>
                <Link to="/tour" className={classes.ctaPrimary}>
                  <IconCube size={18} aria-hidden="true" />
                  {t('ui.home.story.cta.tour', 'Vào tham quan 3D')}
                </Link>
                <Link to="/collection" className={classes.textLink}>
                  {t('ui.home.story.cta.collection', 'Xem bộ sưu tập 2D')}
                  <IconArrowRight size={18} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className={classes.storyArtwork} aria-hidden="true">
              <span className={classes.storyOrbit} />
              <IconCube size={88} stroke={1.2} />
            </div>
          </div>
        </section>
      </Container>
    </div>
  );
}
