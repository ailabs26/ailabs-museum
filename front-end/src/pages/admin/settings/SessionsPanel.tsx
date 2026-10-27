import { ActionIcon, Alert, Badge, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconDeviceDesktopOff, IconLogout } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiException } from '@/core/api/api-error';
import type { AuthSession } from '@/core/auth/authSchema';
import { useAuth } from '@/core/auth/use-auth';
import { describeUserAgent } from '@/helpers/userAgent';
import { authService } from '@/services/auth.service';
import { DataTable, type Column } from '@/shared/components/data';
import { confirmAction, notify } from '@/shared/components/feedback';
import { PageHeader } from '@/shared/components/layout/PageHeader';

const SESSIONS_KEY = ['auth', 'sessions'] as const;

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiException ? error.message : fallback;
}

/** Người dùng xem các thiết bị đang đăng nhập và đăng xuất từ xa (có hiệu lực ngay ở back-end). */
export function SessionsPage() {
  const { logout, logoutAll } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({ queryKey: SESSIONS_KEY, queryFn: () => authService.sessions() });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });

  const endHere = async (message: string) => {
    notify.success(message);
    navigate('/admin/login', { replace: true });
  };

  const revokeMutation = useMutation({
    mutationFn: (session: AuthSession) => authService.revokeSession(session.id),
    onSuccess: async (_result, session) => {
      if (session.current) {
        await logout();
        await endHere('Đã đăng xuất thiết bị này');
        return;
      }
      notify.success('Đã đăng xuất thiết bị');
      await invalidate();
    },
    onError: (error) => {
      notify.error(errorMessage(error, 'Đăng xuất thiết bị thất bại'));
      void invalidate();
    },
  });
  const othersMutation = useMutation({
    mutationFn: () => authService.revokeOtherSessions(),
    onSuccess: async () => {
      notify.success('Đã đăng xuất mọi thiết bị khác');
      await invalidate();
    },
    onError: (error) => notify.error(errorMessage(error, 'Đăng xuất các thiết bị khác thất bại')),
  });
  const allMutation = useMutation({
    mutationFn: () => logoutAll(),
    onSuccess: () => endHere('Đã đăng xuất khỏi tất cả thiết bị'),
    onError: (error) => notify.error(errorMessage(error, 'Đăng xuất tất cả thiết bị thất bại')),
  });

  const isBusy = revokeMutation.isPending || othersMutation.isPending || allMutation.isPending;
  // Thiết bị đang dùng luôn ở đầu; còn lại giữ thứ tự hoạt động gần nhất từ API.
  const sessions = [...(sessionsQuery.data ?? [])].sort((a, b) => Number(b.current) - Number(a.current));
  const hasOthers = sessions.some((session) => !session.current);

  const columns: Column<AuthSession>[] = [
    { key: 'device', header: 'Thiết bị', render: (session) => (
      <Group gap="xs" wrap="nowrap">
        <Text size="sm">{describeUserAgent(session.userAgent)}</Text>
        {session.current && <Badge color="green" variant="light">Thiết bị này</Badge>}
      </Group>
    ) },
    { key: 'ip', header: 'IP', render: (session) => session.ip ?? '—' },
    { key: 'signedInAt', header: 'Đăng nhập lúc', render: (session) => formatTime(session.signedInAt) },
    { key: 'lastActiveAt', header: 'Hoạt động gần nhất', render: (session) => formatTime(session.lastActiveAt) },
    { key: 'actions', header: '', align: 'right', render: (session) => (
      <Tooltip label={session.current ? 'Đăng xuất thiết bị này' : 'Đăng xuất thiết bị'}>
        <ActionIcon variant="subtle" color="red" disabled={isBusy}
          aria-label={`Đăng xuất ${describeUserAgent(session.userAgent)}${session.current ? ' (thiết bị này)' : ''}`}
          onClick={() => confirmAction({
            message: session.current
              ? 'Đăng xuất thiết bị đang dùng? Bạn sẽ cần đăng nhập lại.'
              : `Đăng xuất "${describeUserAgent(session.userAgent)}"? Thiết bị đó bị đăng xuất ngay lập tức.`,
            danger: true,
            confirmLabel: 'Đăng xuất',
            onConfirm: () => revokeMutation.mutate(session),
          })}>
          <IconLogout size={18} />
        </ActionIcon>
      </Tooltip>
    ) },
  ];

  return (
    <>
      <PageHeader title="Phiên đăng nhập"
        description="Các thiết bị đang đăng nhập tài khoản của bạn. Đăng xuất từ xa có hiệu lực ngay."
        actions={(
          <>
            <Button variant="light" leftSection={<IconDeviceDesktopOff size={16} />}
              disabled={isBusy || !hasOthers} loading={othersMutation.isPending}
              onClick={() => confirmAction({
                message: 'Đăng xuất mọi thiết bị khác? Thiết bị này vẫn giữ đăng nhập.',
                danger: true,
                confirmLabel: 'Đăng xuất thiết bị khác',
                onConfirm: () => othersMutation.mutate(),
              })}>
              Đăng xuất các thiết bị khác
            </Button>
            <Button color="red" leftSection={<IconLogout size={16} />}
              disabled={isBusy} loading={allMutation.isPending}
              onClick={() => confirmAction({
                message: 'Đăng xuất khỏi tất cả thiết bị, kể cả thiết bị này? Bạn sẽ cần đăng nhập lại.',
                danger: true,
                confirmLabel: 'Đăng xuất tất cả',
                onConfirm: () => allMutation.mutate(),
              })}>
              Đăng xuất tất cả
            </Button>
          </>
        )} />
      {sessionsQuery.isError ? (
        <Alert color="red" title="Không tải được phiên đăng nhập" role="alert">
          <Stack gap="xs">
            <Text size="sm">{errorMessage(sessionsQuery.error, 'Tải danh sách thất bại')}</Text>
            <Button variant="light" size="xs" onClick={() => void sessionsQuery.refetch()}
              loading={sessionsQuery.isFetching}>Thử lại</Button>
          </Stack>
        </Alert>
      ) : (
        <DataTable columns={columns} data={sessions} rowKey={(session) => session.id}
          loading={sessionsQuery.isLoading} emptyText="Không có phiên đăng nhập nào" />
      )}
    </>
  );
}
