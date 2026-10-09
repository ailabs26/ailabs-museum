import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Center, Stack, Text, Title } from '@mantine/core';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

/** Bắt lỗi render của React để không "trắng trang" — thoái lui êm. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ErrorBoundary:', error, info);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    return (
      <Center h="100vh" p="md">
        <Stack align="center" gap="xs">
          <Title order={3}>Đã xảy ra lỗi hiển thị</Title>
          <Text c="dimmed" ta="center">
            {this.state.message ?? 'Vui lòng tải lại trang.'}
          </Text>
          <Button onClick={() => window.location.reload()}>Tải lại</Button>
        </Stack>
      </Center>
    );
  }
}
