import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  consultarBasicaPF,
  consultarBasicaPJ,
  consultarRatingPF,
  consultarRatingPJ,
} from '@/lib/target-api'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { consultationType, document } = body

    if (!consultationType || !document) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
    }

    console.log('Execute Consulta API -> type:', consultationType, 'doc:', document, 'user:', user.id)

    // Get consultation type details (cost)
    const { data: typeData, error: typeError } = await supabase
      .from('consultation_types')
      .select('*')
      .eq('code', consultationType)
      .eq('is_active', true)
      .single()

    if (typeError || !typeData) {
      console.error('Execute Consulta API -> typeError:', typeError, 'typeData:', typeData)
      return NextResponse.json({ error: 'Tipo de consulta inválido' }, { status: 400 })
    }

    // Get user profile with credits and packages
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits_balance, basica_balance, rating_balance, is_active, role')
      .eq('id', user.id)
      .single()

    if (!profile?.is_active) {
      return NextResponse.json({ error: 'Conta inativa' }, { status: 403 })
    }

    let hasBalance = false
    if (profile?.role === 'admin') {
      hasBalance = true // Admin tem consultas ilimitadas
    } else if (consultationType === 'basica_pf' || consultationType === 'basica_pj') {
      hasBalance = (profile?.basica_balance || 0) >= 1 || (profile?.credits_balance || 0) >= 10
    } else if (consultationType === 'rating_pf' || consultationType === 'rating_pj') {
      hasBalance = (profile?.rating_balance || 0) >= 1 || (profile?.credits_balance || 0) >= 50
    }

    if (!hasBalance) {
      return NextResponse.json({ error: 'Saldo insuficiente. Compre pacotes ou créditos adicionais.' }, { status: 402 })
    }

    // Execute consultation via Target API
    let result
    const cleanDoc = document.replace(/\D/g, '')

    switch (consultationType) {
      case 'basica_pf':
        result = await consultarBasicaPF(cleanDoc)
        break
      case 'basica_pj':
        result = await consultarBasicaPJ(cleanDoc)
        break
      case 'rating_pf':
        result = await consultarRatingPF(cleanDoc)
        break
      case 'rating_pj':
        result = await consultarRatingPJ(cleanDoc)
        break
      default:
        return NextResponse.json({ error: 'Tipo não suportado' }, { status: 400 })
    }

    const adminClient = await createAdminClient()

    // Debit atomically using new RPC only if NOT admin
    if (profile?.role !== 'admin') {
      const { error: debitError } = await adminClient.rpc('consume_consultation', {
        p_user_id: user.id,
        p_consultation_type: consultationType,
        p_description: `Consulta ${typeData.name}`,
      })

      if (debitError) {
        return NextResponse.json({ error: 'Erro ao debitar saldo' }, { status: 500 })
      }
    }

    // Save consultation record
    const docType = ['basica_pf', 'rating_pf'].includes(consultationType) ? 'cpf' : 'cnpj'
    const { data: consultation, error: saveError } = await adminClient
      .from('consultations')
      .insert({
        user_id: user.id,
        consultation_type_id: typeData.id,
        document: cleanDoc,
        document_type: docType,
        result_data: result.data,
        credits_used: profile?.role === 'admin' ? 0 : typeData.credits_cost,
        status: result.success ? 'success' : 'error',
        error_message: result.success ? null : result.error,
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving consultation:', saveError)
    }

    return NextResponse.json({
      success: true,
      consultationId: consultation?.id,
      data: result.data,
    })
  } catch (error: unknown) {
    console.error('Consultation error:', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
