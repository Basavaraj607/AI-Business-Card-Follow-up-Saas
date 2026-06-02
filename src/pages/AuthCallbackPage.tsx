import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/dashboard')
  }, [navigate])

  return <div>Signing you in...</div>
}