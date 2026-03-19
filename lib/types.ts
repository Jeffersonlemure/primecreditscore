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

// ─── Annotation Detail Types ─────────────────────────────────────────────────

export interface ResumoAnotacao {
  tipo: string
  quantidade: number
  periodo: string       // "DD/MM/AAAA a DD/MM/AAAA" or "-"
  valor: number
  maisRecente: string   // date string or "-"
}

export interface PefinDetalhe {
  contrato: string
  modalidade: string
  empresa: string
  data: string
  valor: number
  avalista: string
  local: string
}

export interface ProtestoDetalhe {
  cartorio: string
  cidade: string
  uf: string
  data: string
  valor: number
}

export interface AcaoJudicialDetalhe {
  natureza: string
  distribuidor: string
  vara: string
  cidade: string
  uf: string
  data: string
  valor: number
}

// ─── Partnership ─────────────────────────────────────────────────────────────

export interface Participacao {
  razaoSocial: string
  cnpj: string
  participacao: string   // e.g. "100%"
  uf: string
  statusCnpj: string     // e.g. "SITUACAO DO CNPJ EM 12/07/2025: ATIVA"
  desde: string          // entryDate
  ultimaAtualizacao: string
}

// ─── Consultation result types ────────────────────────────────────────────────

export interface AnotacoesData {
  resumo: ResumoAnotacao[]
  pefin: PefinDetalhe[]
  refin: PefinDetalhe[]
  protestos: ProtestoDetalhe[]
  acoesJudiciais: AcaoJudicialDetalhe[]
}

export interface BasicaPFResult {
  tipo: 'basica_pf'
  documento: string
  identificacao: {
    nome: string
    cpf: string
    dataNascimento: string
    nomeMae: string
    situacaoCpf: string
  }
  anotacoes: AnotacoesData
  score: {
    pontuacao: number
    chancePagamento: number   // percentile = "XX% Chance de Pagamento"
  }
  participacoes: Participacao[]
  consultadoEm: string
}

export interface BasicaPJResult {
  tipo: 'basica_pj'
  documento: string
  identificacao: {
    razaoSocial: string
    cnpj: string
    dataFundacao: string
    uf: string
    municipio: string
    situacaoCnpj: string
  }
  anotacoes: AnotacoesData
  score: {
    pontuacao: number         // 0-1000 or 0 means "Default"
    risco: string             // "IMINENTE" | "ALTO" | "MÉDIO" | "BAIXO" | "MÍNIMO"
    probabilidadeInadimplencia: number
    praticasMercado: string
    interpretacao: string
  }
  faturamento: number         // annualEstimation
  socios: Array<{ documento: string; nome: string; participacao: string }>
  administradores: Array<{ documento: string; nome: string; cargo: string }>
  consultadoEm: string
}

export interface RatingPFResult {
  tipo: 'rating_pf'
  documento: string
  identificacao: {
    nome: string
    cpf: string
    dataNascimento: string
    nomeMae: string
    situacaoCpf: string
  }
  anotacoes: AnotacoesData
  score: {
    pontuacao: number
    chancePagamento: number
  }
  participacoes: Participacao[]
  renda: { min: number; max: number }
  capacidadePagamento: { min: number; max: number }
  consultadoEm: string
}

export interface RatingPJResult {
  tipo: 'rating_pj'
  documento: string
  identificacao: {
    razaoSocial: string
    cnpj: string
    dataFundacao: string
    uf: string
    municipio: string
    situacaoCnpj: string
  }
  anotacoes: AnotacoesData
  score: {
    pontuacao: number
    probabilidadeInadimplencia: number
    risco: string
    praticasMercado: string
    interpretacao: string
  }
  faturamento: number
  limiteCredito: number
  socios: Array<{ documento: string; nome: string; participacao: string }>
  administradores: Array<{ documento: string; nome: string; cargo: string }>
  consultadoEm: string
}
