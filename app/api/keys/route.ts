import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyDB, exportKeysToJSON, exportKeysToCSV } from '@/lib/appwrite/database';
import { ApiStatusEnum } from '@/lib/providers/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');

    // Handle export
    if (action === 'export') {
      const format = searchParams.get('format') || 'json';
      const statusFilter = searchParams.get('status');

      let status: ApiStatusEnum | undefined;
      if (statusFilter && statusFilter !== 'all') {
        status = parseInt(statusFilter, 10) as ApiStatusEnum;
      }

      if (format === 'csv') {
        const csv = await exportKeysToCSV(status);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="api-keys.csv"',
          },
        });
      }

      const json = await exportKeysToJSON(status);
      return new NextResponse(json, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="api-keys.json"',
        },
      });
    }

    // Handle statistics
    if (action === 'stats') {
      const stats = await ApiKeyDB.getStatistics();
      return NextResponse.json(stats);
    }

    // Default: list keys
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (status && status !== 'all') {
      const statusEnum = parseInt(status, 10) as ApiStatusEnum;
      const keys = await ApiKeyDB.listByStatus(statusEnum, limit, offset);
      return NextResponse.json({ keys, status: statusEnum });
    }

    // Get all keys with valid status first
    const validKeys = await ApiKeyDB.listByStatus(ApiStatusEnum.Valid, limit, offset);
    return NextResponse.json({ keys: validKeys });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await ApiKeyDB.delete(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
