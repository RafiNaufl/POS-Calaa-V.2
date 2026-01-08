import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl
    const accessCookie = req.cookies.get('pos.accessToken')?.value
    
    // Derive role from NextAuth token or JWT payload in cookie
    let userRole: string | undefined = token?.role as any
    if (!userRole && accessCookie) {
      try {
        const parts = accessCookie.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]))
          // Check top-level role (Legacy) or user_metadata/app_metadata role (Supabase)
          userRole = payload?.role || payload?.user_metadata?.role || payload?.app_metadata?.role
        }
      } catch (_) {}
    }

    // Allow access to login page; if already authenticated, redirect away
    if (pathname === '/login') {
      if (token || accessCookie) {
        // Default redirect based on role
        if (userRole === 'CASHIER') {
          return NextResponse.redirect(new URL('/cashier', req.url))
        }
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      return NextResponse.next()
    }

    // Redirect to login if not authenticated (accept either NextAuth token or access cookie)
    if (!token && !accessCookie) {
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // Role-based access control
    // userRole determined above

    // Admin can access everything
    if (userRole === 'ADMIN') {
      return NextResponse.next()
    }

    // Cashier restrictions
    if (userRole === 'CASHIER') {
      const restrictedPaths = ['/users', '/categories', '/products/new']
      
      // Check if current path is restricted for cashiers
      const isRestricted = restrictedPaths.some(path => pathname.startsWith(path))
      
      if (isRestricted) {
        return NextResponse.redirect(new URL('/cashier', req.url))
      }
      
      // Allow access to cashier, products (read-only), reports, transactions, and members
      const allowedPaths = ['/cashier', '/products', '/reports', '/transactions', '/dashboard', '/members']
      const isAllowed = allowedPaths.some(path => pathname.startsWith(path))
      
      if (!isAllowed) {
        return NextResponse.redirect(new URL('/cashier', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow access to login page without token
        if (req.nextUrl.pathname === '/login') {
          return true
        }
        // Allow if NextAuth token or access cookie exists
        const hasCookie = !!req.cookies.get('pos.accessToken')?.value
        return !!token || hasCookie
      }
    }
  }
)

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ]
}