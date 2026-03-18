import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { event, payment } = body

    // Only process confirmed payments
    if (event !== 'PAYMENT_RECEIVED' && event !== 'PAYMENT_CONFIRMED') {
      return NextResponse.json({ received: true })
    }

    const asaasPaymentId = payment?.id
    if (!asaasPaymentId) {
      return NextResponse.json({ error: 'Payment ID missing' }, { status: 400 })
    }

    const adminClient = await createAdminClient()

    // Find the payment record
    const { data: pixPayment, error: findError } = await adminClient
      .from('pix_payments')
      .select('*')
      .eq('asaas_payment_id', asaasPaymentId)
      .single()

    if (findError || !pixPayment) {
      console.error('Payment not found:', asaasPaymentId)
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    // Idempotency check
    if (pixPayment.status === 'CONFIRMED' || pixPayment.status === 'RECEIVED') {
      return NextResponse.json({ received: true, message: 'Already processed' })
    }

    // Update payment status
    await adminClient
      .from('pix_payments')
      .update({
        status: 'CONFIRMED',
        paid_at: new Date().toISOString(),
      })
      .eq('id', pixPayment.id)

    // Credit user balance
    let creditError;

    if (pixPayment.package_id === 'pacote_basica') {
      const { error } = await adminClient.rpc('add_package_balance', {
        p_user_id: pixPayment.user_id,
        p_package_type: 'basica',
        p_amount: pixPayment.credits,
        p_description: `Compra via PIX - Pacote Básica (${pixPayment.credits} consultas)`,
        p_reference_id: pixPayment.id,
      })
      creditError = error;
    } else if (pixPayment.package_id === 'pacote_rating') {
      const { error } = await adminClient.rpc('add_package_balance', {
        p_user_id: pixPayment.user_id,
        p_package_type: 'rating',
        p_amount: pixPayment.credits,
        p_description: `Compra via PIX - Pacote Rating (${pixPayment.credits} consultas)`,
        p_reference_id: pixPayment.id,
      })
      creditError = error;
    } else {
      const { error } = await adminClient.rpc('credit_credits', {
        p_user_id: pixPayment.user_id,
        p_amount: pixPayment.credits,
        p_description: `Compra via PIX - ${pixPayment.credits} créditos`,
        p_reference_id: pixPayment.id,
      })
      creditError = error;
    }

    if (creditError) {
      console.error('Error crediting user:', creditError)
      return NextResponse.json({ error: 'Error updating balance' }, { status: 500 })
    }

    console.log(`Payment confirmed: ${asaasPaymentId} → ${pixPayment.package_id} (${pixPayment.credits}) for user ${pixPayment.user_id}`)

    return NextResponse.json({ received: true, success: true })
  } catch (error: unknown) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
