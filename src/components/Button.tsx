import type { ButtonHTMLAttributes, PropsWithChildren, ReactNode } from 'react';
import { ArrowUpRight } from '@phosphor-icons/react';

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  tone?: 'primary' | 'secondary' | 'danger' | 'quiet';
  trailing?: ReactNode | false;
};

export const Button = ({ children, className = '', tone = 'secondary', trailing, ...props }: ButtonProps) => (
  <button className={`button button--${tone} ${className}`} {...props}>
    <span>{children}</span>
    {trailing !== false && (
      <span className="button__island" aria-hidden="true">
        {trailing ?? <ArrowUpRight size={15} weight="light" />}
      </span>
    )}
  </button>
);
