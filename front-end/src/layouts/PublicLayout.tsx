import { Burger, Container, Drawer, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCube, IconShieldLock } from '@tabler/icons-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import auraMark from '@/assets/aura-mark.svg';
import { useScrolled } from '@/hooks/useScrolled';
import { ThemeToggle } from '@/shared/components/layout/ThemeToggle';
import classes from './PublicLayout.module.css';

const NAV = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/collection', label: 'Bộ sưu tập', end: false },
  { to: '/tour', label: 'Tham quan 3D', end: false },
];

/** Khung trang cho phần client công khai (trang chủ, collection, chi tiết, tour). */
export function PublicLayout() {
  const scrolled = useScrolled();
  const [drawer, { open, close }] = useDisclosure(false);

  return (
    <div className={classes.layout}>
      <a className={classes.skipLink} href="#public-content">Đến nội dung chính</a>
      <header className={`${classes.header} ${scrolled ? classes.headerScrolled : ''}`}>
        <Container size="lg" className={classes.headerInner}>
          <Link to="/" className={classes.brand} aria-label="Aura Museum — Trang chủ">
            <span className={classes.brandMark}><img src={auraMark} width="26" height="26" alt="" /></span>
            <span>AURA <span className={classes.brandDetail}>DIGITAL MUSEUM</span></span>
          </Link>

          <nav aria-label="Điều hướng chính" className={classes.navigation}>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={classes.navLink}>{item.label}</NavLink>
            ))}
          </nav>

          <div className={classes.headerActions}>
            <ThemeToggle />
            <Link to="/tour" className={classes.vrButton}>
              <IconCube size={18} aria-hidden="true" />
              <span>Vào không gian 3D</span>
            </Link>
            <Burger opened={drawer} onClick={open} hiddenFrom="sm" size="sm" aria-label="Mở menu điều hướng" />
          </div>
        </Container>
      </header>

      <Drawer opened={drawer} onClose={close} position="right" size="xs" title="Điều hướng" hiddenFrom="sm">
        <Stack gap="xs">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={classes.navLink} onClick={close}>{item.label}</NavLink>
          ))}
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
                Bảo tồn và kể lại câu chuyện di sản bằng không gian số 3D WebXR — để mọi người,
                ở bất cứ đâu, đều có thể chạm tới nghệ thuật và lịch sử.
              </p>
              <span className={classes.footerBadge}>✦ Cam kết tiếp cận WCAG 2.2 AA</span>
            </div>

            <nav aria-label="Khám phá" className={classes.footerCol}>
              <p className={classes.footerColTitle}>Khám phá</p>
              <div className={classes.footerLinks}>
                <Link to="/">Trang chủ</Link>
                <Link to="/collection">Bộ sưu tập 2D</Link>
                <Link to="/tour">Tham quan 3D WebXR</Link>
              </div>
            </nav>

            <nav aria-label="Hệ thống" className={classes.footerCol}>
              <p className={classes.footerColTitle}>Hệ thống</p>
              <div className={classes.footerLinks}>
                <Link to="/admin" className={classes.adminLink}>
                  <IconShieldLock size={16} aria-hidden="true" /> Cổng Quản trị viên
                </Link>
              </div>
            </nav>
          </div>
          <div className={classes.footerBottom}>
            <small>© 2026 Aura Museum · Dự án bảo tàng số · Nhóm ailabs26</small>
            <small>Thiết kế theo Aura Design System 2.0</small>
          </div>
        </Container>
      </footer>
    </div>
  );
}
