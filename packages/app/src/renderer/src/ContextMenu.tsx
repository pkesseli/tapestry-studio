import { useEffect, useRef } from 'react';

/** One entry of a menu. */
export interface MenuItem {
  label: string;
  /** Called when the entry is chosen; the menu closes first. */
  onSelect(): void;
  /** Shown but not choosable (for example "Parenthetical" when the cursor is not in a spoken line). */
  disabled?: boolean;
  /** Styled as destructive. */
  danger?: boolean;
  /** Draws a divider above the entry. */
  separatorBefore?: boolean;
}

/** Properties of {@link ContextMenu}. */
interface ContextMenuProps {
  /** Screen position of the top-left corner (viewport coordinates). */
  x: number;
  y: number;
  /** What the menu is for, read out by screen readers. */
  label: string;
  items: readonly MenuItem[];
  onClose(): void;
}

/** Rough size of the menu, used to keep it inside the window. */
const MENU_WIDTH = 280;
const ITEM_HEIGHT = 40;

/**
 * A small menu that opens at a point: used for right-click menus and for the Insert button. Opens with the first
 * choosable entry focused, moves with the arrow keys, and closes with Escape, a click elsewhere, or scrolling.
 */
export function ContextMenu({ x, y, label, items, onClose }: ContextMenuProps) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    box.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const close = (event: Event) => {
      if (!box.current?.contains(event.target as Node)) onClose();
    };
    const closeNow = () => onClose();
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('scroll', closeNow, true);
    window.addEventListener('blur', closeNow);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('scroll', closeNow, true);
      window.removeEventListener('blur', closeNow);
    };
  }, [onClose]);

  /** Moves the focus to the next or previous choosable entry. */
  const move = (step: 1 | -1) => {
    const buttons = [
      ...(box.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []),
    ];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(at + step + buttons.length) % buttons.length]?.focus();
  };

  const left = Math.max(8, Math.min(x, window.innerWidth - MENU_WIDTH - 8));
  const top = Math.max(8, Math.min(y, window.innerHeight - items.length * ITEM_HEIGHT - 24));

  return (
    <div
      ref={box}
      className="context-menu"
      role="menu"
      aria-label={label}
      style={{ left, top, width: MENU_WIDTH }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          move(1);
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          move(-1);
        }
      }}
    >
      {items.map((item) => (
        <div key={item.label}>
          {item.separatorBefore && <hr />}
          <button
            type="button"
            role="menuitem"
            className={item.danger ? 'danger' : undefined}
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onSelect();
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
