import { NextResponse } from 'next/server';
import { aiImagesEnabled } from '@/lib/server/openai';

export const dynamic = 'force-dynamic';

// Tells the app which optional features the server has keys for.
export async function GET() {
  return NextResponse.json({ ai_images: aiImagesEnabled() });
}
