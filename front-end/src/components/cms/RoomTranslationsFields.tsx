import { useState } from 'react';
import { SegmentedControl, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { TARGET_LOCALES } from '@/services/translations.service';

interface RoomTranslationsFieldsProps {
  source: { name: string; description: string };
  getInputProps: (path: string) => object;
}

/** Bản dịch tên và mô tả phòng, một ngôn ngữ mỗi lần. Phòng không qua kiểm duyệt nên lưu là có hiệu lực ngay. */
export function RoomTranslationsFields({ source, getInputProps }: RoomTranslationsFieldsProps) {
  const [locale, setLocale] = useState(TARGET_LOCALES[0].code);
  const language = TARGET_LOCALES.find((item) => item.code === locale)?.label ?? locale;

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>Bản dịch</Text>
      <Text size="xs" c="dimmed">Không bắt buộc. Ô để trống thì khách xem bằng ngôn ngữ đó sẽ thấy bản tiếng Việt.</Text>
      <SegmentedControl fullWidth size="xs" aria-label="Ngôn ngữ dịch" value={locale} onChange={setLocale}
        data={TARGET_LOCALES.map((item) => ({ value: item.code, label: item.label }))} />
      <TextInput key={`${locale}-name`} label={`Tên (${language})`} placeholder={source.name} maxLength={200}
        {...getInputProps(`translations.${locale}.name`)} />
      <Textarea key={`${locale}-description`} label={`Mô tả (${language})`} placeholder={source.description}
        rows={3} maxLength={10000} {...getInputProps(`translations.${locale}.description`)} />
    </Stack>
  );
}
