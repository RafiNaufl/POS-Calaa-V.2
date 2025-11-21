# Vercel Frontend Env Template

Configure these variables in Vercel → Project Settings → Environment Variables:

- `NEXT_PUBLIC_BACKEND_URL`: `https://api.pos.example.com`
- `NEXTAUTH_URL`: `https://pos.example.com`
- `NEXTAUTH_SECRET`: `replace-with-strong-random-secret`
- (Optional) `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`: set only if the frontend needs Snap client-side

Tips:
- Use separate values for Preview and Production environments.
- Avoid placing sensitive secrets with `NEXT_PUBLIC_` prefix.
- Ensure CORS on backend allows your Vercel domain.

