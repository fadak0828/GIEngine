import type React from 'react';

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  fontSize: 12,
  background: 'var(--bg-card)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 3,
  outline: 'none',
  boxSizing: 'border-box',
};

export const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 6,
};

export const smallBtnStyle: React.CSSProperties = {
  padding: '3px 8px',
  fontSize: 11,
  background: 'var(--bg-card)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: 3,
  cursor: 'pointer',
};

export const dangerBtnStyle: React.CSSProperties = {
  ...smallBtnStyle,
  color: '#ef4444',
  borderColor: '#ef4444',
};

export const cardStyle: React.CSSProperties = {
  padding: 8,
  background: 'var(--bg-primary)',
  borderRadius: 4,
  border: '1px solid var(--border-color)',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
