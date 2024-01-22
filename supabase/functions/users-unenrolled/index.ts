/**
 *  data-cleanup/index.ts
 *
 *
 *  @copyright 2023 Stride EdVentures
 *
 */

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

  const connection = await pool.connect()
  try {
    const aResults =
      await connection.queryArray`select * from profiles where id NOT IN(SELECT profile_id FROM enrollments ) and is_teacher = false`

    const responseData = {
      unenrolled: aResults.rows.map(r => { return { id: r[0], is_teacher: r[1], email: r[2] } })
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

