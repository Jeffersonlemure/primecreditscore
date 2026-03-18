const { createClient } = require('@supabase/supabase-js')
const { generateBasicaPFPdf } = require('./lib/pdf-generator.js') // We can't easily require a ts file without ts-node
