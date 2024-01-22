// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

import * as postgres from 'https://deno.land/x/postgres@v0.14.2/mod.ts'

const databaseUrl = Deno.env.get('SUPABASE_DB_URL')!
const pool = new postgres.Pool(databaseUrl, 3, true)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
 // This is needed if you're planning to invoke your function from a browser.
 if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders })
}

const { username, password } = await req.json()
// This is needed if you're planning to invoke your function from a browser.
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders })
}

const connection = await pool.connect()
try {
  const aResults =
    await connection.queryArray`select * from profiles where username = ${username} and password = ${password}`

  const responseData = {
    profiles: aResults.rows.map(r => { return { id: r[0], is_teacher: r[1], email: r[2], username: r[3] } })
  }

  return new Response(JSON.stringify(responseData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })

} catch (e) {
  return new Response(JSON.stringify(e), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
} finally {
  connection.release()
}

})

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
