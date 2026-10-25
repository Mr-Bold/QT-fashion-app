import { supabase } from './supabase'

export type ClothGalleryRecord = {
  id: string
  name: string
  kind: 'fabric' | 'style'
  category: string
  color: string
  pattern: string
  details?: string
  photo?: string
  photoPath?: string
}

type GalleryRow = {
  id: string
  name: string
  kind: 'fabric' | 'style'
  category: string
  color: string
  pattern: string
  details: string | null
  photo_path: string | null
}

const bucketName = 'cloth-gallery'
const signedUrlLifetimeSeconds = 60 * 60 * 24

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

async function requireOwnerId(): Promise<string> {
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sign in again before managing the cloth gallery.')
  return data.user.id
}

async function uploadPhoto(
  ownerId: string,
  itemId: string,
  photo: string,
): Promise<string> {
  const response = await fetch(photo)
  if (!response.ok) throw new Error('The selected gallery photo could not be read.')
  const file = await response.blob()
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Gallery photos must be JPG or PNG images.')
  }
  const extension = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${ownerId}/gallery/${itemId}/${crypto.randomUUID()}.${extension}`
  const { error } = await requireSupabase().storage.from(bucketName).upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

async function resolvePhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter(Boolean))]
  const result = new Map<string, string>()
  if (!uniquePaths.length) return result

  const client = requireSupabase()
  for (let start = 0; start < uniquePaths.length; start += 100) {
    const batch = uniquePaths.slice(start, start + 100)
    const { data, error } = await client.storage
      .from(bucketName)
      .createSignedUrls(batch, signedUrlLifetimeSeconds)
    if (error) throw error
    for (const photo of data) {
      if (photo.error || !photo.path || !photo.signedUrl) {
        throw new Error(`A gallery photo could not be loaded: ${photo.error ?? 'signed URL missing'}`)
      }
      result.set(photo.path, photo.signedUrl)
    }
  }
  return result
}

function rowsToRecords(rows: GalleryRow[], photoUrls: Map<string, string>): ClothGalleryRecord[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    category: row.category,
    color: row.color,
    pattern: row.pattern,
    ...(row.details ? { details: row.details } : {}),
    ...(row.photo_path
      ? { photo: photoUrls.get(row.photo_path), photoPath: row.photo_path }
      : {}),
  }))
}

export async function loadClothGalleryRecords(): Promise<ClothGalleryRecord[]> {
  const client = requireSupabase()
  await requireOwnerId()
  const { data, error } = await client
    .from('cloth_gallery_items')
    .select('id,name,kind,category,color,pattern,details,photo_path')
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []) as GalleryRow[]
  const photoUrls = await resolvePhotoUrls(
    rows.flatMap((row) => (row.photo_path ? [row.photo_path] : [])),
  )
  return rowsToRecords(rows, photoUrls)
}

async function prepareRecord(
  ownerId: string,
  record: ClothGalleryRecord,
): Promise<{ row: Omit<GalleryRow, 'photo_path'> & { photo_path: string | null }; uploadedPath?: string }> {
  let photoPath = record.photoPath ?? null
  let uploadedPath: string | undefined
  if (record.photo?.startsWith('data:')) {
    uploadedPath = await uploadPhoto(ownerId, record.id, record.photo)
    photoPath = uploadedPath
  }
  return {
    row: {
      id: record.id,
      name: record.name,
      kind: record.kind,
      category: record.category,
      color: record.color,
      pattern: record.pattern,
      details: record.details ?? null,
      photo_path: photoPath,
    },
    ...(uploadedPath ? { uploadedPath } : {}),
  }
}

async function removeUploadedPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return
  const { error } = await requireSupabase().storage.from(bucketName).remove(paths)
  if (error) throw error
}

export async function importClothGalleryRecords(
  records: ClothGalleryRecord[],
): Promise<ClothGalleryRecord[]> {
  if (!records.length) return []
  const client = requireSupabase()
  const ownerId = await requireOwnerId()
  const prepared: Awaited<ReturnType<typeof prepareRecord>>[] = []
  try {
    for (const record of records) prepared.push(await prepareRecord(ownerId, record))
    const { error } = await client.from('cloth_gallery_items').insert(
      prepared.map(({ row }) => ({ ...row, owner_id: ownerId })),
    )
    if (error) throw error
  } catch (error) {
    try {
      await removeUploadedPhotos(
        prepared.flatMap(({ uploadedPath }) => (uploadedPath ? [uploadedPath] : [])),
      )
    } catch (cleanupError) {
      console.error('Could not remove gallery photos after an unsuccessful import.', cleanupError)
    }
    throw error
  }
  return loadClothGalleryRecords()
}

export async function saveClothGalleryRecord(
  record: ClothGalleryRecord,
): Promise<{ record: ClothGalleryRecord; cleanupWarning?: string }> {
  const client = requireSupabase()
  const ownerId = await requireOwnerId()
  const { data: existingRow, error: lookupError } = await client
    .from('cloth_gallery_items')
    .select('photo_path')
    .eq('id', record.id)
    .maybeSingle()
  if (lookupError) throw lookupError

  const prepared = await prepareRecord(ownerId, record)
  const { error: saveError } = await client
    .from('cloth_gallery_items')
    .upsert({ ...prepared.row, owner_id: ownerId }, { onConflict: 'id' })
  if (saveError) {
    if (prepared.uploadedPath) {
      try {
        await removeUploadedPhotos([prepared.uploadedPath])
      } catch (cleanupError) {
        console.error('Could not remove an unreferenced gallery photo.', cleanupError)
      }
    }
    throw saveError
  }

  let cleanupWarning: string | undefined
  const oldPhotoPath = (existingRow as { photo_path: string | null } | null)?.photo_path
  if (oldPhotoPath && oldPhotoPath !== prepared.row.photo_path) {
    try {
      await removeUploadedPhotos([oldPhotoPath])
    } catch (error) {
      console.error('The gallery item was saved, but its previous photo could not be removed.', error)
      cleanupWarning = 'The item was saved, but its previous photo could not be removed.'
    }
  }

  const photoUrls = await resolvePhotoUrls(
    prepared.row.photo_path ? [prepared.row.photo_path] : [],
  )
  return {
    record: rowsToRecords([prepared.row as GalleryRow], photoUrls)[0],
    ...(cleanupWarning ? { cleanupWarning } : {}),
  }
}

export async function deleteClothGalleryRecord(
  record: ClothGalleryRecord,
): Promise<string | undefined> {
  const client = requireSupabase()
  await requireOwnerId()
  const { data, error: lookupError } = await client
    .from('cloth_gallery_items')
    .select('photo_path')
    .eq('id', record.id)
    .maybeSingle()
  if (lookupError) throw lookupError

  const { error } = await client.from('cloth_gallery_items').delete().eq('id', record.id)
  if (error) throw error
  const photoPath = (data as { photo_path: string | null } | null)?.photo_path
  if (!photoPath) return undefined
  try {
    await removeUploadedPhotos([photoPath])
    return undefined
  } catch (cleanupError) {
    console.error('The gallery item was deleted, but its photo could not be removed.', cleanupError)
    return 'The item was removed, but its photo could not be deleted from storage.'
  }
}

export async function photoAsDataUrl(photo: string): Promise<string> {
  if (photo.startsWith('data:')) return photo
  const response = await fetch(photo)
  if (!response.ok) throw new Error('The style photo could not be loaded.')
  const file = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('The style photo could not be prepared for customer history.'))
        return
      }
      resolve(reader.result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('The style photo could not be read.'))
    reader.readAsDataURL(file)
  })
}
