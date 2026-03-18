const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

const AUTH_URL = process.env.TARGET_AUTH_URL
const BASE_URL = 'https://crednet.targetinformacoes.com'
const CLIENT_ID = process.env.TARGET_CLIENT_ID
const CLIENT_SECRET = process.env.TARGET_CLIENT_SECRET
const CLIENT_DOC = process.env.TARGET_CLIENT_DOC || '00000000000000'

async function testApi() {
  try {
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
    const authRes = await axios.post(
      AUTH_URL,
      new URLSearchParams({ grant_type: 'client_credentials' }),
      { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    )
    const token = authRes.data.access_token

    // Format from docs: /crednet/pjconsultation/<documento>/<UF>/<nome_do_relatorio>?optionalFeatures=...
    const cnpj = '00261304000102' // Homolog CNPJ provided in instructions
    const uf = 'RJ'
    const report = 'RELATORIO_INTERMEDIARIO_PJ'
    const features = 'SCORE_POSITIVO,PARTICIPACAO_SOCIETARIA'

    const url = `${BASE_URL}/crednet/pjconsultation/${cnpj}/${uf}/${report}?optionalFeatures=${features}`
    console.log(`Testing: ${url}`)
    
    const response = await axios.get(url, {
      headers: { 
        Authorization: `Bearer ${token}`, 
        Accept: 'application/json',
        'x-indirect-user-doc': CLIENT_DOC
      }
    })
    console.log(`✅ Success PF! Data:`, JSON.stringify(response.data).substring(0, 300))

  } catch (error) {
    if (error.response) {
      console.log(`❌ Failed: ${error.response.status} - Content-Type: ${error.response.headers['content-type']}`)
      if (error.response.headers['content-type'].includes('json')) {
         console.log('   Data:', JSON.stringify(error.response.data).substring(0, 300))
      }
    } else {
      console.log(`❌ Error: ${error.message}`)
    }
  }
}

testApi()
