import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { getJoystickVector, type NavigationInput } from '@/helpers/museumNavigation';
import classes from './NavigationHud.module.css';

export type NavigationMode = 'explore' | 'focusing' | 'inspect';

export function NavigationHud({ input, mode, isActive, hasTouch }: {
  input: NavigationInput; mode: NavigationMode; isActive: boolean; hasTouch: boolean;
}) {
  const [isHelpVisible, setIsHelpVisible] = useState(true);
  const [isPressed, setIsPressed] = useState(false);
  const pointerRef = useRef<number | null>(null);
  const baseRef = useRef<HTMLButtonElement>(null), thumbRef = useRef<HTMLSpanElement>(null);
  const centerRef = useRef({ x: 0, y: 0 });
  const resetRef = useRef<() => void>(() => {});
  const reset = () => {
    const pointer = pointerRef.current; pointerRef.current = null;
    if (pointer !== null && baseRef.current?.hasPointerCapture(pointer)) baseRef.current.releasePointerCapture(pointer);
    input.joystick.x = input.joystick.y = 0;
    if (thumbRef.current) thumbRef.current.style.transform = 'translate(0px, 0px)';
    setIsPressed(false); input.invalidate();
  };
  resetRef.current = reset;
  useEffect(() => {
    const clear = () => resetRef.current();
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('blur', clear); window.addEventListener('resize', clear);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('blur', clear); window.removeEventListener('resize', clear);
      document.removeEventListener('visibilitychange', visibility);
      input.joystick.x = input.joystick.y = 0;
    };
  }, [input]);
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerId !== pointerRef.current) return;
    const dx = event.clientX - centerRef.current.x, dy = event.clientY - centerRef.current.y;
    const vector = getJoystickVector(dx, dy, 38), scale = Math.min(1, 38 / (Math.hypot(dx, dy) || 1));
    input.joystick.x = vector.x; input.joystick.y = vector.y;
    if (thumbRef.current) thumbRef.current.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    input.wake();
  };
  return <div className={classes.hud} data-navigation-mode={mode}>
    <div className={classes.help}>
      <button type="button" onClick={() => setIsHelpVisible(value => !value)} aria-expanded={isHelpVisible} aria-controls="navigation-instructions">
        {isHelpVisible ? 'Ẩn hướng dẫn' : 'Hướng dẫn di chuyển'}
      </button>
      {isHelpVisible && <p id="navigation-instructions">{hasTouch
        ? 'Joystick trái để đi · Vuốt vùng nhìn bên phải để quay · Chạm hiện vật để xem'
        : 'WASD để đi · Giữ và kéo chuột để nhìn · Shift đi nhanh · F tập trung · Home đặt lại'}</p>}
      <span role="status">{mode === 'focusing' ? 'Đang tập trung hiện vật' : mode === 'inspect' ? 'Đang xem hiện vật · Di chuyển để khám phá tiếp'
        : isActive ? 'Sẵn sàng khám phá' : hasTouch ? 'Chạm joystick hoặc vuốt để khám phá' : 'Chọn khung 3D để bắt đầu di chuyển'}</span>
    </div>
    {hasTouch && <button ref={baseRef} type="button" className={classes.joystick} aria-label="Di chuyển bằng joystick" aria-pressed={isPressed}
      onPointerDown={event => {
        event.preventDefault(); event.stopPropagation();
        if (pointerRef.current !== null) return;
        pointerRef.current = event.pointerId;
        const box = event.currentTarget.getBoundingClientRect(); centerRef.current = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        event.currentTarget.setPointerCapture(event.pointerId); setIsPressed(true); move(event);
      }}
      onPointerMove={event => { event.stopPropagation(); move(event); }}
      onPointerUp={event => { event.stopPropagation(); if (pointerRef.current === event.pointerId) reset(); }}
      onPointerCancel={event => { if (pointerRef.current === event.pointerId) reset(); }}
      onLostPointerCapture={event => { if (pointerRef.current === event.pointerId) reset(); }}
      onKeyDown={event => {
        const keys: Record<string, string> = { ArrowUp: 'KeyW', ArrowDown: 'KeyS', ArrowLeft: 'KeyA', ArrowRight: 'KeyD' };
        const key = keys[event.key]; if (key) { event.preventDefault(); input.keys.add(key); input.wake(); }
      }}
      onKeyUp={() => { input.keys.clear(); input.invalidate(); }} onBlur={() => { input.keys.clear(); reset(); }}>
      <span className={classes.cross}>↕<br />↔</span><span ref={thumbRef} className={classes.thumb} />
    </button>}
  </div>;
}
