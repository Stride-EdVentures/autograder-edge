// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as postgres from 'https://deno.land/x/postgres@v0.14.2/mod.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const databaseUrl = Deno.env.get('SUPABASE_DB_URL')!
const pool = new postgres.Pool(databaseUrl, 3, true)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function createSupabaseClient(req) {
  return createClient(
    // Supabase API URL - env var exported by default.
    Deno.env.get('SUPABASE_URL') ?? '',
    // Supabase API ANON KEY - env var exported by default.
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    // Create client with Auth context of the user that called the function.
    // This way your row-level-security (RLS) policies are applied.
    {
      global: { headers: { Authorization: req.headers.get('Authorization')! } },
    }
  )
}

serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // String path = "submissions/" + studentId + "/" + assignmentId + "/" + version + "/" + fileName;
  const url = new URL(req.url)
  const variables = url.pathname.split('/');
  const studentId = variables[1];
  const assignmentId = variables[2];
  const version = variables[3];
  const fileName = variables[4];

  const connection = await pool.connect()

  let query = `SELECT * FROM submission WHERE profile_id = ${studentId}`
  query += ` AND assignment_id = ${assignmentId}`
  query += ` AND version = ${version}`
  query += ` AND file_name = ${fileName}`
  const eResults =
    await connection.queryObject(query)

  const supabaseClient = createSupabaseClient(req)

  const { data, error } = await supabaseClient
    .storage
    .from('submissions')
    .download(`${studentId}/${eResults.id}`)

  if (error) throw error;

  const contents = await data.text();

  return new Response(JSON.stringify(contents), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
})

// To invoke:
// curl -i --location --request POST 'http://localhost:54321/functions/v1/' \
//   --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
//   --header 'Content-Type: application/json' \
//   --data '{"name":"Functions"}'
