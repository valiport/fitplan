// Tausch-Tab: Freundesliste, Tausch-Angebot erstellen (beidseitige Auswahl),
// eingehende/ausgehende Anfragen annehmen/ablehnen/zurückziehen + Historie.

import { useState } from 'react'
import { PLATES, getPlate } from '../domain/plates'
import { XpButton, XpGroupBox } from './ui'
import type { FriendRequest, Trade, TradeItems, useFriends, useTrades } from '../hooks/useCollectionSocial'
import type { Inventory } from '../domain/plates'

/** Wandelt eine Inventar-Auswahl (checkboxen) in TradeItems um. */
function toTradeItems(selection: Record<string, boolean>): TradeItems {
  const out: TradeItems = {}
  for (const [plateId, on] of Object.entries(selection)) {
    if (on) out[plateId] = 1
  }
  return out
}

/** Items lesbar beschreiben (Name × Stück). */
function describeItems(items: TradeItems): string {
  return Object.entries(items)
    .map(([plateId, qty]) => `${getPlate(plateId)?.name ?? plateId}${qty > 1 ? ` ×${qty}` : ''}`)
    .join(', ') || '—'
}

export default function TradeView({ userId, inventory, friendsApi, tradesApi, onChanged }: {
  userId: string
  inventory: Inventory
  friendsApi: ReturnType<typeof useFriends>
  tradesApi: ReturnType<typeof useTrades>
  /** Wallet/Inventar nach jeder Cloud-Transaktion autoritativ nachladen. */
  onChanged: () => void
}) {
  const { friends, requests } = friendsApi
  const [partnerId, setPartnerId] = useState<string>('')
  const [mySelection, setMySelection] = useState<Record<string, boolean>>({})
  const [wantSelection, setWantSelection] = useState<Record<string, boolean>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [friendId, setFriendId] = useState('')
  const [friendBusy, setFriendBusy] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)

  const incoming = tradesApi.trades.filter((t) => t.toUserId === userId && t.status === 'pending')
  const outgoing = tradesApi.trades.filter((t) => t.fromUserId === userId && t.status === 'pending')
  const history = tradesApi.trades.filter((t) => t.status !== 'pending')

  const partner = friends.find((f) => f.id === partnerId) ?? null

  // Partner-Inventar: In der Cloud Unbekannt (RLS: nur eigene Reihen lesbar);
  // die Wunsch-Auswahl ist daher ein freier Platten-Katalog-Dialog.
  const catalogPlates = PLATES

  const submit = async () => {
    if (!partner) {
      setNotice('Bitte zuerst einen Tauschpartner wählen.')
      return
    }
    setBusy(true)
    setNotice(null)
    try {
      await tradesApi.createTrade(partner.id, toTradeItems(mySelection), toTradeItems(wantSelection))
      onChanged()
      setMySelection({})
      setWantSelection({})
      setNotice('Tausch-Angebot gesendet! Dein Freund muss es bestätigen.')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Tausch konnte nicht erstellt werden.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="text-left">
      {tradesApi.error && <p role="alert" className="mb-2 rounded-[12px] border border-[#ff9b92]/30 bg-[#331514]/80 p-2 text-[11px] text-[#ff9b92]">{tradesApi.error}</p>}
      {notice && <p role="status" className="mb-2 rounded-[12px] border border-[#ffcf7e]/30 bg-[#33270f]/85 p-2 text-[11px] text-[#ffcf7e]">{notice}</p>}

      {/* Freunde */}
      <XpGroupBox title="Freunde">
        {friendsApi.error && <p role="alert" className="mb-1 text-[11px] text-[#ff9b92]">{friendsApi.error}</p>}
        <div className="mb-2 flex gap-1.5">
          <input
            aria-label="Freundes-UUID"
            value={friendId}
            onChange={(event) => setFriendId(event.target.value.trim())}
            placeholder="Freundes-UUID"
            className="glass-input min-w-0 flex-1"
            disabled={friendBusy}
          />
          <XpButton disabled={friendBusy || !friendId} onClick={() => {
            setFriendBusy(true)
            void friendsApi.sendRequest(friendId).then(() => setFriendId('')).catch((cause: unknown) => {
              setNotice(cause instanceof Error ? cause.message : 'Anfrage fehlgeschlagen.')
            }).finally(() => setFriendBusy(false))
          }}>Anfragen</XpButton>
        </div>
        {!friends.length && <p className="text-[12px] text-[#8bada7]">Noch keine bestätigten Freunde.</p>}
        {requests.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 text-[11px] font-bold text-[#ffcf7e]">Eingehende Anfragen</p>
            {requests.map((request) => <FriendRequestRow key={request.id} request={request} api={friendsApi} />)}
          </div>
        )}
        {friends.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {friends.map((f) => (
              <span key={f.id} className="flex items-center gap-1">
                <button
                  onClick={() => setPartnerId(f.id)}
                  aria-pressed={partnerId === f.id}
                  className={
                    'glass-chip ' + (partnerId === f.id ? 'glass-chip-active' : '')
                  }
                >
                  👤 {f.name}
                </button>
                <XpButton
                  variant="danger"
                  className="!px-1.5 !py-0.5 !text-[10px]"
                  aria-label={`Freundschaft mit ${f.name} entfernen`}
                  title="Freundschaft entfernen"
                  disabled={removeId !== null}
                  onClick={() => {
                    if (!window.confirm(`Freundschaft mit ${f.name} entfernen? Eine neue Anfrage wäre nötig.`)) return
                    setRemoveId(f.id)
                    void friendsApi.removeFriend(f.id).then(() => {
                      if (partnerId === f.id) setPartnerId('')
                    }).catch((cause: unknown) => {
                      setNotice(cause instanceof Error ? cause.message : 'Freundschaft konnte nicht entfernt werden.')
                    }).finally(() => setRemoveId(null))
                  }}
                >
                  ✕
                </XpButton>
              </span>
            ))}
          </div>
        )}
      </XpGroupBox>

      {/* Tausch erstellen */}
      <XpGroupBox title="Tausch anbieten" className="mt-2">
        {!partner ? (
          <p className="text-[12px] text-[#8bada7]">Wähle oben einen Freund, um einen Tausch zu starten.</p>
        ) : (
          <>
            <p className="mb-1.5 text-[12px] text-[#a9c4be]">
              Du bietest <span className="font-bold text-[#5fe3d4]">{partner.name}</span> deine Platten an — und wünschst dir welche davon:
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[11px] font-bold text-[#8bada7]">DEINE PLATTEN</p>
                <div className="glass-inset max-h-40 space-y-1 overflow-y-auto">
                  {Object.entries(inventory).filter(([, qty]) => qty > 0).length === 0 && (
                    <p className="text-[11px] text-[#8bada7]">Inventar leer.</p>
                  )}
                  {Object.entries(inventory).filter(([, qty]) => qty > 0).map(([plateId, qty]) => (
                    <label key={plateId} className="flex items-center gap-1.5 text-[12px] text-[#dcefec]">
                      <input
                        type="checkbox"
                        checked={mySelection[plateId] ?? false}
                        onChange={(e) => setMySelection((prev) => ({ ...prev, [plateId]: e.target.checked }))}
                      />
                      <span className="min-w-0 truncate">{getPlate(plateId)?.name ?? plateId} ×{qty}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[11px] font-bold text-[#8bada7]">DU WÜNSCHST DIR</p>
                <div className="glass-inset max-h-40 space-y-1 overflow-y-auto">
                  {catalogPlates.map((plate) => (
                    <label key={plate.id} className="flex items-center gap-1.5 text-[12px] text-[#dcefec]">
                      <input
                        type="checkbox"
                        checked={wantSelection[plate.id] ?? false}
                        onChange={(e) => setWantSelection((prev) => ({ ...prev, [plate.id]: e.target.checked }))}
                      />
                      <span className="min-w-0 truncate">{plate.name}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[10px] text-[#8bada7]">
                  Wunschauswahl ist freies Katalog-Feld (Partnerinventar bleibt privat).
                </p>
              </div>
            </div>
            <XpButton
              variant="primary"
              className="mt-2 w-full"
              disabled={busy}
              onClick={() => void submit()}
            >
              Tausch-Angebot senden
            </XpButton>
            <p className="mt-1 text-[10px] text-[#8bada7]">
              Beide Seiten müssen bestätigen. Cooldown: 30 s zwischen Anfragen.
            </p>
          </>
        )}
      </XpGroupBox>

      {/* Eingehende Trades */}
      <XpGroupBox title={`Eingang (${incoming.length})`} className="mt-2">
        {incoming.length === 0 ? (
          <p className="text-[12px] text-[#8bada7]">Keine offenen Angebote.</p>
        ) : (
          incoming.map((trade) => <TradeRow key={trade.id} trade={trade} tradesApi={tradesApi} userId={userId} onChanged={onChanged} />)
        )}
      </XpGroupBox>

      {/* Ausgehende Trades */}
      <XpGroupBox title={`Ausgehend (${outgoing.length})`} className="mt-2">
        {outgoing.length === 0 ? (
          <p className="text-[12px] text-[#8bada7]">Keine offenen Angebote.</p>
        ) : (
          outgoing.map((trade) => <TradeRow key={trade.id} trade={trade} tradesApi={tradesApi} userId={userId} onChanged={onChanged} />)
        )}
      </XpGroupBox>

      {/* Historie */}
      <XpGroupBox title="Tausch-Historie" className="mt-2">
        {history.length === 0 ? (
          <p className="text-[12px] text-[#8bada7]">Noch keine abgeschlossenen Tauschgeschäfte.</p>
        ) : (
          <ul className="space-y-1 text-[11px] text-[#a9c4be]">
            {history.slice(0, 10).map((trade) => (
              <li key={trade.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {describeItems(trade.offered)} ⇄ {describeItems(trade.requested)}
                </span>
                <TradeStatusLabel status={trade.status} />
              </li>
            ))}
          </ul>
        )}
      </XpGroupBox>
    </div>
  )
}

/** Zeile eines Trades mit Aktionen (annehmen/ablehnen/zurückziehen). */
function TradeRow({ trade, tradesApi, userId, onChanged }: {
  trade: Trade
  tradesApi: ReturnType<typeof useTrades>
  userId: string
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isIncoming = trade.toUserId === userId
  const describe = (items: TradeItems) =>
    Object.entries(items)
      .map(([plateId, qty]) => `${getPlate(plateId)?.name ?? plateId}${qty > 1 ? ` ×${qty}` : ''}`)
      .join(', ') || '—'

  const act = async (accept: boolean) => {
    setBusy(true)
    setError(null)
    try {
      await tradesApi.respondToTrade(trade.id, accept)
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Aktion fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  const cancel = async () => {
    setBusy(true)
    setError(null)
    try {
      await tradesApi.cancelTrade(trade.id)
      onChanged()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Zurückziehen fehlgeschlagen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="glass-inset mb-1.5 p-2">
      <p className="text-[12px] text-[#dcefec]">
        <span className="font-bold">{isIncoming ? 'Von' : 'An'} Freund:</span>{' '}
        {describe(trade.offered)} ⇄ {describe(trade.requested)}
      </p>
      <div className="mt-1.5 flex gap-1.5">
        {isIncoming ? (
          <>
            <XpButton disabled={busy} className="!px-2 !py-1 !text-[11px]" onClick={() => void act(true)}>✓ Annehmen</XpButton>
            <XpButton disabled={busy} className="!px-2 !py-1 !text-[11px]" variant="danger" onClick={() => void act(false)}>✕ Ablehnen</XpButton>
          </>
        ) : (
          <XpButton
            disabled={busy}
            className="!px-2 !py-1 !text-[11px]"
            variant="danger"
            onClick={() => void cancel()}
          >
            Zurückziehen
          </XpButton>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-[10px] text-[#ff9b92]">{error}</p>}
    </div>
  )
}

function FriendRequestRow({ request, api }: { request: FriendRequest; api: ReturnType<typeof useFriends> }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const respond = async (accept: boolean) => {
    setBusy(true)
    setMessage(null)
    try {
      await api.respondRequest(request.id, accept)
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Anfrage konnte nicht verarbeitet werden.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="glass-inset mb-1 flex items-center justify-between gap-2 p-2">
      <span className="min-w-0 truncate text-[11px] text-[#dcefec]">Nutzer {request.fromUserId.slice(0, 8)} möchte Freund werden</span>
      <span className="flex gap-1">
        <XpButton disabled={busy} className="!px-2 !py-1 !text-[10px]" onClick={() => void respond(true)}>Annehmen</XpButton>
        <XpButton disabled={busy} variant="danger" className="!px-2 !py-1 !text-[10px]" onClick={() => void respond(false)}>Ablehnen</XpButton>
      </span>
      {message && <span role="alert" className="text-[10px] text-[#ff9b92]">{message}</span>}
    </div>
  )
}

function TradeStatusLabel({ status }: { status: Trade['status'] }) {
  const map: Record<Trade['status'], { label: string; color: string }> = {
    pending: { label: 'Offen', color: '#ffcf7e' },
    accepted: { label: 'Angenommen', color: '#5fd9a6' },
    declined: { label: 'Abgelehnt', color: '#ff8a7a' },
    cancelled: { label: 'Zurückgezogen', color: '#8bada7' },
  }
  const { label, color } = map[status]
  return <span className="shrink-0 font-bold" style={{ color }}>{label}</span>
}
