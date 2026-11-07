import { useState } from 'react';
import { usePublicT } from '@/core/i18n/public-locale';
import { isSameExhibit } from '@/helpers/visitorState';
import type { VisitorExhibitRef } from '@/helpers/visitorState';

export function useExhibitComparison() {
  const [selection, setSelection] = useState<VisitorExhibitRef[]>([]);
  const [message, setMessage] = useState('');
  const t = usePublicT();
  const toggle = (target: VisitorExhibitRef) => {
    if (selection.some(ref => isSameExhibit(ref, target))) {
      setSelection(selection.filter(ref => !isSameExhibit(ref, target)));
      setMessage(t('ui.compare.removed', 'Đã bỏ hiện vật khỏi so sánh.'));
    } else if (selection.length === 3) {
      setMessage(t('ui.compare.max', 'Tối đa 3 hiện vật. Hãy bỏ một lựa chọn trước khi thêm.'));
    } else {
      setSelection([...selection, target]);
      setMessage(t('ui.compare.added', 'Đã thêm hiện vật vào so sánh.'));
    }
  };
  return { selection, message, toggle, clear: () => { setSelection([]); setMessage(t('ui.compare.cleared', 'Đã xóa lựa chọn so sánh.')); } };
}
