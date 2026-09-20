// Pro-Status. Für den MVP ein lokaler Schalter; später wird hier der
// Store-Callback (z. B. RevenueCat/Stripe Webhook → Backend → Entitlement)
// angesetzt. Die Entitlement-Prüfung bleibt an dieser einen Stelle.

import { useCallback, useState } from 'react'
import { loadJson, saveJson } from '../domain/storage'

const KEY = 'fitplanner.pro.v1'

export function usePro() {
  // Parser akzeptiert nur literal true; alles andere (inkl. false/korrupt) = Gratis.
  const [isPro, setIsPro] = useState<boolean>(
    () => loadJson(KEY, (raw) => (raw === true ? true : null)) === true,
  )

  const upgrade = useCallback(() => {
    saveJson(KEY, true)
    setIsPro(true)
  }, [])

  const reset = useCallback(() => {
    saveJson(KEY, false)
    setIsPro(false)
  }, [])

  return { isPro, upgrade, reset }
}
