import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { middleware } from '../middleware';

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => { throw new Error('Portal authentication reached'); }),
}));

beforeEach(() => vi.clearAllMocks());

describe('public webinar access without portal credentials', () => {
  it.each([
    '/webinar', '/webinar/thank-you',
    '/media/webinar/marc-webinar-thank-you-vsl.mp4',
    '/media/webinar/marc-webinar-thank-you-vsl.en-GB.vtt',
    '/api/webinar/calendar',
  ])('serves %s without initializing portal authentication', async (path) => {
    const response = await middleware(new NextRequest(`https://preview.vercel.app${path}`));
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it.each(['/portal', '/admin', '/api/admin/clients', '/api/portal/growth-engine', '/webinar-private'])('preserves the authentication path for %s', async (path) => {
    await expect(middleware(new NextRequest(`https://preview.vercel.app${path}`)))
      .rejects.toThrow('Portal authentication reached');
    expect(createServerClient).toHaveBeenCalledOnce();
  });
});
