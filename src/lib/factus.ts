/**
 * Factus API - Facturación Electrónica Colombia
 * Integración con la API de Factus para emitir facturas electrónicas ante la DIAN
 */

const FACTUS_API_URL = process.env.FACTUS_API_URL || 'https://api-sandbox.factus.com.co'
const FACTUS_CLIENT_ID = process.env.FACTUS_CLIENT_ID || 'a1286a3f-36a5-41c0-a1e5-f19fec9ddf71'
const FACTUS_CLIENT_SECRET = process.env.FACTUS_CLIENT_SECRET || 'NhBhmO2FUdbXQ28JUy3Xq1oypsZSv3qeEgamHi3y'
const FACTUS_USERNAME = process.env.FACTUS_USERNAME || 'sandbox@factus.com.co'
const FACTUS_PASSWORD = process.env.FACTUS_PASSWORD || 'sandbox2024%'

// Cache del token
let cachedToken: string | null = null
let tokenExpiry: number = 0

/**
 * Obtener token de autenticación de Factus (OAuth2 password grant)
 */
export async function getFactusToken(): Promise<string> {
  // Retornar token cacheado si aún es válido (con 5 min de margen)
  if (cachedToken && Date.now() < tokenExpiry - 300000) {
    return cachedToken
  }

  const params = new URLSearchParams({
    grant_type: 'password',
    client_id: FACTUS_CLIENT_ID,
    client_secret: FACTUS_CLIENT_SECRET,
    username: FACTUS_USERNAME,
    password: FACTUS_PASSWORD,
  })

  const res = await fetch(`${FACTUS_API_URL}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Error autenticando con Factus: ${error}`)
  }

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in * 1000)

  return data.access_token
}

/**
 * Hacer request autenticado a la API de Factus
 */
async function factusRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = await getFactusToken()
  
  const res = await fetch(`${FACTUS_API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    let errorData
    try {
      errorData = JSON.parse(errorText)
    } catch {
      errorData = { message: errorText }
    }
    throw new Error(errorData?.message || errorData?.data?.message || `Error Factus: ${res.status}`)
  }

  return res.json()
}

// -- Tipos --

export interface FactusCustomer {
  identification_document_id: string // 1=Registro civil, 2=Tarjeta identidad, 3=Cédula, 4=Tarjeta extranjería, 5=Cédula extranjería, 6=NIT, 7=Pasaporte, 8=Doc identificación extranjero, 9=PEP, 10=NIT otro país
  identification: string
  names: string
  company?: string
  trade_name?: string
  address?: string
  email?: string
  phone?: string
  legal_organization_id: string // 1=Persona Jurídica, 2=Persona Natural
  tribute_id: string // 1=IVA, 21=No aplica (ZZ)
  municipality_id?: string
}

export interface FactusItem {
  code_reference: string
  name: string
  quantity: number
  discount: number
  discount_rate: number
  price: string // precio unitario como string
  tax_rate: string // "0.00", "5.00", "8.00", "19.00"
  unit_measure_id: string // 70=Unidad (94)
  standard_code_id: string // 1=Estándar de adopción del contribuyente (999)
  is_excluded: string // "0" o "1" - si es excluido de IVA
  tribute_id: string // 1=IVA, 21=No aplica
  withholding_taxes: any[]
}

export interface FactusBillRequest {
  numbering_range_id: number
  reference_code: string
  observation?: string
  payment_form: string // "1"=Contado, "2"=Crédito
  payment_method: string // "10"=Efectivo, "48"=Tarjeta crédito, "49"=Tarjeta débito, "ZZZ"=Otro
  payment_due_date?: string // YYYY-MM-DD
  duration_measure?: string
  customer: FactusCustomer
  items: FactusItem[]
}

export interface FactusBillResponse {
  status: string
  message: string
  data: {
    bill: {
      id: number
      number: string
      reference_code: string
      status: number
      cufe: string
      qr: string
      qr_image: string
      total: string
      created_at: string
      public_url: string
      payment_form: { code: string; name: string }
      payment_method: { code: string; name: string }
    }
    company: {
      nit: string
      company: string
      name: string
    }
    customer: {
      identification: string
      names: string
      email: string | null
    }
    items: any[]
  }
}

// Consumidor Final por defecto
export const CONSUMIDOR_FINAL: FactusCustomer = {
  identification_document_id: '3', // Cédula
  identification: '222222222222',
  names: 'Consumidor Final',
  address: 'Colombia',
  email: '',
  phone: '',
  legal_organization_id: '2', // Persona Natural
  tribute_id: '21', // No aplica (ZZ)
}

// -- Funciones principales --

/**
 * Obtener rangos de numeración disponibles
 */
export async function getNumberingRanges(): Promise<any> {
  const result = await factusRequest('/v1/numbering-ranges')
  return result.data?.data || []
}

/**
 * Crear y validar factura electrónica ante la DIAN
 */
export async function createBill(bill: FactusBillRequest): Promise<FactusBillResponse> {
  const result = await factusRequest('/v1/bills/validate', {
    method: 'POST',
    body: JSON.stringify(bill),
  })
  return result
}

/**
 * Listar facturas electrónicas
 */
export async function listBills(page: number = 1, filters?: { identification?: string; number?: string; status?: string }): Promise<any> {
  const params = new URLSearchParams({ page: page.toString() })
  
  if (filters?.identification) params.append('identification', filters.identification)
  if (filters?.number) params.append('number', filters.number)
  if (filters?.status) params.append('status', filters.status)

  const result = await factusRequest(`/v1/bills?${params.toString()}`)
  return result.data
}

/**
 * Obtener detalle de una factura por su número
 */
export async function getBillByNumber(number: string): Promise<any> {
  const result = await factusRequest(`/v1/bills/show/${number}`)
  return result.data
}

/**
 * Descargar PDF de una factura
 */
export async function downloadBillPDF(number: string): Promise<string> {
  const result = await factusRequest(`/v1/bills/download-pdf/${number}`)
  return result.data?.pdf_base_64_bytes || result.data?.pdf_base64 || ''
}

/**
 * Descargar XML de una factura
 */
export async function downloadBillXML(number: string): Promise<string> {
  const result = await factusRequest(`/v1/bills/download-xml/${number}`)
  return result.data?.xml_base_64_bytes || result.data?.xml_base64 || ''
}

/**
 * Crear nota crédito para anular/corregir una factura
 */
export async function createCreditNote(data: {
  numbering_range_id: number
  reference_code: string
  bill_id: number
  customer: FactusCustomer
  items: FactusItem[]
  observation?: string
  credit_note_concept_id?: string // 1=Devolución parcial, 2=Anulación, 3=Rebaja, 4=Ajuste precio, 5=Otros
}): Promise<any> {
  const result = await factusRequest('/v1/credit-notes/validate', {
    method: 'POST',
    body: JSON.stringify({
      ...data,
      credit_note_concept_id: data.credit_note_concept_id || '2',
      payment_form: '1',
    }),
  })
  return result
}

/**
 * Mapear método de pago del POS a código Factus
 */
export function mapPaymentMethod(posMethod: string): string {
  switch (posMethod?.toLowerCase()) {
    case 'cash':
    case 'efectivo':
      return '10' // Efectivo
    case 'card':
    case 'tarjeta':
      return '48' // Tarjeta crédito/débito
    case 'transfer':
    case 'transferencia':
      return 'ZZZ' // Otro
    default:
      return '10' // Efectivo por defecto
  }
}

/**
 * Mapear tipo de documento de identidad
 */
export function getDocumentTypeId(tipo: string): string {
  switch (tipo?.toUpperCase()) {
    case 'CC':
    case 'CEDULA':
      return '3' // Cédula de Ciudadanía
    case 'NIT':
      return '6' // NIT
    case 'CE':
      return '5' // Cédula de Extranjería
    case 'TI':
      return '2' // Tarjeta de Identidad
    case 'PP':
    case 'PASAPORTE':
      return '7' // Pasaporte
    case 'RC':
      return '1' // Registro Civil
    case 'TE':
      return '4' // Tarjeta de Extranjería
    case 'DIE':
      return '8' // Documento de Identificación Extranjero
    case 'PEP':
      return '9' // Permiso Especial de Permanencia
    default:
      return '3' // Cédula por defecto
  }
}

/**
 * Tipos de documento para el select del formulario
 */
export const DOCUMENT_TYPES = [
  { id: '3', code: 'CC', name: 'Cédula de Ciudadanía' },
  { id: '6', code: 'NIT', name: 'NIT' },
  { id: '5', code: 'CE', name: 'Cédula de Extranjería' },
  { id: '2', code: 'TI', name: 'Tarjeta de Identidad' },
  { id: '7', code: 'PP', name: 'Pasaporte' },
  { id: '1', code: 'RC', name: 'Registro Civil' },
  { id: '4', code: 'TE', name: 'Tarjeta de Extranjería' },
  { id: '8', code: 'DIE', name: 'Doc. Identificación Extranjero' },
  { id: '9', code: 'PEP', name: 'Permiso Especial de Permanencia' },
  { id: '10', code: 'NITP', name: 'NIT de Otro País' },
]
