import { useEffect, useState } from 'react'
import { fetchGameCatalog, fetchStatus } from '../api/gameApi'
import { createCatalog } from '../game/catalog'

export function useBootstrapData(apiBaseUrl) {
  const [apiState, setApiState] = useState({ status: 'loading', payload: null })
  const [catalogState, setCatalogState] = useState({ status: 'loading', payload: null, error: null })

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [statusPayload, catalogPayload] = await Promise.all([
          fetchStatus(apiBaseUrl),
          fetchGameCatalog(apiBaseUrl),
        ])

        if (cancelled) {
          return
        }

        setApiState({ status: 'success', payload: statusPayload })
        setCatalogState({ status: 'success', payload: createCatalog(catalogPayload), error: null })
      } catch (error) {
        if (cancelled) {
          return
        }

        const message = error instanceof Error ? error.message : 'Unknown error'
        setApiState({ status: 'error', payload: message })
        setCatalogState({ status: 'error', payload: null, error: message })
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl])

  return { apiState, catalogState }
}