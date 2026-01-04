import { NextRequest, NextResponse } from 'next/server';
import { createVerifierService } from '@/lib/services/verifier';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    const verifier = createVerifierService();

    // If keyId is provided, verify single key
    if (keyId) {
      const result = await verifier.verifySingleKey(keyId);
      return NextResponse.json(result);
    }

    // Otherwise run full verification cycle
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    const verifier = createVerifierService();

    if (action === 'status') {
      const status = await verifier.getStatus();
      return NextResponse.json(status);
    }

    // Default: return status
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
