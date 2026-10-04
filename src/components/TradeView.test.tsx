import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TradeView from './TradeView'
import MarketView from './MarketView'
import type { useFriends, useMarket, useTrades } from '../hooks/useCollectionSocial'

const userId = 'befce79e-503a-4403-89bf-ed73be442a2d'
const saveDisplayName = vi.fn()
const sendRequest = vi.fn()
const onChanged = vi.fn()
const onError = vi.fn()

const friendsApi = {
  friends: [],
  requests: [],
  displayName: '',
  setDisplayName: saveDisplayName,
  sendRequest,
  respondRequest: vi.fn(),
  removeFriend: vi.fn(),
  loading: false,
  error: null,
  reload: vi.fn(),
} as unknown as ReturnType<typeof useFriends>

const tradesApi = {
  trades: [],
  loading: false,
  error: null,
  createTrade: vi.fn(),
  respondToTrade: vi.fn(),
  cancelTrade: vi.fn(),
  reload: vi.fn(),
} as unknown as ReturnType<typeof useTrades>

beforeEach(() => {
  vi.clearAllMocks()
  saveDisplayName.mockResolvedValue(undefined)
  sendRequest.mockResolvedValue(undefined)
})

describe('Freunde- und Marktoberfläche', () => {
  it('zeigt die eigene UUID an und kopiert sie auf Knopfdruck', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    render(<TradeView
      userId={userId}
      inventory={{}}
      friendsApi={friendsApi}
      tradesApi={tradesApi}
      onChanged={onChanged}
    />)

    expect(screen.getByText(userId)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'ID kopieren' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(userId))
    expect(await screen.findByRole('button', { name: 'Kopiert ✓' })).toBeTruthy()
  })

  it('speichert den öffentlichen Spitznamen über die Friends-API', async () => {
    render(<TradeView
      userId={userId}
      inventory={{}}
      friendsApi={friendsApi}
      tradesApi={tradesApi}
      onChanged={onChanged}
    />)

    fireEvent.change(screen.getByLabelText('Öffentlicher Markt-Spitzname'), {
      target: { value: 'FitPlanFan' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))

    await waitFor(() => expect(saveDisplayName).toHaveBeenCalledWith('FitPlanFan'))
    expect((await screen.findByRole('status')).textContent).toContain('Dein Markt-Spitzname wurde gespeichert.')
  })

  it('zeigt Markt-Spitznamen bei Angeboten und erlaubt Kauf', async () => {
    const buyListing = vi.fn().mockResolvedValue(undefined)
    const marketApi = {
      listings: [{
        id: 'listing-1',
        sellerId: 'seller-1',
        sellerName: 'PlattenSammler',
        plateId: 'cp-125',
        price: 15,
        status: 'active',
        createdAt: '2026-10-01T10:00:00Z',
      }],
      ownListings: [],
      transactions: [],
      loading: false,
      error: null,
      createListing: vi.fn(),
      buyListing,
      cancelListing: vi.fn(),
      reload: vi.fn(),
    } as unknown as ReturnType<typeof useMarket>

    render(<MarketView
      coins={100}
      inventory={{}}
      marketApi={marketApi}
      onChanged={onChanged}
      onError={onError}
    />)

    expect(screen.getByText(/von PlattenSammler/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Kaufen' }))
    await waitFor(() => expect(buyListing).toHaveBeenCalledWith('listing-1'))
  })
})
