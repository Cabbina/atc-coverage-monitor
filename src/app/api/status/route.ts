import { NextResponse } from 'next/server';
import { pollerService } from '@/lib/poller-singleton';

export async function GET() {
  const status = pollerService.getStatus();
  
  return NextResponse.json(status);
}
