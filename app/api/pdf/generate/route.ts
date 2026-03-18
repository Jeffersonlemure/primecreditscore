import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateBasicaPFPdf,
  generateBasicaPJPdf,
  generateRatingPFPdf,
  generateRatingPJPdf,
} from '@/lib/pdf-generator'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const consultationId = searchParams.get('id')

    if (!consultationId) {
      return NextResponse.json({ error: 'ID de consulta não informado' }, { status: 400 })
    }

    // Fetch consultation (RLS ensures ownership)
    const { data: consultation, error } = await supabase
      .from('consultations')
      .select('*, consultation_types(*)')
      .eq('id', consultationId)
      .eq('user_id', user.id)
      .single()

    if (error || !consultation) {
      return NextResponse.json({ error: 'Consulta não encontrada' }, { status: 404 })
    }

    const { result_data, consultation_types } = consultation
    const consultationType = (consultation_types as { code: string })?.code

    let pdfBytes: Uint8Array

    switch (consultationType) {
      case 'basica_pf':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfBytes = await generateBasicaPFPdf(result_data as any)
        break
      case 'basica_pj':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfBytes = await generateBasicaPJPdf(result_data as any)
        break
      case 'rating_pf':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfBytes = await generateRatingPFPdf(result_data as any)
        break
      case 'rating_pj':
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pdfBytes = await generateRatingPJPdf(result_data as any)
        break
      default:
        return NextResponse.json({ error: 'Tipo de consulta inválido' }, { status: 400 })
    }

    const docId = consultation.document
    const filename = `primecreditscore-${consultationType}-${docId}-${consultationId.slice(0, 8)}.pdf`

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: unknown) {
    console.error('PDF generation error:', error)
    const message = error instanceof Error ? error.message : 'Erro ao gerar PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
