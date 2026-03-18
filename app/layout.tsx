import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PrimeCreditScore - Consultas de Crédito',
  description: 'Sistema profissional de análise de crédito com integração Serasa. Consulte CPF e CNPJ de forma rápida e segura.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
