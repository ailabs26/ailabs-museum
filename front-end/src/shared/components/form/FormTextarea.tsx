import { Textarea, type TextareaProps } from '@mantine/core';

export function FormTextarea(props: TextareaProps) {
  return <Textarea radius="md" autosize minRows={3} maxRows={8} {...props} />;
}
