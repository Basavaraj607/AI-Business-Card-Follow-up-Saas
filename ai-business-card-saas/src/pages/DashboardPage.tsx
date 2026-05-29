import { useAuth } from '../lib/auth-context'

export default function DashboardPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">
        Dashboard
      </h1>

      <p>{user?.email}</p>

      <button
        onClick={signOut}
        className="mt-4 bg-red-600 text-white px-4 py-2 rounded"
      >
        Sign Out
      </button>
    </div>
  )
}