import { serveVisualOverlay } from '@/lib/cinematic/v19-visual-overlay.cjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request, { params }: { params: { id: string; role: string; digest: string } }) {
  return serveVisualOverlay(request, params, process.env);
}
