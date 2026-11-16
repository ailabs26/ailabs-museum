import { Container, Title } from '@mantine/core';
import { IconArrowRight, IconCube, IconHeadphones } from '@tabler/icons-react';
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
  const heroSlide = useHomeHeroSlides({ rooms, room, selectedRoom })[0];
  const featured = exhibits.slice(0, 3);
  usePageTitle(null);

  return (
    <div className={classes.page}>
      <section className={classes.hero} aria-labelledby="home-title">
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

          <div className={classes.heroArtwork} aria-hidden={!heroSlide}>
            {heroSlide ? (
              <Link className={classes.heroPoster} to={heroSlide.detailHref}>
                <ExhibitImage image={{
                  url: heroSlide.imageUrl,
                  alt: heroSlide.imageAlt,
                }} loading="eager" shape={heroSlide.shape} color={heroSlide.color}
                  className={classes.heroImage} />
                <span className={classes.posterCaption}>{heroSlide.name}</span>
              </Link>
            ) : (
              <>
                <span className={classes.artworkMedallion} />
                <span className={classes.artworkOrbit} />
                <span className={classes.artworkAccent} />
              </>
            )}
          </div>
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
