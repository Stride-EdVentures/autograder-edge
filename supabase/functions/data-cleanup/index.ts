/**
 *  data-cleanup/index.ts
 *
 *
 *  @copyright 2023 Stride EdVentures
 *
 */

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

  const connection = await pool.connect()
  const supabase = createSupabaseClient(req)
  let fileCount = 0;

  try {
    const aResults =
      await connection.queryObject`SELECT * FROM assignments`
    const assignments: string[] = aResults.rows.map((a: any) => a.id);

    const { data: userFolders, error } = await supabase.storage
      .from('submissions')
      .list()

    userFolders.forEach(async (userFolder) => {
      const { data: assignmentFolders, aError } = await supabase.storage
        .from('submissions')
        .list(userFolder.name)
      const oldAssignments = assignmentFolders
        .filter((a: any) => !assignments.includes(a.name))
      console.log('oldAssignments', oldAssignments)

      if (oldAssignments.length > 0) {
        const aPaths = oldAssignments.map(a => `${userFolder.name}/${a.name}`)
        aPaths.forEach(async aPath => {
          const { data: versionFolders, error } = await supabase.storage
            .from('submissions')
            .list(aPath)
          console.log('versionFolders', versionFolders)
          if (versionFolders.length > 0) {
            const vPaths = versionFolders.map(v => `${aPath}/${v.name}`)
            vPaths.forEach(async vPath => {
              const { data: files, error } = await supabase.storage
                .from('submissions')
                .list(vPath)
              console.log('files', files)
              if (files.length > 0) {
                const fPaths = files.map(file => `${vPath}/${file.name}`)
                fileCount = fileCount + fPaths.length
                await supabase.storage.from('submissions').remove(fPaths)
              }
            })
            await supabase.storage.from('submissions').remove(vPaths)
          }
        })
        await supabase.storage.from('submissions').remove(aPaths)
      }
    })
  } finally {
    connection.release()
  }

  const responseData = {
    message: 'Data cleaned',
    filesDeleted: fileCount
  }


  return new Response(JSON.stringify(responseData), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  })
})
