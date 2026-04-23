'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)

    const handleSubmit = async () => {
        if (!email) return
        setLoading(true)
        await signIn('email', { email, redirect: false })
        setSent(true)
        setLoading(false)
    }

    if (sent) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-sm w-full text-center">
                    <div className="text-4xl mb-4">✉️</div>
                    <h1 className="text-white text-xl font-semibold mb-2">Controlla la tua email</h1>
                    <p className="text-gray-400 text-sm">
                        Magic link inviato a <span className="text-white">{email}</span>
                    </p>
                    <p className="text-gray-600 text-xs mt-4">
                        Dev: controlla su{' '}
                        <a href="https://ethereal.email" target="_blank" className="text-blue-400 underline">
                            ethereal.email
                        </a>
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-sm w-full">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white text-sm font-bold">
                        A
                    </div>
                    <div>
                        <h1 className="text-white font-semibold">ATC Monitor</h1>
                        <p className="text-gray-500 text-xs">Login per attivare gli alert</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <input
                        type="email"
                        placeholder="La tua email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={loading || !email}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                    >
                        {loading ? 'Invio in corso...' : 'Invia Magic Link'}
                    </button>
                </div>
            </div>
        </div>
    )
}