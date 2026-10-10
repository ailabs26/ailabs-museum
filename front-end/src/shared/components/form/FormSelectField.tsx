import { Select, type SelectProps } from '@mantine/core';

export function FormSelectField(props: SelectProps) {
  return <Select radius="md" checkIconPosition="right" {...props} />;
}
