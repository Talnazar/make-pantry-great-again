import { getFirestore, doc, setDoc } from 'firebase/firestore'
import type { DocumentReference } from 'firebase/firestore'

// This app has no per-user login. Everyone who opens the site reads and writes
// ONE shared Firestore document, so the people sharing the list stay in sync.
export const COLLECTION_STATE = 'states'
export const SHARED_STATE_ID = 'shared'

export function sharedStateDoc(): DocumentReference {
  return doc(getFirestore(), COLLECTION_STATE, SHARED_STATE_ID)
}

export async function syncSharedState(data: Record<string, unknown>): Promise<void> {
  await setDoc(sharedStateDoc(), data, { merge: true })
}
