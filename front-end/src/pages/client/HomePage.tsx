import { Container, Title } from '@mantine/core';
import { IconAccessible, IconArrowRight, IconCube, IconDeviceGamepad2, IconHeadphones, IconSparkles } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { localizeExhibit, localizedAltText } from '@/helpers/localizeExhibit';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useMuseumRooms } from '@/hooks/useMuseumRooms';
import { ExhibitImage } from '@/shared/components/media/ExhibitImage';
import { HomeFeaturedExhibits } from './HomeFeaturedExhibits';
import classes from './HomePage.module.css';

export function HomePage() {
  const { locale, t } = usePublicLocale();
  const { rooms, room, selectedRoom } = useMuseumRooms(null);
  const detail = rooms.isSuccess && selectedRoom && room.isSuccess ? room.data : undefined;
  const exhibits = detail ? [...detail.exhibits]
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id.localeCompare(right.id)) : [];
  const heroExhibit = exhibits.find((exhibit) => !!exhibit.image?.url);
  const localizedHeroExhibit = heroExhibit ? localizeExhibit(heroExhibit, locale) : null;
  const heroImage = localizedHeroExhibit?.image;
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

          <div className={classes.heroArtwork} aria-hidden={!heroImage}>
            {localizedHeroExhibit && heroImage && selectedRoom ? (
              <Link className={classes.heroPoster}
                to={`/collection/${encodeURIComponent(selectedRoom.slug)}/exhibits/${encodeURIComponent(localizedHeroExhibit.id)}`}>
                <ExhibitImage image={{
                  url: heroImage.url,
                  alt: localizedAltText(heroImage.altText, locale, localizedHeroExhibit.name),
                }} loading="eager" shape={localizedHeroExhibit.placeholderShape} color={localizedHeroExhibit.placeholderColor}
                  className={classes.heroImage} />
                <span className={classes.posterCaption}>{localizedHeroExhibit.name}</span>
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

      <Container size="xl" className={classes.content}>
        <section className={classes.about} aria-labelledby="about-title">
          <div className={classes.aboutHead}>
            <p className={classes.eyebrow}>{t('ui.home.about.eyebrow', 'Về Aura Museum')}</p>
            <Title order={2} id="about-title" className={classes.sectionTitle}>
              {t('ui.home.about.title.first', 'Không gian số.')}{' '}
              <span className={classes.titleGradient}>{t('ui.home.about.title.second', 'Kết nối thật.')}</span>
            </Title>
          </div>
          <div className={classes.bento}>
            <article className={`${classes.bentoCard} ${classes.bentoLarge}`}>
              <span className={classes.bentoIcon}><IconCube size={26} aria-hidden="true" /></span>
              <h3 className={classes.bentoTitle}>{t('ui.home.bento.xr.title', 'Không gian thực tế ảo WebXR nhập vai')}</h3>
              <p className={classes.bentoText}>
                {t('ui.home.bento.xr.text', 'Dạo bước giữa phòng triển lãm 3D ngay trên trình duyệt. Tương thích kính VR (Quest, Pico, HTC Vive) và điều khiển linh hoạt WASD / cảm ứng.')}
              </p>
              <span className={classes.bentoChips}>
                <span><IconDeviceGamepad2 size={14} aria-hidden="true" /> WASD / Touch</span>
                <span>Quest · Pico · Vive</span>
              </span>
            </article>
            <article className={classes.bentoCard}>
              <span className={classes.bentoIcon}><IconHeadphones size={24} aria-hidden="true" /></span>
              <h3 className={classes.bentoTitle}>{t('ui.home.bento.audio.title', 'Thuyết minh âm thanh & sóng nhạc động')}</h3>
              <p className={classes.bentoText}>{t('ui.home.bento.audio.text', 'Audio Player với phụ đề WebVTT song ngữ đồng bộ từng câu nói.')}</p>
            </article>
            <article className={classes.bentoCard}>
              <span className={classes.bentoIcon}><IconSparkles size={24} aria-hidden="true" /></span>
              <h3 className={classes.bentoTitle}>{t('ui.home.bento.detail.title', 'Tái hiện di sản độ chi tiết cao')}</h3>
              <p className={classes.bentoText}>{t('ui.home.bento.detail.text', 'Soi rõ hoa văn, chất liệu gốm sứ / đồng thau cùng các điểm chú thích thông minh.')}</p>
            </article>
            <article className={`${classes.bentoCard} ${classes.bentoWide}`}>
              <span className={classes.bentoIcon}><IconAccessible size={24} aria-hidden="true" /></span>
              <h3 className={classes.bentoTitle}>{t('ui.home.bento.access.title', 'Tiếp cận toàn diện (WCAG 2.2 AA)')}</h3>
              <p className={classes.bentoText}>
                {t('ui.home.bento.access.text', '100% điều hướng bàn phím, tương phản đạt chuẩn và chế độ dự phòng 2D mượt mà khi thiết bị không hỗ trợ WebGL.')}
              </p>
            </article>
          </div>
        </section>

        <section className={classes.featured} aria-labelledby="featured-title">
          <p className={classes.eyebrow}>{t('ui.home.featured.eyebrow', 'Từ bộ sưu tập')}</p>
          <Title order={2} id="featured-title" className={classes.sectionTitle}>{t('ui.home.featured.title', 'Hiện vật nổi bật')}</Title>
          <HomeFeaturedExhibits rooms={rooms} room={room} detail={detail} exhibits={featured} />
        </section>
      </Container>
    </div>
  );
}
