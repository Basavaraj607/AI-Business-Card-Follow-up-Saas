import { useState } from 'react'
import { useAuth } from '../lib/auth-context'

export default function Login_Page() {
  const { signInWithGoogle, signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')

  const handleMagicLink = async () => {
    try {
      await signInWithMagicLink(email)
      alert('Check your email')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-96 space-y-4">

        <h1 className="text-3xl font-bold">
          CardFollowup
        </h1>

        <button
          onClick={signInWithGoogle}
          className="w-full bg-black text-white p-3 rounded"
        >
          Continue with Google
        </button>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-3 w-full rounded"
        />

        <button
          onClick={handleMagicLink}
          className="w-full bg-green-600 text-white p-3 rounded"
        >
          Send Magic Link
        </button>

      </div>
    </div>
  )
}