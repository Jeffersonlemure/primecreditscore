const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

const AUTH_URL = process.env.TARGET_AUTH_URL
const BASE_URL = 'https://crednet.targetinformacoes.com'
const CLIENT_ID = process.env.TARGET_CLIENT_ID
const CLIENT_SECRET = process.env.TARGET_CLIENT_SECRET
const CLIENT_DOC = process.env.TARGET_CLIENT_DOC || '00000000000000'

async function tryGet(token, path, label) {
  const url = `${BASE_URL}${path}`
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'x-indirect-user-doc': CLIENT_DOC }
    })
    console.log(`✅ ${label} WORKED. JSON dump of first report:`);
    console.log(JSON.stringify(response.data.reports[0], null, 2));
    if (response.data.score) {
      console.log('   -> Has score:', response.data.score.pontuacao || 'yes');
    }
    return true
  } catch (error) {
    if (error.response) {
      console.log(`❌ ${label} FAILED: ${error.response.status} - Data: ${JSON.stringify(error.response.data)}`);
    } else {
      console.log(`❌ ${label} Error: ${error.message}`)
    }
    return false
  }
}

async function run() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const authRes = await axios.post(
    AUTH_URL,
    new URLSearchParams({ grant_type: 'client_credentials' }),
    { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  const token = authRes.data.access_token

  const cpf = '00000002305' // Homolog CPF provided in instructions
  const cnpj = '00261304000102' // Homolog CNPJ provided in instructions

  console.log('--- Testing PF ---')
  await tryGet(token, `/crednet/pfconsultation/${cpf}/RELATORIO_INTERMEDIARIO_PF`, "PF Default (no optional)")

  console.log('--- Testing PJ ---')
  await tryGet(token, `/crednet/pjconsultation/${cnpj}/SP/RELATORIO_INTERMEDIARIO_PJ`, "PJ Default (no optional)")
}

run()
