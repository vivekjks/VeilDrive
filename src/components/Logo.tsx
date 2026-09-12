import { Link } from 'react-router-dom';

export const Logo = ({ compact = false }: { compact?: boolean }) => (
  <Link to="/drive" className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="VeilDrive home">
    <img src="/veil-mark.svg" alt="" className="brand__mark" />
    {!compact && <span>VeilDrive</span>}
  </Link>
);
