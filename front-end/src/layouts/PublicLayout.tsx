import { Container } from '@mantine/core';
import { Link, NavLink, Outlet } from 'react-router-dom';
import auraMark from '@/assets/aura-mark.svg';
import classes from './PublicLayout.module.css';

/** Khung trang cho phần client công khai (trang chủ, collection, chi tiết, tour). */
export function PublicLayout() {
  return (
    <div className={classes.layout}>
      <a className={classes.skipLink} href="#public-content">Đến nội dung chính</a>
      <header className={classes.header}>
        <Container size="lg" className={classes.headerInner}>
          <Link to="/" className={classes.brand} aria-label="Aura Museum — Trang chủ">
            <img src={auraMark} width="36" height="36" alt="" />
            <span>AURA <span className={classes.brandDetail}>MUSEUM</span></span>
          </Link>
          <nav aria-label="Điều hướng chính" className={classes.navigation}>
            <NavLink to="/" end className={classes.navLink}>Trang chủ</NavLink>
            <NavLink to="/collection" className={classes.navLink}>Bộ sưu tập</NavLink>
            <span className={classes.comingSoon}>Tham quan 3D <span>Sắp ra mắt</span></span>
          </nav>
        </Container>
      </header>
      <main id="public-content" tabIndex={-1} className={classes.main}>
        <Outlet />
      </main>
      <footer className={classes.footer}>
        <Container size="lg" className={classes.footerInner}>
          <div>
            <Link to="/" className={classes.footerBrand}>Aura Museum</Link>
            <p>Một không gian để khám phá, chiêm nghiệm và kết nối.</p>
          </div>
          <nav aria-label="Liên kết cuối trang" className={classes.footerLinks}>
            <Link to="/">Trang chủ</Link>
            <Link to="/collection">Bộ sưu tập</Link>
          </nav>
          <small>Dự án bảo tàng số · Nhóm ailabs26</small>
        </Container>
      </footer>
    </div>
  );
}
