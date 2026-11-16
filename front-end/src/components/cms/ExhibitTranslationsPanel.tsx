import { useState } from 'react';
import { Divider, SegmentedControl, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { HOTSPOT_BODY_MAX, HOTSPOT_LABEL_MAX, type HotspotFormValue } from '@/helpers/exhibitHotspots';
import { translationProgress, type ExhibitTranslationField, type ExhibitTranslations } from '@/helpers/exhibitTranslations';
import { LOCALES, OPTIONAL_CONTENT_LOCALES, type OptionalContentLocale } from '@/services/translations.service';

const NAME_MAX = 200;
const TEXT_MAX = 10000;

interface ExhibitTranslationsPanelProps {
  translations: ExhibitTranslations;
  hotspots: readonly HotspotFormValue[];
  /** Bản tiếng Việt để đối chiếu khi dịch. */
  source: Record<ExhibitTranslationField, string>;
  getInputProps: (path: string) => object;
}

const languageName = (code: OptionalContentLocale) => LOCALES.find((locale) => locale.code === code)?.label ?? code;

/** Bản dịch không bắt buộc của hiện vật, một ngôn ngữ mỗi lần; lưu cùng bản nháp nên đi qua kiểm duyệt. */
export function ExhibitTranslationsPanel({ translations, hotspots, source, getInputProps }: ExhibitTranslationsPanelProps) {
  const [locale, setLocale] = useState<OptionalContentLocale>('fr');
  const path = `translations.${locale}`;
  const language = languageName(locale);

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Không bắt buộc. Ô để trống thì khách xem bằng ngôn ngữ đó sẽ thấy bản tiếng Việt.
      </Text>
      <SegmentedControl
        fullWidth
        aria-label="Ngôn ngữ dịch"
        value={locale}
        onChange={(value) => setLocale(value as OptionalContentLocale)}
        data={OPTIONAL_CONTENT_LOCALES.map((code) => {
          const { done, total } = translationProgress(translations, hotspots, code);
          return { value: code, label: `${languageName(code)} ${done}/${total}` };
        })}
      />
      <TextInput key={`${locale}-name`} label={`Tên hiện vật (${language})`} placeholder={source.name} maxLength={NAME_MAX}
        {...getInputProps(`${path}.name`)} />
      <Textarea key={`${locale}-description`} label={`Mô tả (${language})`} placeholder={source.description} autosize minRows={3}
        maxLength={TEXT_MAX} {...getInputProps(`${path}.description`)} />
      <Textarea key={`${locale}-transcript`} label={`Thuyết minh (${language})`} placeholder={source.transcript} autosize minRows={3}
        maxLength={TEXT_MAX} {...getInputProps(`${path}.transcript`)} />
      <TextInput key={`${locale}-altText`} label={`Alt text ảnh (${language})`} placeholder={source.altText} maxLength={TEXT_MAX}
        {...getInputProps(`${path}.altText`)} />
      {hotspots.map((hotspot, index) => (
        <Stack key={`${locale}-hotspot-${index}`} gap="xs">
          <Divider label={`Hotspot ${index + 1}`} labelPosition="left" />
          <TextInput label={`Tiêu đề hotspot ${index + 1} (${language})`} placeholder={hotspot.labelVi} maxLength={HOTSPOT_LABEL_MAX}
            {...getInputProps(`hotspots.${index}.translations.${locale}.label`)} />
          <Textarea label={`Nội dung hotspot ${index + 1} (${language})`} placeholder={hotspot.bodyVi} autosize minRows={2}
            maxLength={HOTSPOT_BODY_MAX} {...getInputProps(`hotspots.${index}.translations.${locale}.body`)} />
        </Stack>
      ))}
    </Stack>
  );
}
