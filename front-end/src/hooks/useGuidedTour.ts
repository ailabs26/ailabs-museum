import { useContext } from 'react';
import { MuseumContext } from '@/contexts/MuseumContext';

export function useGuidedTour() {
  const context = useContext(MuseumContext);
  if (!context) throw new Error('useGuidedTour must be used within MuseumProvider');
  return context;
}
