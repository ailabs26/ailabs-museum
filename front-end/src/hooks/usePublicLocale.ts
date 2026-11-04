import { useContext } from 'react';
import { PublicLocaleContext } from '@/contexts/PublicLocaleContext';

export function usePublicLocale() {
  const context = useContext(PublicLocaleContext);
  if (!context) throw new Error('usePublicLocale must be used within PublicLocaleProvider');
  return context;
}
