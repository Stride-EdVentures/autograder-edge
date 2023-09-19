/**
 *  class-delete/index.ts
 *
 *
 *  @copyright 2023 Stride EdVentures
 *
 */

// Follow this setup guide to integrate the Den/**
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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

  const { classId } = await req.json()
  const connection = await pool.connect()
  const supabaseClient = createSupabaseClient(req)

  try {
    const aResults =
      await connection.queryObject`SELECT * FROM assignments where class_id = ${classId}`
    const assignments = aResults.rows

    const eResults =
      await connection.queryObject`SELECT * FROM enrollments where class_id = ${classId}`
    const enrollments = eResults.rows

    enrollments
      .map((e) => assignments.map((a) => `${e.profile_id}/${a.id}`))
      .forEach(async (aPaths) => {
        if (aPaths.length > 0) {
          aPaths.forEach(async (aPath) => {
            try {
              const { data, error } = await supabaseClient.storage
                .from('submissions')
                .list(aPath)
              if (error) throw error
              const vPaths = data!.map((v) => `${aPath}/${v.name}`)
              if (vPaths.length > 0) {
                vPaths.forEach(async (vPath) => {
                  const { data, error } = await supabaseClient.storage
                    .from('submissions')
                    .list(vPath)
                  if (error) throw error
                  if (data.length > 0) {
                    const fPaths = data!.map((f) => `${vPath}/${f.name}`)
                    files = files.concat(fPaths)
                    await supabaseClient.storage
                      .from('submissions')
                      .remove(fPaths)
                  }
                })
                await supabaseClient.storage.from('submissions').remove(vPaths)
              }
              await supabaseClient.storage.from('submissions').remove(aPaths)
            } catch (e) {
              console.log(e)
            }
          })
        }
      })
  } finally {
    connection.release()
  }

  const aResults =
    await connection.queryArray`DELETE FROM assignments WHERE class_id = ${classId}`
  const eResults =
    await connection.queryArray`DELETE FROM enrollments WHERE class_id = ${classId}`
  const cResults =
    await connection.queryArray`DELETE FROM classes WHERE id = ${classId}`

  const response = {
    message: `Deleting ${classId}!`,
  }

  console.log('response', response)

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
})

// To invoke:
// curl -L -X POST 'https://rhojoslgtpvnlmsfppjq.supabase.co/functions/v1/class-delete' -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJob2pvc2xndHB2bmxtc2ZwcGpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTU1MDE0MTQsImV4cCI6MTk3MTA3NzQxNH0.GYmHNPhcL-uiKxA_ImhxvEd8iM6FyxDh3n2etfODVag' --data '{"classId":"f0ed0960-f3ad-4dc5-83af-ed32f98161a6"}'
