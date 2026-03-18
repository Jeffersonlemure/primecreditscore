// TypeScript types for PrimeCreditScore

export type ConsultationType = 'basica_pf' | 'basica_pj' | 'rating_pf' | 'rating_pj'
export type UserRole = 'user' | 'admin'
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'OVERDUE' | 'REFUNDED'
export type TransactionType = 'credit_purchase' | 'consultation_debit' | 'admin_adjustment'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  cpf_cnpj: string | null
  credits_balance: number
  basica_balance: number
  rating_balance: number
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ConsultationType_ {
  id: string
  code: ConsultationType
  name: string
  description: string
  credits_cost: number
  is_active: boolean
}

export interface Consultation {
  id: string
  user_id: string
  consultation_type_id: string
  consultation_type?: ConsultationType_
  document: string
  document_type: 'cpf' | 'cnpj'
  result_data: Record<string, unknown>
  credits_used: number
  status: 'success' | 'error'
  error_message: string | null
  created_at: string
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  price: number
  is_active: boolean
  popular?: boolean
}

export interface CreditTransaction {
  id: string
  user_id: string
  type: TransactionType
  amount: number
  balance_before: number
  balance_after: number
  description: string
  reference_id: string | null
  created_at: string
}

export interface PixPayment {
  id: string
  user_id: string
  package_id: string
  asaas_payment_id: string
  status: PaymentStatus
  amount: number
  credits: number
  pix_code: string | null
  pix_qr_url: string | null
  expires_at: string | null
  paid_at: string | null
  created_at: string
}

// Consultation result types
export interface BasicaPFResult {
  tipo: 'basica_pf'
  documento: string
  identificacao: {
    nome: string
    cpf: string
    dataNascimento: string
    sexo: string
    situacaoCpf: string
  }
  status: {
    situacaoReceita: string
    obitos: boolean
    pep: boolean
  }
  anotacoes: {
    totalDividas: number
    valorTotal: number
    itens: Array<{ credor: string; valor: number; data: string; tipo: string }>
  }
  score: {
    pontuacao: number
    faixa: string
    percentilBrasil: number
  }
  participacoes: {
    empresas: Array<{ razaoSocial: string; cnpj: string; participacao: string; dataEntrada: string }>
  }
  consultadoEm: string
}

export interface BasicaPJResult {
  tipo: 'basica_pj'
  documento: string
  identificacao: {
    razaoSocial: string
    nomeFantasia: string
    cnpj: string
    situacaoCadastral: string
    dataAbertura: string
    naturezaJuridica: string
    porte: string
    atividadePrincipal: string
  }
  status: {
    situacaoReceita: string
    dividaAtiva: boolean
  }
  anotacoes: {
    totalDividas: number
    valorTotal: number
    itens: Array<{ credor: string; valor: number; data: string; tipo: string }>
  }
  detalhamento: {
    capitalSocial: number
    socios: Array<{ nome: string; cpf: string; participacao: string; cargo: string }>
    enderecos: Array<{ tipo: string; logradouro: string; bairro: string; cidade: string; uf: string; cep: string }>
  }
  consultadoEm: string
}

export interface RatingPFResult extends Omit<BasicaPFResult, 'tipo'> {
  tipo: 'rating_pf'
  renda: {
    rendaEstimada: number
    faixaRenda: string
    fonteRenda: string
  }
  capacidadePagamento: {
    limiteRecomendado: number
    comprometimentoRenda: number
    probabilidadeInadimplencia: number
    classificacaoRisco: string
  }
  historicoPagamentos: {
    pontualidade: number
    pagamentosEmDia: number
    pagamentosAtrasados: number
  }
}

export interface RatingPJResult {
  tipo: 'rating_pj'
  documento: string
  identificacao: {
    razaoSocial: string
    cnpj: string
    situacaoCadastral: string
    dataAbertura: string
  }
  anotacoes: {
    totalDividas: number
    valorTotal: number
    itens: Array<{ credor: string; valor: number; data: string; tipo: string }>
  }
  score: { pontuacao: number; faixa: string; percentilBrasil: number }
  risco: { classificacao: string; probabilidadeInadimplencia: number; rating: string }
  faturamento: { estimativaAnual: number; faixa: string }
  limiteCredito: { recomendado: number; emUso: number; disponivel: number }
  socios: Array<{ nome: string; cpf: string; participacao: string; cargo: string; scoreIndividual: number }>
  consultadoEm: string
}
