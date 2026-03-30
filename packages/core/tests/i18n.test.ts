import { describe, it, expect } from 'vitest';
import { I18nManager } from '../src/i18n/i18n.js';

describe('I18nManager', () => {
  it('현재 로케일 텍스트 반환', () => {
    const i18n = new I18nManager('ko');
    expect(i18n.resolveText({ ko: '안녕', en: 'Hello' })).toBe('안녕');
  });

  it('영어 로케일 텍스트 반환', () => {
    const i18n = new I18nManager('en');
    expect(i18n.resolveText({ ko: '안녕', en: 'Hello' })).toBe('Hello');
  });

  it('현재 로케일 누락 시 폴백', () => {
    const i18n = new I18nManager('en', 'ko');
    expect(i18n.resolveText({ ko: '안녕', en: '' })).toBe('안녕');
  });

  it('setLocale로 언어 변경', () => {
    const i18n = new I18nManager('ko');
    i18n.setLocale('en');
    expect(i18n.getLocale()).toBe('en');
    expect(i18n.resolveText({ ko: '안녕', en: 'Hello' })).toBe('Hello');
  });

  it('엔진 내장 텍스트 키 해석', () => {
    const i18n = new I18nManager('ko');
    expect(i18n.resolveKey('ui.validate')).toBe('확인');
    expect(i18n.resolveKey('ui.back')).toBe('돌아가기');
  });

  it('영어 엔진 텍스트', () => {
    const i18n = new I18nManager('en');
    expect(i18n.resolveKey('ui.validate')).toBe('Check');
  });

  it('알 수 없는 키 → 키 자체 반환', () => {
    const i18n = new I18nManager('ko');
    expect(i18n.resolveKey('ui.unknown_key')).toBe('ui.unknown_key');
  });
});
