import { NextResponse } from 'next/server'
import { PRICE, paymentMode } from '@/lib/server/token.ts'

export async function GET() {
  return NextResponse.json({ payments: paymentMode(), price: PRICE })
}
