import { NextResponse } from 'next/server';
import { createVerifierService } from '@/lib/services/verifier';

export async function POST() {
  try {
    const verifier = createVerifierService();
    const result = await verifier.runVerificationCycle();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { status: 'error', error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const verifier = createVerifierService();
    const status = await verifier.getStatus();
    return NextResponse.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
