import { NextResponse } from 'next/server';
import { getSiteTabs, TAB_KEYS } from '@/lib/admin/site-tabs';

export const dynamic = 'force-dynamic';

export async function GET() {
    const tabs = await getSiteTabs();
    const closed = TAB_KEYS.filter(k => tabs[k]?.closed);
    return NextResponse.json({ closed }, {
        headers: { 'Cache-Control': 'no-store, max-age=0' },
    });
}
