import { describe, expect, it } from 'vitest'
import { createRepositories } from '.'

describe('createRepositories (which data layer runs)', () => {
  const url = 'https://example-project.supabase.co'

  it('uses demo data when nothing is configured', async () => {
    const repos = await createRepositories({})
    expect(repos.kind).toBe('mock')
    expect(repos.dev).toBeDefined()
  })

  it('uses Supabase when both the URL and the anon key are set', async () => {
    const repos = await createRepositories({
      VITE_SUPABASE_URL: url,
      VITE_SUPABASE_ANON_KEY: 'anon',
    })
    expect(repos.kind).toBe('supabase')
    expect(repos.dev).toBeUndefined()
  })

  it.each([
    ['only the URL', { VITE_SUPABASE_URL: url }],
    ['only the key', { VITE_SUPABASE_ANON_KEY: 'anon' }],
    ['an empty key (as in .env.example)', { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: '' }],
    ['blank values', { VITE_SUPABASE_URL: '  ', VITE_SUPABASE_ANON_KEY: '  ' }],
  ])('falls back to demo data with %s', async (_label, env) => {
    expect((await createRepositories(env)).kind).toBe('mock')
  })
})
