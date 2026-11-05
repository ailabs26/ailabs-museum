import { useState } from 'react';
import { isSameExhibit } from '@/helpers/visitorState';
import type { VisitorExhibitRef } from '@/helpers/visitorState';

const MESSAGES = {
  removed: ['ui.visitor.compare.message.removed', 'Đã bỏ hiện vật khỏi so sánh.'],
  maximum: ['ui.visitor.compare.message.maximum', 'Tối đa 3 hiện vật. Hãy bỏ một lựa chọn trước khi thêm.'],
  added: ['ui.visitor.compare.message.added', 'Đã thêm hiện vật vào so sánh.'],
  cleared: ['ui.visitor.compare.message.cleared', 'Đã xóa lựa chọn so sánh.'],
} as const;

export function useExhibitComparison(t: (key: string, fallback: string) => string) {
  const [selection, setSelection] = useState<VisitorExhibitRef[]>([]);
  const [messageKey, setMessageKey] = useState<keyof typeof MESSAGES | null>(null);
  const message = messageKey ? t(MESSAGES[messageKey][0], MESSAGES[messageKey][1]) : '';
  const toggle = (target: VisitorExhibitRef) => {
    if (selection.some(ref => isSameExhibit(ref, target))) {
      setSelection(selection.filter(ref => !isSameExhibit(ref, target)));
      setMessageKey('removed');
    } else if (selection.length === 3) {
      setMessageKey('maximum');
    } else {
      setSelection([...selection, target]);
      setMessageKey('added');
    }
  };
  return { selection, message, toggle, clear: () => { setSelection([]); setMessageKey('cleared'); } };
}
