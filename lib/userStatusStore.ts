import fs from 'fs/promises'
import path from 'path'

const STORE_DIR = path.join(process.cwd(), 'data')
const STORE_FILE = path.join(STORE_DIR, 'user-status.json')

async function ensureStore() {
  try {
    await fs.mkdir(STORE_DIR, { recursive: true })
    try {
      await fs.access(STORE_FILE)
    } catch {
      await fs.writeFile(STORE_FILE, JSON.stringify({}, null, 2), 'utf-8')
    }
  } catch (err) {
    console.error('Failed to ensure user status store:', err)
    throw err
  }
}

async function readStore(): Promise<Record<string, boolean>> {
  await ensureStore()
  const raw = await fs.readFile(STORE_FILE, 'utf-8')
  try {
    const json = JSON.parse(raw)
    return json && typeof json === 'object' ? json : {}
  } catch {
    return {}
  }
}

async function writeStore(map: Record<string, boolean>) {
  await ensureStore()
  await fs.writeFile(STORE_FILE, JSON.stringify(map, null, 2), 'utf-8')
}

export async function getIsActive(userId: string): Promise<boolean> {
  const store = await readStore()
  const val = store[userId]
  return typeof val === 'boolean' ? val : true
}

export async function setIsActive(userId: string, isActive: boolean): Promise<void> {
  const store = await readStore()
  store[userId] = !!isActive
  await writeStore(store)
}

export async function removeStatus(userId: string): Promise<void> {
  const store = await readStore()
  if (userId in store) {
    delete store[userId]
    await writeStore(store)
  }
}