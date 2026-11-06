import { NativeSelect, type NativeSelectProps } from '@mantine/core';
import { usePublicLocale } from '@/core/i18n/public-locale';
import { LOCALES } from '@/services/translations.service';

export function LanguageSelect(props: NativeSelectProps) {
  const { locale, setLocale, t } = usePublicLocale();
  return <NativeSelect {...props} size="xs" aria-label={t('ui.language.label', 'Ngôn ngữ')} value={locale}
    onChange={(event) => setLocale(event.currentTarget.value)}
    data={LOCALES.map((item) => ({ value: item.code, label: item.label }))} />;
}
