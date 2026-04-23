export default function VerifyPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-sm w-full text-center">
                <div className="text-4xl mb-4">🔐</div>
                <h1 className="text-white text-xl font-semibold mb-2">Link inviato</h1>
                <p className="text-gray-400 text-sm">
                    Controlla la tua email e clicca il link per accedere.
                </p>
            </div>
        </div>
    )
}