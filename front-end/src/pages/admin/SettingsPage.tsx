import { Tabs } from '@mantine/core';
import { IconDevices, IconLock, IconPalette, IconUser } from '@tabler/icons-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/shared/components/layout/PageHeader';
import { AppearancePanel } from './settings/AppearancePanel';
import { ChangePasswordPanel } from './settings/ChangePasswordPanel';
import { ProfilePanel } from './settings/ProfilePanel';
import { SessionsPanel } from './settings/SessionsPanel';

const TABS = [
  { value: 'profile', label: 'Hồ sơ', icon: IconUser, panel: ProfilePanel },
  { value: 'password', label: 'Mật khẩu', icon: IconLock, panel: ChangePasswordPanel },
  { value: 'sessions', label: 'Phiên đăng nhập', icon: IconDevices, panel: SessionsPanel },
  { value: 'appearance', label: 'Giao diện', icon: IconPalette, panel: AppearancePanel },
] as const;

/** Cài đặt của chính tài khoản đang đăng nhập; tab nằm trên URL (/admin/settings/:tab) để chia sẻ link. */
export function SettingsPage() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const active = TABS.find((item) => item.value === tab);
  if (!active) return <Navigate to="/admin/settings/profile" replace />;

  return (
    <>
      <PageHeader title="Cài đặt" description="Hồ sơ, bảo mật và giao diện của tài khoản bạn" />
      <Tabs value={active.value} onChange={(value) => value && navigate(`/admin/settings/${value}`)} keepMounted={false}>
        <Tabs.List mb="md">
          {TABS.map(({ value, label, icon: Icon }) => (
            <Tabs.Tab key={value} value={value} leftSection={<Icon size={16} />}>{label}</Tabs.Tab>
          ))}
        </Tabs.List>
        {TABS.map(({ value, panel: Panel }) => (
          <Tabs.Panel key={value} value={value}><Panel /></Tabs.Panel>
        ))}
      </Tabs>
    </>
  );
}
