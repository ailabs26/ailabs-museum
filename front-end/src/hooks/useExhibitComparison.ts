import { useState } from 'react';
import { isSameExhibit } from '@/helpers/visitorState';
import type { VisitorExhibitRef } from '@/helpers/visitorState';

export function useExhibitComparison() {
  const [selection, setSelection] = useState<VisitorExhibitRef[]>([]);
  const [message, setMessage] = useState('');
  const toggle = (target: VisitorExhibitRef) => {
    if (selection.some(ref => isSameExhibit(ref, target))) {
      setSelection(selection.filter(ref => !isSameExhibit(ref, target)));
      setMessage('Đã bỏ hiện vật khỏi so sánh.');
    } else if (selection.length === 3) {
      setMessage('Tối đa 3 hiện vật. Hãy bỏ một lựa chọn trước khi thêm.');
    } else {
      setSelection([...selection, target]);
      setMessage('Đã thêm hiện vật vào so sánh.');
    }
  };
  return { selection, message, toggle, clear: () => { setSelection([]); setMessage('Đã xóa lựa chọn so sánh.'); } };
}
