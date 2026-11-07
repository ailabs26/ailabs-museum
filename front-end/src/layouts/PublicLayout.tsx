import { Burger, Container, Drawer, NativeSelect, type NativeSelectProps, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCube, IconShieldLock } from '@tabler/icons-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import auraMark from '@/assets/aura-mark.svg';
import { PublicLocaleProvider, usePublicLocale } from '@/core/i18n/public-locale';
import { useScrolled } from '@/hooks/useScrolled';
import { LOCALES } from '@/services/translations.service';
import { ThemeToggle } from '@/shared/components/layout/ThemeToggle';
import classes from './PublicLayout.module.css';
import { usePageDescription } from '@/hooks/usePageTitle';

const NAV = [
  { to: '/', key: 'ui.nav.home', label: 'Trang chủ', end: true },
  { to: '/collection', key: 'ui.nav.collection', label: 'Bộ sưu tập', end: false },
  { to: '/tour', key: 'ui.nav.tour', label: 'Tham quan 3D', end: false },
];

/** Ô chọn ngôn ngữ dạng native: dùng được bàn phím và trình đọc màn hình sẵn. */
function LanguageSelect(props: Pick<NativeSelectProps, 'visibleFrom'>) {
  const { locale, setLocale, t } = usePublicLocale();
  return (
    <NativeSelect {...props} size="xs" aria-label={t('ui.language.label', 'Ngôn ngữ')} value={locale}
      onChange={(event) => setLocale(event.currentTarget.value)}
      data={LOCALES.map((item) => ({ value: item.code, label: item.label }))} />
  );
}

/** Khung trang cho phần client công khai (trang chủ, collection, chi tiết, tour). */
export function PublicLayout() {
  return <PublicLocaleProvider><PublicLayoutContent /></PublicLocaleProvider>;
}

function PublicLayoutContent() {
  const { t } = usePublicLocale();
  usePageDescription();
  const scrolled = useScrolled();
  const [drawer, { open, close }] = useDisclosure(false);

  return (
    <div className={classes.layout}>
      <a className={classes.skipLink} href="#public-content">{t('ui.skip-link', 'Đến nội dung chính')}</a>
      <header className={`${classes.header} ${scrolled ? classes.headerScrolled : ''}`}>
        <Container size="lg" className={classes.headerInner}>
          <Link to="/" className={classes.brand} aria-label={t('ui.brand.home-aria', 'Aura Museum — Trang chủ')}>
            <span className={classes.brandMark}><img src={auraMark} width="26" height="26" alt="" /></span>
            <span>AURA <span className={classes.brandDetail}>DIGITAL MUSEUM</span></span>
          </Link>

          <nav aria-label={t('ui.nav.main-aria', 'Điều hướng chính')} className={classes.navigation}>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={classes.navLink}>{t(item.key, item.label)}</NavLink>
            ))}
          </nav>

          <div className={classes.headerActions}>
            {/* Điện thoại: nằm trong Drawer để header không tràn ngang ở 320px. */}
            <LanguageSelect visibleFrom="sm" />
            <ThemeToggle />
            <Link to="/tour" className={classes.vrButton}>
              <IconCube size={18} aria-hidden="true" />
              <span>{t('ui.cta.enter-3d', 'Vào không gian 3D')}</span>
            </Link>
            <Burger opened={drawer} onClick={open} hiddenFrom="sm" size="sm" aria-label={t('ui.nav.open-menu', 'Mở menu điều hướng')} />
          </div>
        </Container>
      </header>

      <Drawer opened={drawer} onClose={close} position="right" size="xs" title={t('ui.nav.drawer-title', 'Điều hướng')} hiddenFrom="sm">
        <Stack gap="xs">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={classes.navLink} onClick={close}>{t(item.key, item.label)}</NavLink>
          ))}
          <LanguageSelect />
        </Stack>
      </Drawer>

      <main id="public-content" tabIndex={-1} className={classes.main}>
        <Outlet />
      </main>

      <footer className={classes.footer}>
        <Container size="lg">
          <div className={classes.footerGrid}>
            <div className={classes.footerBrandCol}>
              <Link to="/" className={classes.footerBrand}>
                <span className={classes.brandMark}><img src={auraMark} width="24" height="24" alt="" /></span>
                Aura Museum
              </Link>
              <p className={classes.footerManifesto}>
                {t('ui.footer.manifesto', 'Bảo tồn và kể lại câu chuyện di sản bằng không gian số 3D WebXR — để mọi người, ở bất cứ đâu, đều có thể chạm tới nghệ thuật và lịch sử.')}
              </p>
              <span className={classes.footerBadge}>{t('ui.footer.accessibility', '✦ Cam kết tiếp cận WCAG 2.2 AA')}</span>
            </div>

            <nav aria-label={t('ui.footer.explore', 'Khám phá')} className={classes.footerCol}>
              <p className={classes.footerColTitle}>{t('ui.footer.explore', 'Khám phá')}</p>
              <div className={classes.footerLinks}>
                <Link to="/">{t('ui.nav.home', 'Trang chủ')}</Link>
                <Link to="/collection">{t('ui.footer.collection', 'Bộ sưu tập 2D')}</Link>
                <Link to="/tour">{t('ui.footer.tour', 'Tham quan 3D WebXR')}</Link>
              </div>
            </nav>

            <nav aria-label={t('ui.footer.system', 'Hệ thống')} className={classes.footerCol}>
              <p className={classes.footerColTitle}>{t('ui.footer.system', 'Hệ thống')}</p>
              <div className={classes.footerLinks}>
                <Link to="/admin" className={classes.adminLink}>
                  <IconShieldLock size={16} aria-hidden="true" /> {t('ui.footer.admin', 'Cổng Quản trị viên')}
                </Link>
              </div>
            </nav>
          </div>
          <div className={classes.footerBottom}>
            <small>{t('ui.footer.copyright', '© 2026 Aura Museum · Dự án bảo tàng số · Nhóm ailabs26')}</small>
            <small>{t('ui.footer.design', 'Thiết kế theo Aura Design System 2.0')}</small>
          </div>
        </Container>
      </footer>
    </div>
  );
}
