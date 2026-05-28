import Link from 'next/link'

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <main className="flex w-full flex-1 flex-col items-center justify-center px-20 text-center">
        <h1 className="text-6xl font-bold">
          Welcome to <span className="text-blue-600">Wexa AI</span>
        </h1>

        <p className="mt-3 text-2xl">
          Production Grade AI Analytics Platform
        </p>

        <div className="mt-6 flex max-w-4xl flex-col items-center justify-center gap-4 sm:flex-row sm:w-full">
          <Link
            href="/login"
            className="w-72 rounded-xl border p-6 text-left hover:text-blue-600 focus:text-blue-600"
          >
            <h3 className="text-2xl font-bold">Login &rarr;</h3>
            <p className="mt-4 text-xl">
              Access your dashboard and view analytics.
            </p>
          </Link>
          <Link
            href="/signup"
            className="w-72 rounded-xl border p-6 text-left hover:text-blue-600 focus:text-blue-600 bg-gray-50"
          >
            <h3 className="text-2xl font-bold">Sign up &rarr;</h3>
            <p className="mt-4 text-xl">
              Create a new account to get started.
            </p>
          </Link>
        </div>
      </main>
    </div>
  )
}
