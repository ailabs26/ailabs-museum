import { Button, Container, Title } from '@mantine/core';
import { IconArrowRight } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import classes from './HomePage.module.css';

export function HomePage() {
  return (
    <Container size="lg">
      <section className={classes.hero} aria-labelledby="home-title">
        <div className={classes.heroContent}>
          <p className={classes.eyebrow}>Aura Museum / Bảo tàng số</p>
          <Title order={1} id="home-title" className={classes.title}>
            Mỗi hiện vật,<br />một câu chuyện.
          </Title>
          <p className={classes.introduction}>
            Một góc nhìn mới về nghệ thuật và di sản. Dừng lại, quan sát và khám phá
            những câu chuyện phía sau mỗi hiện vật — ngay trên trình duyệt của bạn.
          </p>
          <Button component={Link} to="/collection" size="lg" color="teal.9" radius="sm"
            rightSection={<IconArrowRight size={20} aria-hidden="true" />}>
            Khám phá bộ sưu tập
          </Button>
          <p className={classes.heroNote}>Tham quan 3D <span>· Sắp ra mắt</span></p>
        </div>
        <div className={classes.heroVisual} aria-hidden="true">
          <div className={classes.arch}><div className={classes.innerArch} /></div>
          <div className={classes.plinth} />
          <span className={classes.visualCaption}>AURA — MỘT KHÔNG GIAN KHÁM PHÁ</span>
        </div>
      </section>

      <section className={classes.about} aria-labelledby="about-title">
        <div>
          <p className={classes.eyebrow}>Về Aura</p>
          <Title order={2} id="about-title" className={classes.sectionTitle}>Không gian số.<br />Kết nối thật.</Title>
        </div>
        <div className={classes.aboutContent}>
          <p>Aura Museum được xây dựng với mong muốn đưa không gian bảo tàng đến gần hơn với mọi người.
            Nghệ thuật và di sản mở ra những cuộc đối thoại — về quá khứ, về sáng tạo và về cách chúng ta nhìn thế giới.</p>
          <p>Bắt đầu từ bộ sưu tập 2D, nơi hình ảnh và câu chuyện được đặt ở trung tâm.
            Trải nghiệm không gian 3D sẽ là bước tiếp theo trong hành trình khám phá.</p>
          <Link to="/collection" className={classes.textLink}>Tìm hiểu bộ sưu tập <IconArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>

      <section className={classes.featured} aria-labelledby="featured-title">
        <p className={classes.eyebrow}>Từ bộ sưu tập</p>
        <Title order={2} id="featured-title" className={classes.sectionTitle}>Hiện vật nổi bật</Title>
        {/* Vùng hiện vật để trống theo phạm vi lượt đầu; sẽ bổ sung từ API. */}
        <div className={classes.featuredSpace} aria-hidden="true" />
      </section>
    </Container>
  );
}
