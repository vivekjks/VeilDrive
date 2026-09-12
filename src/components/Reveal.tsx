import { useEffect, useRef, useState, type CSSProperties, type PropsWithChildren } from 'react';

export const Reveal = ({ children, delay = 0, className = '' }: PropsWithChildren<{ delay?: number; className?: string }>) => {
  const reference = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = reference.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && setVisible(true), { threshold: 0.12 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={reference} className={`reveal ${visible ? 'is-visible' : ''} ${className}`} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>{children}</div>;
};
