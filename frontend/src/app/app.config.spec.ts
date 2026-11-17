import { DecimalPipe, formatDate } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/api/api-base-url';
import { appConfig } from './app.config';

describe('appConfig (FND-06)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [...appConfig.providers, DecimalPipe] });
  });

  it('provides HttpClient', () => {
    expect(TestBed.inject(HttpClient)).toBeTruthy();
  });

  it('uses /api/v1 as the API base path', () => {
    expect(TestBed.inject(API_BASE_URL)).toBe('/api/v1');
  });

  it('uses the Russian locale for pipes', () => {
    expect(TestBed.inject(LOCALE_ID)).toBe('ru');
    expect(TestBed.inject(DecimalPipe).transform(1234.5)).toBe('1 234,5');
    expect(formatDate('2026-11-20', 'd MMMM y', 'ru')).toBe('20 ноября 2026');
  });
});
