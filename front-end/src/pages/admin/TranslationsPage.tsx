import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Drawer, Group, Loader, Paper, RingProgress,
  Select, SimpleGrid, Stack, Text, Textarea, TextInput, Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import {
  IconAlertCircle, IconCheck, IconLanguage, IconPlus, IconRefresh, IconSearch, IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/core/auth/use-auth';
import { PERMISSIONS } from '@/core/auth/permissions';
import {
  CATEGORY_LABELS, LOCALES, SOURCE_LOCALE, TARGET_LOCALES, localeProgress,
  translationsService, type TranslationCategory, type TranslationEntry,
} from '@/services/translations.service';
import { EmptyState } from '@/shared/components/data/EmptyState';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { confirmAction } from '@/shared/components/feedback/confirm';
import { notify } from '@/shared/components/feedback/notify';

const CATEGORY_OPTIONS = (Object.entries(CATEGORY_LABELS) as [TranslationCategory, string][])
  .map(([value, label]) => ({ value, label }));

/** Trang nhập bản dịch đa ngôn ngữ song song cho CMS. */
export function TranslationsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMISSIONS.TRANSLATION_MANAGE) || hasPermission(PERMISSIONS.EXHIBIT_UPDATE);
  const queryClient = useQueryClient();

  const [activeLocale, setActiveLocale] = useState(TARGET_LOCALES[0]?.code ?? 'en');
  const [category, setCategory] = useState<TranslationCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [drawerOpened, drawer] = useDisclosure(false);

  const query = useQuery({ queryKey: ['translations'], queryFn: () => translationsService.list() });
  const entries = useMemo(() => query.data ?? [], [query.data]);

  // Khởi tạo bản nháp cho ngôn ngữ đang chọn mỗi khi dữ liệu hoặc ngôn ngữ đổi.
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const entry of entries) next[entry.id] = entry.values[activeLocale] ?? '';
    setDrafts(next);
  }, [entries, activeLocale]);

  const saveMutation = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      translationsService.updateValues(id, { [activeLocale]: value }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['translations'] });
      notify.success('Đã lưu bản dịch', 'Cập nhật');
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => translationsService.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['translations'] });
      notify.success('Đã xóa mục bản dịch');
    },
    onError: (error: Error) => notify.error(error.message),
  });

  const filtered = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('vi');
    return entries.filter((entry) => {
      if (category !== 'all' && entry.category !== category) return false;
      if (!keyword) return true;
      return `${entry.namespace} ${entry.context} ${entry.values[SOURCE_LOCALE] ?? ''}`
        .toLocaleLowerCase('vi').includes(keyword);
    });
  }, [entries, category, search]);

  const activeMeta = LOCALES.find((locale) => locale.code === activeLocale);

  function commit(entry: TranslationEntry) {
    const value = (drafts[entry.id] ?? '').trim();
    if (value === (entry.values[activeLocale] ?? '')) return; // không đổi → bỏ qua
    saveMutation.mutate({ id: entry.id, value });
  }

  return (
    <>
      <PageHeader
        title="Bản dịch đa ngôn ngữ"
        description="Nhập và đối chiếu bản dịch song song giữa ngôn ngữ nguồn (Tiếng Việt) và các ngôn ngữ đích."
        actions={canManage ? (
          <Button leftSection={<IconPlus size={16} />} onClick={drawer.open}>Thêm chuỗi dịch</Button>
        ) : undefined}
      />

      {/* Tổng quan tiến độ từng ngôn ngữ đích */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="lg">
        {TARGET_LOCALES.map((locale) => {
          const ratio = localeProgress(entries, locale.code);
          return (
            <Paper key={locale.code} withBorder radius="md" p="sm">
              <Group gap="sm" wrap="nowrap">
                <RingProgress
                  size={54} thickness={5}
                  sections={[{ value: Math.round(ratio * 100), color: ratio === 1 ? 'teal' : 'blue' }]}
                  label={<Text ta="center" size="xs" fw={700}>{Math.round(ratio * 100)}%</Text>}
                />
                <div>
                  <Text size="sm" fw={600}>{locale.flag} {locale.label}</Text>
                  <Text size="xs" c="dimmed">
                    {entries.filter((e) => (e.values[locale.code] ?? '').trim()).length}/{entries.length} chuỗi
                  </Text>
                </div>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>

      {query.isLoading ? (
        <Group justify="center" py="xl" role="status" aria-label="Đang tải bản dịch"><Loader /></Group>
      ) : query.isError ? (
        <Alert color="red" title="Không tải được bản dịch" icon={<IconAlertCircle size={18} />}>
          <Button mt="sm" variant="light" color="red" leftSection={<IconRefresh size={16} />}
            onClick={() => void query.refetch()}>Thử lại</Button>
        </Alert>
      ) : (
        <>
          <Group mb="md" gap="md" align="flex-end" wrap="wrap">
            <Select
              label="Ngôn ngữ đích" w={190} allowDeselect={false}
              leftSection={<IconLanguage size={16} />}
              data={TARGET_LOCALES.map((l) => ({ value: l.code, label: `${l.flag} ${l.label}` }))}
              value={activeLocale} onChange={(value) => value && setActiveLocale(value)}
            />
            <Select
              label="Phân loại" w={170} allowDeselect={false}
              data={[{ value: 'all', label: 'Tất cả' }, ...CATEGORY_OPTIONS]}
              value={category} onChange={(value) => setCategory((value as TranslationCategory | 'all') ?? 'all')}
            />
            <TextInput
              label="Tìm kiếm" flex={1} miw={200} leftSection={<IconSearch size={16} />}
              placeholder="namespace, ngữ cảnh hoặc nội dung nguồn…"
              value={search} onChange={(event) => setSearch(event.currentTarget.value)}
            />
          </Group>

          {filtered.length === 0 ? (
            <EmptyState text="Không có chuỗi dịch phù hợp." />
          ) : (
            <Stack gap="sm">
              {filtered.map((entry) => {
                const draft = drafts[entry.id] ?? '';
                const translated = draft.trim().length > 0;
                return (
                  <Paper key={entry.id} withBorder radius="md" p="md">
                    <Group justify="space-between" mb="xs" wrap="nowrap">
                      <Group gap="xs" wrap="wrap">
                        <Badge variant="light">{CATEGORY_LABELS[entry.category]}</Badge>
                        <Text size="sm" ff="monospace" c="dimmed">{entry.namespace}</Text>
                        <Badge size="sm" variant="dot" color={translated ? 'teal' : 'gray'}>
                          {translated ? 'Đã dịch' : 'Thiếu'}
                        </Badge>
                      </Group>
                      {canManage && (
                        <Tooltip label="Xóa chuỗi">
                          <Button variant="subtle" color="red" size="compact-sm"
                            onClick={() => confirmAction({
                              danger: true, message: `Xóa chuỗi "${entry.namespace}"?`,
                              confirmLabel: 'Xóa', onConfirm: () => removeMutation.mutate(entry.id),
                            })}>
                            <IconTrash size={16} />
                          </Button>
                        </Tooltip>
                      )}
                    </Group>
                    <Text size="xs" c="dimmed" mb="sm">{entry.context}</Text>
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                      <Textarea
                        label={`🇻🇳 ${LOCALES[0].label} (nguồn)`} autosize minRows={2} readOnly
                        value={entry.values[SOURCE_LOCALE] ?? ''} variant="filled"
                      />
                      <Textarea
                        label={`${activeMeta?.flag ?? ''} ${activeMeta?.label ?? activeLocale}`}
                        autosize minRows={2} readOnly={!canManage}
                        placeholder={canManage ? 'Nhập bản dịch…' : 'Bạn không có quyền chỉnh sửa'}
                        value={draft}
                        onChange={(event) => setDrafts((prev) => ({ ...prev, [entry.id]: event.currentTarget.value }))}
                        onBlur={() => canManage && commit(entry)}
                      />
                    </SimpleGrid>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </>
      )}

      {canManage && <CreateTranslationDrawer opened={drawerOpened} onClose={drawer.close} />}
    </>
  );
}

function CreateTranslationDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm({
    initialValues: { namespace: '', context: '', category: 'ui' as TranslationCategory, source: '' },
    validate: {
      namespace: (value) => (/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(value.trim()) ? null
        : 'Dùng dạng khóa như exhibit.ten-hien-vat.name'),
      source: (value) => (value.trim() ? null : 'Nhập nội dung nguồn tiếng Việt'),
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: typeof form.values) => translationsService.create({
      namespace: values.namespace.trim(),
      context: values.context.trim(),
      category: values.category,
      values: { [SOURCE_LOCALE]: values.source.trim() },
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['translations'] });
      notify.success('Đã thêm chuỗi dịch');
      form.reset();
      onClose();
    },
    onError: (error: Error) => notify.error(error.message),
  });

  return (
    <Drawer opened={opened} onClose={onClose} position="right" title="Thêm chuỗi dịch" size="md">
      <form onSubmit={form.onSubmit((values) => createMutation.mutate(values))}>
        <Stack>
          <TextInput label="Namespace (khóa)" placeholder="exhibit.ten-hien-vat.name"
            withAsterisk {...form.getInputProps('namespace')} />
          <Select label="Phân loại" allowDeselect={false} data={CATEGORY_OPTIONS}
            {...form.getInputProps('category')} />
          <TextInput label="Ngữ cảnh" placeholder="Gợi ý cho người dịch"
            {...form.getInputProps('context')} />
          <Textarea label="Nội dung nguồn (Tiếng Việt)" autosize minRows={3} withAsterisk
            {...form.getInputProps('source')} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Hủy</Button>
            <Button type="submit" loading={createMutation.isPending} leftSection={<IconCheck size={16} />}>
              Thêm
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
