import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  // Skip auth for NextAuth routes
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const basicAuth = request.headers.get('authorization')

  if (basicAuth) {
    const authValue = basicAuth.split(' ')[1]
    const [user, password] = atob(authValue).split(':')

    const validUser = process.env.BASIC_AUTH_USER
    const validPassword = process.env.BASIC_AUTH_PASSWORD

    if (user === validUser && password === validPassword) {
      return NextResponse.next()
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ATC Monitor - Private Beta"',
    },
  })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
