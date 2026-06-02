import { NextResponse } from 'next/server'
import { openApiSpec } from '@/lib/openapi'

/** GET /api/docs — Retorna o spec OpenAPI 3.0 em JSON */
export function GET() {
  return NextResponse.json(openApiSpec)
}
