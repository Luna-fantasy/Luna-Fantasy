export function serveVisualOverlay(
  request: Request,
  params: { id: string; role: string; digest: string },
  env: NodeJS.ProcessEnv,
): Response;
