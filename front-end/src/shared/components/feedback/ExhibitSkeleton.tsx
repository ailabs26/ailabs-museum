import classes from './ExhibitSkeleton.module.css';

/** Khung xương phát sáng (shimmer) mô phỏng lưới thẻ hiện vật khi đang tải. */
export function ExhibitSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className={classes.grid} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className={classes.card}>
          <div className={`${classes.media} ${classes.shimmer}`} />
          <div className={classes.body}>
            <div className={`${classes.line} ${classes.lineTitle} ${classes.shimmer}`} />
            <div className={`${classes.line} ${classes.shimmer}`} />
            <div className={`${classes.line} ${classes.lineShort} ${classes.shimmer}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
