import { Text } from '@mantine/core';
import classes from './MuseumLoading.module.css';

export function MuseumLoading({ text }: { text: string }) {
  return <div role="status" className={classes.loading}>
    <span className={classes.marker} aria-hidden="true" />
    <Text size="sm">{text}</Text>
  </div>;
}
