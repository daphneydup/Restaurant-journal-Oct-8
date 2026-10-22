// Deploy with: supabase functions deploy giphy   (or the Supabase MCP / dashboard)
// Needs the secret:  supabase secrets set GIPHY_API_KEY=<your key>
import { handleGiphy } from './handler.ts'

Deno.serve((req: Request) => handleGiphy(req, { apiKey: Deno.env.get('GIPHY_API_KEY') }))
