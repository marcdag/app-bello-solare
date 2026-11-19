import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/server';

// Volta dos links de e-mail (confirmação de conta e nova senha)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const next = req.nextUrl.searchParams.get('next') ?? '/';
  const destino = next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (code) {
    const sb = await supabaseServidor();
    await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(destino, req.url));
}
