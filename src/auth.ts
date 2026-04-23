import NextAuth from 'next-auth'
import Email from 'next-auth/providers/email'
import PostgresAdapter from '@auth/pg-adapter'
import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
})

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PostgresAdapter(pool),
    providers: [
        Email({
            server: {
                host: process.env.EMAIL_SERVER_HOST,
                port: Number(process.env.EMAIL_SERVER_PORT),
                auth: {
                    user: process.env.EMAIL_SERVER_USER,
                    pass: process.env.EMAIL_SERVER_PASSWORD,
                },
            },
            from: process.env.EMAIL_FROM,
            sendVerificationRequest: async ({ identifier, url, provider }) => {
                console.log('[Auth] Sending magic link to:', identifier)
                console.log('[Auth] Magic link URL:', url)
                console.log('[Auth] SMTP config:', {
                    host: provider.server,
                    from: provider.from,
                })

                const { createTransport } = await import('nodemailer')
                const transport = createTransport(provider.server)
                const result = await transport.sendMail({
                    to: identifier,
                    from: provider.from,
                    subject: 'ATC Monitor — Magic Link',
                    text: `Clicca qui per accedere: ${url}`,
                    html: `<p>Clicca qui per accedere:</p><p><a href="${url}">${url}</a></p>`,
                })
                console.log('[Auth] Email sent:', result.messageId)
            },
        }),
    ],
    session: {
        strategy: 'database',
    },
    pages: {
        signIn: '/login',
        verifyRequest: '/login/verify',
        error: '/auth/error',
    },
    callbacks: {
        session({ session, user }) {
            session.user.id = user.id
            return session
        },
    },
})