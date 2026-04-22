import { NextResponse } from 'next/server';
import { pollerService } from '@/lib/poller-singleton';

// NOTE: requires Node.js long-running server (Railway, Fly.io)
// Not compatible with Vercel Edge/Serverless functions

export async function GET() {
  // Auto-start poller on first request if not running
  if (!pollerService.isRunning) {
    pollerService.start();
    // We don't await the first fetch here to keep response fast, 
    // unless you want to ensure data is present on first hit.
  }

  const snapshot = pollerService.getSnapshot();
  
  return NextResponse.json(snapshot);
}
