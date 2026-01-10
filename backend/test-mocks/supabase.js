module.exports = {
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: 'Mocked Supabase error' } })
    }
  }
}
