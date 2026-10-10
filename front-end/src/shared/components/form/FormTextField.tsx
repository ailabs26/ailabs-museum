import { TextInput, type TextInputProps } from '@mantine/core';

/** Ô nhập text chuẩn dự án (bọc Mantine TextInput). Dùng với form.getInputProps(name). */
export function FormTextField(props: TextInputProps) {
  return <TextInput radius="md" {...props} />;
}
