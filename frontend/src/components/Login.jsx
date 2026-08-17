import { useRef, useState } from 'react'
import { login } from '../api.js'

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const userRef = useRef(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!username.trim() || !password || busy) return

    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
      setPassword('')
      onSuccess()
    } catch (err) {
      setError(err.message)
      setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack login-stack">
      <header className="masthead">
        <p className="eyebrow">Tutor de inglés</p>
        <h1>Inicia sesión</h1>
        <p className="lede">Tu progreso y tus claves de IA están protegidos.</p>
      </header>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <input
            ref={userRef}
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuario"
            autoComplete="username"
            autoCapitalize="off"
            spellCheck="false"
            disabled={busy}
            autoFocus
          />
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            disabled={busy}
          />
          <button
            className="btn primary"
            type="submit"
            disabled={busy || !username.trim() || !password}
          >
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  )
}
