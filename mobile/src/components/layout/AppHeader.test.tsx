import { render, screen } from '@testing-library/react-native';
import { AppHeader } from './AppHeader';
import { ThemeProvider } from '@/theme/ThemeProvider';

describe('AppHeader', () => {
  it('hiển thị title với role header và subtitle khi có', () => {
    render(
      <ThemeProvider>
        <AppHeader title="Aura Museum" subtitle="Bảo tàng" />
      </ThemeProvider>,
    );
    expect(screen.getByRole('header', { name: 'Aura Museum' })).toBeOnTheScreen();
    expect(screen.getByText('Bảo tàng')).toBeOnTheScreen();
  });

  it('không render subtitle khi không truyền', () => {
    render(
      <ThemeProvider>
        <AppHeader title="Chỉ tiêu đề" />
      </ThemeProvider>,
    );
    expect(screen.queryByText('Bảo tàng')).toBeNull();
  });
});
