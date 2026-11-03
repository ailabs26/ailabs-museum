import { useState } from 'react';
import {
  Alert, Badge, Button, Checkbox, Code, CopyButton, Group, Image, Loader, Modal, Paper, PinInput, SimpleGrid, Stack, Text,
} from '@mantine/core';
import { IconCopy, IconDownload, IconShieldCheck, IconShieldOff } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiException } from '@/core/api/api-error';
import { saveBlob } from '@/helpers/saveBlob';
import { twoFactorService, type TwoFactorSetup } from '@/services/twoFactor.service';
import { notify } from '@/shared/components/feedback';
import { FormPassword } from '@/shared/components/form';

const KEY = ['auth', '2fa'] as const;
const errorText = (error: unknown, fallback: string) => (error instanceof ApiException ? error.message : fallback);

/** Ô nhập mã 6 số dùng chung (app Authenticator). */
function CodeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <Stack gap={4}>
      <Text size="sm" fw={500}>{label}</Text>
      <PinInput length={6} type="number" oneTimeCode value={value} onChange={onChange}
        getInputProps={(index) => ({ 'aria-label': `${label} — chữ số ${index + 1}` })} />
    </Stack>
  );
}

/** Danh sách mã khôi phục vừa tạo: chỉ hiện một lần, bắt xác nhận đã lưu trước khi đóng. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const text = codes.join('\n');
  return (
    <Stack>
      <Alert color="yellow" title="Lưu các mã khôi phục này ngay">
        Dùng một mã để đăng nhập khi mất điện thoại; mỗi mã dùng được <b>một lần</b>. Mã chỉ hiện lúc này.
      </Alert>
      <SimpleGrid cols={2} spacing="xs" aria-label="Mã khôi phục">
        {codes.map((code) => <Code key={code} ta="center" fz="sm">{code}</Code>)}
      </SimpleGrid>
      <Group>
        <CopyButton value={text}>
          {({ copied, copy }) => (
            <Button variant="default" leftSection={<IconCopy size={16} />} onClick={copy}>{copied ? 'Đã sao chép' : 'Sao chép'}</Button>
          )}
        </CopyButton>
        <Button variant="default" leftSection={<IconDownload size={16} />}
          onClick={() => saveBlob(new Blob([`Mã khôi phục Aura Museum\n\n${text}\n`], { type: 'text/plain' }), 'aura-museum-ma-khoi-phuc.txt')}>
          Tải về
        </Button>
      </Group>
      <Checkbox label="Tôi đã lưu các mã khôi phục ở nơi an toàn" checked={saved} onChange={(e) => setSaved(e.currentTarget.checked)} />
      <Button disabled={!saved} onClick={onDone}>Xong</Button>
    </Stack>
  );
}

/** Xác thực 2 lớp (TOTP) của tài khoản đang đăng nhập: bật bằng app Authenticator, tắt, tạo lại mã khôi phục. */
export function TwoFactorPanel() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: KEY, queryFn: () => twoFactorService.status() });
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'disable' | 'regenerate' | null>(null);
  const [password, setPassword] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const closeModal = () => { setModal(null); setCode(''); setPassword(''); setError(null); };

  const start = useMutation({
    mutationFn: () => twoFactorService.setup(),
    onSuccess: (result) => { setSetup(result); setCode(''); setError(null); },
    onError: (e) => notify.error(errorText(e, 'Không bắt đầu được thiết lập')),
  });
  const enable = useMutation({
    mutationFn: () => twoFactorService.enable(code),
    onSuccess: ({ recoveryCodes: codes }) => {
      setSetup(null); setCode(''); setRecoveryCodes(codes); void refresh();
      notify.success('Đã bật xác thực 2 lớp. Các thiết bị khác đã bị đăng xuất.');
    },
    onError: (e) => { setError(errorText(e, 'Mã không đúng')); setCode(''); },
  });
  const disable = useMutation({
    mutationFn: () => twoFactorService.disable(password, { code }),
    onSuccess: () => { closeModal(); void refresh(); notify.success('Đã tắt xác thực 2 lớp. Các thiết bị khác đã bị đăng xuất.'); },
    onError: (e) => { setError(errorText(e, 'Không tắt được')); setCode(''); },
  });
  const regenerate = useMutation({
    mutationFn: () => twoFactorService.regenerateRecoveryCodes(code),
    onSuccess: ({ recoveryCodes: codes }) => { closeModal(); setRecoveryCodes(codes); void refresh(); },
    onError: (e) => { setError(errorText(e, 'Mã không đúng')); setCode(''); },
  });

  if (status.isPending) return <Loader size="sm" />;
  if (status.isError) {
    return <Alert color="red" role="alert">Không tải được trạng thái xác thực 2 lớp.</Alert>;
  }

  if (recoveryCodes) {
    return (
      <Paper withBorder p="lg" radius="md" maw={520}>
        <RecoveryCodes codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} />
      </Paper>
    );
  }

  const enabled = status.data.enabled;
  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Khi bật, mỗi lần đăng nhập cần thêm mã 6 số từ app Authenticator trên điện thoại (Google Authenticator, Microsoft
        Authenticator, Authy…). Mật khẩu bị lộ thì người khác vẫn không vào được.
      </Text>
      <Paper withBorder p="lg" radius="md" maw={520}>
        <Group justify="space-between" mb="md">
          <Text fw={600}>Xác thực 2 lớp</Text>
          <Badge color={enabled ? 'teal' : 'gray'} variant="light">{enabled ? 'Đang bật' : 'Đang tắt'}</Badge>
        </Group>

        {enabled ? (
          <Stack>
            <Text size="sm">Còn <b>{status.data.recoveryCodesRemaining}</b>/10 mã khôi phục chưa dùng.</Text>
            {status.data.recoveryCodesRemaining <= 2 && (
              <Alert color="yellow">Sắp hết mã khôi phục — hãy tạo bộ mã mới.</Alert>
            )}
            <Group>
              <Button variant="default" onClick={() => setModal('regenerate')}>Tạo mã khôi phục mới</Button>
              <Button color="red" variant="light" leftSection={<IconShieldOff size={16} />} onClick={() => setModal('disable')}>
                Tắt xác thực 2 lớp
              </Button>
            </Group>
          </Stack>
        ) : setup ? (
          <Stack>
            <Text size="sm"><b>1.</b> Mở app Authenticator, chọn thêm tài khoản và quét mã QR:</Text>
            <Image src={setup.qrDataUrl} alt="Mã QR thiết lập xác thực 2 lớp" w={200} h={200} />
            <Text size="xs" c="dimmed">Không quét được? Nhập khóa này vào app (loại: theo thời gian):</Text>
            <Group gap="xs">
              <Code fz="sm" style={{ letterSpacing: 1 }}>{setup.secret.match(/.{1,4}/g)?.join(' ')}</Code>
              <CopyButton value={setup.secret}>
                {({ copied, copy }) => <Button size="compact-xs" variant="subtle" onClick={copy}>{copied ? 'Đã chép' : 'Chép'}</Button>}
              </CopyButton>
            </Group>
            <Text size="sm"><b>2.</b> Nhập mã 6 số đang hiện trong app để xác nhận:</Text>
            {error && <Alert color="red" role="alert">{error}</Alert>}
            <CodeInput label="Mã xác thực" value={code} onChange={setCode} />
            <Group>
              <Button leftSection={<IconShieldCheck size={16} />} loading={enable.isPending} disabled={code.length !== 6}
                onClick={() => { setError(null); enable.mutate(); }}>
                Bật xác thực 2 lớp
              </Button>
              <Button variant="subtle" color="gray" onClick={() => { setSetup(null); setError(null); }}>Hủy</Button>
            </Group>
          </Stack>
        ) : (
          <Button leftSection={<IconShieldCheck size={16} />} loading={start.isPending} onClick={() => start.mutate()}>
            Bật xác thực 2 lớp
          </Button>
        )}
      </Paper>

      <Modal opened={modal !== null} onClose={closeModal}
        title={modal === 'disable' ? 'Tắt xác thực 2 lớp' : 'Tạo mã khôi phục mới'}>
        <form onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          (modal === 'disable' ? disable : regenerate).mutate();
        }}>
          <Stack>
            <Text size="sm" c="dimmed">
              {modal === 'disable'
                ? 'Sau khi tắt, đăng nhập chỉ cần mật khẩu. Các thiết bị khác sẽ bị đăng xuất.'
                : 'Bộ mã khôi phục cũ sẽ hết hiệu lực ngay.'}
            </Text>
            {error && <Alert color="red" role="alert">{error}</Alert>}
            {modal === 'disable' && (
              <FormPassword label="Mật khẩu hiện tại" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.currentTarget.value)} />
            )}
            <CodeInput label="Mã xác thực" value={code} onChange={setCode} />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeModal}>Hủy</Button>
              <Button type="submit" color={modal === 'disable' ? 'red' : undefined}
                loading={disable.isPending || regenerate.isPending}
                disabled={code.length !== 6 || (modal === 'disable' && !password)}>
                {modal === 'disable' ? 'Tắt' : 'Tạo mã mới'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
