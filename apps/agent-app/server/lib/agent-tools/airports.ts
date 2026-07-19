import { parse } from 'csv-parse/sync'
import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { toolResult } from '../agent-workflows/types'
import { agentWorkerQuery } from './pg'

// Macro tool for sync-airports (dataset-sync.workflow.data.md): one call = one whole CSV file —
// etag conditional-GET, RFC-4180 parse, chunked upsert, sync bookkeeping. Rows never enter the
// model context. File list/order/coercions lifted from the retired airports/sync-airports.ts;
// OurAirports ships nightly public-domain CSVs, no API, no key
// (.claude/skills/airports-expert/SKILL.md).
const BASE_URL = 'https://davidmegginson.github.io/ourairports-data'
const CHUNK_SIZE = 1000

type CsvRecord = Record<string, string>

// edge coercions: every CSV value arrives as a string; empty means null
const s = (v: string | undefined) => {
  const t = v?.trim()
  return t ? t : null
}
const int = (v: string | undefined) => {
  const t = v?.trim()
  if (!t) return null
  const n = Number.parseInt(t, 10)
  return Number.isNaN(n) ? null : n
}
const num = (v: string | undefined) => {
  const t = v?.trim()
  if (!t) return null
  const n = Number.parseFloat(t)
  return Number.isNaN(n) ? null : n
}

const FILES: Record<string, { upsertFn: string; map: (r: CsvRecord) => Record<string, unknown> }> = {
  'countries.csv': {
    upsertFn: 'upsert_countries',
    map: (r) => ({
      id: int(r.id),
      code: s(r.code),
      name: s(r.name),
      continent: s(r.continent),
      wikipedia_link: s(r.wikipedia_link),
      keywords: s(r.keywords)
    })
  },
  'regions.csv': {
    upsertFn: 'upsert_regions',
    map: (r) => ({
      id: int(r.id),
      code: s(r.code),
      local_code: s(r.local_code),
      name: s(r.name),
      continent: s(r.continent),
      iso_country: s(r.iso_country),
      wikipedia_link: s(r.wikipedia_link),
      keywords: s(r.keywords)
    })
  },
  'airports.csv': {
    upsertFn: 'upsert_airports',
    map: (r) => ({
      id: int(r.id),
      ident: s(r.ident),
      type: s(r.type),
      name: s(r.name),
      latitude_deg: s(r.latitude_deg), // loc.location lat/lon are text columns
      longitude_deg: s(r.longitude_deg),
      elevation_ft: int(r.elevation_ft),
      continent: s(r.continent),
      iso_country: s(r.iso_country),
      iso_region: s(r.iso_region),
      municipality: s(r.municipality),
      scheduled_service: r.scheduled_service?.trim().toLowerCase() === 'yes',
      icao_code: s(r.icao_code),
      iata_code: s(r.iata_code),
      gps_code: s(r.gps_code),
      local_code: s(r.local_code),
      home_link: s(r.home_link),
      wikipedia_link: s(r.wikipedia_link),
      keywords: s(r.keywords)
    })
  },
  'runways.csv': {
    upsertFn: 'upsert_runways',
    map: (r) => ({
      id: int(r.id),
      airport_ref: int(r.airport_ref),
      length_ft: int(r.length_ft),
      width_ft: int(r.width_ft),
      surface: s(r.surface), // free text upstream — not an enum
      lighted: r.lighted?.trim() === '1',
      closed: r.closed?.trim() === '1',
      le_ident: s(r.le_ident),
      le_latitude_deg: s(r.le_latitude_deg),
      le_longitude_deg: s(r.le_longitude_deg),
      le_elevation_ft: int(r.le_elevation_ft),
      le_heading_deg_t: num(r.le_heading_degT), // upstream header is le_heading_degT
      le_displaced_threshold_ft: int(r.le_displaced_threshold_ft),
      he_ident: s(r.he_ident),
      he_latitude_deg: s(r.he_latitude_deg),
      he_longitude_deg: s(r.he_longitude_deg),
      he_elevation_ft: int(r.he_elevation_ft),
      he_heading_deg_t: num(r.he_heading_degT),
      he_displaced_threshold_ft: int(r.he_displaced_threshold_ft)
    })
  },
  'airport-frequencies.csv': {
    upsertFn: 'upsert_airport_frequencies',
    map: (r) => ({
      id: int(r.id),
      airport_ref: int(r.airport_ref),
      type: s(r.type), // free text upstream — not an enum
      description: s(r.description),
      frequency_mhz: num(r.frequency_mhz)
    })
  },
  'navaids.csv': {
    upsertFn: 'upsert_navaids',
    map: (r) => ({
      id: int(r.id),
      ident: s(r.ident),
      name: s(r.name),
      type: s(r.type),
      frequency_khz: num(r.frequency_khz),
      latitude_deg: s(r.latitude_deg),
      longitude_deg: s(r.longitude_deg),
      elevation_ft: int(r.elevation_ft),
      iso_country: s(r.iso_country),
      dme_frequency_khz: num(r.dme_frequency_khz),
      dme_channel: s(r.dme_channel),
      dme_latitude_deg: s(r.dme_latitude_deg),
      dme_longitude_deg: s(r.dme_longitude_deg),
      dme_elevation_ft: int(r.dme_elevation_ft),
      slaved_variation_deg: num(r.slaved_variation_deg),
      magnetic_variation_deg: num(r.magnetic_variation_deg),
      usage_type: s(r.usageType), // the one camelCase header in the dataset
      power: s(r.power),
      associated_airport: s(r.associated_airport)
    })
  }
}

export const AIRPORT_FILE_ORDER = Object.keys(FILES)

export const syncAirportFile = tool(
  'sync_airport_file',
  'Sync ONE OurAirports CSV file: etag conditional-GET (304 = free skip), parse, chunked ' +
    'upsert, record sync bookkeeping. Returns counts only — never rows. Idempotent.',
  { file: z.enum(AIRPORT_FILE_ORDER as [string, ...string[]]) },
  async ({ file }) => {
    const { upsertFn, map } = FILES[file]!

    const storedEtag = (
      await agentWorkerQuery<{ etag: string | null }>(
        'select etag from airports.sync_source where file = $1',
        [file]
      )
    ).rows[0]?.etag

    const headers: Record<string, string> = {}
    if (storedEtag) headers['If-None-Match'] = storedEtag

    const response = await fetch(`${BASE_URL}/${file}`, { headers })
    if (response.status === 304) {
      return toolResult({ file, skipped: true })
    }
    if (!response.ok) {
      throw new Error(`${file} request failed: ${response.status} ${response.statusText}`)
    }

    const records: CsvRecord[] = parse(await response.text(), {
      columns: true,
      skip_empty_lines: true,
      bom: true
    })

    let inserted = 0
    let updated = 0
    let skipped = 0
    let chunks = 0
    for (let offset = 0; offset < records.length; offset += CHUNK_SIZE) {
      const chunk = records.slice(offset, offset + CHUNK_SIZE).map(map)
      const upsert = (
        await agentWorkerQuery<{ result: { inserted: number; updated: number; skipped: number } }>(
          `select to_jsonb(airports_fn.${upsertFn}($1::jsonb)) as result`,
          [JSON.stringify(chunk)]
        )
      ).rows[0]!.result
      inserted += upsert.inserted
      updated += upsert.updated
      skipped += upsert.skipped
      chunks += 1
    }

    await agentWorkerQuery('select airports_fn.record_sync_source($1::citext, $2, $3, $4::int)', [
      file,
      response.headers.get('etag'),
      response.headers.get('last-modified'),
      records.length
    ])

    return toolResult({ file, rowCount: records.length, inserted, updated, skipped, chunks })
  }
)
