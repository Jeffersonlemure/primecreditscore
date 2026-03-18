// Asaas PIX Payment Integration
import axios from 'axios'

const BASE_URL = process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api/v3'
const API_KEY = process.env.ASAAS_API_KEY || ''

const asaas = axios.create({
  baseURL: BASE_URL,
  headers: {
    'access_token': API_KEY,
    'Content-Type': 'application/json',
  },
})

export interface CreatePixPaymentParams {
  customer: {
    name: string
    cpfCnpj: string
    email: string
  }
  value: number
  description: string
  externalReference: string // e.g. "user_id:package_id"
}

export interface PixPaymentResult {
  id: string
  status: string
  value: number
  pixCode: string
  pixQrCodeUrl: string
  expiresAt: string
}

export async function createOrFindCustomer(name: string, cpfCnpj: string, email: string) {
  try {
    // Check if customer exists
    const search = await asaas.get('/customers', { params: { cpfCnpj } })
    if (search.data.data && search.data.data.length > 0) {
      return search.data.data[0].id
    }
  } catch {}

  // Create new customer
  const response = await asaas.post('/customers', { name, cpfCnpj, email })
  return response.data.id
}

export async function createPixPayment(params: CreatePixPaymentParams): Promise<PixPaymentResult> {
  const customerId = await createOrFindCustomer(
    params.customer.name,
    params.customer.cpfCnpj,
    params.customer.email
  )

  const paymentResponse = await asaas.post('/payments', {
    customer: customerId,
    billingType: 'PIX',
    value: params.value,
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    description: params.description,
    externalReference: params.externalReference,
  })

  const payment = paymentResponse.data

  // Get PIX QR Code
  const pixResponse = await asaas.get(`/payments/${payment.id}/pixQrCode`)
  
  return {
    id: payment.id,
    status: payment.status,
    value: payment.value,
    pixCode: pixResponse.data.payload,
    pixQrCodeUrl: pixResponse.data.encodedImage,
    expiresAt: pixResponse.data.expirationDate,
  }
}

export async function getPaymentStatus(paymentId: string) {
  const response = await asaas.get(`/payments/${paymentId}`)
  return {
    id: response.data.id,
    status: response.data.status,
    value: response.data.value,
    paidAt: response.data.paymentDate,
  }
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  // Asaas uses access_token for webhook validation - simplistic check
  return true // Configure with actual signature in production
}
