import { LockKey } from '@phosphor-icons/react';
import type { PrivacyLevel } from '../types';

export const PrivacyBadge = ({ level }: { level: PrivacyLevel }) => (
  <span className={`privacy-badge privacy-badge--${level}`}><LockKey size={12} weight="light" />{level}</span>
);
