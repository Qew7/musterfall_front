import { useEffect, useState } from 'react'
import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

function App() {
  const [apiState, setApiState] = useState({ status: 'loading', payload: null })

  useEffect(() => {
    let cancelled = false

    const loadStatus = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/status`)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = await response.json()

        if (!cancelled) {
          setApiState({ status: 'success', payload })
        }
      } catch (error) {
        if (!cancelled) {
          setApiState({
            status: 'error',
            payload: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    loadStatus()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Autobattler campaign prototype</p>
        <h1>Musterfall</h1>
        <p className="lead">
          Собирайте армию в духе фэнтези-сражений, усиливайте строй и проходите
          цепочку боёв против всё более опасных врагов.
        </p>

        <div className="status-card">
          <span className={`status-pill status-pill--${apiState.status}`}>
            API: {apiState.status}
          </span>

          {apiState.status === 'success' && (
            <dl className="status-grid">
              <div>
                <dt>Имя проекта</dt>
                <dd>{apiState.payload.name}</dd>
              </div>
              <div>
                <dt>Backend</dt>
                <dd>{apiState.payload.status}</dd>
              </div>
              <div>
                <dt>База данных</dt>
                <dd>{apiState.payload.services.database ? 'ready' : 'offline'}</dd>
              </div>
              <div>
                <dt>Время сервера</dt>
                <dd>{apiState.payload.server_time}</dd>
              </div>
            </dl>
          )}

          {apiState.status === 'loading' && (
            <p className="status-copy">Проверка соединения с Rails API...</p>
          )}

          {apiState.status === 'error' && (
            <p className="status-copy">
              Не удалось получить ответ от backend: {apiState.payload}
            </p>
          )}
        </div>
      </section>

      <section className="details-panel">
        <article>
          <h2>Стек проекта</h2>
          <ul>
            <li>Rails API в папке backend</li>
            <li>PostgreSQL как основная база данных</li>
            <li>React + Vite в папке frontend</li>
          </ul>
        </article>

        <article>
          <h2>Ближайшие шаги</h2>
          <ul>
            <li>Создать модели юнитов, армий и боёв</li>
            <li>Поднять PostgreSQL и выполнить rails db:prepare</li>
            <li>Собрать экран найма, формации и симуляции боя</li>
          </ul>
        </article>
      </section>
    </main>
  )
}

export default App
