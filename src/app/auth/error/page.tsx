export default async function AuthErrorPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string }>
}) {
    const params = await searchParams
    const message =
        params.error === 'Verification'
            ? 'Il link e scaduto o gia usato. Richiedine uno nuovo.'
            : 'Errore di autenticazione.'

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-sm w-full text-center">
                <h1 className="text-white text-xl font-semibold mb-2">Errore</h1>
                <p className="text-gray-400 text-sm mb-4">{message}</p>
                <a href="/login" className="text-blue-400 text-sm underline">
                    Torna al login
                </a>
            </div>
        </div>
    )
}