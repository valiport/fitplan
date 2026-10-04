// SQL-Parität: Klienten-Konstanten MÜSSEN mit collection-setup.sql/setup.sql
// übereinstimmen — jede Abweichung wäre nach Deploy ein ökonomischer Defekt
// (falsche Mindestpreise, unbekannte Plate-IDs, abweichende Drop-Raten).

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COINS_PER_CHECK, MIN_PRICE, PLATES, RARITY_WEIGHTS, platesOfRarity } from './plates'

// Vitest liefert hier keine file://-URL → relativ zum Projektroot (cwd) auflösen
const collectionSql = readFileSync(resolve(process.cwd(), 'supabase/collection-setup.sql'), 'utf8')
const baseSql = readFileSync(resolve(process.cwd(), 'supabase/setup.sql'), 'utf8')

describe('SQL-Parität: create_listing vs MIN_PRICE', () => {
  it('jede Plate hat im SQL exakt den Client-Mindestpreis', () => {
    // CASE-Auswahl aus dem RPC isolieren
    const caseStart = collectionSql.indexOf('v_min_price := case p_plate')
    expect(caseStart).toBeGreaterThan(-1)
    const caseEnd = collectionSql.indexOf('else null end', caseStart)
    const block = collectionSql.slice(caseStart, caseEnd)
    const pairs = [...block.matchAll(/when '([a-z0-9-]+)' then (\d+)/g)]
    expect(pairs.length).toBe(PLATES.length)
    const sqlPrices = new Map(pairs.map((m) => [m[1], Number(m[2])]))
    for (const plate of PLATES) {
      expect(sqlPrices.get(plate.id), `Mindestpreis ${plate.id}`).toBe(MIN_PRICE[plate.rarity])
    }
  })
})

describe('SQL-Parität: öffentliche Marktprofile', () => {
  it('trennt Markt-Spitznamen vom privaten Fitnessprofil', () => {
    expect(collectionSql).toContain('create table if not exists public.market_profiles')
    expect(collectionSql).toContain("revoke all on public.market_profiles from public, anon, authenticated")
    expect(collectionSql).toContain('grant select on public.market_profiles to authenticated')
    expect(collectionSql).toContain('create policy "Authenticated users read market display names"')
    expect(collectionSql).toContain('create or replace function public.set_market_display_name(p_display_name text)')
    expect(collectionSql).toContain('v_me uuid := (select auth.uid());')
    expect(collectionSql).toContain('values (v_me, v_name, now())')
    expect(collectionSql).toContain("grant execute on function public.set_market_display_name(text) to authenticated")
    expect(collectionSql).toContain("'market_profiles'] loop")
  })
})

describe('SQL-Parität: Plate-IDs', () => {
  it('Tausch-Whitelist im create_trade enthält genau den Client-Katalog', () => {
    const matches = [...collectionSql.matchAll(/'([a-z0-9-]+)','([a-z0-9-]+)','([a-z0-9-]+)','([a-z0-9-]+)','([a-z0-9-]+)','([a-z0-9-]+)','([a-z0-9-]+)','([a-z0-9-]+)','([a-z0-9-]+)','([a-z0-9-]+)'/g)]
    expect(matches.length).toBeGreaterThan(0)
    for (const match of matches) {
      const ids = match.slice(1)
      expect([...ids].sort()).toEqual(PLATES.map((p) => p.id).sort())
    }
  })

  it('Drop-Pools im claim_check_reward decken alle Platten je Stufe ab', () => {
    const poolStart = collectionSql.indexOf('v_pool := case v_rarity')
    expect(poolStart).toBeGreaterThan(-1)
    const poolEnd = collectionSql.indexOf('v_plate :=', poolStart)
    const block = collectionSql.slice(poolStart, poolEnd)
    const pools = [...block.matchAll(/array\[([^\]]+)\]/g)]
    expect(pools.length).toBe(5)
    for (const pool of pools) {
      const ids = [...pool[1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1])
      // Finde die Stufe: letztvorhergehende when-/else-Zeile
      const idx = pool.index ?? 0
      const before = block.slice(0, idx)
      const rarityMatch = /when '(\w+)' then\s*$/m.exec(before.slice(before.lastIndexOf('case')))
      const expectedRarity = rarityMatch?.[1] ?? 'legendary'
      const expected = platesOfRarity(expectedRarity as never).map((p) => p.id)
      expect([...ids].sort()).toEqual(expected.sort())
    }
  })
})

describe('SQL-Parität: Wirtschaftskonstanten', () => {
  it('Coins pro Check stimmen überein', () => {
    expect(collectionSql).toContain(`set coins = coins + ${COINS_PER_CHECK},`)
  })

  it('Drop-Schwellen im SQL entsprechen den Client-Basisgewichten (60/25/10/4/1)', () => {
    // Kumulierte Schwellen aus dem SQL lesen
    const claimStart = collectionSql.indexOf('v_rarity := case when v_roll')
    expect(claimStart).toBeGreaterThan(-1)
    const claimEnd = collectionSql.indexOf("else 'legendary'", claimStart)
    const block = collectionSql.slice(claimStart, claimEnd)
    const thresholds = [...block.matchAll(/v_roll < (\d+) then '(\w+)'/g)]
    expect(thresholds.map((m) => m[2])).toEqual(['common', 'uncommon', 'rare', 'epic'])
    let cumulative = 0
    for (const [, threshold, rarity] of thresholds) {
      cumulative += RARITY_WEIGHTS[rarity as keyof typeof RARITY_WEIGHTS]
      expect(Number(threshold), `kumulierte Schwelle ${rarity}`).toBe(cumulative)
    }
  })

  it('Upgrade-Kosten von 3 Duplikaten stimmen überein', () => {
    expect(collectionSql).toContain('v_remaining int := 3;')
    expect(collectionSql).toContain('Mindestens drei Platten dieser Stufe nötig.')
  })
})

describe('SQL-Parität: Check-IDs (day_checks)', () => {
  it('Client-RegEx und DB-Constraint sind identisch', () => {
    const constraint = /check_id ~ '\^([^']+)\$'/.exec(baseSql)
    expect(constraint).not.toBeNull()
    const dbPattern = new RegExp(`^${constraint![1]}$`)
    const clientPattern = /^d[0-6]-(workout-0|meal-[0-3])$/
    const samples = [
      'd0-workout-0', 'd6-workout-0', 'd3-meal-0', 'd3-meal-3',
      'd7-workout-0', 'd0-meal-4', 'd0-workout-1', 'meal-0', 'd3-workout',
    ]
    for (const id of samples) {
      expect(dbPattern.test(id), id).toBe(clientPattern.test(id))
    }
  })

  it('claim-Regex im RPC akzeptiert dieselben IDs', () => {
    const rpcCheck = /p_check !~ '([^']+)'/.exec(collectionSql)
    expect(rpcCheck).not.toBeNull()
    expect(rpcCheck![1]).toBe(/^d[0-6]-(workout-0|meal-[0-3])$/.source)
  })
})
