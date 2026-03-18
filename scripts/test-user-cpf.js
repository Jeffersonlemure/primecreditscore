const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

const AUTH_URL = process.env.TARGET_AUTH_URL
const BASE_URL = process.env.TARGET_BASE_URL
const CLIENT_ID = process.env.TARGET_CLIENT_ID
const CLIENT_SECRET = process.env.TARGET_CLIENT_SECRET
const CLIENT_DOC = process.env.TARGET_CLIENT_DOC || ''

async function test() {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  
  const tokenRes = await axios.post(
    AUTH_URL,
    new URLSearchParams({ grant_type: 'client_credentials' }),
    { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  const token = tokenRes.data.access_token
  console.log('Got token')

  const cleanBaseUrl = BASE_URL.replace(/\/+$/, '')

  const cpf = '78500800500'
  try {
    const response = await axios.get(`${cleanBaseUrl}/crednet/pfconsultation/${cpf}/RELATORIO_INTERMEDIARIO_PF`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    })
    console.log(`Success for ${cpf}:`, response.data.reportName || 'OK')
  } catch (err) {
    if (err.response) {
      console.error(`Error for ${cpf}:`, err.response.status, String(err.response.data).substring(0, 100))
    } else {
      console.error(err.message)
    }
  }

  const cpftest = '00000002305'
  try {
    const response2 = await axios.get(`${cleanBaseUrl}/crednet/pfconsultation/${cpftest}/RELATORIO_INTERMEDIARIO_PF`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    })
    console.log(`Success for ${cpftest}:`, response2.data.reportName || 'OK')
  } catch (err) {
    if (err.response) {
      console.error(`Error for ${cpftest}:`, err.response.status, String(err.response.data).substring(0, 100))
    } else {
      console.error(err.message)
    }
  }
}
test()
