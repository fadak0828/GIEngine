import { useEffect } from 'react';

/**
 * Outside-click + ESC 공유 훅.
 * ref 외부 클릭 또는 ESC 키 입력 시 onClose를 호출합니다.
 * isOpen=false 시 이벤트 리스너를 등록하지 않습니다.
 */
export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  isOpen: boolean,
): void {
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [ref, onClose, isOpen]);
}
