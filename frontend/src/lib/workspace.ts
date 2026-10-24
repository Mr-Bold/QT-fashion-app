import { supabase } from './supabase'
import { loadCachedWorkspace, saveCachedWorkspace } from './offline-cache'

type Row = Record<string, unknown>
type PaymentMethod = 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Other'
type TaskPriority = 'High' | 'Medium' | 'Low'

export type WorkspaceCustomer = {
  id: string
  dbId: string
  name: string
  phone: string
  whatsapp?: string
  email?: string
  address?: string
  gender?: string
  garment: string
  orders: number
  measurementsSaved: boolean
  photo: string
}

export type WorkspaceOrder = {
  id: string
  dbId: string
  createdAt: string
  customerId?: string
  customer: string
  item: string
  status: 'Pending' | 'Cutting' | 'Sewing' | 'Fitting' | 'Completed' | 'Delivered'
  date: string
  amount: number
  quantity?: number
  unitPrice?: number
  clothAmount?: number
  discountAmount?: number
}

export type WorkspacePayment = {
  id: string
  orderId: string
  orderUuid: string
  customer: string
  total: number
  paid: number
  method: 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Other' | '—'
  date: string
}

export type WorkspacePaymentTransaction = {
  id: string
  orderId: string
  orderUuid: string
  customer: string
  amount: number
  method: 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Other'
  reference: string
  date: string
  recordedBy: string
  status: 'Confirmed' | 'Pending'
}

export type WorkspaceTask = {
  id: string
  dbId?: string
  orderUuid?: string
  assigneeId?: string
  title: string
  description?: string
  checklist: Array<{ id: string; label: string; completed: boolean }>
  referencePhotos?: Array<{ url: string; caption: string; kind: 'garment' | 'style' }>
  assignee: string
  orderId: string
  dueDate: string
  priority: 'High' | 'Medium' | 'Low'
  status: 'To do' | 'Accepted' | 'In progress' | 'Review' | 'Revision requested' | 'Done'
}

export type WorkspaceTaskChecklistItem = { id: string; label: string; completed: boolean }

export type WorkspaceTaskUpdate = {
  id: string
  taskId: string
  updatedBy: string
  actor: string
  previousStatus: string
  newStatus: string
  comment: string
  createdAt: string
}

export type WorkspaceApprentice = {
  id: string
  userId: string
  name: string
  email: string
  phone: string
  focus: string
  level: string
  hours: number
  joined: string
  assignment: string
  status: 'Active' | 'On leave' | 'Completed'
  notes: string
}

export type WorkspaceApprenticeTrainingRecord = {
  id: string
  apprenticeId: string
  kind: 'hours' | 'skill' | 'attendance' | 'leave'
  date: string
  hours?: number
  activity?: string
  skillName?: string
  skillLevel?: 'Learning' | 'Confident'
  attendanceStatus?: 'Present' | 'Late' | 'Absent'
  leaveEndDate?: string
  notes?: string
}

export type WorkspaceMeasurement = {
  id: string
  customerId: string
  categoryId: string
  customer: string
  date: string
  unit: 'inches' | 'cm'
  fields: Array<{ name: string; value: string }>
  previousSessionId?: string
  garmentPhotos: Array<{ url: string; path: string }>
  stylePhotos: Array<{ url: string; path: string }>
}

export type WorkspaceCustomerNote = {
  id: string
  customerId: string
  text: string
  author: string
  createdAt: string
}

export type WorkspaceShopSettings = {
  shopName: string
  phone: string
  email: string
  address: string
  currency: 'GHS' | 'USD'
  measurements: 'Inches' | 'Centimeters'
  notifications: {
    dueTasks: boolean
    paymentReceived: boolean
    deliveryReminders: boolean
    weeklySummary: boolean
  }
}

export type WorkspaceData = {
  customers: WorkspaceCustomer[]
  orders: WorkspaceOrder[]
  payments: WorkspacePayment[]
  paymentTransactions: WorkspacePaymentTransaction[]
  tasks: WorkspaceTask[]
  taskUpdates: WorkspaceTaskUpdate[]
  apprentices: WorkspaceApprentice[]
  apprenticeTrainingRecords: WorkspaceApprenticeTrainingRecord[]
  availableApprenticeProfiles: Array<{ userId: string; name: string; email: string; phone: string }>
  measurements: WorkspaceMeasurement[]
  measurementPresets: Record<string, string[]>
  measurementPresetClothAmounts: Record<string, number>
  userRole: string
  passwordSetupRequired: boolean
  customerNotes: WorkspaceCustomerNote[]
  measurementCategoryCounts: Record<string, number>
  shopSettings: WorkspaceShopSettings | null
}

function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? data as Row[] : []
}

function taskChecklist(value: unknown): WorkspaceTaskChecklistItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is WorkspaceTaskChecklistItem =>
    Boolean(item) && typeof item === 'object'
    && 'id' in item && typeof item.id === 'string'
    && 'label' in item && typeof item.label === 'string'
    && 'completed' in item && typeof item.completed === 'boolean',
  )
}

function text(row: Row, key: string, fallback = ''): string {
  const value = row[key]
  return typeof value === 'string' ? value : fallback
}

function numeric(row: Row, key: string, fallback = 0): number {
  const value = row[key]
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatDate(value: string, fallback = '—'): string {
  if (!value) return fallback
  const date = new Date(`${value.slice(0, 10)}T12:00:00`)
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const customGarmentCategoryPrefix = 'custom-garment:'

function customGarmentCategoryId(name: string): string {
  return `${customGarmentCategoryPrefix}${encodeURIComponent(name.trim())}`
}

function customGarmentNameFromCategoryId(categoryId: string): string | null {
  if (!categoryId.startsWith(customGarmentCategoryPrefix)) return null
  try {
    return decodeURIComponent(categoryId.slice(customGarmentCategoryPrefix.length))
  } catch {
    return null
  }
}

function categoryIdForGarment(garmentType: string, customGarmentNames: string[] = []): string {
  const customName = customGarmentNames.find(
    (name) => name.toLocaleLowerCase() === garmentType.trim().toLocaleLowerCase(),
  )
  if (customName) return customGarmentCategoryId(customName)
  const value = garmentType.toLowerCase()
  if (value.includes('blouse') || value.includes('top')) return 'tops-blouses'
  if (value.includes('trouser') && value.includes('male')) return 'trousers-male'
  if (value.includes('trouser')) return 'trousers-female'
  if (value.includes('shirt') || value.includes('suit')) return value.includes('shirt') ? 'shirts-male' : 'suits'
  if (value.includes('traditional') || value.includes('kaftan')) return 'traditional-wear'
  return 'dress-female'
}

function orderStatusFromDatabase(status: string): WorkspaceOrder['status'] {
  const statuses: Record<string, WorkspaceOrder['status']> = {
    pending: 'Pending',
    confirmed: 'Cutting',
    in_production: 'Sewing',
    fitting: 'Fitting',
    ready_for_collection: 'Completed',
    delivered: 'Delivered',
    cancelled: 'Completed',
  }
  return statuses[status] ?? 'Pending'
}

function taskStatusFromDatabase(status: string): WorkspaceTask['status'] {
  if (status === 'accepted') return 'Accepted'
  if (status === 'in_progress') return 'In progress'
  if (status === 'submitted_for_review') return 'Review'
  if (status === 'revision_required') return 'Revision requested'
  if (['approved', 'completed', 'cancelled'].includes(status)) return 'Done'
  return 'To do'
}

function taskUpdateStatusLabel(status: string): string {
  return {
    assigned: 'Assigned',
    accepted: 'Accepted',
    in_progress: 'In progress',
    submitted_for_review: 'Submitted for review',
    revision_required: 'Revision requested',
    approved: 'Approved',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }[status] ?? status
}

async function resolveCustomerPhoto(path: string): Promise<string> {
  if (!path || path.startsWith('/')) return path || '/customer-portraits/ama.jpg'
  const client = requireSupabase()
  const { data, error } = await client.storage.from('customer-photos').createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

async function createSignedPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter((path) => path && !path.startsWith('/')))]
  const signedPhotoUrls = new Map<string, string>()
  if (!uniquePaths.length) return signedPhotoUrls

  const client = requireSupabase()
  const batchSize = 100
  const batches: string[][] = []
  for (let index = 0; index < uniquePaths.length; index += batchSize) {
    batches.push(uniquePaths.slice(index, index + batchSize))
  }
  const results = await Promise.all(
    batches.map((batch) => client.storage.from('customer-photos').createSignedUrls(batch, 3600)),
  )

  for (const result of results) {
    if (result.error) throw result.error
    for (const photo of result.data) {
      if (photo.error) throw new Error(`A shop photo could not be loaded: ${photo.error}`)
      if (!photo.path || !photo.signedUrl) {
        throw new Error('A shop photo could not be loaded because its signed URL is missing.')
      }
      signedPhotoUrls.set(photo.path, photo.signedUrl)
    }
  }

  return signedPhotoUrls
}

function getSignedPhotoUrl(path: string, signedPhotoUrls: Map<string, string>): string {
  const signedUrl = signedPhotoUrls.get(path)
  if (!signedUrl) throw new Error('A shop photo could not be loaded because its signed URL is missing.')
  return signedUrl
}

function getLoadedPhotoUrl(
  path: string,
  signedPhotoUrls: Map<string, string>,
  fallback: string,
): string {
  if (!path) return fallback
  return path.startsWith('/') ? path : getSignedPhotoUrl(path, signedPhotoUrls)
}

async function uploadCustomerPhoto(file: File): Promise<string> {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in again before uploading a customer photo.')
  const extension = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userData.user.id}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('customer-photos').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

async function uploadMeasurementPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Measurement photos must be JPG or PNG files under 5 MB.')
  }
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in again before uploading measurement photos.')
  const extension = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `${userData.user.id}/measurements/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('customer-photos').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return path
}

async function removeMeasurementPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return
  const { error } = await requireSupabase().storage.from('customer-photos').remove(paths)
  if (error) throw error
}

function getMeasurementPhotoPaths(sessions: Row[]): string[] {
  return sessions.flatMap((session) => [
    ...(Array.isArray(session.garment_photo_paths)
      ? session.garment_photo_paths.filter((path): path is string => typeof path === 'string')
      : []),
    ...(Array.isArray(session.style_photo_paths)
      ? session.style_photo_paths.filter((path): path is string => typeof path === 'string')
      : []),
  ])
}

async function attachTaskReferencePhotos(
  tasks: WorkspaceTask[],
  ordersById: Map<string, Row>,
  sessions: Row[],
  signedPhotoUrls: Map<string, string>,
): Promise<WorkspaceTask[]> {
  const sortedSessions = [...sessions].sort((first, second) =>
    text(second, 'measurement_date').localeCompare(text(first, 'measurement_date')),
  )
  return Promise.all(tasks.map(async (task) => {
    const order = ordersById.get(task.dbId ?? '')
    const customerId = order ? text(order, 'customer_id') : ''
    if (!customerId) return task
    const matchingSessions = sortedSessions.filter((session) => text(session, 'customer_id') === customerId)
    const orderCategory = categoryIdForGarment(text(order ?? {}, 'garment_type'))
    const session = matchingSessions.find((candidate) => categoryIdForGarment(text(candidate, 'garment_type')) === orderCategory)
      ?? matchingSessions[0]
    if (!session) return task

    const garmentPaths = Array.isArray(session.garment_photo_paths)
      ? session.garment_photo_paths.filter((path): path is string => typeof path === 'string')
      : []
    const stylePaths = Array.isArray(session.style_photo_paths)
      ? session.style_photo_paths.filter((path): path is string => typeof path === 'string')
      : []
    const referencePhotos = await Promise.all([
      ...garmentPaths.map(async (path, index) => ({
        url: getSignedPhotoUrl(path, signedPhotoUrls),
        caption: `Garment reference ${index + 1}`,
        kind: 'garment' as const,
      })),
      ...stylePaths.map(async (path, index) => ({
        url: getSignedPhotoUrl(path, signedPhotoUrls),
        caption: `Style reference ${index + 1}`,
        kind: 'style' as const,
      })),
    ])
    return { ...task, referencePhotos }
  }))
}

function emptyWorkspaceData(userRole: string, passwordSetupRequired: boolean): WorkspaceData {
  return {
    customers: [],
    orders: [],
    payments: [],
    paymentTransactions: [],
    tasks: [],
    taskUpdates: [],
    apprentices: [],
    apprenticeTrainingRecords: [],
    availableApprenticeProfiles: [],
    measurements: [],
    measurementPresets: {},
    measurementPresetClothAmounts: {},
    userRole,
    passwordSetupRequired,
    customerNotes: [],
    measurementCategoryCounts: {},
    shopSettings: null,
  }
}

async function loadApprenticeWorkspace(profile: Row, passwordSetupRequired: boolean): Promise<WorkspaceData> {
  const client = requireSupabase()
  const userId = text(profile, 'id')
  const [apprenticeResult, tasksResult, updatesResult] = await Promise.all([
    client.from('apprentice_profiles')
      .select('user_id,start_date,skill_level,specialization,status,notes')
      .eq('user_id', userId)
      .maybeSingle(),
    client.from('tasks')
      .select('id,order_id,title,description,checklist,assigned_to,priority,status,deadline')
      .eq('assigned_to', userId)
      .order('deadline', { ascending: true, nullsFirst: false }),
    client.from('task_updates')
      .select('id,task_id,updated_by,previous_status,new_status,comment,created_at')
      .order('created_at', { ascending: false }),
  ])
  for (const result of [apprenticeResult, tasksResult, updatesResult]) {
    if (result.error) throw result.error
  }
  if (!apprenticeResult.data) throw new Error('This apprentice account is not linked to an active training profile.')
  const apprenticeRow = apprenticeResult.data as Row
  const apprenticeStatus = text(apprenticeRow, 'status')
  if (!['active', 'on_leave'].includes(apprenticeStatus) || profile.is_active !== true) {
    throw new Error('This apprentice account is inactive. Contact the shop owner for access.')
  }
  const taskRows = asRows(tasksResult.data)
  const orderIds = [...new Set(taskRows.map((row) => text(row, 'order_id')).filter(Boolean))]
  let orderById = new Map<string, Row>()
  if (orderIds.length) {
    const { data, error } = await client.from('orders')
      .select('id,order_number,customer_id,garment_type')
      .in('id', orderIds)
    if (error) throw error
    orderById = new Map(asRows(data).map((row) => [text(row, 'id'), row]))
  }
  const customerIds = [...new Set([...orderById.values()].map((row) => text(row, 'customer_id')).filter(Boolean))]
  let taskReferenceSessions: Row[] = []
  if (customerIds.length) {
    const { data, error } = await client.from('measurement_sessions')
      .select('customer_id,garment_type,measurement_date,garment_photo_paths,style_photo_paths')
      .in('customer_id', customerIds)
      .order('measurement_date', { ascending: false })
    if (error) throw error
    taskReferenceSessions = asRows(data)
  }
  const signedPhotoUrls = await createSignedPhotoUrls(getMeasurementPhotoPaths(taskReferenceSessions))
  const tasks: WorkspaceTask[] = taskRows.map((row) => {
    const order = orderById.get(text(row, 'order_id'))
    const orderNumber = order ? numeric(order, 'order_number') : 0
    return {
      id: `TSK-${text(row, 'id').slice(0, 8)}`,
      dbId: text(row, 'id'),
      orderUuid: text(row, 'order_id'),
      assigneeId: userId,
      title: text(row, 'title', 'Task'),
      description: text(row, 'description'),
      checklist: taskChecklist(row.checklist),
      assignee: text(profile, 'full_name', 'Apprentice'),
      orderId: orderNumber ? `#ORD-${String(orderNumber).padStart(5, '0')}` : '',
      dueDate: text(row, 'deadline'),
      priority: ['urgent', 'high'].includes(text(row, 'priority')) ? 'High' : text(row, 'priority') === 'low' ? 'Low' : 'Medium',
      status: taskStatusFromDatabase(text(row, 'status')),
    }
  })
  const tasksWithReferences = await attachTaskReferencePhotos(tasks, orderById, taskReferenceSessions, signedPhotoUrls)
  const taskUpdates: WorkspaceTaskUpdate[] = asRows(updatesResult.data).map((row) => ({
    id: text(row, 'id'),
    taskId: text(row, 'task_id'),
    updatedBy: text(row, 'updated_by'),
    actor: text(row, 'updated_by') === userId ? text(profile, 'full_name', 'Apprentice') : 'Shop owner',
    previousStatus: taskUpdateStatusLabel(text(row, 'previous_status')),
    newStatus: taskUpdateStatusLabel(text(row, 'new_status')),
    comment: text(row, 'comment'),
    createdAt: text(row, 'created_at'),
  }))
  const apprentice: WorkspaceApprentice = {
    id: `APP-${userId.slice(0, 8)}`,
    userId,
    name: text(profile, 'full_name', 'Apprentice'),
    email: text(profile, 'email'),
    phone: text(profile, 'phone'),
    focus: text(apprenticeRow, 'specialization', 'General tailoring'),
    level: text(apprenticeRow, 'skill_level', 'beginner').replace(/^./, (letter) => letter.toUpperCase()),
    hours: 0,
    joined: formatDate(text(apprenticeRow, 'start_date')),
    assignment: tasksWithReferences.find((task) => task.status !== 'Done')?.title ?? 'Not assigned',
    status: apprenticeStatus === 'on_leave' ? 'On leave' : 'Active',
    notes: text(apprenticeRow, 'notes'),
  }
  return {
    ...emptyWorkspaceData('apprentice', passwordSetupRequired),
    apprentices: [apprentice],
    tasks: tasksWithReferences,
    taskUpdates,
  }
}

async function loadWorkspaceFromServer(
  onUserRoleResolved?: (role: string) => void,
): Promise<WorkspaceData | null> {
  if (!supabase) return null

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in again before loading the shop workspace.')
  const { data: ownProfile, error: ownProfileError } = await supabase.from('profiles')
    .select('id,full_name,email,phone,role,is_active')
    .eq('id', userData.user.id)
    .single()
  if (ownProfileError) throw ownProfileError
  const passwordSetupRequired = userData.user.app_metadata.password_setup_required === true
  const ownProfileRow = ownProfile as Row
  const userRole = text(ownProfileRow, 'role')
  if (userRole === 'apprentice') {
    const workspace = await loadApprenticeWorkspace(ownProfileRow, passwordSetupRequired)
    onUserRoleResolved?.(workspace.userRole)
    return workspace
  }
  if (userRole !== 'owner' || ownProfileRow.is_active !== true) {
    throw new Error('This account does not have active shop-owner access.')
  }
  onUserRoleResolved?.(userRole)

  const results = await Promise.all([
    supabase.from('profiles').select('id,full_name,email,phone,role,is_active'),
    supabase.from('apprentice_profiles').select('id,user_id,start_date,skill_level,specialization,status,notes'),
    supabase.from('apprentice_training_records').select('id,apprentice_user_id,record_type,record_date,hours,activity,skill_name,skill_level,attendance_status,leave_end_date,notes').order('record_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('customers').select('id,customer_number,full_name,phone,whatsapp_number,email,address,gender,preferred_garment,photo_path').is('archived_at', null).order('created_at', { ascending: false }),
    supabase.from('orders').select('id,order_number,customer_id,garment_type,description,total_amount,delivery_date,status,quantity,unit_price,cloth_amount,discount_amount,created_at').order('created_at', { ascending: false }),
    supabase.from('payments').select('id,order_id,amount,payment_method,payment_date,status').neq('status', 'voided'),
    supabase.from('tasks').select('id,order_id,title,description,checklist,assigned_to,priority,status,deadline'),
    supabase.from('task_updates').select('id,task_id,updated_by,previous_status,new_status,comment,created_at').order('created_at', { ascending: false }),
    supabase.from('measurement_sessions').select('id,customer_id,garment_type,measurement_date,unit,previous_session_id,garment_photo_paths,style_photo_paths').order('measurement_date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('measurement_values').select('measurement_session_id,field_name,value'),
    supabase.from('measurement_presets').select('category_id,field_names,default_cloth_amount'),
    supabase.from('customer_notes').select('id,customer_id,content,created_by,created_at').order('created_at', { ascending: false }),
    supabase.from('shop_settings').select('shop_name,phone,email,address,currency,measurement_unit,notifications').maybeSingle(),
  ])
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error

  const [profilesResult, apprenticeProfilesResult, apprenticeTrainingResult, customersResult, ordersResult, paymentsResult, tasksResult, taskUpdatesResult, sessionsResult, valuesResult, measurementPresetsResult, customerNotesResult, shopSettingsResult] = results
  const profileRows = asRows(profilesResult.data)
  const apprenticeTrainingRows = asRows(apprenticeTrainingResult.data)
  const customerRows = asRows(customersResult.data)
  const orderRows = asRows(ordersResult.data)
  const paymentRows = asRows(paymentsResult.data)
  const taskRows = asRows(tasksResult.data)
  const sessionRows = asRows(sessionsResult.data)
  const valueRows = asRows(valuesResult.data)
  const measurementPresetRows = asRows(measurementPresetsResult.data)
  const measurementPresets = Object.fromEntries(measurementPresetRows.map((row) => [
    text(row, 'category_id'),
    Array.isArray(row.field_names) ? row.field_names.filter((field): field is string => typeof field === 'string') : [],
  ]))
  const customGarmentNames = Object.keys(measurementPresets)
    .map(customGarmentNameFromCategoryId)
    .filter((name): name is string => Boolean(name))
  const customerNoteRows = asRows(customerNotesResult.data)
  const settingsRow = shopSettingsResult.data as Row | null
  const signedPhotoUrls = await createSignedPhotoUrls([
    ...customerRows.map((row) => text(row, 'photo_path')),
    ...getMeasurementPhotoPaths(sessionRows),
  ])
  const notificationRow = settingsRow?.notifications && typeof settingsRow.notifications === 'object' && !Array.isArray(settingsRow.notifications)
    ? settingsRow.notifications as Row
    : {}
  const profilesById = new Map(profileRows.map((row) => [text(row, 'id'), row]))

  const customers: WorkspaceCustomer[] = await Promise.all(customerRows.map(async (row) => ({
    id: `CUS-${String(numeric(row, 'customer_number')).padStart(5, '0')}`,
    dbId: text(row, 'id'),
    name: text(row, 'full_name', 'Customer'),
    phone: text(row, 'phone'),
    whatsapp: text(row, 'whatsapp_number'),
    email: text(row, 'email'),
    address: text(row, 'address'),
    garment: text(row, 'preferred_garment', 'Dresses') || 'Dresses',
    gender: text(row, 'gender'),
    orders: orderRows.filter((order) => text(order, 'customer_id') === text(row, 'id')).length,
    measurementsSaved: sessionRows.some((session) => text(session, 'customer_id') === text(row, 'id')),
    photo: getLoadedPhotoUrl(text(row, 'photo_path'), signedPhotoUrls, '/customer-portraits/ama.jpg'),
  })))
  const customersByUuid = new Map(customers.map((customer) => [customer.dbId, customer]))

  const orders: WorkspaceOrder[] = orderRows.map((row) => {
    const number = numeric(row, 'order_number')
    return {
      id: `#ORD-${String(number).padStart(5, '0')}`,
      dbId: text(row, 'id'),
      createdAt: text(row, 'created_at'),
      customerId: text(row, 'customer_id'),
      customer: customersByUuid.get(text(row, 'customer_id'))?.name ?? 'Customer',
      item: text(row, 'garment_type', text(row, 'description', 'Custom garment')),
      status: orderStatusFromDatabase(text(row, 'status')),
      date: formatDate(text(row, 'delivery_date')),
      amount: numeric(row, 'total_amount'),
      quantity: numeric(row, 'quantity', 1),
      unitPrice: numeric(row, 'unit_price', numeric(row, 'total_amount')),
      clothAmount: numeric(row, 'cloth_amount'),
      discountAmount: numeric(row, 'discount_amount'),
    }
  })
  const ordersByUuid = new Map(orders.map((order) => [order.dbId, order]))
  const rawOrdersByUuid = new Map(orderRows.map((order) => [text(order, 'id'), order]))

  const payments: WorkspacePayment[] = orders.map((order) => {
    const orderPayments = paymentRows
      .filter((payment) => text(payment, 'order_id') === order.dbId)
      .sort((left, right) => text(right, 'payment_date').localeCompare(text(left, 'payment_date')))
    const confirmed = orderPayments.filter((payment) => text(payment, 'status') === 'confirmed')
    const latest = confirmed[0]
    const methodMap: Record<string, WorkspacePayment['method']> = {
      cash: 'Cash',
      mobile_money: 'Mobile Money',
      bank_transfer: 'Bank Transfer',
      other: 'Other',
    }
    return {
      id: `PAY-${order.id.slice(-5)}`,
      orderId: order.id,
      orderUuid: order.dbId,
      customer: order.customer,
      total: order.amount,
      paid: confirmed.reduce((sum, payment) => sum + numeric(payment, 'amount'), 0),
      method: latest ? methodMap[text(latest, 'payment_method')] ?? '—' : '—',
      date: latest ? formatDate(text(latest, 'payment_date')) : '—',
    }
  })
  const transactionMethodMap: Record<string, WorkspacePaymentTransaction['method']> = {
    cash: 'Cash',
    mobile_money: 'Mobile Money',
    bank_transfer: 'Bank Transfer',
    other: 'Other',
  }
  const paymentTransactions: WorkspacePaymentTransaction[] = paymentRows
    .filter((row) => text(row, 'status') !== 'voided')
    .map((row) => {
      const orderUuid = text(row, 'order_id')
      const order = ordersByUuid.get(orderUuid)
      return {
        id: text(row, 'id'),
        orderId: order?.id ?? 'Unknown order',
        orderUuid,
        customer: order?.customer ?? 'Customer',
        amount: numeric(row, 'amount'),
        method: transactionMethodMap[text(row, 'payment_method')] ?? 'Other',
        reference: text(row, 'payment_reference'),
        date: text(row, 'payment_date'),
        recordedBy: text(profilesById.get(text(row, 'recorded_by')) ?? {}, 'full_name', 'Shop user'),
        status: text(row, 'status') === 'pending' ? 'Pending' : 'Confirmed',
      }
    })

  const apprenticesResult = asRows(apprenticeProfilesResult.data)
  const linkedApprenticeIds = new Set(apprenticesResult.map((row) => text(row, 'user_id')))
  const apprentices: WorkspaceApprentice[] = apprenticesResult.map((row, index) => {
    const profile = profilesById.get(text(row, 'user_id'))
    const storedStatus = text(row, 'status', 'active')
    const effectiveStatus = storedStatus === 'active' && profile?.is_active === false
      ? 'on_leave'
      : storedStatus
    return {
      id: `APP-${String(index + 1).padStart(5, '0')}`,
      userId: text(row, 'user_id'),
      name: text(profile ?? {}, 'full_name', 'Apprentice'),
      email: text(profile ?? {}, 'email'),
      phone: text(profile ?? {}, 'phone'),
      focus: text(row, 'specialization', 'General tailoring'),
      level: text(row, 'skill_level', 'beginner').replace(/^./, (letter) => letter.toUpperCase()),
      hours: 0,
      joined: formatDate(text(row, 'start_date')),
      assignment: 'Not assigned',
      status: effectiveStatus
        .replace('_', ' ')
        .replace(/^./, (letter) => letter.toUpperCase()) as WorkspaceApprentice['status'],
      notes: text(row, 'notes'),
    }
  })
  const availableApprenticeProfiles = profileRows
    .filter((row) => text(row, 'role') === 'apprentice' && !linkedApprenticeIds.has(text(row, 'id')))
    .map((row) => ({
      userId: text(row, 'id'),
      name: text(row, 'full_name', 'Apprentice'),
      email: text(row, 'email'),
      phone: text(row, 'phone'),
    }))

  const measurements: WorkspaceMeasurement[] = await Promise.all(sessionRows.map(async (session) => {
    const sessionValues = valueRows.filter((value) => text(value, 'measurement_session_id') === text(session, 'id'))
    const garmentPhotoPaths = Array.isArray(session.garment_photo_paths)
      ? session.garment_photo_paths.filter((path): path is string => typeof path === 'string')
      : []
    const stylePhotoPaths = Array.isArray(session.style_photo_paths)
      ? session.style_photo_paths.filter((path): path is string => typeof path === 'string')
      : []
    return {
      id: text(session, 'id'),
      customerId: text(session, 'customer_id'),
      categoryId: categoryIdForGarment(text(session, 'garment_type'), customGarmentNames),
      customer: customersByUuid.get(text(session, 'customer_id'))?.name ?? 'Customer',
      date: formatDate(text(session, 'measurement_date')),
      unit: text(session, 'unit') === 'cm' ? 'cm' : 'inches',
      previousSessionId: text(session, 'previous_session_id') || undefined,
      fields: sessionValues.map((value) => ({
        name: text(value, 'field_name'),
        value: String(numeric(value, 'value')),
      })),
      garmentPhotos: garmentPhotoPaths.map((path) => ({ path, url: getSignedPhotoUrl(path, signedPhotoUrls) })),
      stylePhotos: stylePhotoPaths.map((path) => ({ path, url: getSignedPhotoUrl(path, signedPhotoUrls) })),
    }
  }))
  const measurementPresetClothAmounts = Object.fromEntries(measurementPresetRows.flatMap((row) => {
    const amount = numeric(row, 'default_cloth_amount', Number.NaN)
    return Number.isFinite(amount) && amount >= 0 ? [[text(row, 'category_id'), amount]] : []
  }))
  const customerNotes: WorkspaceCustomerNote[] = customerNoteRows.flatMap((row) => {
    const customerId = text(row, 'customer_id')
    const customer = customersByUuid.get(customerId)
    if (!customer) return []
    const authorId = text(row, 'created_by')
    return [{
      id: text(row, 'id'),
      customerId,
      text: text(row, 'content'),
      author: text(profilesById.get(authorId) ?? {}, 'full_name', 'Shop user'),
      createdAt: text(row, 'created_at'),
    }]
  })

  const tasks: WorkspaceTask[] = taskRows.map((row) => {
    const profile = profilesById.get(text(row, 'assigned_to'))
    const order = ordersByUuid.get(text(row, 'order_id'))
    const priority = text(row, 'priority')
    return {
      id: `TSK-${text(row, 'id').slice(0, 8)}`,
      dbId: text(row, 'id'),
      orderUuid: text(row, 'order_id'),
      assigneeId: text(row, 'assigned_to'),
      title: text(row, 'title', 'Task'),
      description: text(row, 'description'),
      checklist: taskChecklist(row.checklist),
      assignee: text(profile ?? {}, 'full_name', 'Unassigned'),
      orderId: order?.id ?? '',
      dueDate: text(row, 'deadline'),
      priority: priority === 'urgent' || priority === 'high' ? 'High' : priority === 'low' ? 'Low' : 'Medium',
      status: taskStatusFromDatabase(text(row, 'status')),
    }
  })
  const tasksWithReferences = await attachTaskReferencePhotos(tasks, rawOrdersByUuid, sessionRows, signedPhotoUrls)
  const taskUpdates: WorkspaceTaskUpdate[] = asRows(taskUpdatesResult.data).map((row) => ({
    id: text(row, 'id'),
    taskId: text(row, 'task_id'),
    updatedBy: text(row, 'updated_by'),
    actor: text(profilesById.get(text(row, 'updated_by')) ?? {}, 'full_name', 'Shop user'),
    previousStatus: taskUpdateStatusLabel(text(row, 'previous_status')),
    newStatus: taskUpdateStatusLabel(text(row, 'new_status')),
    comment: text(row, 'comment'),
    createdAt: text(row, 'created_at'),
  }))

  const apprenticeTrainingRecords: WorkspaceApprenticeTrainingRecord[] = apprenticeTrainingRows.map((row) => ({
    id: text(row, 'id'),
    apprenticeId: text(row, 'apprentice_user_id'),
    kind: text(row, 'record_type') as WorkspaceApprenticeTrainingRecord['kind'],
    date: text(row, 'record_date'),
    hours: numeric(row, 'hours', Number.NaN),
    activity: text(row, 'activity') || undefined,
    skillName: text(row, 'skill_name') || undefined,
    skillLevel: ['learning', 'confident'].includes(text(row, 'skill_level'))
      ? text(row, 'skill_level').replace(/^./, (letter) => letter.toUpperCase()) as WorkspaceApprenticeTrainingRecord['skillLevel']
      : undefined,
    attendanceStatus: ['present', 'late', 'absent'].includes(text(row, 'attendance_status'))
      ? text(row, 'attendance_status').replace(/^./, (letter) => letter.toUpperCase()) as WorkspaceApprenticeTrainingRecord['attendanceStatus']
      : undefined,
    leaveEndDate: text(row, 'leave_end_date') || undefined,
    notes: text(row, 'notes') || undefined,
  }))
  const monday = new Date()
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  const mondayKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
  for (const apprentice of apprentices) {
    const apprenticeRecords = apprenticeTrainingRecords.filter((record) => record.apprenticeId === apprentice.userId)
    apprentice.hours = apprenticeRecords
      .filter((record) => record.kind === 'hours' && record.date >= mondayKey)
      .reduce((total, record) => total + (record.hours ?? 0), 0)
    apprentice.assignment = tasks.find((task) =>
      task.assignee === apprentice.name && task.status !== 'Done',
    )?.title ?? 'Not assigned'
  }

  const measurementCategoryCounts = measurements.reduce<Record<string, number>>((counts, measurement) => {
    counts[measurement.categoryId] = (counts[measurement.categoryId] ?? 0) + 1
    return counts
  }, {})

  const shopSettings: WorkspaceShopSettings | null = settingsRow ? {
    shopName: text(settingsRow, 'shop_name', 'QT Fashion app'),
    phone: text(settingsRow, 'phone'),
    email: text(settingsRow, 'email'),
    address: text(settingsRow, 'address'),
    currency: text(settingsRow, 'currency') === 'USD' ? 'USD' : 'GHS',
    measurements: text(settingsRow, 'measurement_unit') === 'cm' ? 'Centimeters' : 'Inches',
    notifications: {
      dueTasks: notificationRow.dueTasks !== false,
      paymentReceived: notificationRow.paymentReceived !== false,
      deliveryReminders: notificationRow.deliveryReminders !== false,
      weeklySummary: notificationRow.weeklySummary === true,
    },
  } : null

  return {
    customers,
    orders,
    payments,
    paymentTransactions,
    tasks: tasksWithReferences,
    taskUpdates,
    apprentices,
    apprenticeTrainingRecords,
    availableApprenticeProfiles,
    measurements,
    measurementPresets,
    measurementPresetClothAmounts,
    userRole: text(profilesById.get(userData.user.id) ?? {}, 'role'),
    passwordSetupRequired,
    customerNotes,
    measurementCategoryCounts,
    shopSettings,
  }
}

export async function loadWorkspace(
  onUserRoleResolved?: (role: string) => void,
  userId?: string,
): Promise<WorkspaceData | null> {
  if (!supabase) return null

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    if (!userId) throw new Error('Sign in online once before using offline mode.')
    const cached = await loadCachedWorkspace(userId)
    if (!cached) {
      throw new Error('No saved shop records are available offline on this device.')
    }
    onUserRoleResolved?.(cached.data.userRole)
    return cached.data
  }

  try {
    const workspace = await loadWorkspaceFromServer(onUserRoleResolved)
    if (workspace && userId) {
      try {
        await saveCachedWorkspace(userId, workspace)
      } catch (cacheError) {
        console.error('Could not cache shop records for offline use.', cacheError)
      }
    }
    return workspace
  } catch (error) {
    const networkUnavailable =
      typeof navigator !== 'undefined' &&
      (!navigator.onLine || error instanceof TypeError);
    if (networkUnavailable && userId) {
      const cached = await loadCachedWorkspace(userId)
      if (cached) {
        onUserRoleResolved?.(cached.data.userRole)
        return cached.data
      }
    }
    throw error
  }
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function createCustomerRecord(input: {
  name: string
  phone: string
  whatsapp?: string
  email?: string
  address?: string
  gender?: string
  garment?: string
}, photo?: File): Promise<WorkspaceCustomer> {
  const client = requireSupabase()
  const photoPath = photo ? await uploadCustomerPhoto(photo) : null
  const { data, error } = await client.from('customers').insert({
    full_name: input.name,
    phone: input.phone,
    whatsapp_number: input.whatsapp || null,
    email: input.email || null,
    address: input.address || null,
    gender: input.gender || null,
    preferred_garment: input.garment || 'Dresses',
    photo_path: photoPath,
  }).select('id,customer_number,full_name,phone,whatsapp_number,email,address,gender,preferred_garment,photo_path').single()
  if (error) {
    if (photoPath) {
      const { error: cleanupError } = await client.storage.from('customer-photos').remove([photoPath])
      if (cleanupError) throw new Error(`${error.message} (Photo cleanup failed: ${cleanupError.message})`)
    }
    throw error
  }
  const row = data as Row
  return {
    id: `CUS-${String(numeric(row, 'customer_number')).padStart(5, '0')}`,
    dbId: text(row, 'id'),
    name: text(row, 'full_name'),
    phone: text(row, 'phone'),
    whatsapp: text(row, 'whatsapp_number'),
    email: text(row, 'email'),
    address: text(row, 'address'),
    garment: text(row, 'preferred_garment', 'Dresses') || 'Dresses',
    gender: text(row, 'gender'),
    orders: 0,
    measurementsSaved: false,
    photo: await resolveCustomerPhoto(text(row, 'photo_path')),
  }
}

export async function updateCustomerRecord(customerId: string, input: {
  name: string
  phone: string
  whatsapp?: string
  email?: string
  address?: string
  gender?: string
  garment?: string
}, photo?: File): Promise<void> {
  const client = requireSupabase()
  const photoPath = photo ? await uploadCustomerPhoto(photo) : undefined
  const { error } = await client.from('customers').update({
    full_name: input.name,
    phone: input.phone,
    whatsapp_number: input.whatsapp || null,
    email: input.email || null,
    address: input.address || null,
    gender: input.gender || null,
    preferred_garment: input.garment || 'Dresses',
    ...(photoPath ? { photo_path: photoPath } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', customerId)
  if (error) {
    if (photoPath) {
      const { error: cleanupError } = await client.storage.from('customer-photos').remove([photoPath])
      if (cleanupError) throw new Error(`${error.message} (Photo cleanup failed: ${cleanupError.message})`)
    }
    throw error
  }
}

export async function deleteCustomerRecord(customerId: string): Promise<{ photoCleanupError?: string }> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('owner_delete_customer', {
    target_customer_id: customerId,
  })
  if (error) throw error
  if (!Array.isArray(data) || !data.every((path) => typeof path === 'string')) {
    throw new Error('Customer history was deleted, but photo cleanup paths could not be verified.')
  }
  const photoPaths = [...new Set(data)]
  if (photoPaths.length) {
    const { error: photoCleanupError } = await client.storage.from('customer-photos').remove(photoPaths)
    if (photoCleanupError) return { photoCleanupError: photoCleanupError.message }
  }
  return {}
}

export async function createCustomerNoteRecord(customerId: string, content: string): Promise<WorkspaceCustomerNote> {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in again before adding a customer note.')
  const { data, error } = await client.from('customer_notes')
    .insert({ customer_id: customerId, content, created_by: userData.user.id })
    .select('id,customer_id,content,created_by,created_at')
    .single()
  if (error) throw error
  return {
    id: text(data as Row, 'id'),
    customerId: text(data as Row, 'customer_id'),
    text: text(data as Row, 'content'),
    author: text(data as Row, 'created_by') === userData.user.id
      ? text(userData.user.user_metadata ?? {}, 'full_name', userData.user.email ?? 'Shop user')
      : 'Shop user',
    createdAt: text(data as Row, 'created_at'),
  }
}

export async function createOrderRecord(input: {
  customerId: string
  customerName: string
  garment: string
  amount: number
  deliveryDate: string
  quantity?: number
  unitPrice?: number
  clothAmount?: number
  discountAmount?: number
}): Promise<WorkspaceOrder> {
  const client = requireSupabase()
  const { data, error } = await client.from('orders').insert({
    customer_id: input.customerId,
    garment_type: input.garment,
    description: input.garment,
    total_amount: input.amount,
    quantity: input.quantity ?? 1,
    unit_price: input.unitPrice ?? input.amount,
    cloth_amount: input.clothAmount ?? 0,
    discount_amount: input.discountAmount ?? 0,
    delivery_date: input.deliveryDate,
    status: 'pending',
  }).select('id,order_number,customer_id,garment_type,description,total_amount,delivery_date,status,quantity,unit_price,cloth_amount,discount_amount,created_at').single()
  if (error) throw error
  const row = data as Row
  return {
    id: `#ORD-${String(numeric(row, 'order_number')).padStart(5, '0')}`,
    dbId: text(row, 'id'),
    createdAt: text(row, 'created_at'),
    customerId: text(row, 'customer_id'),
    customer: input.customerName,
    item: text(row, 'garment_type'),
    status: orderStatusFromDatabase(text(row, 'status')),
    date: formatDate(text(row, 'delivery_date')),
    amount: numeric(row, 'total_amount'),
    quantity: numeric(row, 'quantity', 1),
    unitPrice: numeric(row, 'unit_price', numeric(row, 'total_amount')),
    clothAmount: numeric(row, 'cloth_amount'),
    discountAmount: numeric(row, 'discount_amount'),
  }
}

const orderStatusToDatabase: Record<WorkspaceOrder['status'], string> = {
  Pending: 'pending',
  Cutting: 'confirmed',
  Sewing: 'in_production',
  Fitting: 'fitting',
  Completed: 'ready_for_collection',
  Delivered: 'delivered',
}

export async function updateOrderRecordStatus(orderId: string, status: WorkspaceOrder['status']): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('orders').update({ status: orderStatusToDatabase[status] }).eq('id', orderId)
  if (error) throw error
}

export async function createPaymentRecord(input: {
  orderId: string
  amount: number
  method: PaymentMethod
  date: string
  reference?: string
}): Promise<WorkspacePaymentTransaction> {
  const client = requireSupabase()
  const methodMap: Record<PaymentMethod, string> = {
    Cash: 'cash',
    'Mobile Money': 'mobile_money',
    'Bank Transfer': 'bank_transfer',
    Other: 'other',
  }
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in again before recording a payment.')
  const { data, error } = await client.from('payments').insert({
    order_id: input.orderId,
    amount: input.amount,
    payment_method: methodMap[input.method],
    payment_reference: input.reference?.trim() || null,
    payment_date: `${input.date}T12:00:00`,
    recorded_by: userData.user.id,
    status: 'confirmed',
  }).select('id,order_id,amount,payment_method,payment_reference,payment_date,recorded_by,status').single()
  if (error) throw error
  const row = data as Row
  return {
    id: text(row, 'id'),
    orderId: '',
    orderUuid: text(row, 'order_id'),
    customer: '',
    amount: numeric(row, 'amount'),
    method: input.method,
    reference: text(row, 'payment_reference'),
    date: text(row, 'payment_date'),
    recordedBy: text(userData.user.user_metadata ?? {}, 'full_name', userData.user.email ?? 'Shop user'),
    status: text(row, 'status') === 'pending' ? 'Pending' : 'Confirmed',
  }
}

const taskStatusToDatabase: Record<WorkspaceTask['status'], string> = {
  'To do': 'assigned',
  Accepted: 'accepted',
  'In progress': 'in_progress',
  Review: 'submitted_for_review',
  'Revision requested': 'revision_required',
  Done: 'completed',
}

export async function createTaskRecord(input: {
  title: string
  description?: string
  checklist: WorkspaceTaskChecklistItem[]
  assigneeId: string
  orderId: string | null
  dueDate: string
  priority: TaskPriority
}): Promise<string> {
  const client = requireSupabase()
  const priority = input.priority === 'Medium' ? 'normal' : input.priority.toLowerCase()
  const { data, error } = await client.rpc('owner_create_apprentice_task_with_checklist', {
    task_title: input.title,
    task_description: input.description ?? null,
    apprentice_user_id: input.assigneeId,
    related_order_id: input.orderId,
    task_deadline: input.dueDate,
    task_priority: priority,
    task_checklist: input.checklist,
  })
  if (error) throw error
  return String(data)
}

export async function updateTaskRecordStatus(taskId: string, status: WorkspaceTask['status'], _previousStatus: WorkspaceTask['status'], comment = ''): Promise<void> {
  const { error } = await requireSupabase().rpc('update_task_work_status', {
    target_task_id: taskId,
    target_status: taskStatusToDatabase[status],
    update_comment: comment || null,
  })
  if (error) throw error
}

export async function updateTaskChecklistRecord(taskId: string, checklist: WorkspaceTaskChecklistItem[]): Promise<void> {
  const { error } = await requireSupabase().rpc('update_task_checklist', {
    target_task_id: taskId,
    target_checklist: checklist,
  })
  if (error) throw error
}

export async function reviewTaskRecord(taskId: string, decision: 'approved' | 'revision_required', feedback: string): Promise<void> {
  const { error } = await requireSupabase().rpc('review_apprentice_task', {
    target_task_id: taskId,
    review_decision: decision,
    review_feedback: feedback || null,
  })
  if (error) throw error
}

async function invokeApprenticeAccess<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke('apprentice-access', { body })
  if (error) {
    const context = 'context' in error ? error.context : null
    if (context instanceof Response) {
      const responseBody: unknown = await context.clone().json().catch(() => null)
      if (
        responseBody
        && typeof responseBody === 'object'
        && 'error' in responseBody
        && typeof responseBody.error === 'string'
      ) {
        throw new Error(responseBody.error)
      }
    }
    throw error
  }
  if (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error)
  }
  return data as T
}

export async function inviteApprenticeAccount(input: {
  fullName: string
  email: string
  phone: string
  specialization: string
  skillLevel: string
  startDate: string
}): Promise<{ userId: string; fullName: string; email: string; phone: string; actionLink: string }> {
  return invokeApprenticeAccess({ action: 'invite', ...input })
}

export async function deleteApprenticeAccount(userId: string): Promise<void> {
  await invokeApprenticeAccess<{ ok: boolean }>({ action: 'delete', userId })
}

export async function createApprenticePasswordResetLink(userId: string): Promise<{ actionLink: string; email: string }> {
  return invokeApprenticeAccess({ action: 'password_reset', userId })
}

export async function completeApprenticePasswordSetup(): Promise<void> {
  await invokeApprenticeAccess({ action: 'complete_password_setup' })
}

export async function createMeasurementRecord(input: {
  customerId: string
  garmentType: string
  date: string
  unit: 'inches' | 'cm'
  values: Array<{ name: string; value: number }>
  previousSessionId?: string
  garmentPhotos: Array<{ file?: File; path?: string }>
  stylePhotos: Array<{ file?: File; path?: string }>
}): Promise<{ id: string; garmentPhotos: Array<{ path: string }>; stylePhotos: Array<{ path: string }> }> {
  if (input.garmentPhotos.length > 2 || input.stylePhotos.length > 3) {
    throw new Error('A measurement can include at most 2 garment photos and 3 style references.')
  }
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in again before recording measurements.')
  const uploadedPaths: string[] = []
  const persistPhotos = async (photos: Array<{ file?: File; path?: string }>) => {
    const paths: string[] = []
    for (const photo of photos) {
      if (photo.file) {
        const path = await uploadMeasurementPhoto(photo.file)
        uploadedPaths.push(path)
        paths.push(path)
      } else if (photo.path) {
        paths.push(photo.path)
      }
    }
    return paths
  }
  try {
    const garmentPhotoPaths = await persistPhotos(input.garmentPhotos)
    const stylePhotoPaths = await persistPhotos(input.stylePhotos)
    const { data: session, error: sessionError } = await client.from('measurement_sessions').insert({
      customer_id: input.customerId,
      garment_type: input.garmentType,
      unit: input.unit,
      measurement_date: input.date,
      recorded_by: userData.user.id,
      previous_session_id: input.previousSessionId ?? null,
      garment_photo_paths: garmentPhotoPaths,
      style_photo_paths: stylePhotoPaths,
    }).select('id').single()
    if (sessionError) throw sessionError
    const { error: valuesError } = await client.from('measurement_values').insert(input.values.map(({ name, value }) => ({
      measurement_session_id: session.id,
      field_name: name,
      value,
    })))
    if (valuesError) {
      const { error: rollbackError } = await client.from('measurement_sessions').delete().eq('id', session.id)
      if (rollbackError) throw new Error(`${valuesError.message} (Measurement session rollback failed: ${rollbackError.message})`)
      throw valuesError
    }
    return {
      id: text(session as Row, 'id'),
      garmentPhotos: garmentPhotoPaths.map((path) => ({ path })),
      stylePhotos: stylePhotoPaths.map((path) => ({ path })),
    }
  } catch (error) {
    try {
      await removeMeasurementPhotos(uploadedPaths)
    } catch (cleanupError) {
      throw new Error(`${error instanceof Error ? error.message : 'Could not save the measurement.'} (Photo cleanup failed: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown storage error'})`)
    }
    throw error
  }
}

export async function saveMeasurementPresetRecord(categoryId: string, fieldNames: string[], defaultClothAmount?: number): Promise<void> {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in again before saving measurement presets.')
  const { error } = await client.from('measurement_presets').upsert({
    owner_id: userData.user.id,
    category_id: categoryId,
    field_names: fieldNames,
    default_cloth_amount: defaultClothAmount ?? null,
    updated_by: userData.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id,category_id' })
  if (error) throw error
}

export async function createApprenticeRecord(input: {
  userId: string
  skillLevel: string
  specialization: string
  startDate?: string
}): Promise<void> {
  const client = requireSupabase()
  const { error } = await client.from('apprentice_profiles').insert({
    user_id: input.userId,
    start_date: input.startDate || new Date().toISOString().slice(0, 10),
    skill_level: input.skillLevel.toLowerCase(),
    specialization: input.specialization,
    status: 'active',
  })
  if (error) throw error
}

export async function updateApprenticeRecordStatus(userId: string, status: WorkspaceApprentice['status']): Promise<void> {
  const client = requireSupabase()
  const databaseStatus = status === 'On leave' ? 'on_leave' : status.toLowerCase()
  const { error: apprenticeError } = await client
    .from('apprentice_profiles')
    .update({ status: databaseStatus })
    .eq('user_id', userId)
  if (apprenticeError) throw apprenticeError
}

export async function updateApprenticeProfileRecord(input: {
  userId: string
  skillLevel: string
  specialization: string
  notes: string
}): Promise<void> {
  const { error } = await requireSupabase().from('apprentice_profiles').update({
    skill_level: input.skillLevel.toLowerCase(),
    specialization: input.specialization,
    notes: input.notes || null,
  }).eq('user_id', input.userId)
  if (error) throw error
}

export async function createApprenticeTrainingRecord(input: Omit<WorkspaceApprenticeTrainingRecord, 'id'>): Promise<WorkspaceApprenticeTrainingRecord> {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in again before recording apprentice training.')
  const { data, error } = await client.from('apprentice_training_records').insert({
    apprentice_user_id: input.apprenticeId,
    record_type: input.kind,
    record_date: input.date,
    hours: input.hours ?? null,
    activity: input.activity ?? null,
    skill_name: input.skillName ?? null,
    skill_level: input.skillLevel?.toLowerCase() ?? null,
    attendance_status: input.attendanceStatus?.toLowerCase() ?? null,
    leave_end_date: input.leaveEndDate ?? null,
    notes: input.notes ?? null,
    recorded_by: userData.user.id,
  }).select('id').single()
  if (error) throw error
  return { ...input, id: text(data as Row, 'id') }
}

export async function saveShopSettingsRecord(settings: WorkspaceShopSettings): Promise<void> {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in again before saving shop settings.')
  const { error } = await client.from('shop_settings').upsert({
    owner_id: userData.user.id,
    shop_name: settings.shopName,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
    currency: settings.currency,
    measurement_unit: settings.measurements === 'Inches' ? 'inches' : 'cm',
    notifications: settings.notifications,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'owner_id' })
  if (error) throw error
}

export async function resetShopSettingsRecord(): Promise<void> {
  const client = requireSupabase()
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Sign in again before resetting shop settings.')
  const { error } = await client.from('shop_settings').delete().eq('owner_id', userData.user.id)
  if (error) throw error
}
