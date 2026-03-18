import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createPixPayment } from '@/lib/asaas'

const ALLOWED_PACKAGES = [
  { id: 'pacote_basica', name: 'Pacote 10 Consultas Básicas', credits: 10, price: 68.00 },
  { id: 'pacote_rating', name: 'Pacote 3 Consultas Rating', credits: 15, price: 119.70 },
  { id: 'credito_10', name: '10 Créditos', credits: 10, price: 10.00 },
  { id: 'credito_30', name: '30 Créditos', credits: 30, price: 30.00 },
  { id: 'credito_50', name: '50 Créditos', credits: 50, price: 50.00 },
  { id: 'credito_80', name: '80 Créditos', credits: 80, price: 80.00 },
  { id: 'credito_120', name: '120 Créditos', credits: 120, price: 120.00 },
]

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { packageId } = body

    if (!packageId) {
      return NextResponse.json({ error: 'Pacote não informado' }, { status: 400 })
    }

    const pkg = ALLOWED_PACKAGES.find(p => p.id === packageId)
    if (!pkg) {
      return NextResponse.json({ error: 'Pacote inválido' }, { status: 400 })
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, cpf_cnpj')
      .eq('id', user.id)
      .single()

    // Create PIX payment via Asaas
    const pixPayment = await createPixPayment({
      customer: {
        name: profile?.full_name || user.email || 'Cliente',
        cpfCnpj: profile?.cpf_cnpj || '00000000000',
        email: user.email || '',
      },
      value: pkg.price,
      description: `PrimeCreditScore - ${pkg.name} (${pkg.credits} créditos)`,
      externalReference: `${user.id}:${packageId}`,
    })

    // Save payment record
    const adminClient = await createAdminClient()
    const { data: payment } = await adminClient
      .from('pix_payments')
      .insert({
        user_id: user.id,
        package_id: packageId,
        asaas_payment_id: pixPayment.id,
        status: 'PENDING',
        amount: pkg.price,
        credits: pkg.credits,
        pix_code: pixPayment.pixCode,
        pix_qr_url: pixPayment.pixQrCodeUrl,
        expires_at: pixPayment.expiresAt,
      })
      .select()
      .single()

    return NextResponse.json({
      success: true,
      paymentId: payment?.id,
      asaasPaymentId: pixPayment.id,
      pixCode: pixPayment.pixCode,
      pixQrCodeUrl: pixPayment.pixQrCodeUrl,
      expiresAt: pixPayment.expiresAt,
      amount: pkg.price,
      credits: pkg.credits,
    })
  } catch (error: unknown) {
    console.error('Payment creation error:', error)
    const message = error instanceof Error ? error.message : 'Erro ao criar pagamento'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
