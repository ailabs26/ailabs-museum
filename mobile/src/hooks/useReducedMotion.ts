import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Theo dõi cài đặt "Giảm chuyển động" của hệ điều hành — MOB-E11-04.
 * Trả `true` khi người dùng bật reduce motion; component dùng để tắt animation.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => {
        // Không chặn UI nếu API lỗi; mặc định không giảm motion.
      });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
