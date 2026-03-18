const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function test() {
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    console.error('Error fetching:', error)
  } else if (data && data.length > 0) {
    const c = data[0]
    console.log(`Latest consultation ${c.id} from ${c.created_at}`)
    console.log(`Type: ${c.consultation_type_id}`)
    console.log(`Result data keys:`, c.result_data ? Object.keys(c.result_data) : 'null')
    
    if (c.result_data) {
      console.log('Has identificacao?', !!c.result_data.identificacao)
      console.log('Has anotacoes?', !!c.result_data.anotacoes)
      if (!c.result_data.anotacoes) {
        console.log('RAW JSON snippet:', JSON.stringify(c.result_data).substring(0, 150))
      }
    }
  } else {
    console.log('Nenhuma consulta encontrada.')
  }
}

test()
