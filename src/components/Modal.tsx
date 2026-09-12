import { X } from '@phosphor-icons/react';
import { useEffect, type PropsWithChildren } from 'react';

interface ModalProps extends PropsWithChildren {
  open: boolean;
  onClose: () => void;
  title?: string;
  wide?: boolean;
  className?: string;
}

export const Modal = ({ open, onClose, title, wide, className = '', children }: ModalProps) => {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    document.body.classList.add('is-modal-open');
    return () => {
      window.removeEventListener('keydown', close);
      document.body.classList.remove('is-modal-open');
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="modal-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal-shell ${wide ? 'modal-shell--wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-core">
          {title && <header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} weight="light" /></button></header>}
          {children}
        </div>
      </section>
    </div>
  );
};
