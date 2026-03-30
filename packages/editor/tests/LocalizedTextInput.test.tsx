import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LocalizedTextInput } from '../src/components/shared/LocalizedTextInput';

describe('LocalizedTextInput', () => {
  const defaultValue = { ko: '한국어 텍스트', en: 'English text' };

  it('renders without crashing', () => {
    render(<LocalizedTextInput value={defaultValue} onChange={() => {}} />);
    expect(screen.getByText('KO')).toBeTruthy();
    expect(screen.getByText('EN')).toBeTruthy();
  });

  it('renders label when provided', () => {
    render(<LocalizedTextInput value={defaultValue} onChange={() => {}} label="제목" />);
    expect(screen.getByText('제목')).toBeTruthy();
  });

  it('does not render label element when label is not provided', () => {
    const { container } = render(<LocalizedTextInput value={defaultValue} onChange={() => {}} />);
    const label = container.querySelector('label');
    expect(label).toBeNull();
  });

  it('shows KO tab content by default', () => {
    render(<LocalizedTextInput value={defaultValue} onChange={() => {}} />);
    const input = screen.getByDisplayValue('한국어 텍스트');
    expect(input).toBeTruthy();
  });

  it('switches to EN tab on click', () => {
    render(<LocalizedTextInput value={defaultValue} onChange={() => {}} />);
    const enButton = screen.getByText('EN');
    fireEvent.click(enButton);
    const input = screen.getByDisplayValue('English text');
    expect(input).toBeTruthy();
  });

  it('switches back to KO tab on click', () => {
    render(<LocalizedTextInput value={defaultValue} onChange={() => {}} />);
    fireEvent.click(screen.getByText('EN'));
    fireEvent.click(screen.getByText('KO'));
    const input = screen.getByDisplayValue('한국어 텍스트');
    expect(input).toBeTruthy();
  });

  it('calls onChange with updated KO value when typing in KO tab', () => {
    const handleChange = vi.fn();
    render(<LocalizedTextInput value={defaultValue} onChange={handleChange} />);
    const input = screen.getByDisplayValue('한국어 텍스트');
    fireEvent.change(input, { target: { value: '새 텍스트' } });
    expect(handleChange).toHaveBeenCalledWith({ ko: '새 텍스트', en: 'English text' });
  });

  it('calls onChange with updated EN value when typing in EN tab', () => {
    const handleChange = vi.fn();
    render(<LocalizedTextInput value={defaultValue} onChange={handleChange} />);
    fireEvent.click(screen.getByText('EN'));
    const input = screen.getByDisplayValue('English text');
    fireEvent.change(input, { target: { value: 'New text' } });
    expect(handleChange).toHaveBeenCalledWith({ ko: '한국어 텍스트', en: 'New text' });
  });

  it('renders textarea when multiline=true', () => {
    const { container } = render(
      <LocalizedTextInput value={defaultValue} onChange={() => {}} multiline />
    );
    const textarea = container.querySelector('textarea');
    expect(textarea).not.toBeNull();
  });

  it('renders input when multiline=false (default)', () => {
    const { container } = render(
      <LocalizedTextInput value={defaultValue} onChange={() => {}} />
    );
    const input = container.querySelector('input[type="text"]');
    expect(input).not.toBeNull();
  });

  it('shows warning indicator on KO tab when required and KO is empty', () => {
    const emptyValue = { ko: '', en: 'English text' };
    render(<LocalizedTextInput value={emptyValue} onChange={() => {}} required />);
    // The KO button should contain a warning span
    const koButton = screen.getByText('KO', { exact: false });
    expect(koButton.textContent).toContain('⚠');
  });

  it('shows warning indicator on EN tab when required and EN is empty', () => {
    const emptyValue = { ko: '한국어', en: '' };
    render(<LocalizedTextInput value={emptyValue} onChange={() => {}} required />);
    // Switch to EN tab to verify the button shows warning
    const enButton = screen.getByText('EN', { exact: false });
    expect(enButton.textContent).toContain('⚠');
  });

  it('does not show warning indicator when not required', () => {
    const emptyValue = { ko: '', en: '' };
    const { container } = render(
      <LocalizedTextInput value={emptyValue} onChange={() => {}} />
    );
    const warnings = container.querySelectorAll('span');
    // None of the spans should contain the warning icon (there are none unless required)
    const warningSpans = Array.from(warnings).filter(s => s.textContent === '⚠');
    expect(warningSpans).toHaveLength(0);
  });

  it('renders placeholder text when provided for single-line input', () => {
    render(
      <LocalizedTextInput
        value={{ ko: '', en: '' }}
        onChange={() => {}}
        placeholder={{ ko: '한국어 입력', en: 'Enter English' }}
      />
    );
    const input = screen.getByPlaceholderText('한국어 입력');
    expect(input).toBeTruthy();
  });

  it('renders placeholder for EN tab', () => {
    render(
      <LocalizedTextInput
        value={{ ko: '', en: '' }}
        onChange={() => {}}
        placeholder={{ ko: '한국어 입력', en: 'Enter English' }}
      />
    );
    fireEvent.click(screen.getByText('EN'));
    const input = screen.getByPlaceholderText('Enter English');
    expect(input).toBeTruthy();
  });

  it('calls onChange through textarea for multiline input', () => {
    const handleChange = vi.fn();
    render(
      <LocalizedTextInput value={defaultValue} onChange={handleChange} multiline />
    );
    const textarea = screen.getByDisplayValue('한국어 텍스트');
    fireEvent.change(textarea, { target: { value: '멀티라인 텍스트' } });
    expect(handleChange).toHaveBeenCalledWith({ ko: '멀티라인 텍스트', en: 'English text' });
  });
});
