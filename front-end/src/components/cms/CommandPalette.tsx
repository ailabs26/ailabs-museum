import { Kbd, Modal, ScrollArea, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useHotkeys } from '@mantine/hooks';
import { IconArrowRight, IconSearch } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NavItem } from '@/layouts/adminNav';
import classes from './CommandPalette.module.css';

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');

/**
 * Hộp lệnh toàn cục (Ctrl/Cmd + K): tìm nhanh & chuyển trang quản trị.
 * Lọc theo nhãn + từ khóa (không phân biệt dấu), điều hướng bằng phím mũi tên + Enter.
 */
export function CommandPalette({ items, opened, onOpen, onClose }: {
  items: readonly NavItem[]; opened: boolean; onOpen: () => void; onClose: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useHotkeys([['mod+K', (e) => { e.preventDefault(); onOpen(); }]]);

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return items;
    return items.filter((it) => norm(`${it.label} ${it.keywords ?? ''} ${it.to}`).includes(q));
  }, [items, query]);

  useEffect(() => { setActive(0); }, [query, opened]);

  const go = (item?: NavItem) => {
    const target = item ?? results[active];
    if (!target) return;
    onClose(); setQuery('');
    navigate(target.to);
  };

  return (
    <Modal opened={opened} onClose={() => { onClose(); setQuery(''); }} withCloseButton={false}
      size="lg" padding={0} radius="md" yOffset="12vh" transitionProps={{ transition: 'pop' }}>
      <TextInput
        variant="unstyled" size="md" autoFocus value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        placeholder="Tìm trang, hiện vật, tài khoản… rồi nhấn Enter"
        aria-label="Tìm nhanh trong CMS"
        leftSection={<IconSearch size={18} />}
        className={classes.input}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); go(); }
        }}
      />
      <ScrollArea.Autosize mah={360} type="scroll">
        <div className={classes.list} role="listbox" aria-label="Kết quả">
          {results.length === 0 ? (
            <Text c="dimmed" size="sm" p="md">Không có kết quả cho “{query}”.</Text>
          ) : results.map((it, i) => (
            <UnstyledButton key={it.to} role="option" aria-selected={i === active}
              className={`${classes.item} ${i === active ? classes.itemActive : ''}`}
              onMouseEnter={() => setActive(i)} onClick={() => go(it)}>
              <it.icon size={18} stroke={1.6} />
              <span className={classes.itemLabel}>{it.label}</span>
              <span className={classes.itemPath}>{it.to}</span>
              <IconArrowRight size={15} className={classes.itemGo} />
            </UnstyledButton>
          ))}
        </div>
      </ScrollArea.Autosize>
      <div className={classes.footer}>
        <span><Kbd>↑</Kbd><Kbd>↓</Kbd> di chuyển</span>
        <span><Kbd>Enter</Kbd> mở</span>
        <span><Kbd>Esc</Kbd> đóng</span>
      </div>
    </Modal>
  );
}
