import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import {
  deleteClothGalleryRecord,
  importClothGalleryRecords,
  loadClothGalleryRecords,
  photoAsDataUrl,
  saveClothGalleryRecord,
  type ClothGalleryRecord,
} from "./lib/cloth-gallery";
import ApprenticePortal from "./ApprenticePortal";
import {
  deleteCustomerRecord,
  createCustomerNoteRecord,
  createCustomerRecord,
  createMeasurementRecord,
  createOrderRecord,
  createPaymentRecord,
  createTaskRecord,
  loadWorkspace,
  resetShopSettingsRecord,
  saveMeasurementPresetRecord,
  saveShopSettingsRecord,
  updateCustomerRecord,
  updateApprenticeRecordStatus,
  updateApprenticeProfileRecord,
  createApprenticeTrainingRecord,
  deleteApprenticeAccount,
  inviteApprenticeAccount,
  createApprenticePasswordResetLink,
  completeApprenticePasswordSetup,
  reviewTaskRecord,
  updateOrderRecordStatus,
  updateTaskChecklistRecord,
  updateTaskRecordStatus,
} from "./lib/workspace";
import { loadCachedWorkspace } from "./lib/offline-cache";
import type {
  WorkspaceApprenticeTrainingRecord,
  WorkspaceCustomerNote,
  WorkspacePaymentTransaction,
  WorkspaceTask,
  WorkspaceTaskChecklistItem,
  WorkspaceTaskUpdate,
  WorkspaceData,
} from "./lib/workspace";
import {
  BarChart3,
  Bell,
  BookOpen,
  Camera,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  CalendarOff,
  Clock3,
  KeyRound,
  Activity,
  Award,
  CalendarClock,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  Download,
  Ellipsis,
  Eye,
  EyeOff,
  Filter,
  Grid2X2,
  ImagePlus,
  Images,
  LayoutDashboard,
  List,
  ListChecks,
  LogOut,
  MessageSquareText,
  Pencil,
  Plus,
  Ruler,
  Search,
  Settings,
  Shirt,
  Trash2,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";
import "./App.css";

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Calendar", icon: CalendarDays },
  { label: "Cloth Gallery", icon: Images },
  { label: "Customers", icon: Users },
  { label: "Measurements", icon: Ruler },
  { label: "Orders", icon: ClipboardList },
  { label: "Apprentices", icon: UserRound },
  { label: "Tasks", icon: ListChecks },
  { label: "Payments", icon: CreditCard },
  { label: "Reports", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

type CustomerRecord = {
  id: string;
  dbId?: string;
  name: string;
  phone: string;
  whatsapp?: string;
  gender?: string;
  address?: string;
  email?: string;
  garment: string;
  orders: number;
  measurementsSaved: boolean;
  photo: string;
};

type HighlightedRecord = {
  page: "Orders" | "Tasks" | "Payments" | "Customers";
  id: string;
};

const initialCustomerRecords: CustomerRecord[] = [];

const portraitUrl = (photo: string) => photo;

type MeasurementCategory = {
  id: string;
  name: string;
  customerCount: number;
  group: "Female" | "Male" | "Traditional" | "Custom";
  image: string;
};

type MeasurementEntry = {
  id: string;
  customerId?: string;
  categoryId: string;
  customer: string;
  date: string;
  unit: "inches" | "cm";
  fields: Array<{ name: string; value: string }>;
  versionOfId?: string;
  garmentPhotos?: MeasurementImage[];
  stylePhotos?: MeasurementImage[];
};

type MeasurementImage = {
  url: string;
  path?: string;
};

type MeasurementPhotoDraft = MeasurementImage & {
  file?: File;
};

type MeasurementSubmission = {
  categoryId: string;
  customerId: string;
  customerName: string;
  fields: Array<{ name: string; value: string }>;
  unit: "inches" | "cm";
  versionOfId?: string;
  garmentPhotos: MeasurementPhotoDraft[];
  stylePhotos: MeasurementPhotoDraft[];
};

type CustomerGarmentRecord = {
  id: string;
  customerId: string;
  garmentName: string;
  styleName: string;
  fabricName: string;
  photo: string;
  measurements: Record<string, string>;
  unit: "inches" | "cm";
  updatedAt: string;
};

type CustomerNoteRecord = WorkspaceCustomerNote;

type CustomerTimelineItem = {
  id: string;
  type: "order" | "payment" | "measurement" | "note" | "activity";
  title: string;
  description: string;
  date: string;
  timestamp: number;
  images?: MeasurementImage[];
};

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type ConfirmationDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
};

function getStoredCustomerGarments(): CustomerGarmentRecord[] {
  try {
    const stored = localStorage.getItem("oti-b-customer-garments");
    if (!stored) return [];
    const records = JSON.parse(stored) as CustomerGarmentRecord[];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function getStoredCustomerNotes(): CustomerNoteRecord[] {
  try {
    const stored = localStorage.getItem("oti-b-customer-notes");
    if (!stored) return [];
    const notes = JSON.parse(stored) as CustomerNoteRecord[];
    return Array.isArray(notes) ? notes : [];
  } catch {
    return [];
  }
}

const initialMeasurementCategories: MeasurementCategory[] = [
  {
    id: "dress-female",
    name: "Dresses (Female)",
    customerCount: 0,
    group: "Female",
    image: "/garment-icons/dress-female.png",
  },
  {
    id: "tops-blouses",
    name: "Tops & Blouses",
    customerCount: 0,
    group: "Female",
    image: "/garment-icons/tops-blouses.png",
  },
  {
    id: "trousers-female",
    name: "Trousers (Female)",
    customerCount: 0,
    group: "Female",
    image: "/garment-icons/trousers-female.png",
  },
  {
    id: "shirts-male",
    name: "Shirts (Male)",
    customerCount: 0,
    group: "Male",
    image: "/garment-icons/shirt-male.png",
  },
  {
    id: "trousers-male",
    name: "Trousers (Male)",
    customerCount: 0,
    group: "Male",
    image: "/garment-icons/trousers-male.png",
  },
  {
    id: "suits",
    name: "Suits",
    customerCount: 0,
    group: "Male",
    image: "/garment-icons/suits.png",
  },
  {
    id: "traditional-wear",
    name: "Traditional Wear",
    customerCount: 0,
    group: "Traditional",
    image: "/garment-icons/traditional-wear.png",
  },
];

const initialMeasurementPresets: Record<string, string[]> = {
  "dress-female": [
    "Bust",
    "Waist",
    "Hip",
    "Shoulder",
    "Sleeve",
    "Dress Length",
  ],
  "tops-blouses": ["Bust", "Waist", "Shoulder", "Sleeve", "Top Length"],
  "trousers-female": ["Waist", "Hip", "Thigh", "Inseam", "Trouser Length"],
  "shirts-male": ["Chest", "Neck", "Shoulder", "Sleeve", "Shirt Length"],
  "trousers-male": ["Waist", "Hip", "Thigh", "Inseam", "Trouser Length"],
  suits: [
    "Chest",
    "Waist",
    "Hip",
    "Shoulder",
    "Sleeve",
    "Jacket Length",
    "Trouser Length",
  ],
  "traditional-wear": [
    "Chest",
    "Waist",
    "Hip",
    "Shoulder",
    "Sleeve",
    "Top Length",
    "Trouser Length",
  ],
};

const customGarmentCategoryPrefix = "custom-garment:";
const newMeasurementGarmentOption = "__add_garment__";

function customGarmentCategoryId(name: string): string {
  return `${customGarmentCategoryPrefix}${encodeURIComponent(name.trim())}`;
}

function customGarmentNameFromCategoryId(categoryId: string): string | null {
  if (!categoryId.startsWith(customGarmentCategoryPrefix)) return null;
  try {
    return decodeURIComponent(categoryId.slice(customGarmentCategoryPrefix.length));
  } catch {
    return null;
  }
}

function customMeasurementCategories(
  presets: Record<string, string[]>,
): MeasurementCategory[] {
  return Object.keys(presets).flatMap((categoryId) => {
    const name = customGarmentNameFromCategoryId(categoryId);
    return name
      ? [{
          id: categoryId,
          name,
          customerCount: 0,
          group: "Custom" as const,
          image: "/garment-icons/traditional-wear.png",
        }]
      : [];
  });
}

const measurementFieldNames = [
  "Chest",
  "Waist",
  "Hip",
  "Shoulder",
  "Sleeve",
  "Length",
];

const initialMeasurementEntries: MeasurementEntry[] = [];

function getStoredMeasurementEntries(): MeasurementEntry[] {
  try {
    const stored = localStorage.getItem("oti-b-measurements");
    if (!stored) return initialMeasurementEntries;
    const entries = JSON.parse(stored) as Array<
      MeasurementEntry & { values?: string[] }
    >;
    return Array.isArray(entries)
      ? entries.map((entry) => ({
          ...entry,
          fields: Array.isArray(entry.fields)
            ? entry.fields.filter(
                (field) =>
                  typeof field.name === "string" &&
                  typeof field.value === "string",
              )
            : measurementFieldNames.flatMap((name, index) =>
                entry.values?.[index]
                  ? [{ name, value: entry.values[index] }]
                  : [],
              ),
        }))
      : initialMeasurementEntries;
  } catch {
    return initialMeasurementEntries;
  }
}

function getStoredMeasurementPresets(): Record<string, string[]> {
  try {
    const stored = localStorage.getItem("oti-b-measurement-presets");
    if (!stored) return initialMeasurementPresets;
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    const validEntries = Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string[]] =>
          Array.isArray(entry[1]) &&
          entry[1].every((field) => typeof field === "string"),
      ),
    );
    return { ...initialMeasurementPresets, ...validEntries };
  } catch {
    return initialMeasurementPresets;
  }
}

function getStoredMeasurementPresetClothAmounts(): Record<string, number> {
  try {
    const stored = localStorage.getItem(
      "oti-b-measurement-preset-cloth-amounts",
    );
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === "number" &&
          Number.isFinite(entry[1]) &&
          entry[1] >= 0,
      ),
    );
  } catch {
    return {};
  }
}

type OrderStatus =
  | "Pending"
  | "Cutting"
  | "Sewing"
  | "Fitting"
  | "Completed"
  | "Delivered";

type OrderRecord = {
  id: string;
  dbId?: string;
  createdAt?: string;
  customerId?: string;
  customer: string;
  item: string;
  status: OrderStatus;
  date: string;
  amount: number;
  quantity?: number;
  unitPrice?: number;
  clothAmount?: number;
  discountAmount?: number;
};

type ClothRecord = ClothGalleryRecord;

const initialClothRecords: ClothRecord[] = [];

function getStoredClothRecords(): ClothRecord[] {
  try {
    const stored = localStorage.getItem("oti-b-cloth-gallery");
    if (!stored) return initialClothRecords;
    const records = JSON.parse(stored) as Array<
      Partial<ClothRecord> &
        Pick<ClothRecord, "id" | "name" | "category" | "color" | "pattern">
    >;
    if (!Array.isArray(records)) return initialClothRecords;
    return records.map((record) => ({
      ...record,
      kind: record.kind ?? "fabric",
    }));
  } catch {
    return initialClothRecords;
  }
}

type GalleryCustomerHistory = {
  id: string;
  customerId: string;
  galleryItemId: string;
  itemName: string;
  itemKind: "fabric" | "style";
  category: string;
  color: string;
  details: string;
  savedAt: string;
};

function getStoredGalleryCustomerHistory(): GalleryCustomerHistory[] {
  try {
    const stored = localStorage.getItem("oti-b-gallery-customer-history");
    if (!stored) return [];
    const history = JSON.parse(stored) as GalleryCustomerHistory[];
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseCalendarDate(value: string) {
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type ShopSettings = {
  shopName: string;
  phone: string;
  email: string;
  address: string;
  currency: "GHS" | "USD";
  measurements: "Inches" | "Centimeters";
  notifications: {
    dueTasks: boolean;
    paymentReceived: boolean;
    deliveryReminders: boolean;
    weeklySummary: boolean;
  };
};

const defaultShopSettings: ShopSettings = {
  shopName: "QT Fashion app",
  phone: "",
  email: "",
  address: "",
  currency: "GHS",
  measurements: "Inches",
  notifications: {
    dueTasks: true,
    paymentReceived: true,
    deliveryReminders: true,
    weeklySummary: false,
  },
};

function getStoredShopSettings(): ShopSettings {
  try {
    const stored = localStorage.getItem("oti-b-shop-settings");
    if (!stored) return defaultShopSettings;
    const parsed = JSON.parse(stored) as Partial<ShopSettings>;
    return {
      ...defaultShopSettings,
      ...parsed,
      notifications: {
        ...defaultShopSettings.notifications,
        ...parsed.notifications,
      },
    };
  } catch {
    return defaultShopSettings;
  }
}

type PaymentMethod = "Cash" | "Mobile Money" | "Bank Transfer" | "Other";
type PaymentRecord = {
  id: string;
  orderId: string;
  orderUuid?: string;
  customer: string;
  total: number;
  paid: number;
  method: PaymentMethod | "—";
  date: string;
};

const initialPayments: PaymentRecord[] = [];
const initialPaymentTransactions: WorkspacePaymentTransaction[] = [];

type TaskStatus = WorkspaceTask["status"];
type TaskPriority = WorkspaceTask["priority"];
type TaskRecord = WorkspaceTask;

type ActivityRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityLabel: string;
  actor: string;
  createdAt: string;
};

function readStoredActivity(): ActivityRecord[] {
  try {
    const stored = localStorage.getItem("oti-b-activity");
    if (!stored) return [];
    const records = JSON.parse(stored) as ActivityRecord[];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

const initialTasks: TaskRecord[] = [];

const taskTemplates = [
  {
    name: "Garment finishing",
    title: "Finish garment",
    instructions:
      "Complete finishing details and prepare the garment for a final quality check.",
    checklist: [
      "Trim loose threads",
      "Check seams and hems",
      "Press garment",
      "Prepare for supervisor review",
    ],
  },
  {
    name: "Pattern cutting",
    title: "Cut garment panels",
    instructions: "Prepare the fabric and cut all pattern pieces accurately.",
    checklist: [
      "Confirm measurements and pattern",
      "Lay and align fabric",
      "Cut all marked pieces",
      "Label pieces for sewing",
    ],
  },
  {
    name: "Fitting preparation",
    title: "Prepare customer fitting",
    instructions:
      "Prepare the garment and fitting notes before the customer appointment.",
    checklist: [
      "Check garment against measurements",
      "Prepare fitting notes",
      "Pack required pins and tools",
    ],
  },
  {
    name: "Hand embroidery",
    title: "Complete hand embroidery",
    instructions:
      "Complete the embroidery to the approved design and protect the finished work.",
    checklist: [
      "Confirm approved design",
      "Complete embroidery",
      "Secure threads and inspect finish",
    ],
  },
];

type ApprenticeStatus = "Active" | "On leave" | "Completed";

type ApprenticeRecord = {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  focus: string;
  level: string;
  hours: number;
  joined: string;
  assignment: string;
  status: ApprenticeStatus;
  email?: string;
  notes?: string;
};

const initialApprentices: ApprenticeRecord[] = [];

type ApprenticeTrainingRecord = WorkspaceApprenticeTrainingRecord;

type ApprenticeAction =
  | "hours"
  | "skill"
  | "attendance"
  | "leave"
  | "profile"
  | null;

function getStoredApprenticeTrainingRecords(): ApprenticeTrainingRecord[] {
  try {
    const stored = localStorage.getItem("oti-b-apprentice-training-records");
    if (!stored) return [];
    const records = JSON.parse(stored) as ApprenticeTrainingRecord[];
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

function getStoredApprentices(): ApprenticeRecord[] {
  try {
    const stored = localStorage.getItem("oti-b-apprentices");
    if (!stored) return initialApprentices;
    const records = JSON.parse(stored) as ApprenticeRecord[];
    return Array.isArray(records) ? records : initialApprentices;
  } catch {
    return initialApprentices;
  }
}

const initialOrders: OrderRecord[] = [];

const statusCounts = [
  { label: "Pending", color: "pending" },
  { label: "Cutting", color: "cutting" },
  { label: "Sewing", color: "sewing" },
  { label: "Fitting", color: "fitting" },
  { label: "Completed", color: "completed" },
  { label: "Delivered", color: "delivered" },
];

const statusChartColors: Record<string, string> = {
  pending: "#f06a43",
  cutting: "#7654d5",
  sewing: "#f0a228",
  fitting: "#4a8bd8",
  completed: "#3fa5d1",
  delivered: "#36a869",
};

function App() {
  const [installPromptEvent, setInstallPromptEvent] =
    useState<InstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator &&
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true)),
  );
  const [installHelpMessage, setInstallHelpMessage] = useState("");
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const authUserId = authSession?.user.id;
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPasswordVisible, setAuthPasswordVisible] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] =
    useState(isSupabaseConfigured);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceReloadKey, setWorkspaceReloadKey] = useState(0);
  const [workspaceUserRole, setWorkspaceUserRole] = useState("");
  const [workspaceLoadedUserId, setWorkspaceLoadedUserId] = useState("");
  const workspaceLoadedUserIdRef = useRef("");
  const markWorkspaceLoaded = (userId: string) => {
    workspaceLoadedUserIdRef.current = userId;
    setWorkspaceLoadedUserId(userId);
  };
  const [passwordSetupRequired, setPasswordSetupRequired] = useState(
    () =>
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).has("apprentice-invite") ||
        new URLSearchParams(window.location.search).has("password-reset")),
  );
  const [passwordSetupBusy, setPasswordSetupBusy] = useState(false);
  const [passwordSetupError, setPasswordSetupError] = useState("");
  const [activePage, setActivePage] = useState("Dashboard");
  const [highlightedRecord, setHighlightedRecord] =
    useState<HighlightedRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [period, setPeriod] = useState<
    "This Month" | "Last Month" | "This Year"
  >("This Month");
  const [isOrderOpen, setIsOrderOpen] = useState(false);
  const [continueToOrder, setContinueToOrder] = useState(false);
  const [newOrderCustomerName, setNewOrderCustomerName] = useState("");
  const [activityEntries, setActivityEntries] = useState(readStoredActivity);
  const [readActivityIds, setReadActivityIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("oti-b-read-activity");
      const ids = stored ? (JSON.parse(stored) as string[]) : [];
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  });
  const [activeStatusChart, setActiveStatusChart] = useState<string | null>(
    null,
  );
  const [activeRevenuePoint, setActiveRevenuePoint] = useState<number | null>(
    null,
  );
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(() =>
    dateKey(new Date()),
  );
  const [clothRecords, setClothRecords] = useState<ClothRecord[]>(() =>
    isSupabaseConfigured ? [] : getStoredClothRecords(),
  );
  const [clothGalleryLoading, setClothGalleryLoading] = useState(false);
  const [clothGalleryError, setClothGalleryError] = useState("");
  const [galleryImportPending, setGalleryImportPending] = useState(false);
  const [galleryCustomerHistory, setGalleryCustomerHistory] = useState(
    getStoredGalleryCustomerHistory,
  );
  const [clothSearch, setClothSearch] = useState("");
  const [clothCategory, setClothCategory] = useState("All Fabrics");
  const [galleryKind, setGalleryKind] = useState<"fabric" | "style">("fabric");
  const [isClothFormOpen, setIsClothFormOpen] = useState(false);
  const [editingClothId, setEditingClothId] = useState<string | null>(null);
  const [selectedGalleryRecordId, setSelectedGalleryRecordId] = useState<
    string | null
  >(null);
  const [expandedGalleryImageId, setExpandedGalleryImageId] = useState<
    string | null
  >(null);
  const [clothCustomerMode, setClothCustomerMode] = useState(false);
  const [clothCustomerSearch, setClothCustomerSearch] = useState("");
  const [selectedGalleryCustomerId, setSelectedGalleryCustomerId] = useState<
    string | null
  >(null);
  const [clothPhoto, setClothPhoto] = useState("");
  const [settingsSection, setSettingsSection] = useState<
    | "Shop Profile"
    | "Notifications"
    | "Preferences"
    | "Account & Security"
    | "Data & Privacy"
  >("Shop Profile");
  const [shopSettings, setShopSettings] = useState<ShopSettings>(
    getStoredShopSettings,
  );
  const [savedShopSettings, setSavedShopSettings] = useState<ShopSettings>(
    getStoredShopSettings,
  );
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirmation, setAccountPasswordConfirmation] =
    useState("");
  const [accountPasswordBusy, setAccountPasswordBusy] = useState(false);
  const [accountPasswordError, setAccountPasswordError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmationDialog, setConfirmationDialog] =
    useState<ConfirmationDialog | null>(null);
  const confirmationResolverRef = useRef<((confirmed: boolean) => void) | null>(
    null,
  );
  const [orders, setOrders] = useState(initialOrders);
  const [orderFormError, setOrderFormError] = useState("");
  const [payments, setPayments] = useState(initialPayments);
  const [paymentTransactions, setPaymentTransactions] = useState(
    initialPaymentTransactions,
  );
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] =
    useState("All Statuses");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All Methods");
  const [paymentPeriodFilter, setPaymentPeriodFilter] = useState("All Dates");
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
    null,
  );
  const [paymentFormError, setPaymentFormError] = useState("");
  const [paymentFormBusy, setPaymentFormBusy] = useState(false);
  const [reportSearch, setReportSearch] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState("All Statuses");
  const [reportPeriod, setReportPeriod] = useState<
    | "This Month"
    | "Last Month"
    | "Last 30 Days"
    | "This Year"
    | "All Time"
    | "Custom"
  >("This Month");
  const [reportStartDate, setReportStartDate] = useState(() =>
    dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [reportEndDate, setReportEndDate] = useState(() => dateKey(new Date()));
  const [tasks, setTasks] = useState(initialTasks);
  const [taskUpdates, setTaskUpdates] = useState<WorkspaceTaskUpdate[]>([]);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskStatusFilter, setTaskStatusFilter] = useState("All Statuses");
  const [taskPriorityFilter, setTaskPriorityFilter] =
    useState("All Priorities");
  const [taskAssigneeFilter, setTaskAssigneeFilter] =
    useState("All Apprentices");
  const [taskDueFilter, setTaskDueFilter] = useState("All Due Dates");
  const [taskView, setTaskView] = useState<"board" | "list">("board");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskReviewDecision, setTaskReviewDecision] = useState<
    "approved" | "revision_required" | null
  >(null);
  const [taskReviewFeedback, setTaskReviewFeedback] = useState("");
  const [taskReviewBusy, setTaskReviewBusy] = useState(false);
  const [taskChecklistBusy, setTaskChecklistBusy] = useState(false);
  const [taskFormBusy, setTaskFormBusy] = useState(false);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [today] = useState(() => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    return currentDate;
  });
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("All Statuses");
  const [orderDeliveryFilter, setOrderDeliveryFilter] =
    useState("All Delivery Dates");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [taskOrderPrefill, setTaskOrderPrefill] = useState("");
  const [taskAssigneePrefill, setTaskAssigneePrefill] = useState("");
  const [apprentices, setApprentices] = useState(getStoredApprentices);
  const [apprenticeTrainingRecords, setApprenticeTrainingRecords] = useState<
    ApprenticeTrainingRecord[]
  >(getStoredApprenticeTrainingRecords);
  const [apprenticeSearch, setApprenticeSearch] = useState("");
  const [apprenticeStatusFilter, setApprenticeStatusFilter] =
    useState("All Statuses");
  const [apprenticeFocusFilter, setApprenticeFocusFilter] =
    useState("All Skill Areas");
  const [apprenticeAssignmentFilter, setApprenticeAssignmentFilter] =
    useState("All Assignments");
  const [isApprenticeFormOpen, setIsApprenticeFormOpen] = useState(false);
  const [selectedApprenticeId, setSelectedApprenticeId] = useState<
    string | null
  >(null);
  const [apprenticeAction, setApprenticeAction] =
    useState<ApprenticeAction>(null);
  const [apprenticeProfileError, setApprenticeProfileError] = useState("");
  const [apprenticeInviteBusy, setApprenticeInviteBusy] = useState(false);
  const [apprenticeDeleteBusy, setApprenticeDeleteBusy] = useState(false);
  const [apprenticeShareLink, setApprenticeShareLink] = useState<{
    name: string;
    email: string;
    phone: string;
    link: string;
    kind: "invite" | "reset";
  } | null>(null);
  const [customerRecords, setCustomerRecords] = useState(
    initialCustomerRecords,
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [garmentFilter, setGarmentFilter] = useState("All Garment Types");
  const [customerStatusFilter, setCustomerStatusFilter] =
    useState("All Statuses");
  const [showCustomerFilters, setShowCustomerFilters] = useState(false);
  const [ordersOnly, setOrdersOnly] = useState(false);
  const [customerView, setCustomerView] = useState<"grid" | "list">("grid");
  const [customerPage, setCustomerPage] = useState(1);
  const [customerModal, setCustomerModal] = useState<"edit" | "view" | null>(
    null,
  );
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [customerPhotoPreview, setCustomerPhotoPreview] = useState("");
  const [customerPhotoFile, setCustomerPhotoFile] = useState<File | null>(null);
  const [customerGarments, setCustomerGarments] = useState<
    CustomerGarmentRecord[]
  >(getStoredCustomerGarments);
  const [customerNotes, setCustomerNotes] = useState<CustomerNoteRecord[]>(
    getStoredCustomerNotes,
  );
  const [cameraTarget, setCameraTarget] = useState<
    "customer" | "measurementGarment" | "measurementStyle" | null
  >(null);
  const [cameraTab, setCameraTab] = useState<"Camera" | "Upload" | "Gallery">(
    "Camera",
  );
  const [cameraError, setCameraError] = useState("");
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [editingGarmentId, setEditingGarmentId] = useState<string | null>(null);
  const [garmentEditValues, setGarmentEditValues] = useState<
    Record<string, string>
  >({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [measurementCategories, setMeasurementCategories] = useState(
    () =>
      initialMeasurementCategories.concat(
        customMeasurementCategories(
          isSupabaseConfigured
            ? initialMeasurementPresets
            : getStoredMeasurementPresets(),
        ),
      ),
  );
  const [measurementEntries, setMeasurementEntries] = useState(
    getStoredMeasurementEntries,
  );
  const [measurementPresets, setMeasurementPresets] = useState(() =>
    isSupabaseConfigured
      ? initialMeasurementPresets
      : getStoredMeasurementPresets(),
  );
  const [measurementSearch, setMeasurementSearch] = useState("");
  const [measurementFilter, setMeasurementFilter] = useState("All Categories");
  const [measurementRecordSearch, setMeasurementRecordSearch] = useState("");
  const [measurementRecordCustomerId, setMeasurementRecordCustomerId] =
    useState("All Customers");
  const [measurementRecordCategoryId, setMeasurementRecordCategoryId] =
    useState("All Garments");
  const [selectedMeasurementCategoryId, setSelectedMeasurementCategoryId] =
    useState<string | null>(null);
  const [isMeasurementFormOpen, setIsMeasurementFormOpen] = useState(false);
  const [measurementFormCategoryId, setMeasurementFormCategoryId] = useState(
    initialMeasurementCategories[0].id,
  );
  const [measurementFormFields, setMeasurementFormFields] = useState<
    Array<{ name: string; value: string }>
  >([]);
  const [editingMeasurementEntry, setEditingMeasurementEntry] =
    useState<MeasurementEntry | null>(null);
  const [measurementCustomerName, setMeasurementCustomerName] = useState("");
  const [isMeasurementPresetFormOpen, setIsMeasurementPresetFormOpen] =
    useState(false);
  const [measurementPresetCategoryId, setMeasurementPresetCategoryId] =
    useState(initialMeasurementCategories[0].id);
  const [measurementPresetNewGarmentName, setMeasurementPresetNewGarmentName] =
    useState("");
  const [measurementPresetDraft, setMeasurementPresetDraft] = useState("");
  const [
    measurementPresetClothAmountDraft,
    setMeasurementPresetClothAmountDraft,
  ] = useState("");
  const [measurementPresetClothAmounts, setMeasurementPresetClothAmounts] =
    useState(getStoredMeasurementPresetClothAmounts);
  const [measurementBillingEnabled, setMeasurementBillingEnabled] =
    useState(false);
  const [measurementBillingQuantity, setMeasurementBillingQuantity] =
    useState("1");
  const [measurementBillingUnitPrice, setMeasurementBillingUnitPrice] =
    useState("");
  const [measurementBillingClothAmount, setMeasurementBillingClothAmount] =
    useState("");
  const [measurementBillingDiscount, setMeasurementBillingDiscount] =
    useState("0");
  const [measurementBillingDeliveryDate, setMeasurementBillingDeliveryDate] =
    useState("");
  const [measurementGarmentPhotos, setMeasurementGarmentPhotos] = useState<
    MeasurementPhotoDraft[]
  >([]);
  const [measurementStylePhotos, setMeasurementStylePhotos] = useState<
    MeasurementPhotoDraft[]
  >([]);
  const [pendingMeasurementSubmission, setPendingMeasurementSubmission] =
    useState<MeasurementSubmission | null>(null);
  const [customerNamePrefill, setCustomerNamePrefill] = useState("");
  const [
    returnToMeasurementAfterCustomerAdd,
    setReturnToMeasurementAfterCustomerAdd,
  ] = useState(false);

  useEffect(() => {
    if (!cameraTarget || cameraTab !== "Camera") return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Camera access is not available in this browser. Use Upload or Gallery instead.",
          );
        return navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
      })
      .catch((error: unknown) => {
        if (active)
          setCameraError(
            error instanceof Error && error.message.startsWith("Camera access")
              ? error.message
              : "Camera permission was denied or no camera is available. Choose Upload or Gallery to continue.",
          );
      });
    return () => {
      active = false;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraTarget, cameraTab]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setAuthError(error.message);
      setAuthSession(data.session);
      setClothGalleryLoading(Boolean(data.session));
      setAuthLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setWorkspaceUserRole("");
        setWorkspaceLoading(Boolean(session));
        setWorkspaceError("");
        setClothGalleryLoading(Boolean(session));
        setClothRecords([]);
        setClothGalleryError("");
        setGalleryImportPending(false);
      }
      setAuthSession(session);
      setAuthLoading(false);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      setWorkspaceError("");
      setWorkspaceReloadKey((key) => key + 1);
    }
    function handleOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as InstallPromptEvent);
    };
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setInstallPromptEvent(null);
      setInstallHelpMessage("");
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!supabase || !authUserId) return;

    let current = true;
    let serverWorkspaceLoaded = false;
    const userId = authUserId;
    const needsInitialWorkspace = workspaceLoadedUserIdRef.current !== userId;
    if (navigator.onLine && needsInitialWorkspace) {
      void loadCachedWorkspace(userId)
        .then((cached) => {
          if (!current || !cached || serverWorkspaceLoaded) return;
          applyWorkspaceData(cached.data);
          markWorkspaceLoaded(userId);
          setWorkspaceLoading(false);
        })
        .catch((error: unknown) => {
          console.error("Could not load cached shop records.", error);
        });
    }
    void syncWorkspace(userId)
      .then(() => {
        serverWorkspaceLoaded = true;
        if (current) markWorkspaceLoaded(userId);
      })
      .catch((error: unknown) => {
        if (current)
          setWorkspaceError(
            error instanceof Error
              ? error.message
              : "Unable to load the shop database.",
          );
      })
      .finally(() => {
        if (current) setWorkspaceLoading(false);
      });

    return () => {
      current = false;
    };
  }, [authUserId, workspaceReloadKey]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!authUserId || workspaceUserRole !== "owner") return;

    let current = true;
    void loadClothGalleryRecords()
      .then(async (records) => {
        if (!current) return;
        setClothGalleryError("");
        if (records.length) {
          setGalleryImportPending(false);
          setClothRecords(records);
          return;
        }
        const localRecords = getStoredClothRecords();
        if (localRecords.length) {
          const importedRecords = await importLocalClothGallery();
          if (!current) return;
          if (importedRecords) {
            setClothRecords(importedRecords);
            return;
          }
        }
        setClothRecords(records);
      })
      .catch((error: unknown) => {
        console.error("Could not load the Supabase cloth gallery.", error);
        if (current) {
          setClothGalleryError(
            error instanceof Error
              ? error.message
              : "Could not load the fabric and style gallery.",
          );
        }
      })
      .finally(() => {
        if (current) setClothGalleryLoading(false);
      });

    return () => {
      current = false;
    };
  }, [authUserId, workspaceUserRole, workspaceReloadKey]);

  useEffect(() => {
    const realtimeClient = supabase;
    if (!realtimeClient || !authUserId || workspaceUserRole !== "owner") return;
    let refreshTimeout: number | undefined;
    const scheduleWorkspaceRefresh = () => {
      window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(
        () => setWorkspaceReloadKey((key) => key + 1),
        250,
      );
    };
    const channel = realtimeClient
      .channel(`apprentice-workflow-${authUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        () => {
          scheduleWorkspaceRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "task_updates" },
        () => {
          scheduleWorkspaceRefresh();
          void refreshActivityHistory().catch((error: unknown) =>
            openNotice(
              error instanceof Error
                ? error.message
                : "Could not refresh activity history.",
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        () => {
          void refreshActivityHistory().catch((error: unknown) =>
            openNotice(
              error instanceof Error
                ? error.message
                : "Could not refresh activity history.",
            ),
          );
        },
      )
      .subscribe();
    return () => {
      window.clearTimeout(refreshTimeout);
      void realtimeClient.removeChannel(channel);
    };
  }, [authUserId, workspaceUserRole]);

  async function refreshActivityHistory() {
    if (!supabase) return;
    const [auditResult, profilesResult] = await Promise.all([
      supabase
        .from("audit_logs")
        .select("id,actor_id,action,entity_type,entity_id,details,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("profiles").select("id,full_name"),
    ]);
    if (auditResult.error) throw auditResult.error;
    if (profilesResult.error) throw profilesResult.error;
    const profiles = new Map(
      (profilesResult.data ?? []).map((profile) => [
        profile.id,
        profile.full_name,
      ]),
    );
    setActivityEntries(
      (auditResult.data ?? []).map((record) => {
        const details =
          record.details &&
          typeof record.details === "object" &&
          !Array.isArray(record.details)
            ? (record.details as Record<string, unknown>)
            : {};
        return {
          id: record.id,
          action: record.action,
          entityType: record.entity_type,
          entityId: record.entity_id ?? undefined,
          entityLabel:
            typeof details.entity_label === "string"
              ? details.entity_label
              : record.entity_type,
          actor: profiles.get(record.actor_id ?? "") || "Shop user",
          createdAt: record.created_at,
        };
      }),
    );
  }

  useEffect(() => {
    if (activePage !== "Notifications" || !supabase || !authUserId) return;
    let current = true;
    void Promise.all([
      supabase
        .from("audit_logs")
        .select("id,actor_id,action,entity_type,entity_id,details,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("profiles").select("id,full_name"),
    ])
      .then(([auditResult, profileResult]) => {
        if (auditResult.error) throw auditResult.error;
        if (profileResult.error) throw profileResult.error;
        if (!current) return;
        const profiles = new Map(
          (profileResult.data ?? []).map((profile) => [
            profile.id,
            profile.full_name,
          ]),
        );
        setActivityEntries(
          (auditResult.data ?? []).map((record) => {
            const details =
              record.details &&
              typeof record.details === "object" &&
              !Array.isArray(record.details)
                ? (record.details as Record<string, unknown>)
                : {};
            return {
              id: record.id,
              action: record.action,
              entityType: record.entity_type,
              entityId: record.entity_id ?? undefined,
              entityLabel:
                typeof details.entity_label === "string"
                  ? details.entity_label
                  : record.entity_type,
              actor: profiles.get(record.actor_id ?? "") || "Shop user",
              createdAt: record.created_at,
            };
          }),
        );
      })
      .catch((error: unknown) => {
        if (current)
          openNotice(
            error instanceof Error
              ? `Could not load activity history: ${error.message}`
              : "Could not load activity history.",
          );
      });
    return () => {
      current = false;
    };
  }, [activePage, authUserId]);

  useEffect(() => {
    try {
      localStorage.setItem("oti-b-activity", JSON.stringify(activityEntries));
    } catch {
      openNotice("Activity history could not be saved on this device.");
    }
  }, [activityEntries]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "oti-b-read-activity",
        JSON.stringify(readActivityIds),
      );
    } catch {
      openNotice("Notification read status could not be saved on this device.");
    }
  }, [readActivityIds]);

  useEffect(() => {
    if (!highlightedRecord) return;
    document
      .getElementById(
        `${highlightedRecord.page.toLowerCase()}-record-${highlightedRecord.id}`,
      )
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = window.setTimeout(() => setHighlightedRecord(null), 2100);
    return () => window.clearTimeout(timeout);
  }, [highlightedRecord]);

  function applyWorkspaceData(workspace: WorkspaceData) {
    setCustomerRecords(workspace.customers);
    setOrders(workspace.orders);
    setPayments(workspace.payments);
    setPaymentTransactions(workspace.paymentTransactions);
    setTasks(workspace.tasks);
    setTaskUpdates(workspace.taskUpdates);
    setApprentices(workspace.apprentices);
    setApprenticeTrainingRecords(workspace.apprenticeTrainingRecords);
    setMeasurementEntries(
      workspace.measurements.map(({ previousSessionId, ...entry }) => ({
        ...entry,
        versionOfId: previousSessionId,
      })),
    );
    setMeasurementPresets((current) => ({
      ...current,
      ...workspace.measurementPresets,
    }));
    setMeasurementPresetClothAmounts(workspace.measurementPresetClothAmounts);
    setWorkspaceUserRole(workspace.userRole);
    setClothGalleryLoading(workspace.userRole === "owner");
    const accessLinkUsed =
      typeof window !== "undefined" &&
      (new URLSearchParams(window.location.search).has("apprentice-invite") ||
        new URLSearchParams(window.location.search).has("password-reset"));
    setPasswordSetupRequired(workspace.passwordSetupRequired || accessLinkUsed);
    setCustomerNotes(workspace.customerNotes);
    const loadedShopSettings = workspace.shopSettings ?? defaultShopSettings;
    setShopSettings(loadedShopSettings);
    setSavedShopSettings(loadedShopSettings);
    setMeasurementCategories((categories) => {
      const loadedCategories = [
        ...categories,
        ...customMeasurementCategories(workspace.measurementPresets),
      ];
      const uniqueCategories = Array.from(
        new Map(loadedCategories.map((category) => [category.id, category])).values(),
      );
      return uniqueCategories.map((category) => ({
        ...category,
        customerCount: workspace.measurementCategoryCounts[category.id] ?? 0,
      }));
    });
  }

  async function syncWorkspace(userId = authUserId) {
    const workspace = await loadWorkspace(setWorkspaceUserRole, userId);
    if (!workspace) return;
    applyWorkspaceData(workspace);
  }

  const filteredOrders = orders.filter((order) =>
    `${order.id} ${order.customer} ${order.item} ${order.status}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );
  function orderDeliveryState(
    order: OrderRecord,
  ): "overdue" | "today" | "soon" | "scheduled" | "unknown" {
    const deliveryDate = parseCalendarDate(order.date);
    if (!deliveryDate) return "unknown";
    deliveryDate.setHours(0, 0, 0, 0);
    const daysUntilDelivery = Math.round(
      (deliveryDate.getTime() - today.getTime()) / 86_400_000,
    );
    if (order.status !== "Delivered" && daysUntilDelivery < 0) return "overdue";
    if (daysUntilDelivery === 0) return "today";
    if (daysUntilDelivery > 0 && daysUntilDelivery <= 7) return "soon";
    return "scheduled";
  }
  const overdueOrderCount = orders.filter(
    (order) => orderDeliveryState(order) === "overdue",
  ).length;
  const visibleOrders = orders.filter((order) => {
    const searchMatches = `${order.id} ${order.customer} ${order.item}`
      .toLowerCase()
      .includes(orderSearch.toLowerCase());
    const statusMatches =
      orderStatusFilter === "All Statuses" ||
      order.status === orderStatusFilter;
    const deliveryState = orderDeliveryState(order);
    const deliveryMatches =
      orderDeliveryFilter === "All Delivery Dates" ||
      (orderDeliveryFilter === "Overdue" && deliveryState === "overdue") ||
      (orderDeliveryFilter === "Due Today" && deliveryState === "today") ||
      (orderDeliveryFilter === "Due in 7 Days" &&
        ["today", "soon"].includes(deliveryState)) ||
      (orderDeliveryFilter === "Due in 30 Days" &&
        ["today", "soon", "scheduled"].includes(deliveryState) &&
        (() => {
          const deliveryDate = parseCalendarDate(order.date);
          const daysUntilDelivery = deliveryDate
            ? Math.floor(
                (new Date(
                  deliveryDate.getFullYear(),
                  deliveryDate.getMonth(),
                  deliveryDate.getDate(),
                ).getTime() -
                  today.getTime()) /
                  86_400_000,
              )
            : -1;
          return daysUntilDelivery >= 0 && daysUntilDelivery <= 30;
        })()) ||
      (orderDeliveryFilter === "No Delivery Date" &&
        deliveryState === "unknown");
    return searchMatches && statusMatches && deliveryMatches;
  });
  const paymentStatus = (payment: PaymentRecord) =>
    payment.paid >= payment.total
      ? "Paid"
      : payment.paid > 0
        ? "Partially Paid"
        : "Pending";
  const visiblePayments = payments.filter((payment) => {
    const searchMatches = `${payment.id} ${payment.orderId} ${payment.customer}`
      .toLowerCase()
      .includes(paymentSearch.toLowerCase());
    const statusMatches =
      paymentStatusFilter === "All Statuses" ||
      paymentStatus(payment) === paymentStatusFilter;
    return searchMatches && statusMatches;
  });
  const paymentPeriodBounds = (() => {
    if (paymentPeriodFilter === "This month") {
      return [
        new Date(today.getFullYear(), today.getMonth(), 1),
        new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999),
      ] as const;
    }
    if (paymentPeriodFilter === "Last month") {
      return [
        new Date(today.getFullYear(), today.getMonth() - 1, 1),
        new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999),
      ] as const;
    }
    return null;
  })();
  const visiblePaymentTransactions = paymentTransactions
    .filter((transaction) => {
      const searchMatches =
        `${transaction.id} ${transaction.orderId} ${transaction.customer} ${transaction.method} ${transaction.reference} ${transaction.recordedBy}`
          .toLowerCase()
          .includes(paymentSearch.toLowerCase());
      const methodMatches =
        paymentMethodFilter === "All Methods" ||
        transaction.method === paymentMethodFilter;
      const transactionDate = parseCalendarDate(transaction.date);
      const periodMatches =
        !paymentPeriodBounds ||
        Boolean(
          transactionDate &&
          transactionDate >= paymentPeriodBounds[0] &&
          transactionDate <= paymentPeriodBounds[1],
        );
      return searchMatches && methodMatches && periodMatches;
    })
    .sort(
      (first, second) =>
        new Date(second.date).getTime() - new Date(first.date).getTime(),
    );
  const totalPaymentsReceived = payments.reduce(
    (total, payment) => total + payment.paid,
    0,
  );
  const totalRevenue = totalPaymentsReceived;
  const totalPaymentsOutstanding = payments.reduce(
    (total, payment) => total + Math.max(0, payment.total - payment.paid),
    0,
  );
  const fullyPaidCount = payments.filter(
    (payment) => paymentStatus(payment) === "Paid",
  ).length;
  const pendingPaymentCount = payments.filter(
    (payment) => paymentStatus(payment) === "Pending",
  ).length;
  const receivedThisMonth = paymentTransactions.reduce((total, transaction) => {
    const date = parseCalendarDate(transaction.date);
    return (
      total +
      (transaction.status === "Confirmed" &&
      date &&
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth()
        ? transaction.amount
        : 0)
    );
  }, 0);
  const paymentMethodTotals = (
    ["Cash", "Mobile Money", "Bank Transfer", "Other"] as const
  ).map((method) => ({
    method,
    amount: paymentTransactions
      .filter(
        (transaction) =>
          transaction.method === method && transaction.status === "Confirmed",
      )
      .reduce((total, transaction) => total + transaction.amount, 0),
  }));
  const selectedPayment = payments.find(
    (payment) => payment.id === selectedPaymentId,
  );
  const reportStart =
    reportPeriod === "Custom"
      ? reportStartDate
      : reportPeriod === "All Time"
        ? ""
        : reportPeriod === "This Year"
          ? dateKey(new Date(today.getFullYear(), 0, 1))
          : reportPeriod === "Last Month"
            ? dateKey(new Date(today.getFullYear(), today.getMonth() - 1, 1))
            : reportPeriod === "Last 30 Days"
              ? dateKey(
                  new Date(
                    today.getFullYear(),
                    today.getMonth(),
                    today.getDate() - 29,
                  ),
                )
              : dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const reportEnd =
    reportPeriod === "Custom"
      ? reportEndDate
      : reportPeriod === "All Time"
        ? ""
        : reportPeriod === "Last Month"
          ? dateKey(new Date(today.getFullYear(), today.getMonth(), 0))
          : dateKey(today);
  const reportRangeValid =
    reportPeriod !== "Custom" ||
    !reportStartDate ||
    !reportEndDate ||
    reportStartDate <= reportEndDate;
  const reportDateMatches = (value: string) => {
    const parsed = parseCalendarDate(value);
    if (!parsed) return false;
    const key = dateKey(parsed);
    return (
      (!reportStart || key >= reportStart) && (!reportEnd || key <= reportEnd)
    );
  };
  const reportPeriodOrders = reportRangeValid
    ? orders.filter((order) => reportDateMatches(order.createdAt ?? order.date))
    : [];
  const reportPeriodTransactions = reportRangeValid
    ? paymentTransactions.filter(
        (transaction) =>
          transaction.status === "Confirmed" &&
          reportDateMatches(transaction.date),
      )
    : [];
  const reportCollected = reportPeriodTransactions.reduce(
    (total, transaction) => total + transaction.amount,
    0,
  );
  const reportOrderValue = reportPeriodOrders.reduce(
    (total, order) => total + order.amount,
    0,
  );
  const reportOutstanding = reportPeriodOrders.reduce((total, order) => {
    const payment = payments.find((record) => record.orderId === order.id);
    return total + Math.max(0, order.amount - (payment?.paid ?? 0));
  }, 0);
  const reportAverageOrder = reportPeriodOrders.length
    ? Math.round(reportOrderValue / reportPeriodOrders.length)
    : 0;
  const reportOrderRows = reportPeriodOrders.filter((order) => {
    const searchMatches = `${order.id} ${order.customer} ${order.item}`
      .toLowerCase()
      .includes(reportSearch.toLowerCase());
    const statusMatches =
      reportStatusFilter === "All Statuses" ||
      order.status === reportStatusFilter;
    return searchMatches && statusMatches;
  });
  const reportStatusRows = statusCounts.map(({ label, color }) => ({
    label,
    color,
    count: reportPeriodOrders.filter((order) => order.status === label).length,
  }));
  const reportPaymentMethods = (
    ["Mobile Money", "Bank Transfer", "Cash", "Other"] as const
  ).map((method) => ({
    method,
    amount: reportPeriodTransactions
      .filter((transaction) => transaction.method === method)
      .reduce((total, transaction) => total + transaction.amount, 0),
  }));
  const reportGarmentRows = Array.from(
    reportPeriodOrders.reduce((totals, order) => {
      const current = totals.get(order.item) ?? { count: 0, amount: 0 };
      current.count += 1;
      current.amount += order.amount;
      totals.set(order.item, current);
      return totals;
    }, new Map<string, { count: number; amount: number }>()),
  )
    .map(([item, totals]) => ({ item, ...totals }))
    .sort((first, second) => second.amount - first.amount)
    .slice(0, 5);
  let statusChartOffset = 0;
  const statusChartRows = statusCounts.map(({ label, color }) => ({
    label,
    color,
    count: orders.filter((order) => order.status === label).length,
  }));
  const statusChartSegments = orders.length
    ? statusChartRows
        .filter(({ count }) => count > 0)
        .map((status) => {
          const fraction = status.count / orders.length;
          const segment = { ...status, fraction, offset: statusChartOffset };
          statusChartOffset += fraction;
          return segment;
        })
    : [];
  const revenuePeriodStart =
    period === "This Year"
      ? new Date(today.getFullYear(), 0, 1)
      : new Date(
          today.getFullYear(),
          today.getMonth() + (period === "Last Month" ? -1 : 0),
          1,
        );
  const revenuePeriodEnd =
    period === "This Year"
      ? new Date(today.getFullYear(), 11, 31)
      : new Date(
          today.getFullYear(),
          today.getMonth() + (period === "Last Month" ? 0 : 1),
          0,
        );
  const revenueBucketCount =
    period === "This Year" ? 12 : revenuePeriodEnd.getDate();
  const revenueSeries = Array.from(
    { length: revenueBucketCount },
    (_, index) => {
      const bucketDate =
        period === "This Year"
          ? new Date(today.getFullYear(), index, 1)
          : new Date(
              revenuePeriodStart.getFullYear(),
              revenuePeriodStart.getMonth(),
              index + 1,
            );
      const amount = payments.reduce((total, payment) => {
        const paymentDate = parseCalendarDate(payment.date);
        if (
          !paymentDate ||
          paymentDate < revenuePeriodStart ||
          paymentDate > revenuePeriodEnd
        )
          return total;
        const inBucket =
          period === "This Year"
            ? paymentDate.getMonth() === bucketDate.getMonth()
            : paymentDate.getDate() === bucketDate.getDate();
        return total + (inBucket ? payment.paid : 0);
      }, 0);
      return { date: bucketDate, amount };
    },
  );
  const revenuePeriodTotal = revenueSeries.reduce(
    (total, point) => total + point.amount,
    0,
  );
  const revenueMax = Math.max(1, ...revenueSeries.map((point) => point.amount));
  const revenueAxisMax = (Math.ceil(revenueMax / 4 / 100) * 100 || 100) * 4;
  const compactCurrency = (amount: number) => {
    const symbol = shopSettings.currency === "GHS" ? "GH₵" : "$";
    return `${symbol}${amount >= 1000 ? `${(amount / 1000).toFixed(amount >= 10000 ? 0 : 1)}k` : amount}`;
  };
  const revenuePoints = revenueSeries.map((point, index) => ({
    ...point,
    x:
      revenueSeries.length < 2
        ? 180
        : 12 + (index / (revenueSeries.length - 1)) * 334,
    y: 132 - (point.amount / revenueAxisMax) * 114,
  }));
  const revenueLinePath = revenuePoints.reduce((path, point, index, points) => {
    if (index === 0) return `M${point.x} ${point.y}`;
    const previous = points[index - 1];
    const middleX = (previous.x + point.x) / 2;
    return `${path} Q${middleX} ${previous.y} ${middleX} ${(previous.y + point.y) / 2} T${point.x} ${point.y}`;
  }, "");
  const revenueAreaPath = revenuePoints.length
    ? `${revenueLinePath} L${revenuePoints[revenuePoints.length - 1].x} 146 L${revenuePoints[0].x} 146 Z`
    : "";
  const revenueSeriesKey = revenueSeries.map((point) => point.amount).join("-");
  const revenueLabelIndices =
    period === "This Year"
      ? [0, 3, 6, 9]
      : Array.from(
          new Set([
            0,
            Math.floor((revenueBucketCount - 1) / 3),
            Math.floor(((revenueBucketCount - 1) * 2) / 3),
            revenueBucketCount - 1,
          ]),
        );
  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const selectedOrderPayment = selectedOrder
    ? payments.find((payment) => payment.orderId === selectedOrder.id)
    : undefined;
  const selectedOrderCustomer = selectedOrder
    ? customerRecords.find(
        (customer) => customer.name === selectedOrder.customer,
      )
    : undefined;
  const selectedOrderBalance = selectedOrderPayment
    ? Math.max(0, selectedOrderPayment.total - selectedOrderPayment.paid)
    : (selectedOrder?.amount ?? 0);
  const pendingOrderCount = orders.filter(
    (order) => order.status === "Pending",
  ).length;
  const activeOrderCount = orders.filter((order) =>
    ["Cutting", "Sewing", "Fitting"].includes(order.status),
  ).length;
  const completedOrderCount = orders.filter((order) =>
    ["Completed", "Delivered"].includes(order.status),
  ).length;
  const taskIsOverdue = (task: TaskRecord) =>
    Boolean(task.dueDate) &&
    task.status !== "Done" &&
    new Date(`${task.dueDate}T00:00:00`) < today;
  const taskMatchesDueFilter = (task: TaskRecord) => {
    if (taskDueFilter === "Overdue") return taskIsOverdue(task);
    if (taskDueFilter === "Due in 7 days") {
      if (!task.dueDate || task.status === "Done") return false;
      const due = new Date(`${task.dueDate}T00:00:00`);
      const weekFromToday = new Date(today);
      weekFromToday.setDate(weekFromToday.getDate() + 7);
      return due >= today && due <= weekFromToday;
    }
    if (taskDueFilter === "No due date") return !task.dueDate;
    return true;
  };
  const visibleTasks = tasks.filter((task) => {
    const searchMatches =
      `${task.title} ${task.description ?? ""} ${task.id} ${task.assignee} ${task.orderId}`
        .toLowerCase()
        .includes(taskSearch.toLowerCase());
    const statusMatches =
      taskStatusFilter === "All Statuses" || task.status === taskStatusFilter;
    const priorityMatches =
      taskPriorityFilter === "All Priorities" ||
      task.priority === taskPriorityFilter;
    const apprenticeMatches =
      taskAssigneeFilter === "All Apprentices" ||
      task.assigneeId === taskAssigneeFilter ||
      task.assignee === taskAssigneeFilter;
    return (
      searchMatches &&
      statusMatches &&
      priorityMatches &&
      apprenticeMatches &&
      taskMatchesDueFilter(task)
    );
  });
  const taskStatusColumns: TaskStatus[] = [
    "To do",
    "Accepted",
    "In progress",
    "Review",
    "Revision requested",
    "Done",
  ];
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const taskTimeline = (task: TaskRecord) =>
    taskUpdates
      .filter((update) => update.taskId === (task.dbId ?? task.id))
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      );
  const todoTaskCount = tasks.filter((task) => task.status === "To do").length;
  const inProgressTaskCount = tasks.filter(
    (task) => task.status === "In progress",
  ).length;
  const reviewTaskCount = tasks.filter(
    (task) => task.status === "Review",
  ).length;
  const doneTaskCount = tasks.filter((task) => task.status === "Done").length;
  const overdueTaskCount = tasks.filter(taskIsOverdue).length;
  const isTaskAssignedToApprentice = (
    task: TaskRecord,
    apprentice: ApprenticeRecord,
  ) =>
    task.assigneeId && apprentice.userId
      ? task.assigneeId === apprentice.userId
      : task.assignee === apprentice.name;
  const currentTaskForApprentice = (apprentice: ApprenticeRecord) =>
    tasks.find(
      (task) =>
        isTaskAssignedToApprentice(task, apprentice) && task.status !== "Done",
    );
  const visibleApprentices = apprentices.filter((apprentice) => {
    const searchMatches =
      `${apprentice.name} ${apprentice.id} ${apprentice.focus} ${currentTaskForApprentice(apprentice)?.title ?? apprentice.assignment}`
        .toLowerCase()
        .includes(apprenticeSearch.toLowerCase());
    const statusMatches =
      apprenticeStatusFilter === "All Statuses" ||
      apprentice.status === apprenticeStatusFilter;
    const focusMatches =
      apprenticeFocusFilter === "All Skill Areas" ||
      apprentice.focus === apprenticeFocusFilter;
    const apprenticeTasks = tasks.filter(
      (task) =>
        isTaskAssignedToApprentice(task, apprentice) && task.status !== "Done",
    );
    const assignmentMatches =
      apprenticeAssignmentFilter === "All Assignments" ||
      (apprenticeAssignmentFilter === "Assigned" &&
        apprenticeTasks.length > 0) ||
      (apprenticeAssignmentFilter === "Unassigned" &&
        apprenticeTasks.length === 0);
    return searchMatches && statusMatches && focusMatches && assignmentMatches;
  });
  const activeApprenticeCount = apprentices.filter(
    (apprentice) => apprentice.status === "Active",
  ).length;
  const currentWeekStart = new Date();
  currentWeekStart.setHours(0, 0, 0, 0);
  currentWeekStart.setDate(
    currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7),
  );
  const currentWeekStartKey = dateKey(currentWeekStart);
  const currentWeekTrainingRecords = apprenticeTrainingRecords.filter(
    (record) => record.kind === "hours" && record.date >= currentWeekStartKey,
  );
  const weeklyTrainingHours = currentWeekTrainingRecords.reduce(
    (total, record) => total + (record.hours ?? 0),
    0,
  );
  const apprenticeHoursThisWeek = (apprentice: ApprenticeRecord) =>
    apprenticeTrainingRecords
      .filter(
        (record) =>
          record.apprenticeId === (apprentice.userId ?? apprentice.id) &&
          record.kind === "hours" &&
          record.date >= currentWeekStartKey,
      )
      .reduce((total, record) => total + (record.hours ?? 0), 0);
  const onLeaveApprenticeCount = apprentices.filter(
    (apprentice) => apprentice.status === "On leave",
  ).length;
  const activeApprenticeTaskCount = tasks.filter(
    (task) =>
      task.status !== "Done" &&
      apprentices.some((apprentice) =>
        isTaskAssignedToApprentice(task, apprentice),
      ),
  ).length;
  const overdueApprenticeTaskCount = tasks.filter(
    (task) =>
      task.status !== "Done" &&
      apprentices.some((apprentice) =>
        isTaskAssignedToApprentice(task, apprentice),
      ) &&
      new Date(`${task.dueDate}T00:00:00`) < today,
  ).length;
  const recentApprenticeRecordCount = apprenticeTrainingRecords.filter(
    (record) =>
      record.date >= dateKey(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
  ).length;
  const apprenticeFocusAreas = [
    ...new Set(
      apprentices.map((apprentice) => apprentice.focus).filter(Boolean),
    ),
  ];
  const selectedApprentice = apprentices.find(
    (apprentice) => apprentice.id === selectedApprenticeId,
  );
  const selectedApprenticeKey =
    selectedApprentice?.userId ?? selectedApprentice?.id;
  const selectedApprenticeRecords = selectedApprentice
    ? apprenticeTrainingRecords
        .filter(
          (record) =>
            record.apprenticeId === selectedApprenticeKey ||
            record.apprenticeId === selectedApprentice.id,
        )
        .sort((left, right) => right.date.localeCompare(left.date))
    : [];
  const selectedApprenticeTasks = selectedApprentice
    ? tasks
        .filter((task) => isTaskAssignedToApprentice(task, selectedApprentice))
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    : [];
  const selectedApprenticeHoursThisWeek = selectedApprenticeRecords
    .filter(
      (record) => record.kind === "hours" && record.date >= currentWeekStartKey,
    )
    .reduce((total, record) => total + (record.hours ?? 0), 0);
  const filteredCustomers = customerRecords.filter((customer) => {
    const queryMatches = `${customer.name} ${customer.phone} ${customer.id}`
      .toLowerCase()
      .includes(customerSearch.toLowerCase());
    const garmentMatches =
      garmentFilter === "All Garment Types" ||
      customer.garment === garmentFilter;
    const statusMatches =
      customerStatusFilter === "All Statuses" ||
      (customerStatusFilter === "Measurements saved" &&
        customer.measurementsSaved) ||
      (customerStatusFilter === "Measurements missing" &&
        !customer.measurementsSaved);
    return (
      queryMatches &&
      garmentMatches &&
      statusMatches &&
      (!ordersOnly || customer.orders > 0)
    );
  });
  const customerPageCount = Math.max(
    1,
    Math.ceil(filteredCustomers.length / 8),
  );
  const visibleCustomers = filteredCustomers.slice(
    (customerPage - 1) * 8,
    customerPage * 8,
  );
  const selectedCustomer = customerRecords.find(
    (customer) => customer.id === selectedCustomerId,
  );
  const filteredMeasurementCategories = measurementCategories.filter(
    (category) => {
      const queryMatches = category.name
        .toLowerCase()
        .includes(measurementSearch.toLowerCase());
      const filterMatches =
        measurementFilter === "All Categories" ||
        category.group === measurementFilter;
      return queryMatches && filterMatches;
    },
  );
  const selectedMeasurementCategory = measurementCategories.find(
    (category) => category.id === selectedMeasurementCategoryId,
  );
  const supersededMeasurementIds = new Set(
    measurementEntries
      .filter((entry) => entry.versionOfId)
      .map((entry) => entry.versionOfId as string),
  );
  const filteredMeasurementEntries = measurementEntries.filter((entry) => {
    const categoryMatches =
      measurementRecordCategoryId === "All Garments" ||
      entry.categoryId === measurementRecordCategoryId;
    const selectedCategoryMatches =
      !selectedMeasurementCategoryId ||
      entry.categoryId === selectedMeasurementCategoryId;
    const customerMatches =
      measurementRecordCustomerId === "All Customers" ||
      (entry.customerId ??
        customerRecords.find((customer) => customer.name === entry.customer)
          ?.id) === measurementRecordCustomerId;
    const queryMatches =
      `${entry.customer} ${entry.id} ${entry.fields.map((field) => field.name).join(" ")}`
        .toLocaleLowerCase()
        .includes(measurementRecordSearch.trim().toLocaleLowerCase());
    return (
      categoryMatches &&
      selectedCategoryMatches &&
      customerMatches &&
      queryMatches
    );
  });
  const hasMeasurementRecordFilters =
    Boolean(measurementRecordSearch.trim()) ||
    measurementRecordCustomerId !== "All Customers" ||
    measurementRecordCategoryId !== "All Garments" ||
    Boolean(selectedMeasurementCategoryId);
  const displayedMeasurementEntries = hasMeasurementRecordFilters
    ? filteredMeasurementEntries
    : filteredMeasurementEntries.slice(0, 5);
  function measurementVersionNumber(entry: MeasurementEntry): number {
    let version = 1;
    let previousId = entry.versionOfId;
    while (previousId) {
      version += 1;
      previousId = measurementEntries.find(
        (candidate) => candidate.id === previousId,
      )?.versionOfId;
    }
    return version;
  }
  const matchingMeasurementCustomer = customerRecords.find(
    (customer) =>
      customer.name.trim().toLocaleLowerCase() ===
      measurementCustomerName.trim().toLocaleLowerCase(),
  );
  const canManageMeasurementPresets =
    !isSupabaseConfigured || workspaceUserRole === "owner";
  const calendarEvents = [
    ...orders.flatMap((order) => {
      const date = parseCalendarDate(order.date);
      return date
        ? [
            {
              id: order.id,
              date: dateKey(date),
              title: `${order.customer} · ${order.item}`,
              detail: `Delivery · ${order.status}`,
              kind: "order" as const,
            },
          ]
        : [];
    }),
    ...tasks.flatMap((task) => {
      const date = parseCalendarDate(task.dueDate);
      return date
        ? [
            {
              id: task.id,
              date: dateKey(date),
              title: task.title,
              detail: `Task · ${task.assignee} · ${task.status}`,
              kind: "task" as const,
            },
          ]
        : [];
    }),
  ];
  const calendarOffset =
    (new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    ).getDay() +
      6) %
    7;
  const calendarCellCount =
    Math.ceil(
      (calendarOffset +
        new Date(
          calendarMonth.getFullYear(),
          calendarMonth.getMonth() + 1,
          0,
        ).getDate()) /
        7,
    ) * 7;
  const calendarCells = Array.from(
    { length: calendarCellCount },
    (_, index) => {
      const date = new Date(
        calendarMonth.getFullYear(),
        calendarMonth.getMonth(),
        index - calendarOffset + 1,
      );
      return {
        date,
        key: dateKey(date),
        inMonth: date.getMonth() === calendarMonth.getMonth(),
      };
    },
  );
  const selectedDayEvents = calendarEvents.filter(
    (event) => event.date === selectedCalendarDay,
  );
  const selectedGalleryRecord = clothRecords.find(
    (cloth) => cloth.id === selectedGalleryRecordId,
  );

  useEffect(() => {
    if (!expandedGalleryImageId) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpandedGalleryImageId(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [expandedGalleryImageId]);

  useEffect(() => {
    if (!confirmationDialog) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const resolve = confirmationResolverRef.current;
        confirmationResolverRef.current = null;
        setConfirmationDialog(null);
        resolve?.(false);
      }
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [confirmationDialog]);
  const clothCategories = [
    `All ${galleryKind === "fabric" ? "Fabrics" : "Styles"}`,
    ...new Set(
      clothRecords
        .filter((cloth) => cloth.kind === galleryKind)
        .map((cloth) => cloth.category),
    ),
  ];
  const visibleClothRecords = clothRecords.filter((cloth) => {
    const matchesKind = cloth.kind === galleryKind;
    const matchesSearch =
      `${cloth.name} ${cloth.category} ${cloth.color} ${cloth.details ?? ""}`
        .toLowerCase()
        .includes(clothSearch.toLowerCase());
    const matchesCategory =
      clothCategory ===
        `All ${galleryKind === "fabric" ? "Fabrics" : "Styles"}` ||
      cloth.category === clothCategory;
    return matchesKind && matchesSearch && matchesCategory;
  });
  const visibleGalleryCustomers = customerRecords.filter((customer) =>
    `${customer.name} ${customer.phone} ${customer.id}`
      .toLowerCase()
      .includes(clothCustomerSearch.toLowerCase()),
  );
  const selectedCustomerGarments = selectedCustomer
    ? customerGarments.filter(
        (record) =>
          record.customerId === (selectedCustomer.dbId ?? selectedCustomer.id),
      )
    : [];
  const selectedCustomerTimeline: CustomerTimelineItem[] = selectedCustomer
    ? [
        ...orders
          .filter((order) => order.customer === selectedCustomer.name)
          .map((order) => {
            const date = parseCalendarDate(order.date);
            return {
              id: `order-${order.dbId ?? order.id}`,
              type: "order" as const,
              title: `${order.item} order`,
              description: `${order.status} · Delivery ${order.date}`,
              date: order.date,
              timestamp: date?.getTime() ?? 0,
            };
          }),
        ...payments
          .filter(
            (payment) =>
              payment.customer === selectedCustomer.name && payment.paid > 0,
          )
          .map((payment) => {
            const date = parseCalendarDate(payment.date);
            return {
              id: `payment-${payment.id}`,
              type: "payment" as const,
              title: "Payment received",
              description: `${shopSettings.currency === "GHS" ? "GH₵" : "$"} ${payment.paid.toLocaleString("en-US")} via ${payment.method} · ${payment.orderId}`,
              date: payment.date,
              timestamp: date?.getTime() ?? 0,
            };
          }),
        ...measurementEntries
          .filter((entry) => entry.customer === selectedCustomer.name)
          .map((entry) => {
            const date = parseCalendarDate(entry.date);
            return {
              id: `measurement-${entry.id}`,
              type: "measurement" as const,
              title: "Measurements recorded",
              description: `${measurementCategories.find((category) => category.id === entry.categoryId)?.name ?? "Garment"} · ${entry.fields.length} values saved`,
              date: entry.date,
              timestamp: date?.getTime() ?? 0,
              images: [
                ...(entry.garmentPhotos ?? []),
                ...(entry.stylePhotos ?? []),
              ],
            };
          }),
        ...customerNotes
          .filter(
            (note) =>
              note.customerId ===
              (selectedCustomer.dbId ?? selectedCustomer.id),
          )
          .map((note) => ({
            id: `note-${note.id}`,
            type: "note" as const,
            title: "Customer note",
            description: `${note.text} · Added by ${note.author}`,
            date: new Date(note.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }),
            timestamp: new Date(note.createdAt).getTime(),
          })),
        ...activityEntries
          .filter((entry) => {
            if (entry.entityType === "customer") {
              return (
                entry.entityId === selectedCustomer.dbId ||
                entry.entityId === selectedCustomer.id ||
                entry.entityLabel === selectedCustomer.name
              );
            }
            if (entry.entityType === "measurement") {
              return (
                entry.entityId === selectedCustomer.dbId ||
                entry.entityId === selectedCustomer.id ||
                entry.entityLabel.startsWith(`${selectedCustomer.name} ·`)
              );
            }
            const customerOrders = orders.filter(
              (order) => order.customer === selectedCustomer.name,
            );
            return customerOrders.some(
              (order) =>
                entry.entityId === order.dbId ||
                entry.entityId === order.id ||
                (entry.entityLabel.includes(order.id) &&
                  entry.entityLabel.includes(selectedCustomer.name)),
            );
          })
          .map((entry) => ({
            id: `activity-${entry.id}`,
            type:
              entry.entityType === "measurement"
                ? ("measurement" as const)
                : ("activity" as const),
            title: entry.action
              .replace(/[._]/g, " ")
              .replace(/^./, (letter) => letter.toUpperCase()),
            description: entry.entityLabel,
            date: new Date(entry.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }),
            timestamp: new Date(entry.createdAt).getTime(),
          })),
      ].sort((left, right) => right.timestamp - left.timestamp)
    : [];
  const selectedGalleryCustomer = customerRecords.find(
    (customer) => (customer.dbId ?? customer.id) === selectedGalleryCustomerId,
  );
  const selectedCustomerGalleryHistory = selectedCustomer
    ? galleryCustomerHistory.filter(
        (entry) =>
          entry.customerId === (selectedCustomer.dbId ?? selectedCustomer.id),
      )
    : [];
  const unreadActivityCount = activityEntries.filter(
    (entry) => !readActivityIds.includes(entry.id),
  ).length;
  const upcomingDeliveries = orders
    .filter(
      (order) => order.status !== "Delivered" && new Date(order.date) >= today,
    )
    .sort(
      (left, right) =>
        new Date(left.date).getTime() - new Date(right.date).getTime(),
    )
    .slice(0, 4);
  const recentCustomers = customerRecords.slice(0, 4);
  const ownerDisplayName = String(
    authSession?.user.user_metadata.full_name ??
      authSession?.user.email?.split("@")[0] ??
      "Shop owner",
  )
    .replace(/[._-]+/g, " ")
    .trim();
  const welcomeName = ownerDisplayName.split(/\s+/)[0] || "there";
  const weeklySummaryStart = new Date(today);
  weeklySummaryStart.setDate(
    weeklySummaryStart.getDate() - ((weeklySummaryStart.getDay() + 6) % 7),
  );
  const weeklySummaryStartKey = dateKey(weeklySummaryStart);
  const weeklyOrderCount = orders.filter((order) => {
    const createdDate = parseCalendarDate(order.createdAt ?? order.date);
    return Boolean(
      createdDate &&
      dateKey(createdDate) >= weeklySummaryStartKey &&
      dateKey(createdDate) <= dateKey(today),
    );
  }).length;
  const weeklyPaymentTotal = paymentTransactions.reduce(
    (total, transaction) => {
      const transactionDate = parseCalendarDate(transaction.date);
      return (
        total +
        (transaction.status === "Confirmed" &&
        transactionDate &&
        dateKey(transactionDate) >= weeklySummaryStartKey &&
        dateKey(transactionDate) <= dateKey(today)
          ? transaction.amount
          : 0)
      );
    },
    0,
  );
  const operationalNotifications = [
    ...(shopSettings.notifications.dueTasks
      ? tasks
          .filter((task) => task.status !== "Done")
          .flatMap((task) => {
            const dueDate = parseCalendarDate(task.dueDate);
            if (!dueDate) return [];
            const daysUntilDue = Math.round(
              (dueDate.getTime() - today.getTime()) / 86400000,
            );
            if (daysUntilDue > 7) return [];
            return [
              {
                id: `task-${task.id}`,
                title:
                  daysUntilDue < 0
                    ? "Task overdue"
                    : daysUntilDue === 0
                      ? "Task due today"
                      : "Task due soon",
                message: `${task.title} · ${task.assignee}${task.orderId ? ` · ${task.orderId}` : ""}`,
                date: task.dueDate,
                kind: "task" as const,
                targetId: task.id,
              },
            ];
          })
      : []),
    ...(shopSettings.notifications.deliveryReminders
      ? orders
          .filter((order) => order.status !== "Delivered")
          .flatMap((order) => {
            const deliveryDate = parseCalendarDate(order.date);
            if (!deliveryDate) return [];
            const daysUntilDue = Math.round(
              (deliveryDate.getTime() - today.getTime()) / 86400000,
            );
            if (daysUntilDue > 7) return [];
            return [
              {
                id: `delivery-${order.id}`,
                title:
                  daysUntilDue < 0
                    ? "Delivery overdue"
                    : daysUntilDue === 0
                      ? "Delivery due today"
                      : "Upcoming delivery",
                message: `${order.customer} · ${order.item} · ${order.id}`,
                date: order.date,
                kind: "order" as const,
                targetId: order.id,
              },
            ];
          })
      : []),
    ...(shopSettings.notifications.paymentReceived
      ? activityEntries
          .filter(
            (entry) =>
              entry.action === "payment.recorded" &&
              (today.getTime() - new Date(entry.createdAt).getTime()) /
                86400000 <=
                7,
          )
          .slice(0, 5)
          .map((entry) => {
            const payment =
              payments.find(
                (record) =>
                  record.id === entry.entityId ||
                  record.orderUuid === entry.entityId,
              ) ??
              payments.find((record) =>
                entry.entityLabel.endsWith(`from ${record.customer}`),
              );
            return {
              id: `payment-${entry.id}`,
              title: "Payment received",
              message: entry.entityLabel,
              date: new Date(entry.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
              kind: "payment" as const,
              targetId: payment?.id,
            };
          })
      : []),
    ...(shopSettings.notifications.weeklySummary
      ? [
          {
            id: `weekly-summary-${weeklySummaryStartKey}`,
            title: "Weekly shop summary",
            message: `${weeklyOrderCount} ${weeklyOrderCount === 1 ? "order" : "orders"} · ${shopSettings.currency === "GHS" ? "GH₵" : "$"} ${weeklyPaymentTotal.toLocaleString("en-US")} collected · ${tasks.filter((task) => task.status !== "Done").length} open tasks`,
            date: `Week of ${weeklySummaryStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
            kind: "report" as const,
          },
        ]
      : []),
  ];
  const notificationCount =
    unreadActivityCount + operationalNotifications.length;
  const activityActionLabel = (action: string) =>
    ({
      "order.created": "Created an order",
      "order.status_changed": "Updated order status",
      "payment.recorded": "Recorded a payment",
      "task.created": "Created a task",
      "task.status_changed": "Updated task status",
      "apprentice.created": "Added an apprentice",
      "apprentice.status_changed": "Updated apprentice status",
      "apprentice.invited": "Invited an apprentice to the portal",
      "apprentice.access_reset": "Created an apprentice password reset link",
      "apprentice.password_updated": "Apprentice updated their password",
      "customer.created": "Added a customer",
      "customer.updated": "Updated a customer",
      "customer.deleted": "Deleted a customer and their history",
      "measurement.saved": "Saved measurements",
      "settings.updated": "Updated shop settings",
      "fabric.created": "Added a fabric to the gallery",
      "fabric.deleted": "Removed a fabric from the gallery",
      "style.deleted": "Removed a style from the gallery",
    })[action] ?? action.replace(/[._]/g, " ");
  const formatCurrency = (amount: number) =>
    `${shopSettings.currency === "GHS" ? "GH₵" : "$"} ${amount.toLocaleString("en-US")}`;

  function startCustomerOrder() {
    setContinueToOrder(true);
    setNewOrderCustomerName("");
    setCustomerFormOpen(true);
    setCustomerPhotoPreview("");
    setCustomerPhotoFile(null);
    setActivePage("Customers");
  }

  function closeCustomerForm() {
    setContinueToOrder(false);
    setCustomerFormOpen(false);
    setCustomerNamePrefill("");
    setReturnToMeasurementAfterCustomerAdd(false);
    setCustomerPhotoPreview("");
    setCustomerPhotoFile(null);
  }

  async function recordActivity(
    action: string,
    entityType: string,
    entityLabel: string,
    entityId?: string,
  ) {
    if (supabase && authSession) {
      const { data, error } = await supabase
        .from("audit_logs")
        .insert({
          owner_id: authSession.user.id,
          actor_id: authSession.user.id,
          action,
          entity_type: entityType,
          entity_id: entityId ?? null,
          details: { entity_label: entityLabel },
        })
        .select("id,created_at")
        .single();
      if (error) {
        openNotice(`Saved, but could not record activity: ${error.message}`);
        return;
      }
      const entry: ActivityRecord = {
        id: String(data.id),
        action,
        entityType,
        entityId,
        entityLabel,
        actor: welcomeName,
        createdAt: String(data.created_at),
      };
      setActivityEntries((current) => [entry, ...current].slice(0, 100));
      return;
    }

    const entry: ActivityRecord = {
      id: crypto.randomUUID(),
      action,
      entityType,
      entityId,
      entityLabel,
      actor: welcomeName,
      createdAt: new Date().toISOString(),
    };
    setActivityEntries((current) => [entry, ...current].slice(0, 100));
  }

  function markActivityRead() {
    const allIds = activityEntries.map((entry) => entry.id);
    setReadActivityIds((current) =>
      Array.from(new Set([...current, ...allIds])),
    );
  }

  function openRecord(page: HighlightedRecord["page"], id: string) {
    let targetId = id;
    if (page === "Orders") {
      setSearchTerm("");
      setOrderSearch("");
      setOrderStatusFilter("All Statuses");
      setOrderDeliveryFilter("All Delivery Dates");
    } else if (page === "Tasks") {
      setTaskSearch("");
      setTaskStatusFilter("All Statuses");
      setTaskPriorityFilter("All Priorities");
      setTaskAssigneeFilter("All Apprentices");
      setTaskDueFilter("All Due Dates");
    } else if (page === "Payments") {
      setPaymentSearch("");
      setPaymentStatusFilter("All Statuses");
    } else {
      const customer = customerRecords.find(
        (record) => record.id === id || record.dbId === id,
      );
      if (customer) {
        targetId = customer.id;
        setCustomerSearch("");
        setGarmentFilter("All Garment Types");
        setCustomerStatusFilter("All Statuses");
        setOrdersOnly(false);
        setCustomerPage(
          Math.floor(
            customerRecords.findIndex((record) => record.id === customer.id) /
              8,
          ) + 1,
        );
      }
    }
    setHighlightedRecord({ page, id: targetId });
    setActivePage(page);
  }

  function openNotificationRecord(item: {
    kind: "order" | "task" | "payment" | "report";
    targetId?: string;
  }) {
    if (item.kind === "report") {
      setActivePage("Reports");
      return;
    }
    const page =
      item.kind === "order"
        ? "Orders"
        : item.kind === "payment"
          ? "Payments"
          : "Tasks";
    if (item.targetId) openRecord(page, item.targetId);
    else setActivePage(page);
  }

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setOrderFormError("");
    const customerName = String(formData.get("customer")).trim();
    const garment = String(formData.get("item")).trim();
    const deliveryDateValue = String(formData.get("deliveryDate"));
    const deliveryDate = new Date(
      `${formData.get("deliveryDate")}T00:00:00`,
    ).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const orderPrice = Number(formData.get("price"));
    let activityOrderId = "";
    if (isSupabaseConfigured) {
      const customer = customerRecords.find(
        (record) => record.name.toLowerCase() === customerName.toLowerCase(),
      );
      if (!customer?.dbId) {
        setOrderFormError(
          "Choose a customer already saved in the database before creating an order.",
        );
        return;
      }
      try {
        const savedOrder = await createOrderRecord({
          customerId: customer.dbId,
          customerName,
          garment,
          amount: orderPrice,
          deliveryDate: deliveryDateValue,
        });
        activityOrderId = savedOrder.dbId ?? "";
        setOrders((current) => [savedOrder, ...current]);
        setPayments((current) => [
          {
            id: `PAY-${savedOrder.id.slice(-5)}`,
            orderId: savedOrder.id,
            orderUuid: savedOrder.dbId,
            customer: savedOrder.customer,
            total: savedOrder.amount,
            paid: 0,
            method: "—",
            date: "—",
          },
          ...current,
        ]);
        setCustomerRecords((current) =>
          current.map((record) =>
            record.dbId === customer.dbId
              ? { ...record, orders: record.orders + 1 }
              : record,
          ),
        );
      } catch (error) {
        setOrderFormError(
          error instanceof Error ? error.message : "Could not save the order.",
        );
        return;
      }
    } else {
      const nextOrderNumber = orders.length + 1;
      const orderId = `#ORD-${String(nextOrderNumber).padStart(5, "0")}`;
      const localCustomer = customerRecords.find(
        (record) => record.name.toLowerCase() === customerName.toLowerCase(),
      );
      activityOrderId = orderId;
      setOrders((currentOrders) => [
        {
          id: orderId,
          createdAt: new Date().toISOString(),
          customerId: localCustomer?.dbId ?? localCustomer?.id,
          customer: customerName,
          item: garment,
          status: "Pending",
          date: deliveryDate,
          amount: orderPrice,
        },
        ...currentOrders,
      ]);
      setPayments((currentPayments) => [
        {
          id: `PAY-${String(currentPayments.length + 1).padStart(5, "0")}`,
          orderId,
          customer: customerName,
          total: orderPrice,
          paid: 0,
          method: "—",
          date: "—",
        },
        ...currentPayments,
      ]);
    }
    setIsOrderOpen(false);
    setNewOrderCustomerName("");
    void recordActivity(
      "order.created",
      "order",
      `${customerName} · ${garment}`,
      isSupabaseConfigured ? activityOrderId : undefined,
    );
    setNotice("Order created successfully");
    window.setTimeout(() => setNotice(""), 3000);
  }

  function openPaymentForm(payment?: PaymentRecord) {
    setSelectedPaymentId(payment?.id ?? null);
    setPaymentFormError("");
    setPaymentFormBusy(false);
    setIsPaymentFormOpen(true);
  }

  async function recordPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const paymentId = String(formData.get("paymentId"));
    const amount = Number(formData.get("amount"));
    const method = String(formData.get("method")) as PaymentMethod;
    const reference = String(formData.get("reference") ?? "").trim();
    const date = String(formData.get("date") ?? "");
    const amountInCents = Math.round(amount * 100);
    const paidDate = new Date(
      `${formData.get("date")}T00:00:00`,
    ).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const currentPayment = payments.find((payment) => payment.id === paymentId);

    if (
      !currentPayment ||
      !Number.isFinite(amountInCents) ||
      amountInCents <= 0 ||
      amountInCents >
        Math.round((currentPayment.total - currentPayment.paid) * 100) ||
      !date ||
      Number.isNaN(new Date(`${date}T00:00:00`).getTime())
    ) {
      setPaymentFormError(
        "Enter an amount greater than zero and no more than the remaining balance.",
      );
      return;
    }
    if (reference.length > 120) {
      setPaymentFormError("Payment reference must be 120 characters or fewer.");
      return;
    }

    setPaymentFormBusy(true);
    if (isSupabaseConfigured) {
      if (!currentPayment.orderUuid) {
        setPaymentFormError(
          "This order is not linked to a database record. Refresh the dashboard and try again.",
        );
        setPaymentFormBusy(false);
        return;
      }
      try {
        const transaction = await createPaymentRecord({
          orderId: currentPayment.orderUuid,
          amount: amountInCents / 100,
          method,
          date,
          reference,
        });
        setPaymentTransactions((current) => [
          {
            ...transaction,
            orderId: currentPayment.orderId,
            customer: currentPayment.customer,
          },
          ...current,
        ]);
      } catch (error) {
        setPaymentFormError(
          error instanceof Error
            ? error.message
            : "Could not save the payment.",
        );
        setPaymentFormBusy(false);
        return;
      }
    } else {
      const nextReceiptNumber =
        paymentTransactions.reduce((highest, transaction) => {
          const match = /^PAY-(\d+)$/.exec(transaction.id);
          return Math.max(highest, match ? Number(match[1]) : 0);
        }, 0) + 1;
      setPaymentTransactions((current) => [
        {
          id: `PAY-${String(nextReceiptNumber).padStart(5, "0")}`,
          orderId: currentPayment.orderId,
          orderUuid: currentPayment.orderUuid ?? "",
          customer: currentPayment.customer,
          amount: amountInCents / 100,
          method,
          reference,
          date: new Date(`${date}T12:00:00`).toISOString(),
          recordedBy: "Shop owner",
          status: "Confirmed",
        },
        ...current,
      ]);
    }

    setPayments((current) =>
      current.map((payment) =>
        payment.id === paymentId
          ? {
              ...payment,
              paid:
                Math.round((payment.paid + amountInCents / 100) * 100) / 100,
              method,
              date: paidDate,
            }
          : payment,
      ),
    );
    void recordActivity(
      "payment.recorded",
      "payment",
      `${formatCurrency(amountInCents / 100)} received from ${currentPayment.customer}${reference ? ` · Ref ${reference}` : ""}`,
      isSupabaseConfigured ? currentPayment.orderUuid : currentPayment.id,
    );
    setIsPaymentFormOpen(false);
    setPaymentFormError("");
    setPaymentFormBusy(false);
    setNotice("Payment recorded");
    window.setTimeout(() => setNotice(""), 3000);
  }

  function exportPaymentHistory() {
    const csvRows = [
      [
        "Payment ID",
        "Date",
        "Order",
        "Customer",
        "Amount",
        "Method",
        "Reference",
        "Recorded By",
        "Status",
      ],
      ...visiblePaymentTransactions.map((transaction) => [
        transaction.id,
        transaction.date
          ? new Date(transaction.date).toLocaleDateString("en-GB")
          : "",
        transaction.orderId,
        transaction.customer,
        transaction.amount.toFixed(2),
        transaction.method,
        transaction.reference,
        transaction.recordedBy,
        transaction.status,
      ]),
    ];
    const csv = csvRows
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const downloadUrl = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `oti-b-payment-history-${dateKey(new Date())}.csv`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    openNotice("Payment history exported");
  }

  function exportReport() {
    const csvRows = [
      [
        "Business Report",
        `Period: ${reportPeriod}`,
        `From: ${reportStart || "All time"}`,
        `To: ${reportEnd || "Today"}`,
      ],
      [],
      ["Summary", "Value"],
      ["Orders placed", String(reportPeriodOrders.length)],
      ["Order value", reportOrderValue.toFixed(2)],
      ["Payments collected", reportCollected.toFixed(2)],
      ["Outstanding on period orders", reportOutstanding.toFixed(2)],
      ["Average order value", reportAverageOrder.toFixed(2)],
      [],
      [
        "Order ID",
        "Customer",
        "Design",
        "Order Date",
        "Delivery Date",
        "Order Total",
        "Received (all time)",
        "Balance",
        "Status",
      ],
      ...reportOrderRows.map((order) => {
        const payment = payments.find((record) => record.orderId === order.id);
        return [
          order.id,
          order.customer,
          order.item,
          order.createdAt
            ? dateKey(parseCalendarDate(order.createdAt) ?? today)
            : "",
          order.date,
          order.amount.toFixed(2),
          (payment?.paid ?? 0).toFixed(2),
          Math.max(0, order.amount - (payment?.paid ?? 0)).toFixed(2),
          order.status,
        ];
      }),
      [],
      [
        "Payment Receipts",
        "Customer",
        "Order ID",
        "Date",
        "Method",
        "Amount",
        "Status",
        "Reference",
      ],
      ...paymentTransactions
        .filter(
          (transaction) =>
            reportRangeValid && reportDateMatches(transaction.date),
        )
        .map((transaction) => [
          transaction.id,
          transaction.customer,
          transaction.orderId,
          transaction.date,
          transaction.method,
          transaction.amount.toFixed(2),
          transaction.status,
          transaction.reference,
        ]),
    ];
    const csv = csvRows
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
    const downloadUrl = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `oti-b-orders-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    openNotice("Report exported");
  }

  async function updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = orders.find((record) => record.id === orderId);
    if (!order) return;
    const previousStatus = order.status;
    if (previousStatus === status) return;
    if (isSupabaseConfigured) {
      if (!order.dbId) {
        openNotice(
          "This order is not linked to a database record. Refresh and try again.",
        );
        return;
      }
      try {
        await updateOrderRecordStatus(order.dbId, status);
      } catch (error) {
        openNotice(
          error instanceof Error
            ? error.message
            : "Could not update the order status.",
        );
        return;
      }
    }
    setOrders((currentOrders) =>
      currentOrders.map((order) =>
        order.id === orderId ? { ...order, status } : order,
      ),
    );
    void recordActivity(
      "order.status_changed",
      "order",
      `${order.id} · ${order.customer}: ${previousStatus} → ${status}`,
      order.dbId,
    );
  }

  async function updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    comment = "",
  ) {
    const task = tasks.find((record) => record.id === taskId);
    if (!task) return;
    if (isSupabaseConfigured) {
      if (!task.dbId) {
        openNotice(
          "This task is not linked to a database record. Refresh and try again.",
        );
        return;
      }
      try {
        await updateTaskRecordStatus(task.dbId, status, task.status, comment);
      } catch (error) {
        openNotice(
          error instanceof Error
            ? error.message
            : "Could not update the task status.",
        );
        return;
      }
    }
    setTasks((current) =>
      current.map((task) => (task.id === taskId ? { ...task, status } : task)),
    );
    if (task.status !== status) {
      if (!isSupabaseConfigured) {
        const update: WorkspaceTaskUpdate = {
          id: `local-${Date.now()}`,
          taskId: task.dbId ?? task.id,
          updatedBy: "",
          actor: "Shop owner",
          previousStatus: task.status,
          newStatus: status,
          comment,
          createdAt: new Date().toISOString(),
        };
        setTaskUpdates((current) => [update, ...current]);
        void recordActivity(
          "task.status_changed",
          "task",
          `${task.title}: ${task.status} → ${status}${comment ? ` · ${comment}` : ""}`,
          task.dbId,
        );
      }
    }
  }

  async function completeTaskReview() {
    if (!selectedTask || !taskReviewDecision) return;
    const feedback = taskReviewFeedback.trim();
    if (taskReviewDecision === "revision_required" && !feedback) {
      openNotice("Add feedback so the apprentice knows what to revise.");
      return;
    }
    setTaskReviewBusy(true);
    const nextStatus: TaskStatus =
      taskReviewDecision === "approved" ? "Done" : "Revision requested";
    try {
      if (isSupabaseConfigured) {
        if (!selectedTask.dbId)
          throw new Error(
            "This task is not linked to a saved record. Refresh and try again.",
          );
        await reviewTaskRecord(selectedTask.dbId, taskReviewDecision, feedback);
        await syncWorkspace();
      } else {
        setTasks((current) =>
          current.map((task) =>
            task.id === selectedTask.id
              ? { ...task, status: nextStatus }
              : task,
          ),
        );
        setTaskUpdates((current) => [
          {
            id: `local-${Date.now()}`,
            taskId: selectedTask.dbId ?? selectedTask.id,
            updatedBy: "",
            actor: "Shop owner",
            previousStatus: selectedTask.status,
            newStatus: nextStatus,
            comment:
              feedback ||
              (taskReviewDecision === "approved" ? "Work approved." : ""),
            createdAt: new Date().toISOString(),
          },
          ...current,
        ]);
        void recordActivity(
          "task.status_changed",
          "task",
          `${selectedTask.title}: ${selectedTask.status} → ${nextStatus}${feedback ? ` · ${feedback}` : ""}`,
          selectedTask.dbId,
        );
      }
      setTaskReviewDecision(null);
      setTaskReviewFeedback("");
      openNotice(
        taskReviewDecision === "approved"
          ? "Task approved"
          : "Revision requested",
      );
    } catch (error) {
      openNotice(
        error instanceof Error
          ? error.message
          : "Could not save the task review.",
      );
    } finally {
      setTaskReviewBusy(false);
    }
  }

  async function updateTaskChecklist(
    task: TaskRecord,
    itemId: string,
    completed: boolean,
  ) {
    if (taskChecklistBusy) return;
    const checklist = task.checklist.map((item) =>
      item.id === itemId ? { ...item, completed } : item,
    );
    setTaskChecklistBusy(true);
    try {
      if (isSupabaseConfigured) {
        if (!task.dbId)
          throw new Error(
            "This task is not linked to a saved record. Refresh and try again.",
          );
        await updateTaskChecklistRecord(task.dbId, checklist);
        await syncWorkspace();
      } else {
        const item = checklist.find((entry) => entry.id === itemId);
        setTasks((current) =>
          current.map((entry) =>
            entry.id === task.id ? { ...entry, checklist } : entry,
          ),
        );
        if (item) {
          setTaskUpdates((current) => [
            {
              id: `local-${Date.now()}`,
              taskId: task.dbId ?? task.id,
              updatedBy: "",
              actor: "Shop owner",
              previousStatus: task.status,
              newStatus: task.status,
              comment: `${item.completed ? "Completed" : "Reopened"} checklist item: ${item.label}`,
              createdAt: new Date().toISOString(),
            },
            ...current,
          ]);
        }
      }
    } catch (error) {
      openNotice(
        error instanceof Error
          ? error.message
          : "Could not update the task checklist.",
      );
    } finally {
      setTaskChecklistBusy(false);
    }
  }

  async function updateApprenticeTask(
    task: TaskRecord,
    status: TaskStatus,
    comment: string,
  ) {
    if (!task.dbId)
      throw new Error(
        "This task is not linked to a saved record. Refresh and try again.",
      );
    await updateTaskRecordStatus(task.dbId, status, task.status, comment);
    await syncWorkspace();
  }

  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const checklistLabels = String(formData.get("checklist") ?? "")
      .split(/\r?\n/)
      .map((label) => label.trim())
      .filter(Boolean);
    if (checklistLabels.length > 20) {
      openNotice("A task checklist can contain up to 20 items.");
      return;
    }
    if (checklistLabels.some((label) => label.length > 120)) {
      openNotice("Checklist items must be 120 characters or fewer.");
      return;
    }
    const checklist = checklistLabels.map((label) => ({
      id: crypto.randomUUID(),
      label,
      completed: false,
    }));
    const assigneeValue = String(formData.get("assignee"));
    const assignee = apprentices.find(
      (apprentice) =>
        (isSupabaseConfigured ? apprentice.userId : apprentice.name) ===
        assigneeValue,
    );
    const orderValue = String(formData.get("orderId"));
    const relatedOrder = orders.find((order) => order.id === orderValue);
    const newTask: TaskRecord = {
      id: `TSK-${String(tasks.length + 1).padStart(4, "0")}`,
      title: String(formData.get("title")).trim(),
      description: String(formData.get("description") ?? "").trim(),
      checklist,
      assignee: assignee?.name ?? "Unassigned",
      orderId: orderValue,
      dueDate: String(formData.get("dueDate")),
      priority: String(formData.get("priority")) as TaskPriority,
      status: "To do",
    };
    setTaskFormBusy(true);
    if (isSupabaseConfigured) {
      if (!assignee?.userId) {
        openNotice(
          "Select a registered apprentice before assigning this task.",
        );
        setTaskFormBusy(false);
        return;
      }
      try {
        const dbId = await createTaskRecord({
          title: newTask.title,
          description: newTask.description,
          checklist,
          assigneeId: assignee.userId,
          orderId: relatedOrder?.dbId ?? null,
          dueDate: newTask.dueDate,
          priority: newTask.priority,
        });
        newTask.dbId = dbId;
        newTask.id = `TSK-${dbId.slice(0, 8)}`;
        newTask.assigneeId = assignee.userId;
        newTask.orderId = relatedOrder?.id ?? "";
      } catch (error) {
        openNotice(
          error instanceof Error ? error.message : "Could not save the task.",
        );
        setTaskFormBusy(false);
        return;
      }
    }
    setTaskFormBusy(false);
    setTasks((current) => [newTask, ...current]);
    if (!isSupabaseConfigured)
      void recordActivity(
        "task.created",
        "task",
        `${newTask.title} · ${newTask.assignee}`,
        newTask.dbId,
      );
    setTaskSearch("");
    setTaskStatusFilter("All Statuses");
    setTaskPriorityFilter("All Priorities");
    setTaskOrderPrefill("");
    setTaskAssigneePrefill("");
    setIsTaskFormOpen(false);
    setNotice("Task added");
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function addApprentice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (isSupabaseConfigured) {
      const fullName = String(formData.get("name") ?? "").trim();
      const email = String(formData.get("email") ?? "")
        .trim()
        .toLowerCase();
      const phone = String(formData.get("phone") ?? "").trim();
      const focus = String(formData.get("focus"));
      const level = String(formData.get("level"));
      const startDate = String(formData.get("startDate") ?? "");
      setApprenticeInviteBusy(true);
      try {
        const invitation = await inviteApprenticeAccount({
          fullName,
          email,
          phone,
          specialization: focus,
          skillLevel: level,
          startDate,
        });
        setApprentices((current) => [
          {
            id: `APP-${invitation.userId.slice(0, 8)}`,
            userId: invitation.userId,
            name: invitation.fullName,
            email: invitation.email,
            phone: invitation.phone,
            focus,
            level,
            hours: 0,
            joined: new Date(`${startDate}T12:00:00`).toLocaleDateString(
              "en-GB",
              { day: "2-digit", month: "short", year: "numeric" },
            ),
            assignment: "Not assigned",
            status: "Active",
            notes: "",
          },
          ...current,
        ]);
        setApprenticeShareLink({
          name: invitation.fullName,
          email: invitation.email,
          phone: invitation.phone,
          link: invitation.actionLink,
          kind: "invite",
        });
      } catch (error) {
        openNotice(
          error instanceof Error
            ? error.message
            : "Could not save the apprentice profile.",
        );
        return;
      } finally {
        setApprenticeInviteBusy(false);
      }
      setApprenticeSearch("");
      setApprenticeStatusFilter("All Statuses");
      setIsApprenticeFormOpen(false);
      openNotice("Apprentice account created. Share the secure setup link.");
      return;
    }

    const newApprentice: ApprenticeRecord = {
      id: `APP-${String(21 + apprentices.length).padStart(5, "0")}`,
      name: String(formData.get("name")).trim(),
      phone: String(formData.get("phone")).trim(),
      focus: String(formData.get("focus")),
      level: String(formData.get("level")),
      hours: 0,
      joined: new Date(
        `${String(formData.get("startDate"))}T12:00:00`,
      ).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      assignment: "Not assigned",
      status: "Active",
      notes: "",
    };
    const nextApprentices = [newApprentice, ...apprentices];
    try {
      localStorage.setItem(
        "oti-b-apprentices",
        JSON.stringify(nextApprentices),
      );
    } catch {
      openNotice(
        "Could not save the apprentice profile. Your browser storage may be full.",
      );
      return;
    }
    setApprentices(nextApprentices);
    void recordActivity("apprentice.created", "apprentice", newApprentice.name);
    setApprenticeSearch("");
    setApprenticeStatusFilter("All Statuses");
    setIsApprenticeFormOpen(false);
    setNotice("Apprentice added");
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function createApprenticeResetLink(apprentice: ApprenticeRecord) {
    if (!apprentice.userId) {
      openNotice("This apprentice does not have a portal account yet.");
      return;
    }
    setApprenticeInviteBusy(true);
    try {
      const reset = await createApprenticePasswordResetLink(apprentice.userId);
      setApprenticeShareLink({
        name: apprentice.name,
        email: reset.email,
        phone: apprentice.phone,
        link: reset.actionLink,
        kind: "reset",
      });
      openNotice(
        "Secure password reset link created. Share it with the apprentice.",
      );
    } catch (error) {
      openNotice(
        error instanceof Error
          ? error.message
          : "Could not create a password reset link.",
      );
    } finally {
      setApprenticeInviteBusy(false);
    }
  }

  async function updateApprenticeStatus(
    apprenticeId: string,
    status: ApprenticeStatus,
  ): Promise<boolean> {
    const apprentice = apprentices.find((record) => record.id === apprenticeId);
    if (!apprentice) return false;
    const previousStatus = apprentice.status;
    if (previousStatus === status) return true;
    if (isSupabaseConfigured) {
      if (!apprentice.userId) {
        openNotice("This apprentice is not linked to a database profile.");
        return false;
      }
      try {
        await updateApprenticeRecordStatus(apprentice.userId, status);
      } catch (error) {
        openNotice(
          error instanceof Error
            ? error.message
            : "Could not update apprentice status.",
        );
        return false;
      }
    }
    const nextApprentices = apprentices.map((record) =>
      record.id === apprenticeId ? { ...record, status } : record,
    );
    if (!isSupabaseConfigured) {
      try {
        localStorage.setItem(
          "oti-b-apprentices",
          JSON.stringify(nextApprentices),
        );
      } catch {
        openNotice(
          "Could not save this status change. Your browser storage may be full.",
        );
        return false;
      }
    }
    setApprentices(nextApprentices);
    void recordActivity(
      "apprentice.status_changed",
      "apprentice",
      `${apprentice.name}: ${previousStatus} → ${status}`,
      apprentice.userId,
    );
    return true;
  }

  async function deleteApprentice(apprentice: ApprenticeRecord) {
    const assignedTasks = tasks.filter((task) =>
      isTaskAssignedToApprentice(task, apprentice),
    );
    const confirmed = await requestConfirmation(
      "Permanently delete apprentice?",
      `Permanently delete ${apprentice.name}? This also deletes their login, training records, and ${assignedTasks.length} assigned task${assignedTasks.length === 1 ? "" : "s"} with its progress history. This cannot be undone.`,
      "Delete apprentice",
      true,
    );
    if (!confirmed) return;

    setApprenticeDeleteBusy(true);
    try {
      const nextTrainingRecords = apprenticeTrainingRecords.filter(
        (record) =>
          record.apprenticeId !== apprentice.userId &&
          record.apprenticeId !== apprentice.id,
      );
      if (isSupabaseConfigured) {
        if (!apprentice.userId) {
          throw new Error("This apprentice is not linked to a database account.");
        }
        await deleteApprenticeAccount(apprentice.userId);
      } else {
        localStorage.setItem(
          "oti-b-apprentices",
          JSON.stringify(
            apprentices.filter((record) => record.id !== apprentice.id),
          ),
        );
        localStorage.setItem(
          "oti-b-apprentice-training-records",
          JSON.stringify(nextTrainingRecords),
        );
      }

      const removedTaskIds = new Set(
        assignedTasks.flatMap((task) =>
          task.dbId ? [task.id, task.dbId] : [task.id],
        ),
      );
      setApprenticeTrainingRecords(nextTrainingRecords);
      setApprentices((current) =>
        current.filter((record) => record.id !== apprentice.id),
      );
      setTasks((current) =>
        current.filter((task) => !removedTaskIds.has(task.dbId ?? task.id)),
      );
      setTaskUpdates((current) =>
        current.filter((update) => !removedTaskIds.has(update.taskId)),
      );
      setSelectedTaskId((current) =>
        current && removedTaskIds.has(current) ? null : current,
      );
      setSelectedApprenticeId(null);
      setApprenticeAction(null);
      setApprenticeProfileError("");
      setApprenticeShareLink((current) =>
        current?.name === apprentice.name ? null : current,
      );
      openNotice(`${apprentice.name} and their assigned work were deleted.`);
    } catch (error) {
      openNotice(
        error instanceof Error
          ? error.message
          : "Could not delete this apprentice.",
      );
    } finally {
      setApprenticeDeleteBusy(false);
    }
  }

  async function saveApprenticeTrainingRecord(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    if (
      !selectedApprentice ||
      !selectedApprenticeKey ||
      !apprenticeAction ||
      apprenticeAction === "profile"
    )
      return;
    const formData = new FormData(event.currentTarget);
    const record: ApprenticeTrainingRecord = {
      id: crypto.randomUUID(),
      apprenticeId: selectedApprenticeKey,
      kind: apprenticeAction,
      date: String(formData.get("date") ?? ""),
      hours:
        apprenticeAction === "hours"
          ? Number(formData.get("hours"))
          : undefined,
      activity:
        apprenticeAction === "hours"
          ? String(formData.get("activity") ?? "").trim()
          : undefined,
      skillName:
        apprenticeAction === "skill"
          ? String(formData.get("skillName") ?? "").trim()
          : undefined,
      skillLevel:
        apprenticeAction === "skill"
          ? (String(formData.get("skillLevel")) as "Learning" | "Confident")
          : undefined,
      attendanceStatus:
        apprenticeAction === "attendance"
          ? (String(formData.get("attendanceStatus")) as
              | "Present"
              | "Late"
              | "Absent")
          : undefined,
      leaveEndDate:
        apprenticeAction === "leave"
          ? String(formData.get("leaveEndDate") ?? "") || undefined
          : undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    };
    if (
      !record.date ||
      (record.kind === "hours" &&
        (!Number.isFinite(record.hours) ||
          (record.hours ?? 0) <= 0 ||
          (record.hours ?? 0) > 24)) ||
      (record.kind === "hours" && !record.activity) ||
      (record.kind === "skill" && !record.skillName) ||
      (record.kind === "leave" &&
        record.leaveEndDate &&
        record.leaveEndDate < record.date)
    ) {
      setApprenticeProfileError(
        "Enter valid details. Hours must be between 0.25 and 24, and leave end date cannot be before it starts.",
      );
      return;
    }
    if (record.hours !== undefined && record.hours < 0.25) {
      setApprenticeProfileError("Training time must be at least 0.25 hours.");
      return;
    }
    let savedRecord = record;
    if (isSupabaseConfigured) {
      if (!selectedApprentice.userId) {
        setApprenticeProfileError(
          "This apprentice is not linked to a database profile.",
        );
        return;
      }
      try {
        savedRecord = await createApprenticeTrainingRecord({
          ...record,
          apprenticeId: selectedApprentice.userId,
        });
      } catch (error) {
        setApprenticeProfileError(
          error instanceof Error
            ? error.message
            : "Could not save the training record.",
        );
        return;
      }
    } else {
      try {
        localStorage.setItem(
          "oti-b-apprentice-training-records",
          JSON.stringify([record, ...apprenticeTrainingRecords]),
        );
      } catch {
        setApprenticeProfileError(
          "Could not save the training record. Your browser storage may be full.",
        );
        return;
      }
    }
    setApprenticeTrainingRecords((current) => [savedRecord, ...current]);
    if (record.kind === "leave" && selectedApprentice.status !== "On leave") {
      if (!(await updateApprenticeStatus(selectedApprentice.id, "On leave"))) {
        setApprenticeAction(null);
        return;
      }
    } else if (
      record.kind === "attendance" &&
      record.attendanceStatus === "Present" &&
      selectedApprentice.status === "On leave"
    ) {
      if (!(await updateApprenticeStatus(selectedApprentice.id, "Active"))) {
        setApprenticeAction(null);
        return;
      }
    }
    setApprenticeAction(null);
    setApprenticeProfileError("");
    setNotice(
      record.kind === "hours"
        ? "Training hours logged"
        : record.kind === "skill"
          ? "Skill progress saved"
          : record.kind === "leave"
            ? "Leave recorded"
            : "Attendance recorded",
    );
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function saveApprenticeProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedApprentice) return;
    const formData = new FormData(event.currentTarget);
    const focus = String(formData.get("focus") ?? "").trim();
    const level = String(formData.get("level") ?? "");
    const notes = String(formData.get("notes") ?? "").trim();
    if (!focus) {
      setApprenticeProfileError("Enter a focus area for this apprentice.");
      return;
    }
    if (isSupabaseConfigured) {
      if (!selectedApprentice.userId) {
        setApprenticeProfileError(
          "This apprentice is not linked to a database profile.",
        );
        return;
      }
      try {
        await updateApprenticeProfileRecord({
          userId: selectedApprentice.userId,
          specialization: focus,
          skillLevel: level,
          notes,
        });
      } catch (error) {
        setApprenticeProfileError(
          error instanceof Error
            ? error.message
            : "Could not update this apprentice profile.",
        );
        return;
      }
    }
    const nextApprentices = apprentices.map((record) =>
      record.id === selectedApprentice.id
        ? { ...record, focus, level, notes }
        : record,
    );
    if (!isSupabaseConfigured) {
      try {
        localStorage.setItem(
          "oti-b-apprentices",
          JSON.stringify(nextApprentices),
        );
      } catch {
        setApprenticeProfileError(
          "Could not update this profile. Your browser storage may be full.",
        );
        return;
      }
    }
    setApprentices(nextApprentices);
    setApprenticeAction(null);
    setApprenticeProfileError("");
    void recordActivity(
      "apprentice.profile_updated",
      "apprentice",
      selectedApprentice.name,
      selectedApprentice.userId,
    );
    openNotice("Apprentice profile updated");
  }

  function assignTaskToApprentice(apprentice: ApprenticeRecord) {
    setSelectedApprenticeId(null);
    setTaskAssigneePrefill(
      isSupabaseConfigured ? (apprentice.userId ?? "") : apprentice.name,
    );
    setTaskOrderPrefill("");
    setActivePage("Tasks");
    setIsTaskFormOpen(true);
  }

  function openNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }

  function requestConfirmation(
    title: string,
    message: string,
    confirmLabel = "Continue",
    destructive = false,
  ): Promise<boolean> {
    if (confirmationResolverRef.current) resolveConfirmation(false);
    return new Promise((resolve) => {
      confirmationResolverRef.current = resolve;
      setConfirmationDialog({ title, message, confirmLabel, destructive });
    });
  }

  async function importLocalClothGallery(): Promise<ClothRecord[] | null> {
    const localRecords = getStoredClothRecords();
    if (!localRecords.length) return null;
    const confirmed = await requestConfirmation(
      "Import this device's gallery?",
      `Import ${localRecords.length} fabric and style item${localRecords.length === 1 ? "" : "s"}, including their photos, into the signed-in shop's Supabase gallery?`,
      "Import gallery",
    );
    if (!confirmed) {
      setGalleryImportPending(true);
      return null;
    }

    try {
      const importedRecords = await importClothGalleryRecords(localRecords);
      try {
        localStorage.removeItem("oti-b-cloth-gallery");
      } catch (error) {
        console.error("The imported local gallery copy could not be removed.", error);
      }
      setClothRecords(importedRecords);
      setClothGalleryError("");
      setGalleryImportPending(false);
      openNotice("This device's gallery was imported to Supabase");
      return importedRecords;
    } catch (error) {
      setGalleryImportPending(true);
      throw error;
    }
  }

  function resolveConfirmation(confirmed: boolean) {
    const resolve = confirmationResolverRef.current;
    confirmationResolverRef.current = null;
    setConfirmationDialog(null);
    resolve?.(confirmed);
  }

  async function installApp() {
    if (!installPromptEvent) {
      const isAppleMobile =
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !("MSStream" in window);
      setInstallHelpMessage(
        isAppleMobile
          ? "To install on iPhone or iPad, open the Share menu in Safari and choose “Add to Home Screen”."
          : "To install, use your browser’s Install app or Add to Home Screen option in the browser menu.",
      );
      return;
    }

    try {
      const promptEvent = installPromptEvent;
      setInstallHelpMessage("");
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setInstallPromptEvent(null);
      if (choice.outcome === "dismissed") {
        setInstallHelpMessage("Installation was cancelled. You can try again anytime.");
      }
    } catch (error) {
      console.error("Could not open the app installation prompt.", error);
      setInstallHelpMessage(
        "The installation prompt could not be opened. Try the install option in your browser menu.",
      );
    }
  }

  function handleClothPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      openNotice("Choose a JPG or PNG image under 5 MB");
      event.currentTarget.value = "";
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1000 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        openNotice("Could not process this fabric photo.");
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      setClothPhoto(canvas.toDataURL("image/jpeg", 0.78));
      URL.revokeObjectURL(objectUrl);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      openNotice("Could not read the selected fabric photo.");
    };
    image.src = objectUrl;
  }

  async function addCloth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const category = String(formData.get("category"));
    const previous = clothRecords.find((cloth) => cloth.id === editingClothId);
    const cloth: ClothRecord = {
      id: previous?.id ?? crypto.randomUUID(),
      name: String(formData.get("name")).trim(),
      kind: previous?.kind ?? galleryKind,
      category,
      color: String(formData.get("color")).trim() || "Not specified",
      pattern:
        previous?.pattern ?? category.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      details: String(formData.get("details")).trim(),
      ...(clothPhoto
        ? { photo: clothPhoto }
        : previous?.photo
          ? { photo: previous.photo }
          : {}),
    };
    let savedCloth = cloth;
    if (isSupabaseConfigured) {
      if (workspaceUserRole !== "owner") {
        openNotice("Sign in as the shop owner to manage the cloth gallery.");
        return;
      }
      try {
        const result = await saveClothGalleryRecord(cloth);
        savedCloth = result.record;
        if (result.cleanupWarning) openNotice(result.cleanupWarning);
      } catch (error) {
        console.error("Could not save the Supabase cloth gallery item.", error);
        openNotice(
          error instanceof Error
            ? `Could not save this ${galleryKind}: ${error.message}`
            : `Could not save this ${galleryKind}.`,
        );
        return;
      }
    } else {
      const nextRecords = previous
        ? clothRecords.map((record) =>
            record.id === previous.id ? cloth : record,
          )
        : [cloth, ...clothRecords];
      try {
        localStorage.setItem("oti-b-cloth-gallery", JSON.stringify(nextRecords));
      } catch {
        openNotice(
          `Could not save this ${galleryKind}. Your browser storage may be full.`,
        );
        return;
      }
      setClothRecords(nextRecords);
    }
    if (isSupabaseConfigured) {
      const nextRecords = previous
        ? clothRecords.map((record) =>
            record.id === previous.id ? savedCloth : record,
          )
        : [savedCloth, ...clothRecords];
      setClothRecords(nextRecords);
      setClothGalleryError("");
    }
    setClothSearch("");
    setClothCategory(`All ${galleryKind === "fabric" ? "Fabrics" : "Styles"}`);
    setClothPhoto("");
    setIsClothFormOpen(false);
    setEditingClothId(null);
    if (!previous)
      void recordActivity(
        cloth.kind === "fabric" ? "fabric.created" : "style.created",
        cloth.kind,
        `${cloth.name} · ${cloth.category}`,
      );
    openNotice(
      previous
        ? `${cloth.kind === "fabric" ? "Fabric" : "Style"} updated`
        : `${cloth.kind === "fabric" ? "Fabric" : "Style"} added to your gallery`,
    );
  }

  function openGalleryForm(kind: "fabric" | "style", record?: ClothRecord) {
    setGalleryKind(kind);
    setClothCategory(`All ${kind === "fabric" ? "Fabrics" : "Styles"}`);
    setClothPhoto(record?.photo ?? "");
    setEditingClothId(record?.id ?? null);
    setSelectedGalleryRecordId(null);
    setIsClothFormOpen(true);
  }

  async function deleteGalleryItem(record: ClothRecord) {
    const typeLabel = record.kind === "fabric" ? "fabric" : "style";
    const confirmed = await requestConfirmation(
      `Remove ${typeLabel} from gallery?`,
      `Remove “${record.name}” from your ${record.kind === "fabric" ? "fabric" : "style"} gallery?\n\nThis removes the item from the gallery, but keeps any copies already saved in customer histories.`,
      `Remove ${typeLabel}`,
      true,
    );
    if (!confirmed)
      return;

    const nextRecords = clothRecords.filter((item) => item.id !== record.id);
    let cleanupWarning: string | undefined;
    if (isSupabaseConfigured) {
      try {
        cleanupWarning = await deleteClothGalleryRecord(record);
      } catch (error) {
        console.error("Could not delete the Supabase cloth gallery item.", error);
        openNotice(
          error instanceof Error
            ? `Could not remove this ${typeLabel}: ${error.message}`
            : `Could not remove this ${typeLabel}.`,
        );
        return;
      }
    } else {
      try {
        localStorage.setItem("oti-b-cloth-gallery", JSON.stringify(nextRecords));
      } catch {
        openNotice(
          `Could not remove this ${typeLabel}. Your browser storage may be unavailable.`,
        );
        return;
      }
    }

    setClothRecords(nextRecords);
    setSelectedGalleryRecordId(null);
    setClothCustomerMode(false);
    setSelectedGalleryCustomerId(null);
    void recordActivity(
      `${record.kind}.deleted`,
      record.kind,
      `${record.name} · ${record.category}`,
    );
    openNotice(
      cleanupWarning ??
        `${record.kind === "fabric" ? "Fabric" : "Style"} removed from gallery`,
    );
  }

  function startGalleryCustomerAssignment() {
    setClothCustomerMode(true);
    setClothCustomerSearch("");
    setSelectedGalleryCustomerId(null);
  }

  async function saveGalleryItemForCustomer() {
    if (!selectedGalleryRecord || !selectedGalleryCustomer) return;
    let stylePhoto = "";
    if (selectedGalleryRecord.kind === "style" && selectedGalleryRecord.photo) {
      try {
        stylePhoto = await photoAsDataUrl(selectedGalleryRecord.photo);
      } catch (error) {
        console.error("Could not prepare the style photo for customer history.", error);
        openNotice(
          error instanceof Error
            ? error.message
            : "Could not save the style photo to customer history.",
        );
        return;
      }
    }
    const entry: GalleryCustomerHistory = {
      id: crypto.randomUUID(),
      customerId: selectedGalleryCustomer.dbId ?? selectedGalleryCustomer.id,
      galleryItemId: selectedGalleryRecord.id,
      itemName: selectedGalleryRecord.name,
      itemKind: selectedGalleryRecord.kind,
      category: selectedGalleryRecord.category,
      color: selectedGalleryRecord.color,
      details: selectedGalleryRecord.details ?? "",
      savedAt: new Date().toISOString(),
    };
    const nextHistory = [entry, ...galleryCustomerHistory];
    try {
      localStorage.setItem(
        "oti-b-gallery-customer-history",
        JSON.stringify(nextHistory),
      );
    } catch {
      openNotice(
        "Could not save this item to customer history. Your browser storage may be full.",
      );
      return;
    }
    setGalleryCustomerHistory(nextHistory);
    if (selectedGalleryRecord.kind === "style") {
      const garmentRecord: CustomerGarmentRecord = {
        id: crypto.randomUUID(),
        customerId: entry.customerId,
        garmentName: selectedGalleryRecord.name,
        styleName: selectedGalleryRecord.name,
        fabricName: "",
        photo: stylePhoto,
        measurements: {},
        unit: shopSettings.measurements === "Inches" ? "inches" : "cm",
        updatedAt: new Date().toISOString(),
      };
      persistCustomerGarments([garmentRecord, ...customerGarments]);
    }
    void recordActivity(
      "gallery.assigned",
      selectedGalleryRecord.kind,
      `${selectedGalleryRecord.name} saved for ${selectedGalleryCustomer.name}`,
    );
    setClothCustomerMode(false);
    setSelectedGalleryRecordId(null);
    setSelectedGalleryCustomerId(null);
    openNotice(
      `${selectedGalleryRecord.kind === "fabric" ? "Fabric" : "Style"} saved to ${selectedGalleryCustomer.name}’s history`,
    );
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));
    try {
      const result =
        authMode === "sign-in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { full_name: String(formData.get("fullName")).trim() },
                emailRedirectTo: window.location.origin,
              },
            });
      if (result.error) {
        setAuthError(result.error.message);
        return;
      }
      if (authMode === "sign-up" && !result.data.session) {
        setAuthMessage(
          "Check your email to confirm your account before signing in.",
        );
      } else {
        setAuthSession(result.data.session);
      }
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Authentication could not be completed.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function sendPasswordReset() {
    if (!supabase) {
      setAuthError(
        "Password reset is unavailable until the shop database is connected.",
      );
      return;
    }
    const email = authEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError("Enter a valid email address to receive a reset link.");
      setAuthMessage("");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) {
        setAuthError(error.message);
        return;
      }
      setAuthMessage(
        "If an account exists for that email, a password reset link will be sent.",
      );
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "A password reset link could not be sent.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) setNotice(error.message);
    else {
      setPasswordSetupRequired(false);
      setWorkspaceUserRole("");
      clearApprenticeAccessLinkFlags();
    }
  }

  function clearApprenticeAccessLinkFlags() {
    const url = new URL(window.location.href);
    url.searchParams.delete("apprentice-invite");
    url.searchParams.delete("password-reset");
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  async function handleApprenticePortalTaskUpdate(
    task: WorkspaceTask,
    status: TaskStatus,
    comment: string,
  ) {
    await updateApprenticeTask(task, status, comment);
  }

  async function handleApprenticePortalChecklistUpdate(
    task: WorkspaceTask,
    checklist: WorkspaceTaskChecklistItem[],
  ) {
    if (!task.dbId)
      throw new Error(
        "This task is not linked to a saved record. Refresh and try again.",
      );
    await updateTaskChecklistRecord(task.dbId, checklist);
    await syncWorkspace();
  }

  async function submitPasswordSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("newPassword") ?? "");
    const confirmation = String(formData.get("confirmPassword") ?? "");
    if (password.length < 12) {
      setPasswordSetupError(
        "Use at least 12 characters for your new password.",
      );
      return;
    }
    if (password !== confirmation) {
      setPasswordSetupError("The passwords do not match.");
      return;
    }
    if (!supabase) return;
    setPasswordSetupBusy(true);
    setPasswordSetupError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await completeApprenticePasswordSetup();
      setPasswordSetupRequired(false);
      setPasswordSetupError("");
      clearApprenticeAccessLinkFlags();
    } catch (error) {
      setPasswordSetupError(
        error instanceof Error
          ? error.message
          : "The password could not be updated.",
      );
    } finally {
      setPasswordSetupBusy(false);
    }
  }

  async function saveShopSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsSaving(true);
    setSettingsError("");
    try {
      if (isSupabaseConfigured) {
        await saveShopSettingsRecord(shopSettings);
      } else {
        localStorage.setItem(
          "oti-b-shop-settings",
          JSON.stringify(shopSettings),
        );
      }
      setSavedShopSettings(shopSettings);
      void recordActivity(
        "settings.updated",
        "settings",
        "Shop profile and preferences",
      );
      setNotice("Settings saved");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Settings could not be saved.";
      setSettingsError(message);
      setNotice(message);
    } finally {
      setSettingsSaving(false);
    }
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function resetShopSettings() {
    const confirmed = await requestConfirmation(
      "Reset shop settings?",
      "Reset shop profile, notifications, and preferences to their defaults? This does not delete customer, order, or payment data.",
      "Reset settings",
      true,
    );
    if (!confirmed)
      return;
    setSettingsError("");
    try {
      if (isSupabaseConfigured) {
        await resetShopSettingsRecord();
      } else {
        localStorage.removeItem("oti-b-shop-settings");
      }
      setShopSettings(defaultShopSettings);
      setSavedShopSettings(defaultShopSettings);
      void recordActivity(
        "settings.updated",
        "settings",
        "Restored shop settings to defaults",
      );
      setNotice("Settings restored to defaults");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Settings could not be reset.";
      setSettingsError(message);
      setNotice(message);
    }
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function updateAccountPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountPasswordError("");
    if (accountPassword.length < 12) {
      setAccountPasswordError(
        "Use at least 12 characters for your new password.",
      );
      return;
    }
    if (accountPassword !== accountPasswordConfirmation) {
      setAccountPasswordError("The passwords do not match.");
      return;
    }
    if (!supabase || !authSession) {
      setAccountPasswordError(
        "Password changes are only available for a signed-in shop account.",
      );
      return;
    }
    setAccountPasswordBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: accountPassword,
      });
      if (error) throw error;
      setAccountPassword("");
      setAccountPasswordConfirmation("");
      setNotice("Password updated successfully");
    } catch (error) {
      setAccountPasswordError(
        error instanceof Error
          ? error.message
          : "The password could not be updated.",
      );
    } finally {
      setAccountPasswordBusy(false);
    }
    window.setTimeout(() => setNotice(""), 3000);
  }

  function exportWorkspaceData() {
    const exportData = {
      exportedAt: new Date().toISOString(),
      shopSettings,
      customers: customerRecords.map(
        ({ photo: _photo, ...customer }) => customer,
      ),
      orders,
      payments,
      paymentTransactions,
      tasks,
      taskUpdates,
      apprentices,
      apprenticeTrainingRecords,
      customerGarments: customerGarments.map(
        ({ photo: _photo, ...garment }) => garment,
      ),
      measurements: measurementEntries.map(
        ({
          garmentPhotos: _garmentPhotos,
          stylePhotos: _stylePhotos,
          ...measurement
        }) => measurement,
      ),
      customerNotes,
      activity: activityEntries,
      fabricsAndStyles: clothRecords.map(
        ({ photo: _photo, ...record }) => record,
      ),
      customerGarmentHistory: galleryCustomerHistory,
    };
    const downloadUrl = URL.createObjectURL(
      new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json;charset=utf-8",
      }),
    );
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `oti-b-workspace-data-${dateKey(new Date())}.json`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    openNotice("Workspace data exported");
  }

  function updateNotificationSetting(
    key: keyof ShopSettings["notifications"],
    checked: boolean,
  ) {
    setShopSettings((current) => ({
      ...current,
      notifications: { ...current.notifications, [key]: checked },
    }));
  }

  function openCustomerModal(mode: "edit" | "view", customer?: CustomerRecord) {
    setSelectedCustomerId(customer?.id ?? null);
    setCustomerPhotoPreview(mode === "edit" ? (customer?.photo ?? "") : "");
    setCustomerPhotoFile(null);
    setCustomerModal(mode);
  }

  function editSelectedCustomer() {
    setCustomerPhotoPreview(selectedCustomer?.photo ?? "");
    setCustomerPhotoFile(null);
    setCustomerModal("edit");
  }

  function openPhotoPicker(target: "customer") {
    setCameraTarget(target);
    setCameraTab("Camera");
    setCameraError("");
  }

  function openMeasurementPhotoPicker(
    target: "measurementGarment" | "measurementStyle",
  ) {
    setCameraTarget(target);
    setCameraTab("Camera");
    setCameraError("");
  }

  function closePhotoPicker() {
    setCameraTarget(null);
    setCameraError("");
  }

  function applyPickedPhoto(file: File, dataUrl: string) {
    if (cameraTarget === "customer") {
      setCustomerPhotoPreview(dataUrl);
      setCustomerPhotoFile(file);
      closePhotoPicker();
      return;
    }
    if (cameraTarget === "measurementGarment") {
      setMeasurementGarmentPhotos((current) => {
        if (current.length >= 2) {
          openNotice("A measurement can have up to 2 garment photos.");
          return current;
        }
        return [...current, { url: dataUrl, file }];
      });
    } else if (cameraTarget === "measurementStyle") {
      setMeasurementStylePhotos((current) => {
        if (current.length >= 3) {
          openNotice("A measurement can have up to 3 style photos.");
          return current;
        }
        return [...current, { url: dataUrl, file }];
      });
    }
    closePhotoPicker();
  }

  async function preparePhoto(file: File) {
    const bitmap = await createImageBitmap(file);
    try {
      const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context)
        throw new Error("This browser could not prepare the selected photo.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error("Could not prepare the selected photo.")),
          "image/jpeg",
          0.78,
        );
      });
      return {
        file: new File([blob], `customer-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        }),
        dataUrl: canvas.toDataURL("image/jpeg", 0.78),
      };
    } finally {
      bitmap.close();
    }
  }

  async function handlePhotoPickerFile(
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      openNotice("Choose a JPG or PNG image under 5 MB");
      event.currentTarget.value = "";
      return;
    }
    event.currentTarget.value = "";
    try {
      const prepared = await preparePhoto(file);
      applyPickedPhoto(prepared.file, prepared.dataUrl);
    } catch (error) {
      openNotice(
        error instanceof Error
          ? error.message
          : "Could not read the selected photo.",
      );
    }
  }

  function capturePhoto() {
    const video = cameraVideoRef.current;
    if (!video || !cameraTarget || video.videoWidth === 0) {
      setCameraError(
        "The camera is not ready yet. Please wait a moment and try again.",
      );
      return;
    }
    const scale = Math.min(
      1,
      1280 / Math.max(video.videoWidth, video.videoHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("This browser could not capture the camera image.");
      return;
    }
    context.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Could not capture the photo. Please try again.");
          return;
        }
        const file = new File([blob], `customer-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        applyPickedPhoto(file, canvas.toDataURL("image/jpeg", 0.78));
      },
      "image/jpeg",
      0.78,
    );
  }

  async function selectGalleryPhoto(photo: string) {
    if (!cameraTarget) return;
    if (
      cameraTarget === "measurementGarment" &&
      measurementGarmentPhotos.length >= 2
    ) {
      openNotice("A measurement can have up to 2 garment photos.");
      return;
    }
    if (
      cameraTarget === "measurementStyle" &&
      measurementStylePhotos.length >= 3
    ) {
      openNotice("A measurement can have up to 3 style photos.");
      return;
    }
    if (cameraTarget === "customer") setCustomerPhotoPreview(photo);
    try {
      const response = await fetch(photo);
      if (!response.ok) throw new Error("Could not load the gallery image.");
      const blob = await response.blob();
      const prepared = await preparePhoto(
        new File([blob], "gallery-photo", { type: blob.type || "image/jpeg" }),
      );
      if (cameraTarget === "customer") {
        setCustomerPhotoFile(prepared.file);
        setCustomerPhotoPreview(prepared.dataUrl);
      } else {
        applyPickedPhoto(prepared.file, prepared.dataUrl);
        return;
      }
    } catch (error) {
      setCustomerPhotoPreview("");
      openNotice(
        error instanceof Error
          ? error.message
          : "Could not load the gallery image.",
      );
      return;
    }
    closePhotoPicker();
  }

  function persistCustomerGarments(nextRecords: CustomerGarmentRecord[]) {
    try {
      localStorage.setItem(
        "oti-b-customer-garments",
        JSON.stringify(nextRecords),
      );
    } catch {
      openNotice(
        "Could not save garment details. Your browser storage may be full.",
      );
      return false;
    }
    setCustomerGarments(nextRecords);
    return true;
  }

  function saveGarmentMeasurements(garmentId: string) {
    const nextRecords = customerGarments.map((record) =>
      record.id === garmentId
        ? {
            ...record,
            measurements: garmentEditValues,
            updatedAt: new Date().toISOString(),
          }
        : record,
    );
    if (persistCustomerGarments(nextRecords)) {
      setEditingGarmentId(null);
      openNotice("Garment measurements updated");
    }
  }

  async function addCustomerNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCustomer) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = String(formData.get("customerNote") ?? "").trim();
    if (!text) return;
    let note: CustomerNoteRecord = {
      id: crypto.randomUUID(),
      customerId: selectedCustomer.dbId ?? selectedCustomer.id,
      text,
      author: welcomeName,
      createdAt: new Date().toISOString(),
    };
    const nextNotes = [note, ...customerNotes];
    if (isSupabaseConfigured) {
      if (!selectedCustomer.dbId) {
        openNotice(
          "This customer is not linked to a database record. Refresh and try again.",
        );
        return;
      }
      try {
        note = await createCustomerNoteRecord(selectedCustomer.dbId, text);
      } catch (error) {
        openNotice(
          error instanceof Error ? error.message : "Could not save this note.",
        );
        return;
      }
    } else {
      try {
        localStorage.setItem("oti-b-customer-notes", JSON.stringify(nextNotes));
      } catch {
        openNotice(
          "Could not save this note. Your browser storage may be full.",
        );
        return;
      }
    }
    setCustomerNotes([note, ...customerNotes]);
    form.reset();
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const shouldAddMeasurements = submitter?.value === "save-and-measure";
    const shouldResumeMeasurement = returnToMeasurementAfterCustomerAdd;
    const shouldOpenOrderAfterSave =
      continueToOrder &&
      !shouldAddMeasurements &&
      !shouldResumeMeasurement &&
      customerModal !== "edit";
    const customerFields = {
      name: String(formData.get("name")).trim(),
      phone: String(formData.get("phone")).trim(),
      whatsapp: String(
        formData.get("whatsapp") ?? selectedCustomer?.whatsapp ?? "",
      ).trim(),
      gender: String(formData.get("gender") ?? selectedCustomer?.gender ?? ""),
      address: String(
        formData.get("address") ?? selectedCustomer?.address ?? "",
      ).trim(),
      email: String(
        formData.get("email") ?? selectedCustomer?.email ?? "",
      ).trim(),
      garment: String(formData.get("garment") || "Dresses"),
    };
    let newCustomerIdForActivity: string | undefined;

    if (customerModal === "edit" && selectedCustomerId) {
      if (isSupabaseConfigured) {
        if (!selectedCustomer?.dbId) {
          openNotice(
            "This customer is not linked to a database record. Refresh and try again.",
          );
          return;
        }
        try {
          await updateCustomerRecord(
            selectedCustomer.dbId,
            customerFields,
            customerPhotoFile ?? undefined,
          );
        } catch (error) {
          openNotice(
            error instanceof Error
              ? error.message
              : "Could not update the customer.",
          );
          return;
        }
      }
      setCustomerRecords((current) =>
        current.map((customer) =>
          customer.id === selectedCustomerId
            ? {
                ...customer,
                ...customerFields,
                photo: customerPhotoPreview || customer.photo,
              }
            : customer,
        ),
      );
      void recordActivity(
        "customer.updated",
        "customer",
        customerFields.name,
        selectedCustomer?.dbId,
      );
      setNotice("Customer updated");
    } else {
      const newCustomerId = `CUS-${String(45 + customerRecords.length).padStart(5, "0")}`;
      if (isSupabaseConfigured) {
        try {
          const savedCustomer = await createCustomerRecord(
            customerFields,
            customerPhotoFile ?? undefined,
          );
          newCustomerIdForActivity = savedCustomer.dbId;
          setCustomerRecords((current) => [savedCustomer, ...current]);
        } catch (error) {
          openNotice(
            error instanceof Error
              ? error.message
              : "Could not save the customer.",
          );
          return;
        }
      } else {
        setCustomerRecords((current) => [
          {
            id: newCustomerId,
            ...customerFields,
            orders: 0,
            measurementsSaved: false,
            photo: customerPhotoPreview,
          },
          ...current,
        ]);
        newCustomerIdForActivity = newCustomerId;
      }
      void recordActivity(
        "customer.created",
        "customer",
        customerFields.name,
        newCustomerIdForActivity,
      );
      setCustomerPage(1);
      if (shouldResumeMeasurement) {
        setActivePage("Measurements");
        setSelectedMeasurementCategoryId(measurementFormCategoryId);
        setMeasurementCustomerName(customerFields.name);
        setMeasurementGarmentPhotos([]);
        setMeasurementStylePhotos([]);
        setIsMeasurementFormOpen(true);
      } else if (shouldAddMeasurements) {
        const categoryId =
          customerFields.gender === "Male" ? "suits" : "dress-female";
        setActivePage("Measurements");
        setSelectedMeasurementCategoryId(categoryId);
        setMeasurementFormCategoryId(categoryId);
        setMeasurementFormFields(
          (measurementPresets[categoryId] ?? []).map((name) => ({
            name,
            value: "",
          })),
        );
        setMeasurementCustomerName(customerFields.name);
        setMeasurementGarmentPhotos([]);
        setMeasurementStylePhotos([]);
        setIsMeasurementFormOpen(true);
        setNotice("Customer saved. Add their measurements.");
      } else {
        setNotice("Customer added");
      }
    }

    setCustomerModal(null);
    setCustomerFormOpen(false);
    setCustomerNamePrefill("");
    setReturnToMeasurementAfterCustomerAdd(false);
    setCustomerPhotoPreview("");
    setCustomerPhotoFile(null);
    if (continueToOrder && customerModal !== "edit") setContinueToOrder(false);
    if (shouldOpenOrderAfterSave) {
      setContinueToOrder(false);
      setNewOrderCustomerName(customerFields.name);
      setIsOrderOpen(true);
    }
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function deleteCustomer(customer: CustomerRecord) {
    const confirmed = await requestConfirmation(
      "Permanently delete customer and history?",
      `WARNING: Permanently delete ${customer.name} and all of their history?\n\nThis removes their orders, payment records and balances, measurements and measurement photos, notes, assigned tasks and task history, and customer photos. This cannot be undone and may remove records needed for accounting or legal purposes.\n\nContinue only if you are sure.`,
      "Delete customer permanently",
      true,
    );
    if (!confirmed) return;

    const customerIds = new Set(
      [customer.dbId, customer.id].filter((id): id is string => Boolean(id)),
    );
    const relatedOrders = orders.filter((order) =>
      order.customerId
        ? customerIds.has(order.customerId)
        : order.customer === customer.name,
    );
    const relatedOrderIds = new Set(
      relatedOrders.flatMap((order) =>
        order.dbId ? [order.id, order.dbId] : [order.id],
      ),
    );
    const relatedTasks = tasks.filter(
      (task) =>
        (task.orderUuid && relatedOrderIds.has(task.orderUuid)) ||
        relatedOrderIds.has(task.orderId),
    );
    const relatedTaskIds = new Set(
      relatedTasks.flatMap((task) =>
        task.dbId ? [task.id, task.dbId] : [task.id],
      ),
    );
    const relatedPayments = payments.filter(
      (payment) =>
        relatedOrderIds.has(payment.orderId) ||
        (payment.orderUuid && relatedOrderIds.has(payment.orderUuid)),
    );
    const relatedPaymentTransactions = paymentTransactions.filter(
      (payment) =>
        relatedOrderIds.has(payment.orderId) ||
        relatedOrderIds.has(payment.orderUuid),
    );
    const relatedPaymentIds = new Set([
      ...relatedPayments.map((payment) => payment.id),
      ...relatedPaymentTransactions.map((payment) => payment.id),
    ]);
    const remainingGarments = customerGarments.filter(
      (garment) => !customerIds.has(garment.customerId),
    );
    const remainingHistory = galleryCustomerHistory.filter(
      (entry) => !customerIds.has(entry.customerId),
    );
    const remainingNotes = customerNotes.filter(
      (note) => !customerIds.has(note.customerId),
    );
    const remainingMeasurements = measurementEntries.filter(
      (entry) =>
        !(entry.customerId && customerIds.has(entry.customerId)) &&
        entry.customer !== customer.name,
    );
    const relatedHistoryIds = new Set([
      ...customerIds,
      ...relatedOrderIds,
      ...relatedTaskIds,
      ...relatedPaymentIds,
      ...customerNotes
        .filter((note) => customerIds.has(note.customerId))
        .map((note) => note.id),
      ...measurementEntries
        .filter(
          (entry) =>
            (entry.customerId && customerIds.has(entry.customerId)) ||
            entry.customer === customer.name,
        )
        .map((entry) => entry.id),
    ]);
    const remainingActivity = activityEntries.filter(
      (entry) =>
        !(entry.entityId && relatedHistoryIds.has(entry.entityId)) &&
        !(entry.entityType === "customer" && entry.entityLabel === customer.name),
    );

    let photoCleanupError = "";
    let localCacheCleanupError = "";
    if (isSupabaseConfigured) {
      if (!customer.dbId) {
        openNotice(
          "This customer is not linked to a database record. Refresh and try again.",
        );
        return;
      }
      try {
        const result = await deleteCustomerRecord(customer.dbId);
        photoCleanupError = result.photoCleanupError ?? "";
      } catch (error) {
        openNotice(
          error instanceof Error
            ? error.message
            : "Could not delete this customer.",
        );
        return;
      }
    } else {
      try {
        localStorage.setItem(
          "oti-b-customer-garments",
          JSON.stringify(remainingGarments),
        );
        localStorage.setItem(
          "oti-b-gallery-customer-history",
          JSON.stringify(remainingHistory),
        );
        localStorage.setItem(
          "oti-b-customer-notes",
          JSON.stringify(remainingNotes),
        );
        localStorage.setItem(
          "oti-b-measurements",
          JSON.stringify(remainingMeasurements),
        );
        localStorage.setItem(
          "oti-b-activity",
          JSON.stringify(remainingActivity),
        );
      } catch {
        openNotice(
          "Could not delete this customer because browser storage could not be updated.",
        );
        return;
      }

      setCustomerGarments(remainingGarments);
      setGalleryCustomerHistory(remainingHistory);
    }

    if (isSupabaseConfigured) {
      try {
        localStorage.setItem(
          "oti-b-customer-garments",
          JSON.stringify(remainingGarments),
        );
        localStorage.setItem(
          "oti-b-gallery-customer-history",
          JSON.stringify(remainingHistory),
        );
        localStorage.setItem(
          "oti-b-customer-notes",
          JSON.stringify(
            getStoredCustomerNotes().filter(
              (note) => !customerIds.has(note.customerId),
            ),
          ),
        );
        localStorage.setItem(
          "oti-b-measurements",
          JSON.stringify(
            getStoredMeasurementEntries().filter(
              (entry) =>
                !(entry.customerId && customerIds.has(entry.customerId)) &&
                entry.customer !== customer.name,
            ),
          ),
        );
        localStorage.setItem(
          "oti-b-activity",
          JSON.stringify(remainingActivity),
        );
      } catch (error) {
        localCacheCleanupError =
          error instanceof Error
            ? error.message
            : "Browser storage could not be updated.";
      }
    }

    setCustomerGarments(remainingGarments);
    setGalleryCustomerHistory(remainingHistory);
    setCustomerNotes(remainingNotes);
    setMeasurementEntries(remainingMeasurements);
    setActivityEntries(remainingActivity);
    setOrders((current) =>
      current.filter((order) => !relatedOrderIds.has(order.id) && !relatedOrderIds.has(order.dbId ?? "")),
    );
    setPayments((current) =>
      current.filter((payment) => !relatedOrderIds.has(payment.orderId) && !relatedOrderIds.has(payment.orderUuid ?? "")),
    );
    setPaymentTransactions((current) =>
      current.filter(
        (payment) =>
          !relatedOrderIds.has(payment.orderId) &&
          !relatedOrderIds.has(payment.orderUuid),
      ),
    );
    setTasks((current) =>
      current.filter((task) => !relatedTaskIds.has(task.id) && !relatedTaskIds.has(task.dbId ?? "")),
    );
    setTaskUpdates((current) =>
      current.filter((update) => !relatedTaskIds.has(update.taskId)),
    );
    setSelectedTaskId((current) =>
      current && relatedTaskIds.has(current) ? null : current,
    );
    setSelectedOrderId((current) =>
      current && relatedOrderIds.has(current) ? null : current,
    );
    setSelectedPaymentId((current) =>
      current && relatedPaymentIds.has(current) ? null : current,
    );
    setMeasurementCategories((current) =>
      current.map((category) => ({
        ...category,
        customerCount: remainingMeasurements.filter(
          (entry) => entry.categoryId === category.id,
        ).length,
      })),
    );
    setCustomerRecords((current) =>
      current.filter((record) => record.id !== customer.id),
    );
    setCustomerPage((page) =>
      Math.min(
        page,
        Math.max(1, Math.ceil((filteredCustomers.length - 1) / 8)),
      ),
    );
    if (selectedCustomerId === customer.id) {
      setSelectedCustomerId(null);
      setCustomerModal(null);
    }
    setNotice(
      photoCleanupError
        ? `${customer.name} and their history were deleted, but some photos could not be removed: ${photoCleanupError}`
        : localCacheCleanupError
          ? `${customer.name} and their history were deleted, but local cached data could not be fully cleared: ${localCacheCleanupError}`
          : `${customer.name} and all related history were permanently deleted`,
    );
    window.setTimeout(() => setNotice(""), 3000);
  }

  function openMeasurementForm() {
    const categoryId =
      selectedMeasurementCategoryId ?? measurementCategories[0].id;
    setMeasurementFormCategoryId(categoryId);
    setMeasurementFormFields(
      (measurementPresets[categoryId] ?? []).map((name) => ({
        name,
        value: "",
      })),
    );
    setMeasurementCustomerName("");
    setMeasurementBillingEnabled(false);
    setMeasurementBillingQuantity("1");
    setMeasurementBillingUnitPrice("");
    setMeasurementBillingClothAmount(
      measurementPresetClothAmounts[categoryId]?.toString() ?? "",
    );
    setMeasurementBillingDiscount("0");
    setMeasurementBillingDeliveryDate("");
    setMeasurementGarmentPhotos([]);
    setMeasurementStylePhotos([]);
    setPendingMeasurementSubmission(null);
    setIsMeasurementFormOpen(true);
  }

  function addMeasurementCustomer() {
    setCustomerNamePrefill(measurementCustomerName.trim());
    setReturnToMeasurementAfterCustomerAdd(true);
    setIsMeasurementFormOpen(false);
    setActivePage("Customers");
    setCustomerFormOpen(true);
  }

  async function persistMeasurementPreset(
    categoryId: string,
    fieldNames: string[],
    clothAmount?: number,
  ): Promise<boolean> {
    const normalizedFields = [
      ...new Map(
        fieldNames
          .map((field) => field.trim())
          .filter(Boolean)
          .map((field) => [field.toLocaleLowerCase(), field]),
      ).values(),
    ];
    if (isSupabaseConfigured) {
      try {
        await saveMeasurementPresetRecord(
          categoryId,
          normalizedFields,
          clothAmount,
        );
      } catch (error) {
        openNotice(
          error instanceof Error
            ? error.message
            : "Could not save the measurement preset.",
        );
        return false;
      }
    } else {
      try {
        localStorage.setItem(
          "oti-b-measurement-presets",
          JSON.stringify({
            ...measurementPresets,
            [categoryId]: normalizedFields,
          }),
        );
        const storedClothAmounts = JSON.parse(
          localStorage.getItem("oti-b-measurement-preset-cloth-amounts") ??
            "{}",
        ) as Record<string, number>;
        if (clothAmount === undefined) delete storedClothAmounts[categoryId];
        else storedClothAmounts[categoryId] = clothAmount;
        localStorage.setItem(
          "oti-b-measurement-preset-cloth-amounts",
          JSON.stringify(storedClothAmounts),
        );
      } catch {
        openNotice(
          "Could not save this preset. Your browser storage may be full.",
        );
        return false;
      }
    }
    setMeasurementPresets((current) => ({
      ...current,
      [categoryId]: normalizedFields,
    }));
    setMeasurementPresetClothAmounts((current) => {
      const next = { ...current };
      if (clothAmount === undefined) delete next[categoryId];
      else next[categoryId] = clothAmount;
      return next;
    });
    return true;
  }

  async function saveMeasurementPreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let categoryId = measurementPresetCategoryId;
    let newCategory: MeasurementCategory | undefined;
    if (categoryId === newMeasurementGarmentOption) {
      const garmentName = measurementPresetNewGarmentName.trim();
      if (!garmentName) {
        openNotice("Enter a garment name to add a new measurement preset.");
        return;
      }
      if (garmentName.length > 60) {
        openNotice("Garment names must be 60 characters or fewer.");
        return;
      }
      const existingCategory = measurementCategories.find(
        (category) =>
          category.name.toLocaleLowerCase() === garmentName.toLocaleLowerCase(),
      );
      categoryId =
        existingCategory?.id ?? customGarmentCategoryId(garmentName);
      if (!existingCategory) {
        newCategory = {
          id: categoryId,
          name: garmentName,
          customerCount: 0,
          group: "Custom",
          image: "/garment-icons/traditional-wear.png",
        };
      }
    }
    const fields = measurementPresetDraft
      .split(/[\n,]/)
      .map((field) => field.trim())
      .filter(Boolean);
    if (fields.some((field) => field.length > 50)) {
      openNotice("Measurement titles must be 50 characters or fewer.");
      return;
    }
    if (
      new Set(fields.map((field) => field.toLocaleLowerCase())).size !==
      fields.length
    ) {
      openNotice("Each measurement title in a preset must be unique.");
      return;
    }
    const clothAmount =
      measurementPresetClothAmountDraft.trim() === ""
        ? undefined
        : Number(measurementPresetClothAmountDraft);
    if (
      clothAmount !== undefined &&
      (!Number.isFinite(clothAmount) || clothAmount < 0)
    ) {
      openNotice("The default cloth amount must be zero or greater.");
      return;
    }
    if (
      !(await persistMeasurementPreset(
        categoryId,
        fields,
        clothAmount,
      ))
    )
      return;
    if (newCategory) {
      setMeasurementCategories((categories) => [...categories, newCategory]);
    }
    setMeasurementPresetCategoryId(categoryId);
    setMeasurementFormCategoryId(categoryId);
    setSelectedMeasurementCategoryId(categoryId);
    setMeasurementPresetNewGarmentName("");
    setIsMeasurementPresetFormOpen(false);
    setNotice(
      fields.length ? "Measurement preset saved" : "Measurement preset cleared",
    );
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function deleteMeasurementPreset() {
    const categoryId = measurementPresetCategoryId;
    const category = measurementCategories.find(
      (item) => item.id === categoryId,
    );
    if (!category) return;
    const confirmed = await requestConfirmation(
      `Delete ${category.name} measurement preset?`,
      `This removes the preset's default measurement fields and cloth amount. The garment type and existing customer measurements will remain unchanged.`,
      "Delete preset",
      true,
    );
    if (!confirmed) return;

    if (!(await persistMeasurementPreset(categoryId, []))) return;
    setMeasurementPresetDraft("");
    setMeasurementPresetClothAmountDraft("");
    setIsMeasurementPresetFormOpen(false);
    setNotice(
      `Measurement preset for ${category.name} deleted. Existing measurements were kept.`,
    );
    window.setTimeout(() => setNotice(""), 3000);
  }

  function editMeasurementAsNewVersion(entry: MeasurementEntry) {
    setEditingMeasurementEntry(entry);
    setMeasurementFormCategoryId(entry.categoryId);
    setMeasurementFormFields(entry.fields.map((field) => ({ ...field })));
    setMeasurementCustomerName(entry.customer);
    setMeasurementBillingEnabled(false);
    setMeasurementGarmentPhotos(
      (entry.garmentPhotos ?? []).map((photo) => ({ ...photo })),
    );
    setMeasurementStylePhotos(
      (entry.stylePhotos ?? []).map((photo) => ({ ...photo })),
    );
    setIsMeasurementFormOpen(true);
  }

  async function completeMeasurementSave(submission: MeasurementSubmission) {
    let measurementEntryId = `MEA-${crypto.randomUUID()}`;
    let savedGarmentPhotos: MeasurementImage[] = submission.garmentPhotos.map(
      ({ url, path }) => ({ url, path }),
    );
    let savedStylePhotos: MeasurementImage[] = submission.stylePhotos.map(
      ({ url, path }) => ({ url, path }),
    );
    const categoryName =
      measurementCategories.find(
        (category) => category.id === submission.categoryId,
      )?.name ?? submission.categoryId;
    if (isSupabaseConfigured) {
      if (!submission.customerId) {
        openNotice(
          "Select a customer saved in the database before recording measurements.",
        );
        return;
      }
      try {
        const savedMeasurement = await createMeasurementRecord({
          customerId: submission.customerId,
          garmentType: categoryName,
          date: new Date().toISOString().slice(0, 10),
          unit: submission.unit,
          values: submission.fields.map(({ name, value }) => ({
            name,
            value: Number(value),
          })),
          previousSessionId: submission.versionOfId,
          garmentPhotos: submission.garmentPhotos.map(({ file, path }) => ({
            file,
            path,
          })),
          stylePhotos: submission.stylePhotos.map(({ file, path }) => ({
            file,
            path,
          })),
        });
        measurementEntryId = savedMeasurement.id;
        savedGarmentPhotos = savedMeasurement.garmentPhotos.map(
          (photo, index) => ({
            ...photo,
            url: submission.garmentPhotos[index].url,
          }),
        );
        savedStylePhotos = savedMeasurement.stylePhotos.map((photo, index) => ({
          ...photo,
          url: submission.stylePhotos[index].url,
        }));
      } catch (error) {
        openNotice(
          error instanceof Error
            ? error.message
            : "Could not save the measurement.",
        );
        return;
      }
    }

    const nextEntry: MeasurementEntry = {
      id: measurementEntryId,
      customerId: submission.customerId,
      categoryId: submission.categoryId,
      customer: submission.customerName,
      date: new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      unit: submission.unit,
      fields: submission.fields,
      versionOfId: submission.versionOfId,
      garmentPhotos: savedGarmentPhotos,
      stylePhotos: savedStylePhotos,
    };
    if (!isSupabaseConfigured) {
      try {
        localStorage.setItem(
          "oti-b-measurements",
          JSON.stringify([nextEntry, ...measurementEntries]),
        );
      } catch {
        openNotice(
          "Could not save this measurement. Your browser storage may be full.",
        );
        return;
      }
    }
    const alreadyMeasuredThisGarment = measurementEntries.some(
      (entry) =>
        (entry.customerId ??
          customerRecords.find((customer) => customer.name === entry.customer)
            ?.id) === submission.customerId &&
        entry.categoryId === submission.categoryId,
    );
    setMeasurementEntries((current) => [nextEntry, ...current]);
    if (!alreadyMeasuredThisGarment) {
      setMeasurementCategories((current) =>
        current.map((category) =>
          category.id === submission.categoryId
            ? { ...category, customerCount: category.customerCount + 1 }
            : category,
        ),
      );
    }
    setSelectedMeasurementCategoryId(submission.categoryId);
    if (submission.versionOfId) {
      setMeasurementRecordCustomerId(submission.customerId);
      setMeasurementRecordCategoryId(submission.categoryId);
    }
    setCustomerRecords((current) =>
      current.map((customer) =>
        (customer.dbId ?? customer.id) === submission.customerId
          ? { ...customer, measurementsSaved: true }
          : customer,
      ),
    );
    setIsMeasurementFormOpen(false);
    setPendingMeasurementSubmission(null);
    setEditingMeasurementEntry(null);
    setMeasurementCustomerName("");
    setMeasurementFormFields([]);
    setMeasurementGarmentPhotos([]);
    setMeasurementStylePhotos([]);
    void recordActivity(
      "measurement.saved",
      "measurement",
      `${submission.customerName} · ${categoryName}`,
      submission.customerId,
    );
    if (measurementBillingEnabled && !editingMeasurementEntry) {
      const quantity = Number(measurementBillingQuantity);
      const unitPrice = Number(measurementBillingUnitPrice);
      const clothAmount = measurementBillingClothAmount.trim()
        ? Number(measurementBillingClothAmount)
        : 0;
      const discountAmount = Number(measurementBillingDiscount);
      const amount = quantity * (unitPrice + clothAmount) - discountAmount;
      const deliveryDate = measurementBillingDeliveryDate;
      const customer = customerRecords.find(
        (record) => (record.dbId ?? record.id) === submission.customerId,
      );
      try {
        if (!customer)
          throw new Error(
            "The selected customer could not be found for order creation.",
          );
        let savedOrder: OrderRecord;
        if (isSupabaseConfigured) {
          if (!customer.dbId)
            throw new Error(
              "Choose a customer saved in the database before creating a billed order.",
            );
          savedOrder = await createOrderRecord({
            customerId: customer.dbId,
            customerName: customer.name,
            garment: categoryName,
            amount,
            deliveryDate,
            quantity,
            unitPrice,
            clothAmount,
            discountAmount,
          });
        } else {
          const nextOrderNumber = orders.length + 1;
          savedOrder = {
            id: `#ORD-${String(nextOrderNumber).padStart(5, "0")}`,
            createdAt: new Date().toISOString(),
            customer: customer.name,
            item: categoryName,
            status: "Pending",
            date: new Date(`${deliveryDate}T00:00:00`).toLocaleDateString(
              "en-GB",
              { day: "2-digit", month: "short", year: "numeric" },
            ),
            amount,
            quantity,
            unitPrice,
            clothAmount,
            discountAmount,
          };
        }
        setOrders((current) => [savedOrder, ...current]);
        setPayments((current) => [
          {
            id: `PAY-${savedOrder.id.slice(-5)}`,
            orderId: savedOrder.id,
            orderUuid: savedOrder.dbId,
            customer: customer.name,
            total: amount,
            paid: 0,
            method: "—",
            date: "—",
          },
          ...current,
        ]);
        setCustomerRecords((current) =>
          current.map((record) =>
            (record.dbId ?? record.id) === submission.customerId
              ? { ...record, orders: record.orders + 1 }
              : record,
          ),
        );
        void recordActivity(
          "order.created",
          "order",
          `${customer.name} · ${categoryName}`,
          isSupabaseConfigured ? savedOrder.dbId : undefined,
        );
      } catch (error) {
        setNotice(
          `Measurement saved, but order creation failed: ${error instanceof Error ? error.message : "Please create the order separately."}`,
        );
        window.setTimeout(() => setNotice(""), 6000);
        return;
      }
    }
    setNotice(
      measurementBillingEnabled && !editingMeasurementEntry
        ? "Measurement and order saved"
        : "Measurement saved",
    );
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function confirmMeasurementPresetAndSave(savePreset: boolean) {
    if (!pendingMeasurementSubmission) return;
    if (
      savePreset &&
      !(await persistMeasurementPreset(
        pendingMeasurementSubmission.categoryId,
        pendingMeasurementSubmission.fields.map((field) => field.name),
        measurementPresetClothAmounts[pendingMeasurementSubmission.categoryId],
      ))
    )
      return;
    await completeMeasurementSave(pendingMeasurementSubmission);
  }

  async function saveMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedCustomerRecord = customerRecords.find(
      (customer) =>
        customer.name.trim().toLocaleLowerCase() ===
        measurementCustomerName.trim().toLocaleLowerCase(),
    );
    if (!selectedCustomerRecord) {
      return;
    }
    const fields = measurementFormFields.map(({ name, value }) => ({
      name: name.trim(),
      value: value.trim(),
    }));
    if (
      !fields.length ||
      fields.some(
        ({ name, value }) =>
          !name || !Number.isFinite(Number(value)) || Number(value) <= 0,
      )
    ) {
      openNotice(
        "Enter a title and a measurement greater than zero for every measurement part.",
      );
      return;
    }
    const fieldNames = fields.map(({ name }) => name.toLocaleLowerCase());
    if (new Set(fieldNames).size !== fieldNames.length) {
      openNotice("Each measurement title must be unique.");
      return;
    }
    if (
      measurementGarmentPhotos.length > 2 ||
      measurementStylePhotos.length > 3
    ) {
      openNotice(
        "A measurement can include at most 2 garment photos and 3 style references.",
      );
      return;
    }
    if (measurementBillingEnabled && !editingMeasurementEntry) {
      const quantity = Number(measurementBillingQuantity);
      const unitPrice = Number(measurementBillingUnitPrice);
      const clothAmount = measurementBillingClothAmount.trim()
        ? Number(measurementBillingClothAmount)
        : 0;
      const discountAmount = Number(measurementBillingDiscount);
      const subtotal = quantity * (unitPrice + clothAmount);
      if (
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0 ||
        !Number.isFinite(clothAmount) ||
        clothAmount < 0 ||
        !Number.isFinite(discountAmount) ||
        discountAmount < 0 ||
        discountAmount > subtotal ||
        !measurementBillingDeliveryDate
      ) {
        openNotice(
          "Enter valid quantity, prices, a discount no greater than the subtotal, and a delivery date.",
        );
        return;
      }
    }
    const submission: MeasurementSubmission = {
      categoryId: measurementFormCategoryId,
      customerId: selectedCustomerRecord.dbId ?? selectedCustomerRecord.id,
      customerName: selectedCustomerRecord.name,
      fields,
      unit: shopSettings.measurements === "Inches" ? "inches" : "cm",
      versionOfId: editingMeasurementEntry?.id,
      garmentPhotos: measurementGarmentPhotos,
      stylePhotos: measurementStylePhotos,
    };
    if (
      !editingMeasurementEntry &&
      !(measurementPresets[measurementFormCategoryId] ?? []).length
    ) {
      setPendingMeasurementSubmission(submission);
      return;
    }
    await completeMeasurementSave(submission);
  }

  function renderMeasurementEntry(entry: MeasurementEntry) {
    const categoryName =
      measurementCategories.find((category) => category.id === entry.categoryId)
        ?.name ?? "Garment";
    const isLatestVersion = !supersededMeasurementIds.has(entry.id);
    return (
      <article className="measurement-entry-card" key={entry.id}>
        <div className="measurement-entry-heading">
          <div>
            <strong>{entry.customer}</strong>
            <span>
              {categoryName} · {entry.id}
            </span>
          </div>
          <div className="measurement-entry-meta">
            <time>{entry.date}</time>
            <span
              className={`measurement-version-badge${isLatestVersion ? " current" : ""}`}
            >
              {isLatestVersion
                ? "Latest"
                : `Version ${measurementVersionNumber(entry)}`}
            </span>
          </div>
        </div>
        <dl>
          {entry.fields.map((field) => (
            <div key={`${field.name}-${field.value}`}>
              <dt>{field.name}</dt>
              <dd>
                {field.value}{" "}
                <small>{entry.unit === "inches" ? "in" : "cm"}</small>
              </dd>
            </div>
          ))}
        </dl>
        {((entry.garmentPhotos?.length ?? 0) > 0 ||
          (entry.stylePhotos?.length ?? 0) > 0) && (
          <div className="measurement-entry-photos">
            {entry.garmentPhotos?.map((photo, index) => (
              <img
                key={`garment-${index}`}
                src={photo.url}
                alt={`Garment photo ${index + 1}`}
                loading="lazy"
              />
            ))}
            {entry.stylePhotos?.map((photo, index) => (
              <img
                key={`style-${index}`}
                src={photo.url}
                alt={`Style reference ${index + 1}`}
                loading="lazy"
              />
            ))}
          </div>
        )}
        <div className="measurement-entry-actions">
          <button
            className="secondary-button"
            type="button"
            aria-label={`Create a new version of ${entry.customer}'s ${categoryName} measurements`}
            onClick={() => editMeasurementAsNewVersion(entry)}
          >
            <Pencil size={13} /> Edit / new version
          </button>
        </div>
      </article>
    );
  }

  const measurementRecordToolbar = (
    <div className="measurement-record-toolbar">
      <label className="measurement-search">
        <Search size={15} aria-hidden="true" />
        <input
          aria-label="Search saved measurements"
          placeholder="Search customer or body part..."
          value={measurementRecordSearch}
          onChange={(event) => setMeasurementRecordSearch(event.target.value)}
        />
        {measurementRecordSearch && (
          <button
            type="button"
            aria-label="Clear measurement search"
            onClick={() => setMeasurementRecordSearch("")}
          >
            <X size={14} />
          </button>
        )}
      </label>
      {!selectedMeasurementCategory && (
        <label className="measurement-select">
          <span className="sr-only">Filter by garment</span>
          <select
            aria-label="Filter measurements by garment"
            value={measurementRecordCategoryId}
            onChange={(event) =>
              setMeasurementRecordCategoryId(event.target.value)
            }
          >
            <option value="All Garments">All Garments</option>
            {measurementCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
      )}
      <label className="measurement-select">
        <span className="sr-only">View customer measurements</span>
        <select
          aria-label="View measurements for customer"
          value={measurementRecordCustomerId}
          onChange={(event) =>
            setMeasurementRecordCustomerId(event.target.value)
          }
        >
          <option value="All Customers">All Customers</option>
          {customerRecords.map((customer) => (
            <option
              key={customer.dbId ?? customer.id}
              value={customer.dbId ?? customer.id}
            >
              {customer.name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} />
      </label>
    </div>
  );

  if (!isSupabaseConfigured) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="supabase-setup-title">
          <a className="auth-brand" href="#home">
            <span>QT Fashion app</span>
          </a>
          <p className="auth-kicker">PROJECT SETUP</p>
          <h1 id="supabase-setup-title">Connect your shop database</h1>
          <p className="auth-description">
            Demo records have been removed. Add your Supabase project URL and
            publishable key to <code>frontend/.env.local</code>, then restart
            the app to use real shop data.
          </p>
        </section>
      </main>
    );
  }

  if (isSupabaseConfigured && authLoading) {
    return (
      <main className="auth-loading" aria-live="polite">
        Checking your session…
      </main>
    );
  }

  if (isSupabaseConfigured && !authSession) {
    return (
      <main className="auth-shell auth-login-shell">
        <div className="auth-login-frame">
          <aside
            className="auth-login-showcase"
            aria-label="QT Fashion app"
          >
            <div className="auth-showcase-topline">
              <a className="auth-showcase-brand" href="#home">
                <span>QT Fashion app</span>
              </a>
              <span className="auth-showcase-edition">MADE FOR YOUR CRAFT</span>
            </div>
            <div className="auth-showcase-copy">
              <p>YOUR ATELIER, BEAUTIFULLY IN SYNC</p>
              <h2>
                Make space
                <br />
                for the <em>work</em>
                <br />
                you love.
              </h2>
              <span className="auth-showcase-rule" aria-hidden="true" />
              <p className="auth-showcase-caption">
                Customers, orders, measurements and your team — all in one
                thoughtful workspace.
              </p>
            </div>
            <div className="auth-showcase-footer">
              <span className="auth-showcase-ornament" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              <span>EVERY STITCH STARTS WITH A PLAN</span>
            </div>
          </aside>
          <section
            className="auth-login-form-side"
            aria-labelledby="auth-title"
          >
            <div className="auth-login-card">
              <p className="auth-kicker">
                {authMode === "sign-in"
                  ? "EXISTING MEMBER"
                  : "JOIN THE ATELIER"}
              </p>
              <h1 id="auth-title">
                {authMode === "sign-in"
                  ? "Welcome back"
                  : "Create your account"}
              </h1>
              <p className="auth-description">
                {authMode === "sign-in"
                  ? "Sign in to keep your shop moving."
                  : "Set up your account and create a private workspace for your shop."}
              </p>
              <div
                className="auth-mode-switch"
                role="group"
                aria-label="Choose sign in or account creation"
              >
                <button
                  aria-pressed={authMode === "sign-in"}
                  className={authMode === "sign-in" ? "selected" : ""}
                  type="button"
                  onClick={() => {
                    setAuthMode("sign-in");
                    setAuthError("");
                    setAuthMessage("");
                  }}
                >
                  Sign in
                </button>
                <button
                  aria-pressed={authMode === "sign-up"}
                  className={authMode === "sign-up" ? "selected" : ""}
                  type="button"
                  onClick={() => {
                    setAuthMode("sign-up");
                    setAuthError("");
                    setAuthMessage("");
                  }}
                >
                  Create account
                </button>
              </div>
              <form className="auth-form" onSubmit={submitAuth}>
                {authMode === "sign-up" && (
                  <label>
                    Full name
                    <input
                      autoComplete="name"
                      name="fullName"
                      placeholder="Your name"
                      required
                    />
                  </label>
                )}
                <label>
                  Email address
                  <input
                    autoComplete="email"
                    name="email"
                    type="email"
                    placeholder="name@example.com"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Password
                  <span className="auth-password-field">
                    <input
                      autoComplete={
                        authMode === "sign-in"
                          ? "current-password"
                          : "new-password"
                      }
                      name="password"
                      type={authPasswordVisible ? "text" : "password"}
                      minLength={8}
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      aria-label={
                        authPasswordVisible ? "Hide password" : "Show password"
                      }
                      type="button"
                      onClick={() =>
                        setAuthPasswordVisible((visible) => !visible)
                      }
                    >
                      <span aria-hidden="true">
                        {authPasswordVisible ? (
                          <EyeOff size={17} />
                        ) : (
                          <Eye size={17} />
                        )}
                      </span>
                    </button>
                  </span>
                </label>
                {authMode === "sign-in" && (
                  <button
                    className="auth-forgot-button"
                    type="button"
                    onClick={() => void sendPasswordReset()}
                    disabled={authBusy}
                  >
                    Forgot password?
                  </button>
                )}
                {authError && (
                  <p className="auth-feedback error" role="alert">
                    {authError}
                  </p>
                )}
                {authMessage && (
                  <p className="auth-feedback" role="status">
                    {authMessage}
                  </p>
                )}
                <button
                  className="primary-button auth-submit"
                  type="submit"
                  disabled={authBusy}
                >
                  {authBusy
                    ? "Please wait…"
                    : authMode === "sign-in"
                      ? "Sign in"
                      : "Create account"}
                  <span aria-hidden="true">→</span>
                </button>
              </form>
              <p className="auth-security-note">
                <span aria-hidden="true">●</span> Your account is secured by
                Supabase authentication.
              </p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (
    isSupabaseConfigured &&
    workspaceLoading &&
    !(passwordSetupRequired && authSession) &&
    authSession &&
    workspaceLoadedUserId !== authSession.user.id
  ) {
    return (
      <main className="workspace-loading-screen" aria-live="polite" aria-busy="true">
        <section className="workspace-loading-card" aria-labelledby="workspace-loading-title">
          <a className="workspace-loading-brand" href="#home">
            <span className="workspace-loading-brand-mark" aria-hidden="true">QT</span>
            <span>
              <strong>QT Fashion app</strong>
              <small>YOUR ATELIER, BEAUTIFULLY IN SYNC</small>
            </span>
          </a>
          <div className="workspace-loading-copy">
            <span className="workspace-loading-spinner" aria-hidden="true" />
            <p className="auth-kicker">GETTING YOUR SHOP READY</p>
            <h1 id="workspace-loading-title">Loading your workspace</h1>
            <p>
              We’re securely gathering your shop records, team, and settings.
              This usually takes just a moment.
            </p>
          </div>
          <div className="workspace-loading-preview" aria-hidden="true">
            <div className="workspace-loading-preview-top">
              <span className="workspace-loading-skeleton workspace-loading-title-line" />
              <span className="workspace-loading-skeleton workspace-loading-button" />
            </div>
            <div className="workspace-loading-preview-stats">
              <span className="workspace-loading-skeleton" />
              <span className="workspace-loading-skeleton" />
              <span className="workspace-loading-skeleton" />
            </div>
            <div className="workspace-loading-preview-list">
              <span className="workspace-loading-skeleton" />
              <span className="workspace-loading-skeleton" />
              <span className="workspace-loading-skeleton" />
            </div>
          </div>
          <p className="workspace-loading-footnote">
            Your information is protected by your shop account.
          </p>
        </section>
      </main>
    );
  }

  if (
    isSupabaseConfigured &&
    workspaceError &&
    !(passwordSetupRequired && authSession)
  ) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="workspace-error-title">
          <p className="auth-kicker">DATABASE CONNECTION</p>
          <h1 id="workspace-error-title">Shop records couldn’t load</h1>
          <p className="auth-description">{workspaceError}</p>
          <button
            className="primary-button auth-submit"
            type="button"
            onClick={() => {
              setWorkspaceError("");
              setWorkspaceReloadKey((key) => key + 1);
            }}
          >
            Try again
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void signOut();
            }}
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  if (isSupabaseConfigured && passwordSetupRequired && authSession) {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-labelledby="password-setup-title">
          <a className="auth-brand" href="#home">
            <span>QT Fashion app</span>
            <small>APPRENTICE WORKSPACE</small>
          </a>
          <p className="auth-kicker">SECURE ACCOUNT SETUP</p>
          <h1 id="password-setup-title">Set your password</h1>
          <p className="auth-description">
            Choose a private password to finish setting up your apprentice
            login. Your shop owner cannot see it.
          </p>
          <form className="auth-form" onSubmit={submitPasswordSetup}>
            <label>
              New password
              <input
                autoComplete="new-password"
                name="newPassword"
                type="password"
                minLength={12}
                placeholder="At least 12 characters"
                required
              />
            </label>
            <label>
              Confirm password
              <input
                autoComplete="new-password"
                name="confirmPassword"
                type="password"
                minLength={12}
                placeholder="Enter it again"
                required
              />
            </label>
            {passwordSetupError && (
              <p className="auth-feedback error" role="alert">
                {passwordSetupError}
              </p>
            )}
            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={passwordSetupBusy}
            >
              {passwordSetupBusy
                ? "Saving password…"
                : "Save password and continue"}
            </button>
          </form>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </section>
      </main>
    );
  }

  if (
    isSupabaseConfigured &&
    workspaceUserRole === "apprentice" &&
    authSession
  ) {
    const apprentice = apprentices[0];
    if (!apprentice?.userId) {
      return (
        <main className="auth-loading">
          This account does not have an apprentice profile. Contact the shop
          owner.
        </main>
      );
    }
    return (
      <ApprenticePortal
        apprentice={{
          ...apprentice,
          userId: authSession.user.id,
          email: apprentice.email ?? "",
          notes: apprentice.notes ?? "",
        }}
        tasks={tasks}
        updates={taskUpdates}
        onUpdate={handleApprenticePortalTaskUpdate}
        onChecklistUpdate={handleApprenticePortalChecklistUpdate}
        onSignOut={() => {
          void signOut();
        }}
      />
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#dashboard"
          onClick={() => setActivePage("Dashboard")}
        >
          <span className="brand-name">QT Fashion app</span>
        </a>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              className={`nav-link${activePage === label ? " active" : ""}`}
              key={label}
              onClick={() => setActivePage(label)}
              type="button"
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button
          className="sidebar-profile"
          type="button"
          onClick={() => void signOut()}
        >
          <span className="profile-avatar">
            {ownerDisplayName
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0])
              .join("")
              .toUpperCase()}
          </span>
          <span className="profile-copy">
            <strong>{ownerDisplayName}</strong>
            <small>Sign out</small>
          </span>
        </button>
      </aside>

      <main
        className={`main-content${activePage === "Calendar" ? " calendar-active" : ""}${activePage === "Cloth Gallery" ? " cloth-gallery-active" : ""}${activePage === "Customers" ? " customers-active" : ""}${activePage === "Measurements" ? " measurements-active" : ""}${activePage === "Orders" ? " orders-active" : ""}${activePage === "Apprentices" ? " apprentices-active" : ""}${activePage === "Tasks" ? " tasks-active" : ""}${activePage === "Payments" ? " payments-active" : ""}${activePage === "Reports" ? " reports-active" : ""}${activePage === "Settings" ? " settings-active" : ""}${customerFormOpen ? " customer-form-active" : ""}`}
      >
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-name">QT Fashion app</span>
          </div>
          <div className="heading-block">
            <p className="eyebrow">QT FASHION APP</p>
            <h1>{activePage}</h1>
            <p
              className={`welcome${activePage === "Customers" ? " customer-page-subtitle" : ""}`}
            >
              Welcome back, <strong>{welcomeName}</strong>{" "}
              <span aria-hidden="true">👋</span>
            </p>
          </div>
          <div className="top-actions">
            {!["Calendar", "Cloth Gallery", "Customers"].includes(
              activePage,
            ) && (
              <label className={`search-box${isSearchOpen ? " expanded" : ""}`}>
                <Search size={15} aria-hidden="true" />
                <button
                  className="search-trigger"
                  aria-label="Open search"
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                >
                  <Search size={16} />
                </button>
                <input
                  aria-label="Search orders"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && filteredOrders[0])
                      openRecord("Orders", filteredOrders[0].id);
                  }}
                  placeholder="Search anything..."
                  value={searchTerm}
                />
                {(searchTerm || isSearchOpen) && (
                  <button
                    aria-label={searchTerm ? "Clear search" : "Close search"}
                    type="button"
                    onClick={() => {
                      if (searchTerm) setSearchTerm("");
                      else setIsSearchOpen(false);
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
            )}
            <button
              className="icon-button notification-button"
              aria-label={
                notificationCount
                  ? `Notifications (${notificationCount} updates)`
                  : "Notifications"
              }
              type="button"
              onClick={() => setActivePage("Notifications")}
            >
              <Bell size={17} />
              {notificationCount > 0 && <span className="notification-dot" />}
            </button>
            <button
              className="help-button"
              aria-label="Help"
              type="button"
              onClick={() => setActivePage("Help")}
            >
              <CircleHelp size={16} />
            </button>
            <button
              className="primary-button desktop-create"
              type="button"
              onClick={startCustomerOrder}
            >
              <Plus size={15} /> New Order
            </button>
          </div>
        </header>

        {!isOnline && (
          <p className="offline-workspace-banner" role="status">
            <span aria-hidden="true" />
            Offline — showing the last saved shop records. Updates are
            unavailable until you reconnect.
          </p>
        )}

        {workspaceLoading && (
          <p className="workspace-loading-status" role="status">
            Loading shop records…
          </p>
        )}

        {workspaceLoading && activePage === "Dashboard" ? (
          <section
            className="dashboard-skeleton"
            aria-label="Dashboard content loading"
            aria-busy="true"
          >
            <div className="skeleton-stats-grid" aria-hidden="true">
              {Array.from({ length: 4 }, (_, index) => (
                <div className="skeleton-card skeleton-stat-card" key={index}>
                  <span className="skeleton-block skeleton-label" />
                  <span className="skeleton-block skeleton-value" />
                  <span className="skeleton-block skeleton-caption" />
                </div>
              ))}
            </div>
            <div className="skeleton-overview-grid" aria-hidden="true">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="skeleton-card skeleton-overview-card" key={index}>
                  <span className="skeleton-block skeleton-heading" />
                  <span className="skeleton-block skeleton-visual" />
                  <span className="skeleton-block skeleton-caption" />
                </div>
              ))}
            </div>
            <div className="skeleton-bottom-grid" aria-hidden="true">
              <div className="skeleton-card skeleton-table-card">
                <span className="skeleton-block skeleton-heading" />
                {Array.from({ length: 5 }, (_, index) => (
                  <span className="skeleton-block skeleton-table-row" key={index} />
                ))}
              </div>
              <div className="skeleton-card skeleton-side-card">
                <span className="skeleton-block skeleton-heading" />
                {Array.from({ length: 4 }, (_, index) => (
                  <span className="skeleton-block skeleton-person-row" key={index} />
                ))}
              </div>
            </div>
          </section>
        ) : activePage === "Notifications" ? (
          <section
            className="notifications-page"
            aria-label="Notifications and activity"
          >
            <div className="notifications-page-heading">
              <div>
                <p>
                  Important shop reminders and a history of changes made in the
                  app.
                </p>
              </div>
              <button
                className="secondary-button"
                type="button"
                disabled={!unreadActivityCount}
                onClick={markActivityRead}
              >
                Mark activity as read
              </button>
            </div>
            <section
              className="panel notification-section"
              aria-labelledby="notification-reminders-title"
            >
              <div className="notification-section-heading">
                <div>
                  <h3 id="notification-reminders-title">
                    Needs your attention
                  </h3>
                  <p>
                    Upcoming deadlines and summaries based on your shop records.
                  </p>
                </div>
                <span className="notification-count">
                  {operationalNotifications.length}
                </span>
              </div>
              {operationalNotifications.length ? (
                <div className="notification-list">
                  {operationalNotifications.map((item) => (
                    <button
                      className="notification-row"
                      key={item.id}
                      type="button"
                      onClick={() => openNotificationRecord(item)}
                    >
                      <span className={`notification-icon ${item.kind}`}>
                        {item.kind === "order" ? (
                          <CalendarDays size={16} />
                        ) : item.kind === "payment" ? (
                          <CreditCard size={16} />
                        ) : item.kind === "report" ? (
                          <BarChart3 size={16} />
                        ) : (
                          <ListChecks size={16} />
                        )}
                      </span>
                      <span className="notification-copy">
                        <strong>{item.title}</strong>
                        <small>{item.message}</small>
                      </span>
                      <time>{item.date}</time>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="notification-empty">
                  You’re all caught up. New reminders will appear here.
                </p>
              )}
            </section>
            <section
              className="panel notification-section"
              aria-labelledby="activity-history-title"
            >
              <div className="notification-section-heading">
                <div>
                  <h3 id="activity-history-title">Recent activity</h3>
                  <p>Changes recorded by shop users.</p>
                </div>
                <span className="notification-count">
                  {activityEntries.length}
                </span>
              </div>
              {activityEntries.length ? (
                <div className="activity-list">
                  {activityEntries.map((entry) => (
                    <article
                      className={`activity-row${readActivityIds.includes(entry.id) ? "" : " unread"}`}
                      key={entry.id}
                    >
                      <span className="activity-icon">
                        <Activity size={15} />
                      </span>
                      <div className="activity-copy">
                        <strong>{activityActionLabel(entry.action)}</strong>
                        <p>{entry.entityLabel}</p>
                        <small>
                          {entry.actor} ·{" "}
                          {new Date(entry.createdAt).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </small>
                      </div>
                      {!readActivityIds.includes(entry.id) && (
                        <span className="activity-unread" aria-label="Unread" />
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <p className="notification-empty">
                  No changes have been recorded yet. Updates made from now on
                  will show here.
                </p>
              )}
            </section>
          </section>
        ) : activePage === "Help" ? (
          <section className="help-page" aria-label="App help guide">
            <div className="help-page-heading">
              <div>
                <h2>How can we help?</h2>
                <p>
                  A quick guide to the main tools in your fashion shop
                  workspace.
                </p>
              </div>
            </div>
            <div className="help-topic-grid">
              <article className="panel help-topic">
                <span className="help-topic-icon">
                  <Users size={19} />
                </span>
                <h3>Customers and orders</h3>
                <p>
                  Start with <strong>New Order</strong> to add a customer, then
                  enter the garment, delivery date, and price to create the
                  order. Manage customer details from Customers.
                </p>
                <button
                  className="panel-link"
                  type="button"
                  onClick={() => setActivePage("Customers")}
                >
                  Open Customers <ChevronRight size={14} />
                </button>
              </article>
              <article className="panel help-topic">
                <span className="help-topic-icon">
                  <ClipboardList size={19} />
                </span>
                <h3>Track order progress</h3>
                <p>
                  Open Orders to find a garment and update its status as it
                  moves from pending through cutting, sewing, fitting, and
                  delivery.
                </p>
                <button
                  className="panel-link"
                  type="button"
                  onClick={() => setActivePage("Orders")}
                >
                  Open Orders <ChevronRight size={14} />
                </button>
              </article>
              <article className="panel help-topic">
                <span className="help-topic-icon">
                  <Ruler size={19} />
                </span>
                <h3>Measurements</h3>
                <p>
                  Choose a measurement category, select the customer, and save
                  their measurements. You can return to the profile whenever the
                  fit needs updating.
                </p>
                <button
                  className="panel-link"
                  type="button"
                  onClick={() => setActivePage("Measurements")}
                >
                  Open Measurements <ChevronRight size={14} />
                </button>
              </article>
              <article className="panel help-topic">
                <span className="help-topic-icon">
                  <CalendarDays size={19} />
                </span>
                <h3>Calendar and tasks</h3>
                <p>
                  Use the calendar to review delivery dates and task deadlines.
                  Tasks can be assigned to apprentices and updated as work
                  progresses.
                </p>
                <button
                  className="panel-link"
                  type="button"
                  onClick={() => setActivePage("Calendar")}
                >
                  Open Calendar <ChevronRight size={14} />
                </button>
              </article>
              <article className="panel help-topic">
                <span className="help-topic-icon">
                  <CreditCard size={19} />
                </span>
                <h3>Payments and reports</h3>
                <p>
                  Record money received against an order in Payments. Reports
                  summarize orders, revenue, and payment methods for your shop.
                </p>
                <button
                  className="panel-link"
                  type="button"
                  onClick={() => setActivePage("Payments")}
                >
                  Open Payments <ChevronRight size={14} />
                </button>
              </article>
              <article className="panel help-topic">
                <span className="help-topic-icon">
                  <BookOpen size={19} />
                </span>
                <h3>Settings and help</h3>
                <p>
                  Update your shop profile, currency, measurement units, and
                  reminder preferences in Settings. Notifications show deadlines
                  and recorded changes.
                </p>
                <button
                  className="panel-link"
                  type="button"
                  onClick={() => setActivePage("Settings")}
                >
                  Open Settings <ChevronRight size={14} />
                </button>
              </article>
            </div>
          </section>
        ) : activePage === "Calendar" ? (
          <section className="calendar-page" aria-label="Shop calendar">
            <div className="calendar-page-heading">
              <p>Keep delivery dates and atelier tasks in view.</p>
            </div>
            <section
              className="panel calendar-panel"
              aria-label="Monthly calendar"
            >
              <div className="calendar-toolbar">
                <div className="calendar-month-controls">
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Previous month"
                    onClick={() =>
                      setCalendarMonth(
                        (month) =>
                          new Date(
                            month.getFullYear(),
                            month.getMonth() - 1,
                            1,
                          ),
                      )
                    }
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <h3>
                    {calendarMonth.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </h3>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Next month"
                    onClick={() =>
                      setCalendarMonth(
                        (month) =>
                          new Date(
                            month.getFullYear(),
                            month.getMonth() + 1,
                            1,
                          ),
                      )
                    }
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <button
                  className="secondary-button calendar-today-button"
                  type="button"
                  onClick={() => {
                    setCalendarMonth(
                      new Date(today.getFullYear(), today.getMonth(), 1),
                    );
                    setSelectedCalendarDay(dateKey(today));
                  }}
                >
                  Today
                </button>
              </div>
              <div
                className="calendar-grid"
                role="grid"
                aria-label={calendarMonth.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              >
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (weekday) => (
                    <span
                      className="calendar-weekday"
                      key={weekday}
                      role="columnheader"
                    >
                      {weekday}
                    </span>
                  ),
                )}
                {calendarCells.map(({ date, key, inMonth }) => {
                  const dayEvents = calendarEvents.filter(
                    (event) => event.date === key,
                  );
                  return (
                    <button
                      className={`calendar-day${inMonth ? "" : " outside-month"}${key === selectedCalendarDay ? " selected" : ""}${key === dateKey(today) ? " today" : ""}`}
                      key={key}
                      type="button"
                      role="gridcell"
                      aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}, ${dayEvents.length} scheduled items`}
                      aria-pressed={key === selectedCalendarDay}
                      onClick={() => setSelectedCalendarDay(key)}
                    >
                      <span className="calendar-day-number">
                        {date.getDate()}
                      </span>
                      {dayEvents.slice(0, 2).map((item) => (
                        <span
                          className={`calendar-event-chip ${item.kind}`}
                          key={`${item.kind}-${item.id}`}
                        >
                          <i />
                          {item.title}
                        </span>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="calendar-event-more">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="calendar-legend">
                <span>
                  <i className="order-dot" /> Deliveries
                </span>
                <span>
                  <i className="task-dot" /> Tasks
                </span>
              </div>
            </section>
            <section
              className="panel calendar-day-panel"
              aria-labelledby="calendar-day-title"
            >
              <div className="calendar-day-heading">
                <div>
                  <h3 id="calendar-day-title">
                    {new Date(
                      `${selectedCalendarDay}T00:00:00`,
                    ).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  <p>
                    {selectedDayEvents.length} scheduled{" "}
                    {selectedDayEvents.length === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
              {selectedDayEvents.length ? (
                <div className="calendar-event-list">
                  {selectedDayEvents.map((item) => (
                    <button
                      className="calendar-event-row"
                      key={`${item.kind}-${item.id}`}
                      type="button"
                      onClick={() => {
                        openRecord(
                          item.kind === "order" ? "Orders" : "Tasks",
                          item.id,
                        );
                      }}
                    >
                      <span className={`calendar-event-marker ${item.kind}`} />
                      <span className="calendar-event-copy">
                        <strong>{item.title}</strong>
                        <small>{item.detail}</small>
                      </span>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="calendar-empty">
                  Nothing scheduled for this day.
                </p>
              )}
            </section>
          </section>
        ) : activePage === "Cloth Gallery" ? (
          <section className="cloth-gallery-page" aria-label="Cloth gallery">
            {clothCustomerMode ? (
              <section
                className="panel cloth-customer-picker"
                aria-label="Choose a customer for this gallery item"
              >
                <div className="cloth-picker-heading">
                  <div>
                    <h2>Save for a customer</h2>
                    <p>
                      Choose the customer this{" "}
                      {selectedGalleryRecord?.kind ?? "item"} is for.
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setClothCustomerMode(false);
                      setSelectedGalleryCustomerId(null);
                    }}
                  >
                    Back to gallery
                  </button>
                </div>
                {selectedGalleryRecord && (
                  <div className="cloth-selected-summary">
                    <strong>{selectedGalleryRecord.name}</strong>
                    <span>
                      {selectedGalleryRecord.kind === "fabric"
                        ? "Fabric"
                        : "Cloth style"}{" "}
                      · {selectedGalleryRecord.category}
                    </span>
                  </div>
                )}
                <label className="cloth-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    aria-label="Search customers for gallery item"
                    placeholder="Search by customer name, phone or ID"
                    value={clothCustomerSearch}
                    onChange={(event) =>
                      setClothCustomerSearch(event.target.value)
                    }
                  />
                  {clothCustomerSearch && (
                    <button
                      type="button"
                      aria-label="Clear customer search"
                      onClick={() => setClothCustomerSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <div className="cloth-customer-list">
                  {visibleGalleryCustomers.map((customer) => {
                    const customerKey = customer.dbId ?? customer.id;
                    return (
                      <button
                        className={`cloth-customer-option${selectedGalleryCustomerId === customerKey ? " selected" : ""}`}
                        key={customerKey}
                        type="button"
                        aria-pressed={selectedGalleryCustomerId === customerKey}
                        onClick={() =>
                          setSelectedGalleryCustomerId(customerKey)
                        }
                      >
                        <span className="cloth-customer-avatar">
                          {customer.name
                            .split(" ")
                            .map((part) => part[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span>
                          <strong>{customer.name}</strong>
                          <small>
                            {customer.id} · {customer.phone}
                          </small>
                        </span>
                        <span className="cloth-customer-choice">
                          {selectedGalleryCustomerId === customerKey ? (
                            <Check size={16} />
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
                  {!visibleGalleryCustomers.length && (
                    <p className="notification-empty">
                      No customers match this search.
                    </p>
                  )}
                </div>
                <div className="modal-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setClothCustomerMode(false);
                      setSelectedGalleryCustomerId(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!selectedGalleryCustomer}
                    onClick={saveGalleryItemForCustomer}
                  >
                    Save to Customer History
                  </button>
                </div>
              </section>
            ) : (
              <>
                <div className="cloth-gallery-heading">
                  <p>
                    Browse fabrics and clothing styles, then save a selection to
                    a customer’s history.
                  </p>
                  <div className="cloth-gallery-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => openGalleryForm("style")}
                    >
                      <Plus size={15} /> Add Style
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => openGalleryForm("fabric")}
                    >
                      <ImagePlus size={15} /> Add Fabric
                    </button>
                  </div>
                </div>
                {clothGalleryLoading && (
                  <p role="status">Loading your saved fabrics and styles…</p>
                )}
                {clothGalleryError && (
                  <p role="alert" className="form-error">
                    {clothGalleryError}
                  </p>
                )}
                {galleryImportPending && (
                  <div className="cloth-selected-summary">
                    <span>
                      This device has a local gallery that has not been imported
                      into your Supabase shop.
                    </span>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        void importLocalClothGallery().catch((error: unknown) => {
                          console.error("Could not import this device's cloth gallery.", error);
                          setClothGalleryError(
                            error instanceof Error
                              ? error.message
                              : "Could not import this device's gallery.",
                          );
                        });
                      }}
                    >
                      Import from this device
                    </button>
                  </div>
                )}
                <div
                  className="cloth-gallery-tabs"
                  role="tablist"
                  aria-label="Gallery category"
                >
                  <button
                    className={galleryKind === "fabric" ? "active" : ""}
                    role="tab"
                    aria-selected={galleryKind === "fabric"}
                    type="button"
                    onClick={() => {
                      setGalleryKind("fabric");
                      setClothCategory("All Fabrics");
                      setClothSearch("");
                    }}
                  >
                    <Images size={16} /> Fabrics{" "}
                    <span>
                      {
                        clothRecords.filter(
                          (record) => record.kind === "fabric",
                        ).length
                      }
                    </span>
                  </button>
                  <button
                    className={galleryKind === "style" ? "active" : ""}
                    role="tab"
                    aria-selected={galleryKind === "style"}
                    type="button"
                    onClick={() => {
                      setGalleryKind("style");
                      setClothCategory("All Styles");
                      setClothSearch("");
                    }}
                  >
                    <UserRound size={16} /> Cloth Styles{" "}
                    <span>
                      {
                        clothRecords.filter((record) => record.kind === "style")
                          .length
                      }
                    </span>
                  </button>
                </div>
                <div className="cloth-gallery-toolbar">
                  <label className="cloth-search">
                    <Search size={16} aria-hidden="true" />
                    <input
                      aria-label={`Search ${galleryKind === "fabric" ? "fabrics" : "styles"}`}
                      placeholder={`Search ${galleryKind === "fabric" ? "fabric, type or color" : "style, garment or details"}`}
                      value={clothSearch}
                      onChange={(event) => setClothSearch(event.target.value)}
                    />
                    {clothSearch && (
                      <button
                        type="button"
                        aria-label="Clear gallery search"
                        onClick={() => setClothSearch("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <label className="orders-status-filter">
                    <span className="sr-only">
                      {galleryKind === "fabric"
                        ? "Fabric type"
                        : "Style category"}
                    </span>
                    <select
                      value={clothCategory}
                      onChange={(event) => setClothCategory(event.target.value)}
                    >
                      {clothCategories.map((category) => (
                        <option key={category}>{category}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </label>
                  <span className="orders-result-count">
                    {visibleClothRecords.length}{" "}
                    {galleryKind === "fabric" ? "fabrics" : "styles"}
                  </span>
                </div>
                {visibleClothRecords.length ? (
                  <div className="cloth-gallery-grid">
                    {visibleClothRecords.map((cloth) => (
                      <button
                        className="cloth-card"
                        key={cloth.id}
                        type="button"
                        onClick={() => setSelectedGalleryRecordId(cloth.id)}
                        aria-label={`View ${cloth.kind === "fabric" ? "fabric" : "style"} ${cloth.name}`}
                      >
                        <div
                          className={`${cloth.kind === "fabric" ? "fabric-swatch" : "style-preview"} fabric-pattern-${cloth.pattern}${cloth.photo ? " has-photo" : ""}`}
                          role="img"
                          aria-label={`${cloth.category} ${cloth.kind === "fabric" ? "fabric" : "style"}`}
                          style={
                            cloth.photo
                              ? { backgroundImage: `url("${cloth.photo}")` }
                              : undefined
                          }
                        >
                          {!cloth.photo && <span>{cloth.category}</span>}
                          <span className="cloth-card-id">{cloth.id}</span>
                        </div>
                        <div className="cloth-card-copy">
                          <div>
                            <span>{cloth.category}</span>
                            <h3>{cloth.name}</h3>
                            <p>{cloth.color}</p>
                          </div>
                          <span className="cloth-card-mark" aria-hidden="true">
                            ✦
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="panel cloth-gallery-empty">
                    <Images size={26} />
                    <strong>
                      No {galleryKind === "fabric" ? "fabrics" : "styles"} found
                    </strong>
                    <span>
                      Try another search or add a{" "}
                      {galleryKind === "fabric" ? "fabric" : "style"} to your
                      collection.
                    </span>
                  </div>
                )}
              </>
            )}

            {isClothFormOpen && (
              <div
                className="modal-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget)
                    setIsClothFormOpen(false);
                }}
              >
                <section
                  className="order-modal cloth-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="cloth-modal-title"
                >
                  <div className="modal-heading">
                    <div>
                      <span className="modal-kicker">
                        {galleryKind === "fabric"
                          ? "FABRIC LIBRARY"
                          : "CLOTH STYLE LIBRARY"}
                      </span>
                      <h2 id="cloth-modal-title">
                        {editingClothId
                          ? `Edit ${galleryKind === "fabric" ? "Fabric" : "Style"}`
                          : `Add ${galleryKind === "fabric" ? "Fabric" : "Style"}`}
                      </h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Close dialog"
                      type="button"
                      onClick={() => {
                        setIsClothFormOpen(false);
                        setEditingClothId(null);
                        setClothPhoto("");
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={addCloth}>
                    {(() => {
                      const editingRecord = clothRecords.find(
                        (record) => record.id === editingClothId,
                      );
                      return (
                        <>
                          <label>
                            {galleryKind === "fabric"
                              ? "Fabric name"
                              : "Style name"}
                            <input
                              autoFocus
                              name="name"
                              defaultValue={editingRecord?.name ?? ""}
                              placeholder={
                                galleryKind === "fabric"
                                  ? "e.g. Royal Ankara"
                                  : "e.g. Classic Wrap Dress"
                              }
                              required
                            />
                          </label>
                          <div className="form-row">
                            <label>
                              {galleryKind === "fabric"
                                ? "Fabric type"
                                : "Style category"}
                              <select
                                className="form-select"
                                name="category"
                                defaultValue={
                                  editingRecord?.category ??
                                  (galleryKind === "fabric"
                                    ? "Ankara"
                                    : "Dresses")
                                }
                              >
                                {(galleryKind === "fabric"
                                  ? [
                                      "Ankara",
                                      "Kente",
                                      "Adinkra",
                                      "Aso-Oke",
                                      "Lace",
                                      "Other",
                                    ]
                                  : [
                                      "Dresses",
                                      "Gowns",
                                      "Suits",
                                      "Kaftans",
                                      "Traditional Wear",
                                      "Other",
                                    ]
                                ).map((category) => (
                                  <option key={category}>{category}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              {galleryKind === "fabric"
                                ? "Colors"
                                : "Design features"}
                              <input
                                name="color"
                                defaultValue={
                                  editingRecord?.color === "Not specified"
                                    ? ""
                                    : (editingRecord?.color ?? "")
                                }
                                placeholder={
                                  galleryKind === "fabric"
                                    ? "e.g. Navy · Gold"
                                    : "e.g. Wrap waist · Midi length"
                                }
                              />
                            </label>
                          </div>
                          <label>
                            Details
                            <textarea
                              className="form-textarea"
                              name="details"
                              defaultValue={editingRecord?.details ?? ""}
                              placeholder={`Describe this ${galleryKind === "fabric" ? "fabric" : "style"} for future reference.`}
                              rows={3}
                            />
                          </label>
                        </>
                      );
                    })()}
                    <label className="cloth-photo-picker">
                      <ImagePlus size={17} />
                      <span>
                        {clothPhoto
                          ? "Photo selected"
                          : `Upload ${galleryKind === "fabric" ? "fabric" : "style"} photo (optional)`}
                      </span>
                      <input
                        accept="image/jpeg,image/png"
                        onChange={handleClothPhoto}
                        type="file"
                      />
                    </label>
                    {clothPhoto && (
                      <img
                        className="cloth-photo-preview"
                        src={clothPhoto}
                        alt={`${galleryKind === "fabric" ? "Fabric" : "Style"} preview`}
                      />
                    )}
                    <p className="cloth-photo-hint">
                      JPG or PNG, up to 5 MB. Your gallery is saved on this
                      device.
                    </p>
                    <div className="modal-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setIsClothFormOpen(false);
                          setEditingClothId(null);
                          setClothPhoto("");
                        }}
                      >
                        Cancel
                      </button>
                      <button className="primary-button" type="submit">
                        <Check size={15} />{" "}
                        {editingClothId ? "Save Changes" : "Add to Gallery"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
            {selectedGalleryRecord &&
              !clothCustomerMode &&
              !isClothFormOpen && (
                <div
                  className="modal-backdrop"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget)
                      setSelectedGalleryRecordId(null);
                  }}
                >
                  <section
                    className="order-modal cloth-detail-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="cloth-detail-title"
                  >
                    <div className="modal-heading">
                      <div>
                        <span className="modal-kicker">
                          {selectedGalleryRecord.kind === "fabric"
                            ? "FABRIC DETAILS"
                            : "CLOTH STYLE DETAILS"}
                        </span>
                        <h2 id="cloth-detail-title">
                          {selectedGalleryRecord.name}
                        </h2>
                      </div>
                      <button
                        className="icon-button"
                        aria-label="Close dialog"
                        type="button"
                        onClick={() => setSelectedGalleryRecordId(null)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="cloth-detail-content">
                      <button
                        type="button"
                        className={`${selectedGalleryRecord.kind === "fabric" ? "fabric-swatch" : "style-preview"} fabric-pattern-${selectedGalleryRecord.pattern}${selectedGalleryRecord.photo ? " has-photo" : ""}`}
                        aria-label={
                          selectedGalleryRecord.photo
                            ? `Open ${selectedGalleryRecord.name} image at full size`
                            : `${selectedGalleryRecord.category} ${selectedGalleryRecord.kind}`
                        }
                        disabled={!selectedGalleryRecord.photo}
                        onClick={() =>
                          setExpandedGalleryImageId(selectedGalleryRecord.id)
                        }
                        style={
                          selectedGalleryRecord.photo
                            ? {
                                backgroundImage: `url("${selectedGalleryRecord.photo}")`,
                              }
                            : undefined
                        }
                      >
                        {!selectedGalleryRecord.photo && (
                          <span>{selectedGalleryRecord.category}</span>
                        )}
                      </button>
                      <dl>
                        <div>
                          <dt>Type</dt>
                          <dd>
                            {selectedGalleryRecord.kind === "fabric"
                              ? "Fabric"
                              : "Cloth style"}
                          </dd>
                        </div>
                        <div>
                          <dt>Category</dt>
                          <dd>{selectedGalleryRecord.category}</dd>
                        </div>
                        <div>
                          <dt>Colors / design features</dt>
                          <dd>{selectedGalleryRecord.color}</dd>
                        </div>
                        <div>
                          <dt>Gallery ID</dt>
                          <dd>{selectedGalleryRecord.id}</dd>
                        </div>
                      </dl>
                      <div className="cloth-detail-description">
                        <strong>Details</strong>
                        <p>
                          {selectedGalleryRecord.details ||
                            "No additional details have been added."}
                        </p>
                      </div>
                      <div className="modal-actions">
                        <button
                          className="secondary-button cloth-delete-button"
                          type="button"
                          onClick={() =>
                            void deleteGalleryItem(selectedGalleryRecord)
                          }
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() =>
                            openGalleryForm(
                              selectedGalleryRecord.kind,
                              selectedGalleryRecord,
                            )
                          }
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          className="primary-button"
                          type="button"
                          onClick={startGalleryCustomerAssignment}
                        >
                          For Customer
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            {expandedGalleryImageId === selectedGalleryRecord?.id &&
              selectedGalleryRecord.photo && (
              <div
                className="cloth-image-lightbox"
                role="dialog"
                aria-modal="true"
                aria-label={`Full-size image: ${selectedGalleryRecord.name}`}
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget)
                    setExpandedGalleryImageId(null);
                }}
              >
                <button
                  className="icon-button cloth-image-lightbox-close"
                  type="button"
                  aria-label="Close full-size image"
                  onClick={() => setExpandedGalleryImageId(null)}
                >
                  <X size={20} />
                </button>
                <img
                  src={selectedGalleryRecord.photo}
                  alt={`${selectedGalleryRecord.name} - ${selectedGalleryRecord.category}`}
                />
                <p>{selectedGalleryRecord.name}</p>
              </div>
            )}
          </section>
        ) : activePage === "Settings" ? (
          <section className="settings-page" aria-label="Shop settings">
            <div className="settings-page-heading">
              <div>
                <p>
                  Manage your shop profile, notifications, account security, and
                  preferences.
                </p>
              </div>
              <span
                className={`settings-save-indicator${JSON.stringify(shopSettings) !== JSON.stringify(savedShopSettings) ? " is-unsaved" : ""}`}
                aria-live="polite"
              >
                <span aria-hidden="true" />
                {JSON.stringify(shopSettings) !==
                JSON.stringify(savedShopSettings)
                  ? "Unsaved changes"
                  : "All changes saved"}
              </span>
            </div>
            <div className="settings-layout">
              <nav
                className="settings-section-nav"
                aria-label="Settings sections"
              >
                {[
                  { label: "Shop Profile" as const, icon: UserRound },
                  { label: "Notifications" as const, icon: Bell },
                  { label: "Preferences" as const, icon: Settings },
                  { label: "Account & Security" as const, icon: KeyRound },
                  { label: "Data & Privacy" as const, icon: CircleHelp },
                ].map(({ label, icon: Icon }) => (
                  <button
                    className={settingsSection === label ? "selected" : ""}
                    key={label}
                    type="button"
                    aria-current={
                      settingsSection === label ? "page" : undefined
                    }
                    onClick={() => setSettingsSection(label)}
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                ))}
              </nav>

              <section
                className="settings-content"
                aria-labelledby="settings-section-title"
              >
                {settingsSection === "Shop Profile" && (
                  <form className="settings-panel" onSubmit={saveShopSettings}>
                    <div className="settings-panel-heading">
                      <span className="settings-panel-icon">
                        <UserRound size={17} />
                      </span>
                      <div>
                        <h3 id="settings-section-title">Shop Profile</h3>
                        <p>
                          Keep your shop identity and contact information up to
                          date.
                        </p>
                      </div>
                    </div>
                    <div className="settings-profile-callout">
                      <strong>
                        {shopSettings.shopName || "Your shop name"}
                      </strong>
                      <span>
                        {shopSettings.address || "Add your shop address"}
                        {shopSettings.phone ? ` · ${shopSettings.phone}` : ""}
                      </span>
                    </div>
                    <div className="settings-fields-grid">
                      <label>
                        Shop name
                        <input
                          autoComplete="organization"
                          maxLength={80}
                          value={shopSettings.shopName}
                          onChange={(event) =>
                            setShopSettings((current) => ({
                              ...current,
                              shopName: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Phone number
                        <input
                          autoComplete="tel"
                          maxLength={30}
                          type="tel"
                          value={shopSettings.phone}
                          onChange={(event) =>
                            setShopSettings((current) => ({
                              ...current,
                              phone: event.target.value,
                            }))
                          }
                          required
                        />
                      </label>
                      <label>
                        Email address
                        <input
                          autoComplete="email"
                          maxLength={254}
                          type="email"
                          value={shopSettings.email}
                          onChange={(event) =>
                            setShopSettings((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label>
                        Shop address
                        <input
                          autoComplete="street-address"
                          maxLength={160}
                          value={shopSettings.address}
                          onChange={(event) =>
                            setShopSettings((current) => ({
                              ...current,
                              address: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    {settingsError && (
                      <p className="settings-error" role="alert">
                        {settingsError}
                      </p>
                    )}
                    <div className="settings-panel-actions">
                      <span className="settings-action-hint">
                        Changes apply across your workspace.
                      </span>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={
                          settingsSaving ||
                          JSON.stringify(shopSettings) ===
                            JSON.stringify(savedShopSettings)
                        }
                      >
                        {settingsSaving ? (
                          "Saving…"
                        ) : (
                          <>
                            <Check size={15} /> Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {settingsSection === "Notifications" && (
                  <form className="settings-panel" onSubmit={saveShopSettings}>
                    <div className="settings-panel-heading">
                      <span className="settings-panel-icon">
                        <Bell size={17} />
                      </span>
                      <div>
                        <h3 id="settings-section-title">Notifications</h3>
                        <p>
                          Choose which in-app updates and reminders appear in
                          your notifications.
                        </p>
                      </div>
                    </div>
                    <div className="settings-toggle-list">
                      {[
                        {
                          key: "dueTasks" as const,
                          title: "Task due reminders",
                          description:
                            "Get reminded when an atelier task is approaching its due date.",
                        },
                        {
                          key: "paymentReceived" as const,
                          title: "Payment updates",
                          description:
                            "Show a notification when a customer payment is recorded.",
                        },
                        {
                          key: "deliveryReminders" as const,
                          title: "Upcoming deliveries",
                          description:
                            "Get a reminder before an order is due for delivery.",
                        },
                        {
                          key: "weeklySummary" as const,
                          title: "Weekly shop summary",
                          description:
                            "Show this week’s order, payment, and open-task totals in Notifications.",
                        },
                      ].map(({ key, title, description }) => (
                        <label className="settings-toggle-row" key={key}>
                          <span>
                            <strong>{title}</strong>
                            <small>{description}</small>
                          </span>
                          <span className="settings-switch">
                            <input
                              type="checkbox"
                              checked={shopSettings.notifications[key]}
                              aria-label={title}
                              onChange={(event) =>
                                updateNotificationSetting(
                                  key,
                                  event.target.checked,
                                )
                              }
                            />
                            <i />
                          </span>
                        </label>
                      ))}
                    </div>
                    {settingsError && (
                      <p className="settings-error" role="alert">
                        {settingsError}
                      </p>
                    )}
                    <div className="settings-panel-actions">
                      <span className="settings-action-hint">
                        Reminder settings are saved to your shop profile.
                      </span>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={
                          settingsSaving ||
                          JSON.stringify(shopSettings) ===
                            JSON.stringify(savedShopSettings)
                        }
                      >
                        {settingsSaving ? (
                          "Saving…"
                        ) : (
                          <>
                            <Check size={15} /> Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {settingsSection === "Preferences" && (
                  <form className="settings-panel" onSubmit={saveShopSettings}>
                    <div className="settings-panel-heading">
                      <span className="settings-panel-icon">
                        <Settings size={17} />
                      </span>
                      <div>
                        <h3 id="settings-section-title">Preferences</h3>
                        <p>
                          Set how money and measurements are displayed in your
                          shop.
                        </p>
                      </div>
                    </div>
                    <div className="settings-fields-grid settings-preferences-grid">
                      <label>
                        Currency
                        <select
                          className="form-select"
                          value={shopSettings.currency}
                          onChange={(event) =>
                            setShopSettings((current) => ({
                              ...current,
                              currency: event.target
                                .value as ShopSettings["currency"],
                            }))
                          }
                        >
                          <option value="GHS">Ghana Cedi (GH₵)</option>
                          <option value="USD">US Dollar ($)</option>
                        </select>
                        <small>
                          Used for order totals, payments, and reports. Existing
                          amounts are not converted.
                        </small>
                      </label>
                      <label>
                        Default measurement units
                        <select
                          className="form-select"
                          value={shopSettings.measurements}
                          onChange={(event) =>
                            setShopSettings((current) => ({
                              ...current,
                              measurements: event.target
                                .value as ShopSettings["measurements"],
                            }))
                          }
                        >
                          <option>Inches</option>
                          <option>Centimeters</option>
                        </select>
                        <small>
                          Used as the default unit when recording new
                          measurements.
                        </small>
                      </label>
                    </div>
                    <section className="settings-install-card" aria-labelledby="install-app-title">
                      <div>
                        <h4 id="install-app-title">Install QT Fashion app</h4>
                        <p>
                          Add the app to your device for a dedicated window and
                          quicker access. Open it online at least once to
                          prepare it for offline use.
                        </p>
                        {installHelpMessage && (
                          <p className="settings-install-help" role="status">
                            {installHelpMessage}
                          </p>
                        )}
                      </div>
                      <button
                        className="primary-button"
                        type="button"
                        disabled={isAppInstalled}
                        onClick={() => void installApp()}
                      >
                        {isAppInstalled ? (
                          <>
                            <Check size={15} /> Installed
                          </>
                        ) : (
                          <>
                            <Download size={15} /> Install app
                          </>
                        )}
                      </button>
                    </section>
                    {settingsError && (
                      <p className="settings-error" role="alert">
                        {settingsError}
                      </p>
                    )}
                    <div className="settings-panel-actions">
                      <span className="settings-action-hint">
                        Your saved values will be used on the next page update.
                      </span>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={
                          settingsSaving ||
                          JSON.stringify(shopSettings) ===
                            JSON.stringify(savedShopSettings)
                        }
                      >
                        {settingsSaving ? (
                          "Saving…"
                        ) : (
                          <>
                            <Check size={15} /> Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}

                {settingsSection === "Account & Security" && (
                  <div className="settings-panel">
                    <div className="settings-panel-heading">
                      <span className="settings-panel-icon">
                        <KeyRound size={17} />
                      </span>
                      <div>
                        <h3 id="settings-section-title">Account & Security</h3>
                        <p>
                          Review the account signed in to this shop and manage
                          its password.
                        </p>
                      </div>
                    </div>
                    <div className="settings-account-card">
                      <span className="settings-account-avatar">
                        <UserRound size={18} />
                      </span>
                      <div>
                        <strong>{ownerDisplayName}</strong>
                        <span>{authSession?.user.email}</span>
                      </div>
                      <span className="settings-account-role">
                        {workspaceUserRole || "Signed in"}
                      </span>
                    </div>
                    {supabase && authSession ? (
                      <form
                        className="settings-security-form"
                        onSubmit={updateAccountPassword}
                      >
                        <div>
                          <h4>Change password</h4>
                          <p>
                            Use at least 12 characters and choose a password you
                            do not use elsewhere.
                          </p>
                        </div>
                        <div className="settings-fields-grid">
                          <label>
                            New password
                            <input
                              autoComplete="new-password"
                              minLength={12}
                              type="password"
                              value={accountPassword}
                              onChange={(event) =>
                                setAccountPassword(event.target.value)
                              }
                              required
                            />
                          </label>
                          <label>
                            Confirm new password
                            <input
                              autoComplete="new-password"
                              minLength={12}
                              type="password"
                              value={accountPasswordConfirmation}
                              onChange={(event) =>
                                setAccountPasswordConfirmation(
                                  event.target.value,
                                )
                              }
                              required
                            />
                          </label>
                        </div>
                        {accountPasswordError && (
                          <p className="settings-error" role="alert">
                            {accountPasswordError}
                          </p>
                        )}
                        <div className="settings-panel-actions">
                          <span className="settings-action-hint">
                            Password changes apply to this signed-in account.
                          </span>
                          <button
                            className="primary-button"
                            type="submit"
                            disabled={accountPasswordBusy}
                          >
                            {accountPasswordBusy ? (
                              "Updating…"
                            ) : (
                              <>
                                <KeyRound size={14} /> Update Password
                              </>
                            )}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="settings-info-note">
                        <CircleHelp size={16} />
                        <p>Sign in to a shop account to manage its password.</p>
                      </div>
                    )}
                    {supabase && authSession && (
                      <div className="settings-data-row settings-danger-row">
                        <div>
                          <strong>Log out of this account</strong>
                          <p>
                            Sign out of this shop account on this device.
                          </p>
                        </div>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => void signOut()}
                        >
                          <LogOut size={14} />
                          Log out
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {settingsSection === "Data & Privacy" && (
                  <div className="settings-panel">
                    <div className="settings-panel-heading">
                      <span className="settings-panel-icon">
                        <CircleHelp size={17} />
                      </span>
                      <div>
                        <h3 id="settings-section-title">Data & Privacy</h3>
                        <p>
                          Download a copy of your workspace or restore settings
                          to their defaults.
                        </p>
                      </div>
                    </div>
                    <div className="settings-data-row">
                      <div>
                        <strong>Export workspace data</strong>
                        <p>
                          Download the currently loaded shop records, settings,
                          and activity history as a JSON file. Photo files are
                          not included.
                        </p>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={exportWorkspaceData}
                      >
                        <Download size={14} /> Download data
                      </button>
                    </div>
                    <div className="settings-data-row settings-danger-row">
                      <div>
                        <strong>Reset shop settings</strong>
                        <p>
                          Restore shop profile, notification, and preference
                          values. This does not delete customers, orders, or
                          payments.
                        </p>
                      </div>
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={resetShopSettings}
                      >
                        <Trash2 size={14} /> Reset settings
                      </button>
                    </div>
                    {settingsError && (
                      <p className="settings-error" role="alert">
                        {settingsError}
                      </p>
                    )}
                    <div className="settings-storage-note">
                      <span className="settings-storage-dot" />
                      <p>
                        Your shop records are loaded from your Supabase
                        workspace. Changes to settings are saved to your
                        account.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </section>
        ) : activePage === "Reports" ? (
          <section className="reports-page" aria-label="Business reports">
            <div className="reports-page-heading">
              <div>
                <p>A clear view of orders, revenue, and payments.</p>
              </div>
              <button
                className="primary-button report-export-button"
                type="button"
                onClick={exportReport}
              >
                <Download size={15} /> Export CSV
              </button>
            </div>

            <div
              className="order-stats-grid report-stats"
              aria-label="Report summary"
            >
              <article className="order-stat-card">
                <span>Order Value</span>
                <strong>{formatCurrency(reportOrderValue)}</strong>
                <small>
                  {reportPeriodOrders.length} orders placed in period
                </small>
              </article>
              <article className="order-stat-card">
                <span>Payments Collected</span>
                <strong>{formatCurrency(reportCollected)}</strong>
                <small>Confirmed receipts in period</small>
              </article>
              <article className="order-stat-card">
                <span>Outstanding</span>
                <strong>{formatCurrency(reportOutstanding)}</strong>
                <small>Remaining balance on period orders</small>
              </article>
              <article className="order-stat-card">
                <span>Average Order</span>
                <strong>{formatCurrency(reportAverageOrder)}</strong>
                <small>Average value of period orders</small>
              </article>
            </div>

            <div className="report-filter-bar">
              <label className="orders-status-filter report-period-select">
                <span>Report period</span>
                <select
                  value={reportPeriod}
                  onChange={(event) =>
                    setReportPeriod(event.target.value as typeof reportPeriod)
                  }
                >
                  <option>This Month</option>
                  <option>Last Month</option>
                  <option>Last 30 Days</option>
                  <option>This Year</option>
                  <option>All Time</option>
                  <option>Custom</option>
                </select>
                <ChevronDown size={14} />
              </label>
              {reportPeriod === "Custom" && (
                <div className="report-custom-dates">
                  <label>
                    From
                    <input
                      type="date"
                      value={reportStartDate}
                      max={reportEndDate || undefined}
                      onChange={(event) =>
                        setReportStartDate(event.target.value)
                      }
                    />
                  </label>
                  <label>
                    To
                    <input
                      type="date"
                      value={reportEndDate}
                      min={reportStartDate || undefined}
                      onChange={(event) => setReportEndDate(event.target.value)}
                    />
                  </label>
                </div>
              )}
              <p>
                {reportPeriod === "All Time"
                  ? "Showing all recorded orders and receipts."
                  : `Orders are grouped by order creation date; revenue uses confirmed receipt dates.${reportStart && reportEnd ? ` ${reportStart} to ${reportEnd}.` : ""}`}
              </p>
            </div>
            {!reportRangeValid && (
              <p className="report-range-error" role="alert">
                The start date must be on or before the end date.
              </p>
            )}

            <div className="report-breakdown-grid">
              <article className="panel report-breakdown-panel">
                <div className="orders-page-heading">
                  <div>
                    <h2>Orders by Status</h2>
                    <p>Workflow for orders placed in this period</p>
                  </div>
                </div>
                <div className="report-status-list">
                  {reportStatusRows.map((row) => (
                    <div className="report-status-row" key={row.label}>
                      <span className={`legend-dot ${row.color}`} />
                      <span className="report-status-label">{row.label}</span>
                      <span className="report-status-track">
                        <i
                          className={row.color}
                          style={{
                            width: `${reportPeriodOrders.length ? (row.count / reportPeriodOrders.length) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <strong>{row.count}</strong>
                    </div>
                  ))}
                  {reportPeriodOrders.length === 0 && (
                    <p className="report-empty-note">
                      No orders were placed in this period.
                    </p>
                  )}
                </div>
              </article>

              <article className="panel report-breakdown-panel">
                <div className="orders-page-heading">
                  <div>
                    <h2>Payments by Method</h2>
                    <p>Confirmed receipts in this period</p>
                  </div>
                </div>
                <div className="report-method-list">
                  {reportPaymentMethods.map(({ method, amount }) => (
                    <div className="report-method-row" key={method}>
                      <div>
                        <span>{method}</span>
                        <strong>{formatCurrency(amount)}</strong>
                      </div>
                      <span className="report-method-track">
                        <i
                          style={{
                            width: `${reportCollected ? (amount / reportCollected) * 100 : 0}%`,
                          }}
                        />
                      </span>
                    </div>
                  ))}
                  {reportCollected === 0 && (
                    <p className="report-empty-note">
                      No confirmed receipts in this period.
                    </p>
                  )}
                </div>
              </article>

              <article className="panel report-breakdown-panel report-garments-panel">
                <div className="orders-page-heading">
                  <div>
                    <h2>Top Designs</h2>
                    <p>Highest order value in this period</p>
                  </div>
                </div>
                <div className="report-garment-list">
                  {reportGarmentRows.map((row, index) => (
                    <div className="report-garment-row" key={row.item}>
                      <span className="report-garment-rank">{index + 1}</span>
                      <div>
                        <strong>{row.item}</strong>
                        <small>
                          {row.count} {row.count === 1 ? "order" : "orders"}
                        </small>
                      </div>
                      <b>{formatCurrency(row.amount)}</b>
                    </div>
                  ))}
                  {reportGarmentRows.length === 0 && (
                    <p className="report-empty-note">
                      No design data for this period.
                    </p>
                  )}
                </div>
              </article>
            </div>

            <article className="panel report-orders-panel">
              <div className="orders-page-heading report-orders-heading">
                <div>
                  <h2>Order Performance</h2>
                  <p>Order totals compared with lifetime payments received.</p>
                </div>
                <span>{reportOrderRows.length} orders</span>
              </div>
              <div className="report-toolbar">
                <label className="orders-search">
                  <Search size={15} aria-hidden="true" />
                  <input
                    aria-label="Search report orders"
                    placeholder="Search orders, customers or designs"
                    value={reportSearch}
                    onChange={(event) => setReportSearch(event.target.value)}
                  />
                  {reportSearch && (
                    <button
                      type="button"
                      aria-label="Clear report search"
                      onClick={() => setReportSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>
                <label className="orders-status-filter">
                  <span className="sr-only">Report order status</span>
                  <select
                    value={reportStatusFilter}
                    onChange={(event) =>
                      setReportStatusFilter(event.target.value)
                    }
                  >
                    <option>All Statuses</option>
                    <option>Pending</option>
                    <option>Cutting</option>
                    <option>Sewing</option>
                    <option>Fitting</option>
                    <option>Completed</option>
                    <option>Delivered</option>
                  </select>
                  <ChevronDown size={14} />
                </label>
              </div>
              <div className="table-wrap report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Design</th>
                      <th>Delivery</th>
                      <th>Order Value</th>
                      <th>Received</th>
                      <th>Balance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportOrderRows.map((order) => {
                      const received =
                        payments.find((payment) => payment.orderId === order.id)
                          ?.paid ?? 0;
                      return (
                        <tr key={order.id}>
                          <td>
                            <span className="payment-id">{order.id}</span>
                          </td>
                          <td>{order.customer}</td>
                          <td>{order.item}</td>
                          <td>{order.date}</td>
                          <td>{formatCurrency(order.amount)}</td>
                          <td>{formatCurrency(received)}</td>
                          <td
                            className={
                              received < order.amount
                                ? "payment-balance"
                                : "payment-settled"
                            }
                          >
                            {formatCurrency(
                              Math.max(0, order.amount - received),
                            )}
                          </td>
                          <td>
                            <span
                              className={`order-status ${order.status.toLowerCase()}`}
                            >
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {reportOrderRows.length === 0 && (
                      <tr>
                        <td className="empty-state" colSpan={8}>
                          {reportRangeValid
                            ? "No orders match your date, search, or status filters."
                            : "Correct the report date range to see matching orders."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : activePage === "Payments" ? (
          <section className="payment-page" aria-label="Payment management">
            <div className="payment-page-heading">
              <div>
                <p>Track customer payments and outstanding balances.</p>
              </div>
              <button
                className="primary-button payment-add-button"
                type="button"
                onClick={() => openPaymentForm()}
              >
                <Plus size={15} /> Record Payment
              </button>
            </div>

            <div
              className="order-stats-grid payment-stats"
              aria-label="Payment summary"
            >
              <article className="order-stat-card">
                <span>Total Received</span>
                <strong>{formatCurrency(totalPaymentsReceived)}</strong>
                <small>
                  {formatCurrency(receivedThisMonth)} collected this month
                </small>
              </article>
              <article className="order-stat-card">
                <span>Outstanding</span>
                <strong>{formatCurrency(totalPaymentsOutstanding)}</strong>
                <small>Remaining balances</small>
              </article>
              <article className="order-stat-card">
                <span>Paid in Full</span>
                <strong>{fullyPaidCount}</strong>
                <small>of {payments.length} orders settled</small>
              </article>
              <article className="order-stat-card">
                <span>Awaiting Payment</span>
                <strong>{pendingPaymentCount}</strong>
                <small>
                  {
                    payments.filter(
                      (payment) => paymentStatus(payment) === "Partially Paid",
                    ).length
                  }{" "}
                  partially paid orders
                </small>
              </article>
            </div>

            <div className="payment-toolbar">
              <label className="orders-search">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search payments"
                  placeholder="Search customer, order, payment or reference"
                  value={paymentSearch}
                  onChange={(event) => setPaymentSearch(event.target.value)}
                />
                {paymentSearch && (
                  <button
                    type="button"
                    aria-label="Clear payment search"
                    onClick={() => setPaymentSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <label className="orders-status-filter">
                <span className="sr-only">Order payment status</span>
                <select
                  value={paymentStatusFilter}
                  onChange={(event) =>
                    setPaymentStatusFilter(event.target.value)
                  }
                >
                  <option>All Statuses</option>
                  <option>Paid</option>
                  <option>Partially Paid</option>
                  <option>Pending</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="orders-status-filter payment-method-filter">
                <span className="sr-only">Payment method</span>
                <select
                  value={paymentMethodFilter}
                  onChange={(event) =>
                    setPaymentMethodFilter(event.target.value)
                  }
                >
                  <option>All Methods</option>
                  <option>Cash</option>
                  <option>Mobile Money</option>
                  <option>Bank Transfer</option>
                  <option>Other</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="orders-status-filter payment-period-filter">
                <span className="sr-only">Payment date range</span>
                <select
                  value={paymentPeriodFilter}
                  onChange={(event) =>
                    setPaymentPeriodFilter(event.target.value)
                  }
                >
                  <option>All Dates</option>
                  <option>This month</option>
                  <option>Last month</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <span className="orders-result-count">
                {visiblePayments.length} balances ·{" "}
                {visiblePaymentTransactions.length} receipts
              </span>
              {(paymentSearch ||
                paymentStatusFilter !== "All Statuses" ||
                paymentMethodFilter !== "All Methods" ||
                paymentPeriodFilter !== "All Dates") && (
                <button
                  className="payment-clear-filters"
                  type="button"
                  onClick={() => {
                    setPaymentSearch("");
                    setPaymentStatusFilter("All Statuses");
                    setPaymentMethodFilter("All Methods");
                    setPaymentPeriodFilter("All Dates");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            <article className="panel payment-list-panel">
              <div className="orders-page-heading">
                <div>
                  <h2>Order balances</h2>
                  <p>
                    Track totals, payments received, and what each customer
                    still owes.
                  </p>
                </div>
                <span>
                  {formatCurrency(totalPaymentsOutstanding)} outstanding
                </span>
              </div>
              <div className="table-wrap payment-table-wrap">
                <table className="payment-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Garment</th>
                      <th>Order Total</th>
                      <th>Received</th>
                      <th>Balance</th>
                      <th>Last Payment</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePayments.map((payment) => {
                      const balance = Math.max(0, payment.total - payment.paid);
                      const status = paymentStatus(payment);
                      return (
                        <tr
                          id={`payments-record-${payment.id}`}
                          className={
                            highlightedRecord?.page === "Payments" &&
                            highlightedRecord.id === payment.id
                              ? "record-target-highlight"
                              : undefined
                          }
                          key={payment.id}
                        >
                          <td>
                            <span className="payment-id">
                              {payment.orderId}
                            </span>
                          </td>
                          <td>{payment.customer}</td>
                          <td>
                            {orders.find(
                              (record) => record.id === payment.orderId,
                            )?.item ?? "Custom garment"}
                          </td>
                          <td>{formatCurrency(payment.total)}</td>
                          <td>{formatCurrency(payment.paid)}</td>
                          <td
                            className={
                              balance ? "payment-balance" : "payment-settled"
                            }
                          >
                            {formatCurrency(balance)}
                          </td>
                          <td>
                            <div className="payment-method-cell">
                              <strong>{payment.method}</strong>
                              <small>{payment.date}</small>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`payment-status ${status.toLowerCase().replace(" ", "-")}`}
                            >
                              {status}
                            </span>
                          </td>
                          <td>
                            <button
                              className="payment-record-button"
                              type="button"
                              disabled={!balance}
                              onClick={() => openPaymentForm(payment)}
                            >
                              {balance ? "Record payment" : "Settled"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {visiblePayments.length === 0 && (
                      <tr>
                        <td className="empty-state" colSpan={9}>
                          No order balances match your search or status filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="panel payment-history-panel">
              <div className="orders-page-heading payment-history-heading">
                <div>
                  <h2>Payment history</h2>
                  <p>
                    Every recorded receipt, method, date, and reference in one
                    place.
                  </p>
                </div>
                <div>
                  <span>{visiblePaymentTransactions.length} receipts</span>
                  <button
                    className="secondary-button payment-export-button"
                    type="button"
                    disabled={!visiblePaymentTransactions.length}
                    onClick={exportPaymentHistory}
                  >
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </div>
              <div
                className="payment-method-breakdown"
                aria-label="Confirmed payments by method"
              >
                {paymentMethodTotals.map(({ method, amount }) => {
                  const share = totalPaymentsReceived
                    ? (amount / totalPaymentsReceived) * 100
                    : 0;
                  return (
                    <div className="payment-method-summary" key={method}>
                      <div>
                        <span>{method}</span>
                        <strong>{formatCurrency(amount)}</strong>
                      </div>
                      <span className="payment-method-track">
                        <i style={{ width: `${share}%` }} />
                      </span>
                      <small>{share.toFixed(0)}% of received payments</small>
                    </div>
                  );
                })}
              </div>
              <div className="table-wrap payment-table-wrap">
                <table className="payment-table payment-history-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Receipt</th>
                      <th>Order / Customer</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference</th>
                      <th>Recorded By</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePaymentTransactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>
                          <time>
                            {transaction.date
                              ? new Date(transaction.date).toLocaleDateString(
                                  "en-GB",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )
                              : "—"}
                          </time>
                        </td>
                        <td>
                          <span className="payment-id">
                            {transaction.id.startsWith("PAY-")
                              ? transaction.id
                              : `PAY-${transaction.id.slice(0, 8).toUpperCase()}`}
                          </span>
                        </td>
                        <td>
                          <div className="payment-customer-cell">
                            <button
                              type="button"
                              className="payment-order-link"
                              onClick={() => {
                                const order = orders.find(
                                  (record) =>
                                    record.id === transaction.orderId ||
                                    record.dbId === transaction.orderUuid,
                                );
                                if (order) openRecord("Orders", order.id);
                              }}
                            >
                              {transaction.orderId}
                            </button>
                            <small>{transaction.customer}</small>
                          </div>
                        </td>
                        <td className="payment-history-amount">
                          {formatCurrency(transaction.amount)}
                        </td>
                        <td>{transaction.method}</td>
                        <td>{transaction.reference || "—"}</td>
                        <td>{transaction.recordedBy}</td>
                        <td>
                          <span
                            className={`payment-status ${transaction.status.toLowerCase()}`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {visiblePaymentTransactions.length === 0 && (
                      <tr>
                        <td className="empty-state" colSpan={8}>
                          No payment receipts match your search, method, or date
                          filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            {isPaymentFormOpen && (
              <div
                className="modal-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setIsPaymentFormOpen(false);
                    setPaymentFormError("");
                  }
                }}
              >
                <section
                  className="order-modal payment-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="payment-modal-title"
                >
                  <div className="modal-heading">
                    <div>
                      <span className="modal-kicker">PAYMENT RECORD</span>
                      <h2 id="payment-modal-title">Record Payment</h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Close dialog"
                      type="button"
                      onClick={() => {
                        setIsPaymentFormOpen(false);
                        setPaymentFormError("");
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={recordPayment}>
                    <label>
                      Order with outstanding balance
                      <select
                        className="form-select"
                        name="paymentId"
                        value={selectedPaymentId ?? ""}
                        onChange={(event) =>
                          setSelectedPaymentId(event.target.value)
                        }
                        required
                      >
                        <option value="" disabled>
                          Select an order
                        </option>
                        {payments
                          .filter((payment) => payment.paid < payment.total)
                          .map((payment) => (
                            <option key={payment.id} value={payment.id}>
                              {payment.orderId} · {payment.customer} ·{" "}
                              {formatCurrency(payment.total - payment.paid)} due
                            </option>
                          ))}
                      </select>
                    </label>
                    {selectedPayment && (
                      <div className="payment-form-order-summary">
                        <span>
                          {orders.find(
                            (order) => order.id === selectedPayment.orderId,
                          )?.item ?? "Custom garment"}
                        </span>
                        <span>
                          Order total{" "}
                          <strong>
                            {formatCurrency(selectedPayment.total)}
                          </strong>
                        </span>
                        <span>
                          Already received{" "}
                          <strong>
                            {formatCurrency(selectedPayment.paid)}
                          </strong>
                        </span>
                        <span>
                          Balance due{" "}
                          <strong>
                            {formatCurrency(
                              selectedPayment.total - selectedPayment.paid,
                            )}
                          </strong>
                        </span>
                      </div>
                    )}
                    <label>
                      Amount received (
                      {shopSettings.currency === "GHS" ? "GH₵" : "$"})
                      <input
                        autoFocus
                        name="amount"
                        type="number"
                        min="0.01"
                        max={
                          selectedPayment
                            ? selectedPayment.total - selectedPayment.paid
                            : undefined
                        }
                        step="0.01"
                        placeholder="0.00"
                        required
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        Payment method
                        <select className="form-select" name="method">
                          <option>Mobile Money</option>
                          <option>Cash</option>
                          <option>Bank Transfer</option>
                          <option>Other</option>
                        </select>
                      </label>
                      <label>
                        Payment date
                        <input
                          name="date"
                          type="date"
                          defaultValue={dateKey(new Date())}
                          required
                        />
                      </label>
                    </div>
                    <label>
                      Transaction reference{" "}
                      <small>
                        Optional · include a mobile money or bank reference
                      </small>
                      <input
                        name="reference"
                        maxLength={120}
                        placeholder="e.g. MOMO-123456"
                      />
                    </label>
                    {paymentFormError && (
                      <p className="payment-form-error" role="alert">
                        {paymentFormError}
                      </p>
                    )}
                    {!payments.some(
                      (payment) => payment.paid < payment.total,
                    ) && (
                      <p className="payment-form-empty">
                        There are no outstanding order balances to collect.
                      </p>
                    )}
                    <div className="modal-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setIsPaymentFormOpen(false);
                          setPaymentFormError("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={
                          paymentFormBusy ||
                          !payments.some(
                            (payment) => payment.paid < payment.total,
                          )
                        }
                      >
                        <Check size={15} />{" "}
                        {paymentFormBusy ? "Saving payment…" : "Save Payment"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </section>
        ) : activePage === "Tasks" ? (
          <section className="task-page" aria-label="Task management">
            <div className="task-page-heading">
              <div>
                <p>Keep orders moving and your atelier in sync.</p>
              </div>
              <button
                className="primary-button task-add-button"
                type="button"
                onClick={() => {
                  setTaskOrderPrefill("");
                  setTaskAssigneePrefill("");
                  setIsTaskFormOpen(true);
                }}
              >
                <Plus size={15} /> Add Task
              </button>
            </div>

            <div
              className="order-stats-grid task-stats"
              aria-label="Task summary"
            >
              <article className="order-stat-card">
                <span>All Tasks</span>
                <strong>{tasks.length}</strong>
                <small>Across all orders</small>
              </article>
              <article className="order-stat-card">
                <span>To Do</span>
                <strong>{todoTaskCount}</strong>
                <small>Waiting to start</small>
              </article>
              <article className="order-stat-card">
                <span>In Progress</span>
                <strong>{inProgressTaskCount}</strong>
                <small>{reviewTaskCount} ready for review</small>
              </article>
              <article className="order-stat-card">
                <span>Overdue</span>
                <strong>{overdueTaskCount}</strong>
                <small>{doneTaskCount} completed</small>
              </article>
            </div>

            <div className="task-toolbar">
              <label className="orders-search">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search tasks"
                  placeholder="Search task, order or assignee"
                  value={taskSearch}
                  onChange={(event) => setTaskSearch(event.target.value)}
                />
                {taskSearch && (
                  <button
                    type="button"
                    aria-label="Clear task search"
                    onClick={() => setTaskSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <label className="orders-status-filter">
                <span className="sr-only">Task status</span>
                <select
                  value={taskStatusFilter}
                  onChange={(event) => setTaskStatusFilter(event.target.value)}
                >
                  <option>All Statuses</option>
                  {taskStatusColumns.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="orders-status-filter task-priority-filter">
                <span className="sr-only">Task priority</span>
                <select
                  value={taskPriorityFilter}
                  onChange={(event) =>
                    setTaskPriorityFilter(event.target.value)
                  }
                >
                  <option>All Priorities</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="orders-status-filter task-apprentice-filter">
                <span className="sr-only">Assigned apprentice</span>
                <select
                  value={taskAssigneeFilter}
                  onChange={(event) =>
                    setTaskAssigneeFilter(event.target.value)
                  }
                >
                  <option>All Apprentices</option>
                  {apprentices.map((apprentice) => (
                    <option
                      key={apprentice.id}
                      value={
                        isSupabaseConfigured
                          ? apprentice.userId
                          : apprentice.name
                      }
                    >
                      {apprentice.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="orders-status-filter task-due-filter">
                <span className="sr-only">Task due date</span>
                <select
                  value={taskDueFilter}
                  onChange={(event) => setTaskDueFilter(event.target.value)}
                >
                  <option>All Due Dates</option>
                  <option>Overdue</option>
                  <option>Due in 7 days</option>
                  <option>No due date</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <div
                className="task-view-toggle"
                role="group"
                aria-label="Task view"
              >
                <button
                  type="button"
                  className={taskView === "board" ? "selected" : ""}
                  aria-pressed={taskView === "board"}
                  onClick={() => setTaskView("board")}
                >
                  <Grid2X2 size={14} /> Board
                </button>
                <button
                  type="button"
                  className={taskView === "list" ? "selected" : ""}
                  aria-pressed={taskView === "list"}
                  onClick={() => setTaskView("list")}
                >
                  <List size={14} /> List
                </button>
              </div>
              <span className="orders-result-count">
                {visibleTasks.length}{" "}
                {visibleTasks.length === 1 ? "task" : "tasks"}
              </span>
              {(taskSearch ||
                taskStatusFilter !== "All Statuses" ||
                taskPriorityFilter !== "All Priorities" ||
                taskAssigneeFilter !== "All Apprentices" ||
                taskDueFilter !== "All Due Dates") && (
                <button
                  className="task-clear-filters"
                  type="button"
                  onClick={() => {
                    setTaskSearch("");
                    setTaskStatusFilter("All Statuses");
                    setTaskPriorityFilter("All Priorities");
                    setTaskAssigneeFilter("All Apprentices");
                    setTaskDueFilter("All Due Dates");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            <section
              className="task-workload-panel"
              aria-label="Apprentice task workload"
            >
              <div className="task-workload-heading">
                <div>
                  <h2>Apprentice workload</h2>
                  <p>Active assignments and overdue work</p>
                </div>
                <button
                  type="button"
                  className={
                    taskAssigneeFilter === "All Apprentices" ? "selected" : ""
                  }
                  onClick={() => setTaskAssigneeFilter("All Apprentices")}
                >
                  All team
                </button>
              </div>
              <div className="task-workload-list">
                {apprentices.map((apprentice) => {
                  const apprenticeTasks = tasks.filter((task) =>
                    isTaskAssignedToApprentice(task, apprentice),
                  );
                  const activeCount = apprenticeTasks.filter(
                    (task) => task.status !== "Done",
                  ).length;
                  const overdueCount =
                    apprenticeTasks.filter(taskIsOverdue).length;
                  const filterValue = isSupabaseConfigured
                    ? (apprentice.userId ?? "")
                    : apprentice.name;
                  return (
                    <button
                      key={apprentice.id}
                      type="button"
                      className={`task-workload-card${taskAssigneeFilter === filterValue ? " selected" : ""}`}
                      aria-pressed={taskAssigneeFilter === filterValue}
                      onClick={() => setTaskAssigneeFilter(filterValue)}
                    >
                      <span className="task-workload-avatar">
                        {apprentice.name
                          .split(/\s+/)
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span className="task-workload-name">
                        <strong>{apprentice.name}</strong>
                        <small>
                          {activeCount} active ·{" "}
                          {
                            apprenticeTasks.filter(
                              (task) => task.status === "Review",
                            ).length
                          }{" "}
                          in review
                        </small>
                      </span>
                      <span
                        className={
                          overdueCount
                            ? "task-workload-overdue"
                            : "task-workload-due"
                        }
                      >
                        {overdueCount
                          ? `${overdueCount} overdue`
                          : `${activeCount} active`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {taskView === "board" ? (
              <section
                className="task-board"
                aria-label="Tasks grouped by status"
              >
                {taskStatusColumns.map((status) => {
                  const columnTasks = visibleTasks.filter(
                    (task) => task.status === status,
                  );
                  return (
                    <article
                      className={`task-board-column status-${status.toLowerCase().replaceAll(" ", "-")}`}
                      key={status}
                    >
                      <div className="task-board-column-heading">
                        <h2>{status}</h2>
                        <span>{columnTasks.length}</span>
                      </div>
                      <div className="task-board-cards">
                        {columnTasks.map((task) => {
                          const checklistDone = task.checklist.filter(
                            (item) => item.completed,
                          ).length;
                          return (
                            <article className="task-board-card" key={task.id}>
                              <div className="task-board-card-top">
                                <span
                                  className={`task-priority ${task.priority.toLowerCase()}`}
                                >
                                  {task.priority}
                                </span>
                                {taskIsOverdue(task) && (
                                  <span className="task-board-overdue">
                                    Overdue
                                  </span>
                                )}
                              </div>
                              <button
                                className="task-board-title"
                                type="button"
                                onClick={() => setSelectedTaskId(task.id)}
                              >
                                {task.title}
                              </button>
                              {task.description && <p>{task.description}</p>}
                              <div className="task-board-card-meta">
                                <span>
                                  <UserRound size={13} /> {task.assignee}
                                </span>
                                <span>
                                  <CalendarClock size={13} />{" "}
                                  {task.dueDate
                                    ? new Date(
                                        `${task.dueDate}T00:00:00`,
                                      ).toLocaleDateString("en-GB", {
                                        day: "2-digit",
                                        month: "short",
                                      })
                                    : "No due date"}
                                </span>
                              </div>
                              <div className="task-board-card-footer">
                                <span>{task.orderId || "General task"}</span>
                                {task.checklist.length > 0 && (
                                  <span>
                                    <Check size={12} /> {checklistDone}/
                                    {task.checklist.length}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSelectedTaskId(task.id)}
                                >
                                  Details
                                </button>
                              </div>
                            </article>
                          );
                        })}
                        {columnTasks.length === 0 && (
                          <p className="task-board-empty">No tasks</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
            ) : (
              <article className="panel task-list-panel">
                <div className="orders-page-heading">
                  <div>
                    <h2>Task list</h2>
                    <p>Work assigned across orders and the atelier.</p>
                  </div>
                </div>
                <div className="table-wrap task-table-wrap">
                  <table className="task-table">
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Assigned To</th>
                        <th>Order</th>
                        <th>Due Date</th>
                        <th>Priority</th>
                        <th>Status</th>
                        <th>Latest activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTasks.map((task) => {
                        const isOverdue = taskIsOverdue(task);
                        const latestUpdate = taskTimeline(task)[0];
                        return (
                          <tr
                            id={`tasks-record-${task.id}`}
                            className={
                              highlightedRecord?.page === "Tasks" &&
                              highlightedRecord.id === task.id
                                ? "record-target-highlight"
                                : undefined
                            }
                            key={task.id}
                          >
                            <td>
                              <div className="task-title-cell">
                                <button
                                  type="button"
                                  onClick={() => setSelectedTaskId(task.id)}
                                >
                                  {task.title}
                                </button>
                                <small>{task.id}</small>
                              </div>
                            </td>
                            <td>{task.assignee}</td>
                            <td>{task.orderId || "General"}</td>
                            <td>
                              <time className={isOverdue ? "task-overdue" : ""}>
                                {task.dueDate
                                  ? new Date(
                                      `${task.dueDate}T00:00:00`,
                                    ).toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                    })
                                  : "Not set"}
                                {isOverdue && <span>Overdue</span>}
                              </time>
                            </td>
                            <td>
                              <span
                                className={`task-priority ${task.priority.toLowerCase()}`}
                              >
                                {task.priority}
                              </span>
                            </td>
                            <td>
                              <select
                                className={`task-status-select ${task.status.toLowerCase().replaceAll(" ", "-")}`}
                                aria-label={`Status for ${task.title}`}
                                value={task.status}
                                onChange={(event) =>
                                  updateTaskStatus(
                                    task.id,
                                    event.target.value as TaskStatus,
                                  )
                                }
                              >
                                <option>To do</option>
                                <option>Accepted</option>
                                <option>In progress</option>
                                <option>Review</option>
                                <option>Revision requested</option>
                                <option>Done</option>
                              </select>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="task-row-activity"
                                onClick={() => setSelectedTaskId(task.id)}
                              >
                                {latestUpdate ? (
                                  <>
                                    <strong>{latestUpdate.newStatus}</strong>
                                    <small>
                                      {latestUpdate.comment ||
                                        latestUpdate.actor}
                                    </small>
                                  </>
                                ) : (
                                  <span>No progress update yet</span>
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {visibleTasks.length === 0 && (
                        <tr>
                          <td className="empty-state" colSpan={7}>
                            No tasks match your search or filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            )}

            {selectedTask && (
              <div
                className="modal-backdrop task-detail-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedTaskId(null);
                    setTaskReviewDecision(null);
                    setTaskReviewFeedback("");
                  }
                }}
              >
                <section
                  className="order-modal task-detail-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="task-detail-title"
                >
                  <div className="modal-heading">
                    <div>
                      <span className="modal-kicker">
                        {selectedTask.id} · {selectedTask.assignee}
                      </span>
                      <h2 id="task-detail-title">{selectedTask.title}</h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Close task details"
                      type="button"
                      onClick={() => {
                        setSelectedTaskId(null);
                        setTaskReviewDecision(null);
                        setTaskReviewFeedback("");
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="task-detail-meta">
                    <span
                      className={`task-detail-status ${selectedTask.status.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {selectedTask.status}
                    </span>
                    <span
                      className={`task-priority ${selectedTask.priority.toLowerCase()}`}
                    >
                      {selectedTask.priority} priority
                    </span>
                    <span>
                      <CalendarClock size={14} />{" "}
                      {selectedTask.dueDate
                        ? new Date(
                            `${selectedTask.dueDate}T00:00:00`,
                          ).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "No due date"}
                      {taskIsOverdue(selectedTask) ? " · Overdue" : ""}
                    </span>
                    {selectedTask.orderId ? (
                      <button
                        type="button"
                        className="task-detail-order-link"
                        onClick={() => {
                          const order = orders.find(
                            (entry) => entry.id === selectedTask.orderId,
                          );
                          if (order) {
                            setSelectedTaskId(null);
                            openRecord("Orders", order.id);
                          }
                        }}
                      >
                        {selectedTask.orderId}
                      </button>
                    ) : (
                      <span>General task</span>
                    )}
                  </div>
                  <section className="task-detail-section">
                    <h3>Work instructions</h3>
                    <p>
                      {selectedTask.description ||
                        "No additional instructions were provided."}
                    </p>
                  </section>
                  {selectedTask.referencePhotos &&
                    selectedTask.referencePhotos.length > 0 && (
                      <section className="task-detail-section">
                        <div className="task-detail-section-heading">
                          <div>
                            <h3>Garment & style references</h3>
                            <p>
                              Photos from the linked order’s latest matching
                              measurement record
                            </p>
                          </div>
                          <span>
                            {selectedTask.referencePhotos.length} photos
                          </span>
                        </div>
                        <div className="task-reference-photos">
                          {selectedTask.referencePhotos.map((photo, index) => (
                            <a
                              key={`${photo.kind}-${index}`}
                              href={photo.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img src={photo.url} alt={photo.caption} />
                              <span>{photo.caption}</span>
                            </a>
                          ))}
                        </div>
                      </section>
                    )}
                  <section className="task-detail-section">
                    <div className="task-detail-section-heading">
                      <div>
                        <h3>Checklist</h3>
                        <p>
                          {
                            selectedTask.checklist.filter(
                              (item) => item.completed,
                            ).length
                          }{" "}
                          of {selectedTask.checklist.length} complete
                        </p>
                      </div>
                      <span>
                        {selectedTask.checklist.length
                          ? `${Math.round((selectedTask.checklist.filter((item) => item.completed).length / selectedTask.checklist.length) * 100)}%`
                          : "—"}
                      </span>
                    </div>
                    {selectedTask.checklist.length ? (
                      <ul className="task-detail-checklist">
                        {selectedTask.checklist.map((item) => (
                          <li key={item.id}>
                            <label>
                              <input
                                type="checkbox"
                                checked={item.completed}
                                disabled={taskChecklistBusy}
                                onChange={(event) =>
                                  void updateTaskChecklist(
                                    selectedTask,
                                    item.id,
                                    event.target.checked,
                                  )
                                }
                              />
                              <span
                                className={item.completed ? "completed" : ""}
                              >
                                {item.label}
                              </span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="task-detail-empty">
                        No checklist was added to this task.
                      </p>
                    )}
                  </section>
                  <section className="task-detail-section">
                    <div className="task-detail-section-heading">
                      <div>
                        <h3>Progress timeline</h3>
                        <p>Task and checklist activity</p>
                      </div>
                      <span>{taskTimeline(selectedTask).length} updates</span>
                    </div>
                    {taskTimeline(selectedTask).length ? (
                      <ol className="task-timeline">
                        {taskTimeline(selectedTask).map((update) => (
                          <li key={update.id}>
                            <span className="task-timeline-dot" />
                            <div>
                              <strong>
                                {update.newStatus === update.previousStatus
                                  ? "Checklist progress"
                                  : `${update.actor} · ${update.newStatus}`}
                              </strong>
                              <p>
                                {update.comment ||
                                  `${update.actor} updated the task`}
                              </p>
                              <time>
                                {new Date(update.createdAt).toLocaleString()}
                              </time>
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="task-detail-empty">
                        Progress and review updates will appear here.
                      </p>
                    )}
                  </section>
                  {selectedTask.status === "Review" && (
                    <section
                      className="task-review-panel"
                      aria-label="Review submitted work"
                    >
                      <h3>
                        <MessageSquareText size={16} /> Review submitted work
                      </h3>
                      {!taskReviewDecision ? (
                        <div className="task-review-actions">
                          <button
                            type="button"
                            className="primary-button"
                            onClick={() => setTaskReviewDecision("approved")}
                          >
                            <Check size={14} /> Approve work
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              setTaskReviewDecision("revision_required")
                            }
                          >
                            Request revision
                          </button>
                        </div>
                      ) : (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void completeTaskReview();
                          }}
                        >
                          <label>
                            {taskReviewDecision === "approved"
                              ? "Approval note (optional)"
                              : "Revision feedback"}
                            <textarea
                              value={taskReviewFeedback}
                              onChange={(event) =>
                                setTaskReviewFeedback(event.target.value)
                              }
                              maxLength={500}
                              placeholder={
                                taskReviewDecision === "approved"
                                  ? "Add a note for the apprentice"
                                  : "Explain what needs to be changed"
                              }
                              required={
                                taskReviewDecision === "revision_required"
                              }
                            />
                          </label>
                          <div className="task-review-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => {
                                setTaskReviewDecision(null);
                                setTaskReviewFeedback("");
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className="primary-button"
                              disabled={taskReviewBusy}
                            >
                              {taskReviewBusy
                                ? "Saving review…"
                                : taskReviewDecision === "approved"
                                  ? "Confirm approval"
                                  : "Send revision request"}
                            </button>
                          </div>
                        </form>
                      )}
                    </section>
                  )}
                  <div className="task-detail-footer">
                    <label>
                      Update task status
                      <select
                        className={`task-status-select ${selectedTask.status.toLowerCase().replaceAll(" ", "-")}`}
                        value={selectedTask.status}
                        onChange={(event) =>
                          void updateTaskStatus(
                            selectedTask.id,
                            event.target.value as TaskStatus,
                          )
                        }
                      >
                        <option>To do</option>
                        <option>Accepted</option>
                        <option>In progress</option>
                        <option>Review</option>
                        <option>Revision requested</option>
                        <option>Done</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setSelectedTaskId(null)}
                    >
                      Close details
                    </button>
                  </div>
                </section>
              </div>
            )}

            {isTaskFormOpen && (
              <div
                className="modal-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setIsTaskFormOpen(false);
                    setTaskOrderPrefill("");
                    setTaskAssigneePrefill("");
                  }
                }}
              >
                <section
                  className="order-modal task-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="task-modal-title"
                >
                  <div className="modal-heading">
                    <div>
                      <span className="modal-kicker">ATELIER WORKFLOW</span>
                      <h2 id="task-modal-title">Add Task</h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Close dialog"
                      type="button"
                      onClick={() => {
                        setIsTaskFormOpen(false);
                        setTaskOrderPrefill("");
                        setTaskAssigneePrefill("");
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={addTask}>
                    <label>
                      Start from a template
                      <select
                        className="form-select"
                        defaultValue=""
                        onChange={(event) => {
                          const template = taskTemplates.find(
                            (item) => item.name === event.currentTarget.value,
                          );
                          const form = event.currentTarget.form;
                          if (!template || !form) return;
                          const titleInput = form.elements.namedItem("title");
                          const instructionInput =
                            form.elements.namedItem("description");
                          const checklistInput =
                            form.elements.namedItem("checklist");
                          if (titleInput instanceof HTMLInputElement)
                            titleInput.value = template.title;
                          if (instructionInput instanceof HTMLTextAreaElement)
                            instructionInput.value = template.instructions;
                          if (checklistInput instanceof HTMLTextAreaElement)
                            checklistInput.value =
                              template.checklist.join("\n");
                        }}
                      >
                        <option value="">Choose a workflow template</option>
                        {taskTemplates.map((template) => (
                          <option key={template.name}>{template.name}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Task title
                      <input
                        autoFocus
                        name="title"
                        defaultValue={
                          taskOrderPrefill
                            ? `Follow up: ${orders.find((order) => order.id === taskOrderPrefill)?.item ?? "order"}`
                            : ""
                        }
                        placeholder="What needs to be done?"
                        required
                      />
                    </label>
                    <label>
                      Work instructions
                      <textarea
                        name="description"
                        maxLength={1000}
                        placeholder="Describe the expected result or important details"
                      />
                    </label>
                    <label>
                      Checklist{" "}
                      <small>One item per line, up to 20 items.</small>
                      <textarea
                        name="checklist"
                        rows={4}
                        maxLength={2400}
                        placeholder={
                          "Check seams and hems\nPress garment\nPrepare for supervisor review"
                        }
                      />
                    </label>
                    <label>
                      Assign to
                      <select
                        className="form-select"
                        name="assignee"
                        defaultValue={taskAssigneePrefill}
                        required
                      >
                        <option value="" disabled>
                          Select an apprentice
                        </option>
                        {apprentices.map((apprentice) => (
                          <option
                            key={apprentice.id}
                            value={
                              isSupabaseConfigured
                                ? apprentice.userId
                                : apprentice.name
                            }
                          >
                            {apprentice.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Related order
                      <select
                        className="form-select"
                        name="orderId"
                        defaultValue={taskOrderPrefill}
                      >
                        {" "}
                        <option value="">General task</option>
                        {orders.map((order) => (
                          <option key={order.id} value={order.id}>
                            {order.id} · {order.item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="form-row">
                      <label>
                        Due date
                        <input name="dueDate" type="date" required />
                      </label>
                      <label>
                        Priority
                        <select className="form-select" name="priority">
                          <option>Medium</option>
                          <option>High</option>
                          <option>Low</option>
                        </select>
                      </label>
                    </div>
                    <div className="modal-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setIsTaskFormOpen(false);
                          setTaskOrderPrefill("");
                          setTaskAssigneePrefill("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={taskFormBusy}
                      >
                        <Plus size={15} />{" "}
                        {taskFormBusy ? "Saving task…" : "Add Task"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </section>
        ) : activePage === "Apprentices" ? (
          <section
            className="apprentice-page"
            aria-label="Apprentice management"
          >
            <div className="apprentice-page-heading">
              <div>
                <span className="apprentice-page-kicker">TEAM DEVELOPMENT</span>
                <h2>Apprentices</h2>
                <p>Support your team’s growth and track training progress.</p>
              </div>
              <button
                className="primary-button"
                type="button"
                onClick={() => setIsApprenticeFormOpen(true)}
              >
                <Plus size={15} /> Add Apprentice
              </button>
            </div>
            {apprenticeShareLink && (
              <aside
                className="apprentice-share-panel"
                aria-label="Apprentice account link"
              >
                <div>
                  <strong>
                    {apprenticeShareLink.kind === "invite"
                      ? "Secure invite ready"
                      : "Secure password reset ready"}
                  </strong>
                  <p>
                    Share this one-time link with {apprenticeShareLink.name}.
                    They will set their own password; the shop cannot view it.
                  </p>
                </div>
                {(() => {
                  const message =
                    apprenticeShareLink.kind === "invite"
                      ? `Hi ${apprenticeShareLink.name}, your QT Fashion app apprentice login is ${apprenticeShareLink.email}. Use this secure one-time link to activate your workspace and set your own password: ${apprenticeShareLink.link}`
                      : `Hi ${apprenticeShareLink.name}, use ${apprenticeShareLink.email} to sign in to your QT Fashion app apprentice workspace after resetting your password with this secure one-time link: ${apprenticeShareLink.link}`;
                  const phoneDigits = apprenticeShareLink.phone.replace(
                    /\D/g,
                    "",
                  );
                  const phone = phoneDigits.startsWith("00")
                    ? phoneDigits.slice(2)
                    : phoneDigits.startsWith("0")
                      ? `233${phoneDigits.slice(1)}`
                      : phoneDigits;
                  return (
                    <div className="apprentice-share-actions">
                      <a
                        className="secondary-button"
                        href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Share via WhatsApp
                      </a>
                      <a
                        className="secondary-button"
                        href={`sms:${apprenticeShareLink.phone.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(message)}`}
                      >
                        Share via SMS
                      </a>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label="Dismiss secure link"
                        onClick={() => setApprenticeShareLink(null)}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })()}
              </aside>
            )}

            <div
              className="order-stats-grid apprentice-stats"
              aria-label="Apprentice summary"
            >
              <article className="order-stat-card">
                <div className="apprentice-stat-top">
                  <span>Total Apprentices</span>
                  <span className="apprentice-stat-icon" aria-hidden="true">
                    <Users size={16} />
                  </span>
                </div>
                <strong>{apprentices.length}</strong>
                <small>Across all skill areas</small>
              </article>
              <article className="order-stat-card">
                <div className="apprentice-stat-top">
                  <span>Active</span>
                  <span className="apprentice-stat-icon active" aria-hidden="true">
                    <Check size={16} />
                  </span>
                </div>
                <strong>{activeApprenticeCount}</strong>
                <small>Currently in training</small>
              </article>
              <article className="order-stat-card">
                <div className="apprentice-stat-top">
                  <span>On Leave</span>
                  <span className="apprentice-stat-icon leave" aria-hidden="true">
                    <CalendarOff size={16} />
                  </span>
                </div>
                <strong>{onLeaveApprenticeCount}</strong>
                <small>Currently away</small>
              </article>
              <article className="order-stat-card">
                <div className="apprentice-stat-top">
                  <span>Active Assignments</span>
                  <span className="apprentice-stat-icon assignments" aria-hidden="true">
                    <ClipboardList size={16} />
                  </span>
                </div>
                <strong>{activeApprenticeTaskCount}</strong>
                <small>Open apprentice tasks</small>
              </article>
              <article className="order-stat-card">
                <div className="apprentice-stat-top">
                  <span>Overdue Tasks</span>
                  <span className="apprentice-stat-icon overdue" aria-hidden="true">
                    <Clock3 size={16} />
                  </span>
                </div>
                <strong>{overdueApprenticeTaskCount}</strong>
                <small>Need follow-up</small>
              </article>
              <article className="order-stat-card">
                <div className="apprentice-stat-top">
                  <span>Training Hours</span>
                  <span className="apprentice-stat-icon hours" aria-hidden="true">
                    <Award size={16} />
                  </span>
                </div>
                <strong>{weeklyTrainingHours}<small> hrs</small></strong>
                <small>This week · logged</small>
              </article>
            </div>

            <div className="apprentice-toolbar">
              <label className="orders-search">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search apprentices"
                  placeholder="Search by name, skill or assignment"
                  value={apprenticeSearch}
                  onChange={(event) => setApprenticeSearch(event.target.value)}
                />
                {apprenticeSearch && (
                  <button
                    type="button"
                    aria-label="Clear apprentice search"
                    onClick={() => setApprenticeSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <label className="orders-status-filter">
                <span className="sr-only">Apprentice status</span>
                <select
                  value={apprenticeStatusFilter}
                  onChange={(event) =>
                    setApprenticeStatusFilter(event.target.value)
                  }
                >
                  <option>All Statuses</option>
                  <option>Active</option>
                  <option>On leave</option>
                  <option>Completed</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="orders-status-filter">
                <span className="sr-only">Apprentice skill area</span>
                <select
                  aria-label="Filter by skill area"
                  value={apprenticeFocusFilter}
                  onChange={(event) =>
                    setApprenticeFocusFilter(event.target.value)
                  }
                >
                  <option>All Skill Areas</option>
                  {apprenticeFocusAreas.map((focus) => (
                    <option key={focus}>{focus}</option>
                  ))}
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="orders-status-filter">
                <span className="sr-only">Apprentice assignment</span>
                <select
                  aria-label="Filter by assignment"
                  value={apprenticeAssignmentFilter}
                  onChange={(event) =>
                    setApprenticeAssignmentFilter(event.target.value)
                  }
                >
                  <option>All Assignments</option>
                  <option>Assigned</option>
                  <option>Unassigned</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <span className="orders-result-count">
                {visibleApprentices.length} apprentices
              </span>
            </div>

            <article className="panel apprentice-roster-panel">
              <div className="orders-page-heading">
                <div>
                  <h2>Apprentice roster</h2>
                  <p>
                    Assignments stay linked to Tasks and Orders. Recent training
                    activity: {recentApprenticeRecordCount} records this week.
                  </p>
                </div>
                <span className="apprentice-roster-count">
                  {visibleApprentices.length} of {apprentices.length}
                </span>
              </div>
              {apprentices.length === 0 ? (
                <div className="apprentice-empty-state">
                  <span className="apprentice-empty-icon" aria-hidden="true">
                    <Users size={22} />
                  </span>
                  <h3>Build your training team</h3>
                  <p>
                    Add an apprentice to track skills, training hours, and
                    assignments in one place.
                  </p>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setIsApprenticeFormOpen(true)}
                  >
                    <Plus size={15} /> Add your first apprentice
                  </button>
                </div>
              ) : (
                <div className="table-wrap apprentice-table-wrap">
                  <table className="apprentice-table">
                    <thead>
                      <tr>
                        <th>Apprentice</th>
                        <th>Focus Area</th>
                        <th>Level</th>
                        <th>Current Assignment</th>
                        <th>Hours This Week</th>
                        <th>Status</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleApprentices.map((apprentice) => (
                        <tr key={apprentice.id}>
                        <td>
                          <div className="apprentice-person">
                            <span className="apprentice-avatar">
                              {apprentice.name
                                .split(" ")
                                .map((part) => part[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            <span>
                              <strong>{apprentice.name}</strong>
                              <small>{apprentice.id}</small>
                              <small
                                className={
                                  apprenticeTrainingRecords.some(
                                    (record) =>
                                      record.apprenticeId ===
                                        (apprentice.userId ?? apprentice.id) &&
                                      record.date >= currentWeekStartKey,
                                  )
                                    ? "apprentice-recent-activity"
                                    : "apprentice-no-activity"
                                }
                              >
                                {apprenticeTrainingRecords.some(
                                  (record) =>
                                    record.apprenticeId ===
                                      (apprentice.userId ?? apprentice.id) &&
                                    record.date >= currentWeekStartKey,
                                )
                                  ? "Recent activity this week"
                                  : "No recent activity"}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td>{apprentice.focus}</td>
                        <td>
                          <span
                            className={`skill-level ${apprentice.level.toLowerCase()}`}
                          >
                            {apprentice.level}
                          </span>
                        </td>
                        <td>
                          <div className="apprentice-assignment-cell">
                            {currentTaskForApprentice(apprentice)?.title ??
                              "Not assigned"}
                            {tasks.some(
                              (task) =>
                                isTaskAssignedToApprentice(task, apprentice) &&
                                task.status !== "Done" &&
                                new Date(`${task.dueDate}T00:00:00`) < today,
                            ) && (
                              <small className="apprentice-overdue-badge">
                                Overdue task
                              </small>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="training-hours">
                            <strong>
                              {apprenticeHoursThisWeek(apprentice)}h
                            </strong>
                            <span>
                              <i
                                style={{
                                  width: `${Math.min((apprenticeHoursThisWeek(apprentice) / 40) * 100, 100)}%`,
                                }}
                              />
                            </span>
                          </div>
                        </td>
                        <td>
                          <select
                            className={`apprentice-status-select ${apprentice.status.toLowerCase().replace(" ", "-")}`}
                            aria-label={`Status for ${apprentice.name}`}
                            value={apprentice.status}
                            onChange={(event) =>
                              updateApprenticeStatus(
                                apprentice.id,
                                event.target.value as ApprenticeStatus,
                              )
                            }
                          >
                            <option>Active</option>
                            <option>On leave</option>
                            <option>Completed</option>
                          </select>
                        </td>
                        <td>
                          <button
                            className="icon-button order-details-button"
                            type="button"
                            aria-label={`View ${apprentice.name}`}
                            title="View apprentice"
                            onClick={() =>
                              setSelectedApprenticeId(apprentice.id)
                            }
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                        </tr>
                      ))}
                      {visibleApprentices.length === 0 && (
                        <tr>
                          <td className="empty-state" colSpan={7}>
                            No apprentices match your search or filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            {isApprenticeFormOpen && (
              <div
                className="modal-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget)
                    setIsApprenticeFormOpen(false);
                }}
              >
                <section
                  className="order-modal apprentice-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="apprentice-modal-title"
                >
                  <div className="modal-heading">
                    <div>
                      <span className="modal-kicker">TEAM DEVELOPMENT</span>
                      <h2 id="apprentice-modal-title">Add Apprentice</h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Close dialog"
                      type="button"
                      onClick={() => setIsApprenticeFormOpen(false)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={addApprentice}>
                    <label>
                      Full name
                      <input
                        autoFocus
                        name="name"
                        placeholder="Enter full name"
                        required
                      />
                    </label>
                    {isSupabaseConfigured && (
                      <label>
                        Login email
                        <input
                          autoComplete="email"
                          name="email"
                          type="email"
                          placeholder="apprentice@example.com"
                          required
                        />
                      </label>
                    )}
                    <label>
                      Phone number
                      <input
                        name="phone"
                        type="tel"
                        placeholder="055 123 4567"
                        required
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        Focus area
                        <select className="form-select" name="focus">
                          <option>Dressmaking</option>
                          <option>Menswear</option>
                          <option>Tailoring</option>
                          <option>Embroidery</option>
                          <option>Pattern cutting</option>
                        </select>
                      </label>
                      <label>
                        Skill level
                        <select className="form-select" name="level">
                          <option>Beginner</option>
                          <option>Intermediate</option>
                          <option>Advanced</option>
                        </select>
                      </label>
                    </div>
                    <label>
                      Training start date
                      <input
                        type="date"
                        name="startDate"
                        defaultValue={dateKey(new Date())}
                        required
                      />
                    </label>
                    {isSupabaseConfigured && (
                      <p className="auth-feedback">
                        An invite link will be generated for secure sharing. The
                        apprentice sets their own password.
                      </p>
                    )}
                    <div className="modal-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setIsApprenticeFormOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={apprenticeInviteBusy}
                      >
                        <Plus size={15} />{" "}
                        {apprenticeInviteBusy
                          ? "Creating secure invite…"
                          : "Add Apprentice"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}

            {selectedApprentice && (
              <div
                className="modal-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setSelectedApprenticeId(null);
                    setApprenticeAction(null);
                  }
                }}
              >
                <section
                  className="order-modal apprentice-detail-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="apprentice-detail-title"
                >
                  <div className="modal-heading">
                    <div>
                      <span className="modal-kicker">APPRENTICE PROFILE</span>
                      <h2 id="apprentice-detail-title">
                        {selectedApprentice.name}
                      </h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Close dialog"
                      type="button"
                      onClick={() => {
                        setSelectedApprenticeId(null);
                        setApprenticeAction(null);
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <p className="apprentice-detail-id">
                    {selectedApprentice.id}
                  </p>
                  <dl className="order-detail-grid">
                    <div>
                      <dt>Portal email</dt>
                      <dd>{selectedApprentice.email || "Not linked"}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{selectedApprentice.phone || "Not provided"}</dd>
                    </div>
                    <div>
                      <dt>Focus area</dt>
                      <dd>{selectedApprentice.focus}</dd>
                    </div>
                    <div>
                      <dt>Skill level</dt>
                      <dd>{selectedApprentice.level}</dd>
                    </div>
                    <div>
                      <dt>Joined</dt>
                      <dd>{selectedApprentice.joined}</dd>
                    </div>
                    <div>
                      <dt>Current assignment</dt>
                      <dd>
                        {currentTaskForApprentice(selectedApprentice)?.title ??
                          "Not assigned"}
                      </dd>
                    </div>
                    <div>
                      <dt>Hours this week</dt>
                      <dd>{selectedApprenticeHoursThisWeek} hours</dd>
                    </div>
                  </dl>
                  <label className="apprentice-detail-status">
                    Training status
                    <select
                      className="form-select"
                      value={selectedApprentice.status}
                      onChange={(event) =>
                        updateApprenticeStatus(
                          selectedApprentice.id,
                          event.target.value as ApprenticeStatus,
                        )
                      }
                    >
                      <option>Active</option>
                      <option>On leave</option>
                      <option>Completed</option>
                    </select>
                  </label>
                  <div className="apprentice-detail-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setApprenticeAction("hours");
                        setApprenticeProfileError("");
                      }}
                    >
                      <Clock3 size={14} /> Log hours
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setApprenticeAction("skill");
                        setApprenticeProfileError("");
                      }}
                    >
                      <Award size={14} /> Update skill
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setApprenticeAction("attendance");
                        setApprenticeProfileError("");
                      }}
                    >
                      <CalendarCheck2 size={14} /> Attendance
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setApprenticeAction("leave");
                        setApprenticeProfileError("");
                      }}
                    >
                      <CalendarOff size={14} /> Record leave
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={selectedApprentice.status !== "Active"}
                      title={
                        selectedApprentice.status !== "Active"
                          ? "Only active apprentices can receive a new task."
                          : undefined
                      }
                      onClick={() => assignTaskToApprentice(selectedApprentice)}
                    >
                      <ListChecks size={14} /> Assign task
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setApprenticeAction("profile");
                        setApprenticeProfileError("");
                      }}
                    >
                      <Pencil size={14} /> Edit profile
                    </button>
                    {isSupabaseConfigured && (
                      <button
                        className="secondary-button"
                        type="button"
                        disabled={
                          apprenticeInviteBusy || !selectedApprentice.userId
                        }
                        onClick={() =>
                          void createApprenticeResetLink(selectedApprentice)
                        }
                      >
                        <KeyRound size={14} /> Reset login
                      </button>
                    )}
                    <button
                      className="secondary-button apprentice-delete-button"
                      type="button"
                      disabled={apprenticeDeleteBusy}
                      onClick={() => void deleteApprentice(selectedApprentice)}
                    >
                      <Trash2 size={14} />
                      {apprenticeDeleteBusy ? "Deleting…" : "Delete apprentice"}
                    </button>
                  </div>
                  {selectedApprentice.notes && (
                    <p className="apprentice-profile-notes">
                      <strong>Profile notes</strong>
                      {selectedApprentice.notes}
                    </p>
                  )}

                  {apprenticeAction && (
                    <section
                      className="apprentice-action-panel"
                      aria-label={
                        apprenticeAction === "profile"
                          ? "Edit apprentice profile"
                          : `Record apprentice ${apprenticeAction}`
                      }
                    >
                      <div className="apprentice-action-heading">
                        <h3>
                          {apprenticeAction === "hours"
                            ? "Log training hours"
                            : apprenticeAction === "skill"
                              ? "Update skill progress"
                              : apprenticeAction === "attendance"
                                ? "Record attendance"
                                : apprenticeAction === "leave"
                                  ? "Record leave"
                                  : "Edit apprentice profile"}
                        </h3>
                        <button
                          type="button"
                          className="icon-button"
                          aria-label="Close form"
                          onClick={() => {
                            setApprenticeAction(null);
                            setApprenticeProfileError("");
                          }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                      {apprenticeAction === "profile" ? (
                        <form onSubmit={saveApprenticeProfile}>
                          <label>
                            Phone number
                            <input
                              value={selectedApprentice.phone || ""}
                              readOnly
                            />
                          </label>
                          <label>
                            Focus area
                            <input
                              name="focus"
                              defaultValue={selectedApprentice.focus}
                              required
                              maxLength={80}
                            />
                          </label>
                          <label>
                            Overall skill level
                            <select
                              className="form-select"
                              name="level"
                              defaultValue={selectedApprentice.level}
                            >
                              <option>Beginner</option>
                              <option>Intermediate</option>
                              <option>Advanced</option>
                            </select>
                          </label>
                          <label>
                            Profile notes
                            <textarea
                              name="notes"
                              defaultValue={selectedApprentice.notes ?? ""}
                              maxLength={1000}
                              placeholder="Training goals, support needs, or profile notes"
                            />
                          </label>
                          {apprenticeProfileError && (
                            <p className="payment-form-error" role="alert">
                              {apprenticeProfileError}
                            </p>
                          )}
                          <button className="primary-button" type="submit">
                            Save profile
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={saveApprenticeTrainingRecord}>
                          <label>
                            Date
                            <input
                              type="date"
                              name="date"
                              defaultValue={dateKey(new Date())}
                              required
                            />
                          </label>
                          {apprenticeAction === "hours" && (
                            <>
                              <label>
                                Hours worked
                                <input
                                  type="number"
                                  name="hours"
                                  min="0.25"
                                  max="24"
                                  step="0.25"
                                  placeholder="e.g. 4"
                                  required
                                />
                              </label>
                              <label>
                                Training activity
                                <input
                                  name="activity"
                                  maxLength={120}
                                  placeholder="e.g. Drafting a bodice pattern"
                                  required
                                />
                              </label>
                            </>
                          )}
                          {apprenticeAction === "skill" && (
                            <>
                              <label>
                                Skill
                                <input
                                  name="skillName"
                                  maxLength={80}
                                  placeholder="e.g. Sleeve setting"
                                  required
                                />
                              </label>
                              <label>
                                Progress level
                                <select
                                  className="form-select"
                                  name="skillLevel"
                                  defaultValue="Learning"
                                >
                                  <option>Learning</option>
                                  <option>Confident</option>
                                </select>
                              </label>
                            </>
                          )}
                          {apprenticeAction === "attendance" && (
                            <label>
                              Attendance
                              <select
                                className="form-select"
                                name="attendanceStatus"
                                defaultValue="Present"
                              >
                                <option>Present</option>
                                <option>Late</option>
                                <option>Absent</option>
                              </select>
                            </label>
                          )}
                          {apprenticeAction === "leave" && (
                            <label>
                              Expected return date
                              <input type="date" name="leaveEndDate" />
                            </label>
                          )}
                          <label>
                            Notes (optional)
                            <textarea
                              name="notes"
                              maxLength={500}
                              placeholder={
                                apprenticeAction === "leave"
                                  ? "Reason or handover details"
                                  : "Add a brief note"
                              }
                            />
                          </label>
                          {apprenticeProfileError && (
                            <p className="payment-form-error" role="alert">
                              {apprenticeProfileError}
                            </p>
                          )}
                          <div className="modal-actions">
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => {
                                setApprenticeAction(null);
                                setApprenticeProfileError("");
                              }}
                            >
                              Cancel
                            </button>
                            <button className="primary-button" type="submit">
                              Save record
                            </button>
                          </div>
                        </form>
                      )}
                    </section>
                  )}

                  <section className="apprentice-detail-section">
                    <div className="apprentice-section-heading">
                      <h3>Linked tasks & orders</h3>
                      <span>
                        {
                          selectedApprenticeTasks.filter(
                            (task) => task.status !== "Done",
                          ).length
                        }{" "}
                        open
                      </span>
                    </div>
                    {selectedApprenticeTasks.length ? (
                      <ul className="apprentice-record-list">
                        {selectedApprenticeTasks.slice(0, 5).map((task) => (
                          <li key={task.id}>
                            <div>
                              <strong>{task.title}</strong>
                              <small>
                                {task.orderId ? (
                                  <button
                                    className="apprentice-order-link"
                                    type="button"
                                    onClick={() => {
                                      setSelectedApprenticeId(null);
                                      setOrderSearch(task.orderId);
                                      setActivePage("Orders");
                                    }}
                                  >
                                    Open order {task.orderId}
                                  </button>
                                ) : (
                                  `General task · ${task.dueDate}`
                                )}
                              </small>
                            </div>
                            <button
                              className="secondary-button apprentice-task-link"
                              type="button"
                              onClick={() => {
                                setSelectedApprenticeId(null);
                                setTaskSearch(task.title);
                                setActivePage("Tasks");
                              }}
                            >
                              Open task
                            </button>
                            <span
                              className={`task-status ${task.status.toLowerCase().replace(" ", "-")}`}
                            >
                              {task.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="apprentice-empty-note">
                        No linked tasks yet. Assign a task to connect work to an
                        order.
                      </p>
                    )}
                    {selectedApprenticeTasks.some((task) => task.orderId) && (
                      <p className="apprentice-linked-order-note">
                        Related order links are maintained in the Tasks and
                        Orders pages.
                      </p>
                    )}
                  </section>

                  <section className="apprentice-detail-section">
                    <div className="apprentice-section-heading">
                      <h3>Task progress activity</h3>
                      <span>
                        {
                          taskUpdates.filter((update) =>
                            selectedApprenticeTasks.some(
                              (task) => task.dbId === update.taskId,
                            ),
                          ).length
                        }{" "}
                        updates
                      </span>
                    </div>
                    {taskUpdates
                      .filter((update) =>
                        selectedApprenticeTasks.some(
                          (task) => task.dbId === update.taskId,
                        ),
                      )
                      .slice(0, 8).length ? (
                      <ul className="apprentice-record-list">
                        {taskUpdates
                          .filter((update) =>
                            selectedApprenticeTasks.some(
                              (task) => task.dbId === update.taskId,
                            ),
                          )
                          .slice(0, 8)
                          .map((update) => (
                            <li key={update.id}>
                              <div>
                                <strong>
                                  {
                                    selectedApprenticeTasks.find(
                                      (task) => task.dbId === update.taskId,
                                    )?.title
                                  }
                                  : {update.newStatus}
                                </strong>
                                <small>
                                  {update.comment ||
                                    `${update.actor} updated the task`}{" "}
                                  ·{" "}
                                  {new Date(update.createdAt).toLocaleString()}
                                </small>
                              </div>
                              <span className="apprentice-record-kind">
                                Task
                              </span>
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="apprentice-empty-note">
                        Task acceptances and progress updates will appear here.
                      </p>
                    )}
                  </section>

                  <section className="apprentice-detail-section">
                    <div className="apprentice-section-heading">
                      <h3>Skill progression</h3>
                      <span>
                        {
                          selectedApprenticeRecords.filter(
                            (record) => record.kind === "skill",
                          ).length
                        }{" "}
                        updates
                      </span>
                    </div>
                    {selectedApprenticeRecords.some(
                      (record) => record.kind === "skill",
                    ) ? (
                      <ul className="apprentice-record-list">
                        {selectedApprenticeRecords
                          .filter((record) => record.kind === "skill")
                          .slice(0, 6)
                          .map((record) => (
                            <li key={record.id}>
                              <div>
                                <strong>{record.skillName}</strong>
                                <small>
                                  {record.date}
                                  {record.notes ? ` · ${record.notes}` : ""}
                                </small>
                              </div>
                              <span
                                className={`skill-level ${(record.skillLevel ?? "Learning").toLowerCase()}`}
                              >
                                {record.skillLevel}
                              </span>
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="apprentice-empty-note">
                        No skills tracked yet. Add a skill update as progress is
                        demonstrated.
                      </p>
                    )}
                  </section>

                  <section className="apprentice-detail-section">
                    <div className="apprentice-section-heading">
                      <h3>Training, attendance & leave history</h3>
                      <span>{selectedApprenticeRecords.length} records</span>
                    </div>
                    {selectedApprenticeRecords.length ? (
                      <ul className="apprentice-record-list">
                        {selectedApprenticeRecords.slice(0, 8).map((record) => (
                          <li key={record.id}>
                            <div>
                              <strong>
                                {record.kind === "hours"
                                  ? `${record.hours} hours · ${record.activity}`
                                  : record.kind === "attendance"
                                    ? record.attendanceStatus
                                    : record.kind === "leave"
                                      ? `Leave${record.leaveEndDate ? ` until ${record.leaveEndDate}` : ""}`
                                      : `${record.skillName} · ${record.skillLevel}`}
                              </strong>
                              <small>
                                {record.date}
                                {record.notes ? ` · ${record.notes}` : ""}
                              </small>
                            </div>
                            <span className="apprentice-record-kind">
                              {record.kind}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="apprentice-empty-note">
                        No training or attendance records yet.
                      </p>
                    )}
                  </section>
                  <div className="modal-actions">
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        setSelectedApprenticeId(null);
                        setApprenticeAction(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                </section>
              </div>
            )}
          </section>
        ) : activePage === "Orders" ? (
          <section className="orders-page" aria-label="Order management">
            <div className="order-stats-grid" aria-label="Order summary">
              <article className="order-stat-card">
                <span>Total Orders</span>
                <strong>{orders.length}</strong>
                <small>Across all categories</small>
              </article>
              <article className="order-stat-card">
                <span>Pending</span>
                <strong>{pendingOrderCount}</strong>
                <small>Awaiting production</small>
              </article>
              <article className="order-stat-card">
                <span>In Progress</span>
                <strong>{activeOrderCount}</strong>
                <small>Cutting, sewing or fitting</small>
              </article>
              <article className="order-stat-card">
                <span>Completed</span>
                <strong>{completedOrderCount}</strong>
                <small>Ready or delivered</small>
              </article>
            </div>
            {overdueOrderCount > 0 && (
              <div className="orders-overdue-banner" role="status">
                <Bell size={16} />
                <span>
                  <strong>
                    {overdueOrderCount}{" "}
                    {overdueOrderCount === 1 ? "order is" : "orders are"}{" "}
                    overdue.
                  </strong>{" "}
                  Review delivery dates and follow up with customers.
                </span>
                <button
                  type="button"
                  onClick={() => setOrderDeliveryFilter("Overdue")}
                >
                  View overdue
                </button>
              </div>
            )}

            <div className="orders-toolbar">
              <label className="orders-search">
                <Search size={16} aria-hidden="true" />
                <input
                  aria-label="Search orders"
                  placeholder="Search by order, customer or design"
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                />
                {orderSearch && (
                  <button
                    type="button"
                    aria-label="Clear order search"
                    onClick={() => setOrderSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <label className="orders-status-filter">
                <span className="sr-only">Order status</span>
                <select
                  value={orderStatusFilter}
                  onChange={(event) => setOrderStatusFilter(event.target.value)}
                >
                  <option>All Statuses</option>
                  <option>Pending</option>
                  <option>Cutting</option>
                  <option>Sewing</option>
                  <option>Fitting</option>
                  <option>Completed</option>
                  <option>Delivered</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <label className="orders-status-filter orders-delivery-filter">
                <span className="sr-only">Delivery date</span>
                <select
                  aria-label="Filter by delivery date"
                  value={orderDeliveryFilter}
                  onChange={(event) =>
                    setOrderDeliveryFilter(event.target.value)
                  }
                >
                  <option>All Delivery Dates</option>
                  <option>Overdue</option>
                  <option>Due Today</option>
                  <option>Due in 7 Days</option>
                  <option>Due in 30 Days</option>
                  <option>No Delivery Date</option>
                </select>
                <ChevronDown size={14} />
              </label>
              <span className="orders-result-count">
                {visibleOrders.length} orders
              </span>
            </div>

            <article className="panel orders-page-panel">
              <div className="orders-page-heading">
                <div>
                  <h2>All Orders</h2>
                  <p>Track orders from initial cut through delivery.</p>
                </div>
              </div>
              <div className="table-wrap orders-page-table-wrap">
                <table className="orders-page-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Garment / Design</th>
                      <th>Delivery Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleOrders.map((order) => {
                      const deliveryState = orderDeliveryState(order);
                      return (
                        <tr
                          id={`orders-record-${order.id}`}
                          className={`${highlightedRecord?.page === "Orders" && highlightedRecord.id === order.id ? "record-target-highlight " : ""}${deliveryState === "overdue" ? "order-row-overdue" : ""}`}
                          key={order.id}
                        >
                          <td>
                            <a
                              className="order-id-link"
                              href={`#${order.id.slice(1)}`}
                            >
                              {order.id}
                            </a>
                          </td>
                          <td>{order.customer}</td>
                          <td>{order.item}</td>
                          <td>
                            <span
                              className={`order-delivery-date ${deliveryState}`}
                            >
                              {order.date}
                              {deliveryState === "overdue" ? (
                                <small>Overdue</small>
                              ) : deliveryState === "today" ? (
                                <small>Due today</small>
                              ) : deliveryState === "soon" ? (
                                <small>Due soon</small>
                              ) : null}
                            </span>
                          </td>
                          <td>{formatCurrency(order.amount)}</td>
                          <td>
                            <select
                              className={`order-status-select ${order.status.toLowerCase()}`}
                              aria-label={`Status for ${order.id}`}
                              value={order.status}
                              onChange={(event) =>
                                updateOrderStatus(
                                  order.id,
                                  event.target.value as OrderStatus,
                                )
                              }
                            >
                              <option>Pending</option>
                              <option>Cutting</option>
                              <option>Sewing</option>
                              <option>Fitting</option>
                              <option>Completed</option>
                              <option>Delivered</option>
                            </select>
                          </td>
                          <td>
                            <button
                              className="icon-button order-details-button"
                              type="button"
                              aria-label={`View ${order.id}`}
                              title="View order details"
                              onClick={() => setSelectedOrderId(order.id)}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {visibleOrders.length === 0 && (
                      <tr>
                        <td className="empty-state" colSpan={7}>
                          No orders match your search or filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          </section>
        ) : activePage === "Measurements" ? (
          <section className="measurement-page" aria-label="Measurements">
            {selectedMeasurementCategory ? (
              <>
                <div className="measurement-page-heading">
                  <div className="measurement-title-with-back">
                    <button
                      className="measurement-back-button"
                      type="button"
                      aria-label="Back to measurement categories"
                      onClick={() => setSelectedMeasurementCategoryId(null)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <div>
                      <h2>{selectedMeasurementCategory.name}</h2>
                      <p>
                        {selectedMeasurementCategory.customerCount} Customers ·{" "}
                        {(
                          measurementPresets[selectedMeasurementCategory.id] ??
                          []
                        ).length
                          ? `Preset: ${(measurementPresets[selectedMeasurementCategory.id] ?? []).join(", ")}`
                          : "No preset · add titles when recording"}
                      </p>
                    </div>
                  </div>
                  <div className="measurement-page-actions">
                    {canManageMeasurementPresets && (
                      <button
                        className="secondary-button measurement-preset-button"
                        type="button"
                        onClick={() => {
                          setMeasurementPresetCategoryId(
                            selectedMeasurementCategory.id,
                          );
                          setMeasurementPresetDraft(
                            (
                              measurementPresets[
                                selectedMeasurementCategory.id
                              ] ?? []
                            ).join("\n"),
                          );
                          setIsMeasurementPresetFormOpen(true);
                        }}
                      >
                        Manage Presets
                      </button>
                    )}
                    <button
                      className="primary-button measurement-add-button"
                      type="button"
                      onClick={openMeasurementForm}
                    >
                      <Plus size={15} /> Add Measurement
                    </button>
                  </div>
                </div>
                {measurementRecordToolbar}
                {displayedMeasurementEntries.length ? (
                  <div className="measurement-entry-list">
                    {displayedMeasurementEntries.map(renderMeasurementEntry)}
                  </div>
                ) : (
                  <div className="measurement-empty-state">
                    <Ruler size={24} />
                    <strong>No matching measurements</strong>
                    <span>
                      Change the search or customer filter, or add a measurement
                      for this category.
                    </span>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="measurement-page-heading">
                  <h2>Measurement book</h2>
                  <div className="measurement-page-actions">
                    {canManageMeasurementPresets && (
                      <button
                        className="secondary-button measurement-preset-button"
                        type="button"
                        onClick={() => {
                          setMeasurementPresetCategoryId(
                            measurementCategories[0].id,
                          );
                          setMeasurementPresetDraft(
                            (
                              measurementPresets[measurementCategories[0].id] ??
                              []
                            ).join("\n"),
                          );
                          setMeasurementPresetClothAmountDraft(
                            measurementPresetClothAmounts[
                              measurementCategories[0].id
                            ]?.toString() ?? "",
                          );
                          setIsMeasurementPresetFormOpen(true);
                        }}
                      >
                        Manage Presets
                      </button>
                    )}
                    <button
                      className="primary-button measurement-add-button"
                      type="button"
                      onClick={openMeasurementForm}
                    >
                      <Plus size={15} /> Add Measurement
                    </button>
                  </div>
                </div>
                <div className="measurement-toolbar">
                  <label className="measurement-search">
                    <Search size={15} aria-hidden="true" />
                    <input
                      aria-label="Search measurement categories"
                      placeholder="Search garment type..."
                      value={measurementSearch}
                      onChange={(event) =>
                        setMeasurementSearch(event.target.value)
                      }
                    />
                    {measurementSearch && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setMeasurementSearch("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <label className="measurement-select">
                    <span className="sr-only">Measurement category</span>
                    <select
                      value={measurementFilter}
                      onChange={(event) =>
                        setMeasurementFilter(event.target.value)
                      }
                    >
                      <option>All Categories</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Traditional</option>
                      <option>Custom</option>
                    </select>
                    <ChevronDown size={14} />
                  </label>
                </div>
                <div className="measurement-category-list">
                  {filteredMeasurementCategories.map((category) => (
                    <button
                      className="measurement-category-row"
                      key={category.id}
                      type="button"
                      onClick={() =>
                        setSelectedMeasurementCategoryId(category.id)
                      }
                    >
                      <img src={category.image} alt="" />
                      <span className="measurement-category-copy">
                        <strong>{category.name}</strong>
                        <small>
                          {(measurementPresets[category.id] ?? []).length
                            ? `Preset · ${(measurementPresets[category.id] ?? []).join(", ")}`
                            : "No preset · enter measurement titles when adding"}
                        </small>
                        <small>
                          {category.customerCount} customers ·{" "}
                          {
                            measurementEntries.filter(
                              (entry) => entry.categoryId === category.id,
                            ).length
                          }{" "}
                          saved measurements
                        </small>
                      </span>
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  ))}
                  {filteredMeasurementCategories.length === 0 && (
                    <div className="measurement-empty-state">
                      <Ruler size={24} />
                      <strong>No categories found</strong>
                      <span>Try another search or category filter.</span>
                    </div>
                  )}
                </div>
                <section
                  className="measurement-recent"
                  aria-labelledby="measurement-recent-title"
                >
                  <div className="measurement-section-heading">
                    <div>
                      <h3 id="measurement-recent-title">
                        {measurementRecordCustomerId !== "All Customers"
                          ? `Measurements for ${customerRecords.find((customer) => (customer.dbId ?? customer.id) === measurementRecordCustomerId)?.name ?? "customer"}`
                          : hasMeasurementRecordFilters
                            ? "Matching measurements"
                            : "Recent measurements"}
                      </h3>
                      <p>
                        {hasMeasurementRecordFilters
                          ? `${filteredMeasurementEntries.length} matching record${filteredMeasurementEntries.length === 1 ? "" : "s"}; previous versions are kept in the history.`
                          : "Latest measurement records across all garment types."}
                      </p>
                    </div>
                  </div>
                  {measurementRecordToolbar}
                  {displayedMeasurementEntries.length ? (
                    <div className="measurement-entry-list">
                      {displayedMeasurementEntries.map(renderMeasurementEntry)}
                    </div>
                  ) : (
                    <div className="measurement-empty-state">
                      <Ruler size={24} />
                      <strong>
                        {hasMeasurementRecordFilters
                          ? "No matching measurements"
                          : "No recent measurements"}
                      </strong>
                      <span>
                        {hasMeasurementRecordFilters
                          ? "Try a different customer, garment, or search term."
                          : "Saved customer measurements will appear here."}
                      </span>
                    </div>
                  )}
                </section>
              </>
            )}

            {isMeasurementFormOpen && (
              <div
                className="modal-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    setIsMeasurementFormOpen(false);
                    setPendingMeasurementSubmission(null);
                  }
                }}
              >
                <section
                  className="order-modal measurement-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="measurement-modal-title"
                >
                  <div className="modal-heading">
                    <div>
                      <span className="modal-kicker">MEASUREMENT BOOK</span>
                      <h2 id="measurement-modal-title">
                        {pendingMeasurementSubmission
                          ? "Save measurement titles?"
                          : editingMeasurementEntry
                            ? "Edit measurement version"
                            : "Add Measurement"}
                      </h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Close dialog"
                      type="button"
                      onClick={() => {
                        setIsMeasurementFormOpen(false);
                        setPendingMeasurementSubmission(null);
                        setEditingMeasurementEntry(null);
                        setMeasurementCustomerName("");
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {pendingMeasurementSubmission ? (
                    <div className="measurement-preset-confirm">
                      <p>
                        There is no saved preset for{" "}
                        {
                          measurementCategories.find(
                            (category) =>
                              category.id ===
                              pendingMeasurementSubmission.categoryId,
                          )?.name
                        }
                        . Save these titles for next time, or continue without
                        changing presets?
                      </p>
                      <div className="measurement-preset-tags">
                        {pendingMeasurementSubmission.fields.map((field) => (
                          <span key={field.name}>{field.name}</span>
                        ))}
                      </div>
                      <div className="modal-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => setPendingMeasurementSubmission(null)}
                        >
                          Back to measurement
                        </button>
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() =>
                            void confirmMeasurementPresetAndSave(false)
                          }
                        >
                          Continue without saving
                        </button>
                        <button
                          className="primary-button"
                          type="button"
                          onClick={() =>
                            void confirmMeasurementPresetAndSave(true)
                          }
                        >
                          Save as preset &amp; continue
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={saveMeasurement}>
                      <label>
                        Garment type
                        <select
                          className="form-select"
                          name="categoryId"
                          value={measurementFormCategoryId}
                          onChange={(event) => {
                            const nextCategoryId = event.target.value;
                            setMeasurementFormCategoryId(nextCategoryId);
                            setMeasurementFormFields(
                              (measurementPresets[nextCategoryId] ?? []).map(
                                (name) => ({ name, value: "" }),
                              ),
                            );
                            setMeasurementBillingClothAmount(
                              measurementPresetClothAmounts[
                                nextCategoryId
                              ]?.toString() ?? "",
                            );
                            setMeasurementGarmentPhotos([]);
                            setMeasurementStylePhotos([]);
                          }}
                        >
                          {measurementCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="measurement-billing-toggle">
                        <input
                          type="checkbox"
                          checked={measurementBillingEnabled}
                          disabled={Boolean(editingMeasurementEntry)}
                          onChange={(event) =>
                            setMeasurementBillingEnabled(event.target.checked)
                          }
                        />
                        <span>Create an order and bill this customer</span>
                      </label>
                      <label>
                        Customer name
                        <input
                          autoFocus
                          name="customerName"
                          list="measurement-customer-options"
                          placeholder="Type or select a customer"
                          required
                          value={measurementCustomerName}
                          onChange={(event) =>
                            setMeasurementCustomerName(event.target.value)
                          }
                        />
                        <datalist id="measurement-customer-options">
                          {customerRecords.map((customer) => (
                            <option
                              key={customer.dbId ?? customer.id}
                              value={customer.name}
                            />
                          ))}
                        </datalist>
                      </label>
                      {measurementCustomerName.trim() &&
                      matchingMeasurementCustomer ? (
                        <p className="measurement-customer-status found">
                          Customer found: {matchingMeasurementCustomer.name}
                        </p>
                      ) : measurementCustomerName.trim() ? (
                        <div
                          className="measurement-customer-status missing"
                          role="alert"
                        >
                          <span>
                            Customer not found. Add this customer before
                            recording measurements.
                          </span>
                          <button
                            className="panel-link"
                            type="button"
                            onClick={addMeasurementCustomer}
                          >
                            Add customer <ChevronRight size={14} />
                          </button>
                        </div>
                      ) : null}
                      {(measurementPresets[measurementFormCategoryId] ?? [])
                        .length ? (
                        <p className="measurement-preset-hint">
                          Preset loaded:{" "}
                          {(
                            measurementPresets[measurementFormCategoryId] ?? []
                          ).join(", ")}
                        </p>
                      ) : (
                        <p className="measurement-preset-hint">
                          No preset exists for this garment type. Add a title
                          for each body part you measure.
                        </p>
                      )}
                      <div className="measurement-input-grid">
                        {measurementFormFields.map((field, index) =>
                          (measurementPresets[measurementFormCategoryId] ?? [])
                            .length ? (
                            <label
                              key={`${measurementFormCategoryId}-${index}`}
                            >
                              {field.name} (
                              {shopSettings.measurements === "Inches"
                                ? "in"
                                : "cm"}
                              )
                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                placeholder="0.0"
                                required
                                value={field.value}
                                onChange={(event) =>
                                  setMeasurementFormFields((current) =>
                                    current.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, value: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                              />
                            </label>
                          ) : (
                            <div
                              className="measurement-custom-field"
                              key={`${measurementFormCategoryId}-${index}`}
                            >
                              <label>
                                Measurement title
                                <input
                                  aria-label={`Measurement title ${index + 1}`}
                                  placeholder="e.g. Chest"
                                  maxLength={50}
                                  value={field.name}
                                  onChange={(event) =>
                                    setMeasurementFormFields((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              name: event.target.value,
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </label>
                              <label>
                                Measurement (
                                {shopSettings.measurements === "Inches"
                                  ? "in"
                                  : "cm"}
                                )
                                <input
                                  type="number"
                                  min="0.1"
                                  step="0.1"
                                  placeholder="0.0"
                                  required
                                  value={field.value}
                                  onChange={(event) =>
                                    setMeasurementFormFields((current) =>
                                      current.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              value: event.target.value,
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                />
                              </label>
                            </div>
                          ),
                        )}
                      </div>
                      {!(measurementPresets[measurementFormCategoryId] ?? [])
                        .length && (
                        <button
                          className="secondary-button measurement-add-field"
                          type="button"
                          onClick={() =>
                            setMeasurementFormFields((current) => [
                              ...current,
                              { name: "", value: "" },
                            ])
                          }
                        >
                          <Plus size={14} /> Add measurement title
                        </button>
                      )}
                      <div className="measurement-photo-groups">
                        <section
                          className="measurement-photo-group"
                          aria-label="Garment photos"
                        >
                          <div>
                            <strong>Garment photos</strong>
                            <small>
                              {measurementGarmentPhotos.length}/2 · Upload,
                              capture, or choose from gallery
                            </small>
                          </div>
                          <div className="measurement-photo-list">
                            {measurementGarmentPhotos.map((photo, index) => (
                              <div
                                className="measurement-photo-item"
                                key={`garment-photo-${index}`}
                              >
                                <img
                                  src={photo.url}
                                  alt={`Garment photo ${index + 1}`}
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove garment photo ${index + 1}`}
                                  onClick={() =>
                                    setMeasurementGarmentPhotos((current) =>
                                      current.filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      ),
                                    )
                                  }
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                            {measurementGarmentPhotos.length < 2 && (
                              <button
                                className="measurement-photo-add"
                                type="button"
                                onClick={() =>
                                  openMeasurementPhotoPicker(
                                    "measurementGarment",
                                  )
                                }
                              >
                                <Camera size={17} />
                                <span>Add garment photo</span>
                              </button>
                            )}
                          </div>
                        </section>
                        <section
                          className="measurement-photo-group"
                          aria-label="Style references"
                        >
                          <div>
                            <strong>Style references</strong>
                            <small>
                              {measurementStylePhotos.length}/3 · Choose a saved
                              style, upload, or capture
                            </small>
                          </div>
                          <div className="measurement-photo-list">
                            {measurementStylePhotos.map((photo, index) => (
                              <div
                                className="measurement-photo-item"
                                key={`style-photo-${index}`}
                              >
                                <img
                                  src={photo.url}
                                  alt={`Style reference ${index + 1}`}
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove style reference ${index + 1}`}
                                  onClick={() =>
                                    setMeasurementStylePhotos((current) =>
                                      current.filter(
                                        (_, itemIndex) => itemIndex !== index,
                                      ),
                                    )
                                  }
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                            {measurementStylePhotos.length < 3 && (
                              <button
                                className="measurement-photo-add"
                                type="button"
                                onClick={() =>
                                  openMeasurementPhotoPicker("measurementStyle")
                                }
                              >
                                <Images size={17} />
                                <span>Add style reference</span>
                              </button>
                            )}
                          </div>
                        </section>
                      </div>
                      {editingMeasurementEntry && (
                        <p className="measurement-preset-hint">
                          Saving creates a new version and keeps{" "}
                          {editingMeasurementEntry.id} in the history.
                        </p>
                      )}
                      {measurementBillingEnabled &&
                        !editingMeasurementEntry && (
                          <section
                            className="measurement-billing-panel"
                            aria-label="Order billing"
                          >
                            <h3>Order billing</h3>
                            <div className="measurement-billing-grid">
                              <label>
                                Garment quantity
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  required
                                  value={measurementBillingQuantity}
                                  onChange={(event) =>
                                    setMeasurementBillingQuantity(
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label>
                                Price per garment
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  required
                                  value={measurementBillingUnitPrice}
                                  onChange={(event) =>
                                    setMeasurementBillingUnitPrice(
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label>
                                Cloth amount per garment (optional)
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={measurementBillingClothAmount}
                                  onChange={(event) =>
                                    setMeasurementBillingClothAmount(
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label>
                                Discount amount
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  required
                                  value={measurementBillingDiscount}
                                  onChange={(event) =>
                                    setMeasurementBillingDiscount(
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label>
                                Delivery date
                                <input
                                  type="date"
                                  required
                                  value={measurementBillingDeliveryDate}
                                  onChange={(event) =>
                                    setMeasurementBillingDeliveryDate(
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                            </div>
                            <p className="measurement-billing-total">
                              Total:{" "}
                              <strong>
                                {shopSettings.currency === "GHS" ? "GH₵" : "$"}
                                {Math.max(
                                  0,
                                  Number(measurementBillingQuantity || 0) *
                                    (Number(measurementBillingUnitPrice || 0) +
                                      Number(
                                        measurementBillingClothAmount || 0,
                                      )) -
                                    Number(measurementBillingDiscount || 0),
                                ).toFixed(2)}
                              </strong>
                              <small>
                                Quantity × (price + cloth) − fixed discount
                              </small>
                            </p>
                          </section>
                        )}
                      <div className="modal-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => {
                            setIsMeasurementFormOpen(false);
                            setEditingMeasurementEntry(null);
                            setMeasurementCustomerName("");
                          }}
                        >
                          Cancel
                        </button>
                        <button className="primary-button" type="submit">
                          <Plus size={15} />{" "}
                          {editingMeasurementEntry
                            ? "Save new version"
                            : "Save Measurement"}
                        </button>
                      </div>
                    </form>
                  )}
                </section>
              </div>
            )}

            {isMeasurementPresetFormOpen && (
              <div
                className="modal-backdrop"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget)
                    setIsMeasurementPresetFormOpen(false);
                }}
              >
                <section
                  className="order-modal measurement-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="measurement-preset-title"
                >
                  <div className="modal-heading">
                    <div>
                      <span className="modal-kicker">ADMIN SETTINGS</span>
                      <h2 id="measurement-preset-title">Measurement presets</h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Close dialog"
                      type="button"
                      onClick={() => setIsMeasurementPresetFormOpen(false)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={saveMeasurementPreset}>
                    <label>
                      Garment type
                      <select
                        className="form-select"
                        value={measurementPresetCategoryId}
                        onChange={(event) => {
                          const categoryId = event.target.value;
                          setMeasurementPresetCategoryId(categoryId);
                          setMeasurementPresetNewGarmentName("");
                          setMeasurementPresetDraft(
                            categoryId === newMeasurementGarmentOption
                              ? ""
                              : (measurementPresets[categoryId] ?? []).join("\n"),
                          );
                          setMeasurementPresetClothAmountDraft(
                            categoryId === newMeasurementGarmentOption
                              ? ""
                              : (measurementPresetClothAmounts[
                                  categoryId
                                ]?.toString() ?? ""),
                          );
                        }}
                      >
                        <option value={newMeasurementGarmentOption}>
                          + Add a new garment type
                        </option>
                        {measurementCategories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <small>
                        Select an existing garment to load and edit its saved
                        measurement fields.
                      </small>
                    </label>
                    {measurementPresetCategoryId ===
                      newMeasurementGarmentOption && (
                      <label>
                        New garment name
                        <input
                          autoFocus
                          maxLength={60}
                          placeholder="e.g. Jumpsuit or Kaftan"
                          value={measurementPresetNewGarmentName}
                          onChange={(event) =>
                            setMeasurementPresetNewGarmentName(
                              event.target.value,
                            )
                          }
                          required
                        />
                        <small>
                          Saving this preset adds the garment type to your
                          measurement options.
                        </small>
                      </label>
                    )}
                    <label>
                      Measurement titles{" "}
                      <small>
                        Enter one body part per line, such as Chest, Waist, or
                        Sleeve.
                      </small>
                      <textarea
                        className="measurement-preset-textarea"
                        rows={7}
                        value={measurementPresetDraft}
                        onChange={(event) =>
                          setMeasurementPresetDraft(event.target.value)
                        }
                        maxLength={600}
                      />
                    </label>
                    <label>
                      Default cloth amount per garment (optional)
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={measurementPresetClothAmountDraft}
                        onChange={(event) =>
                          setMeasurementPresetClothAmountDraft(
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <div className="modal-actions">
                      {measurementPresetCategoryId !==
                        newMeasurementGarmentOption &&
                        ((measurementPresets[measurementPresetCategoryId] ?? [])
                          .length > 0 ||
                          measurementPresetClothAmounts[
                            measurementPresetCategoryId
                          ] !== undefined) && (
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => void deleteMeasurementPreset()}
                        >
                          <Trash2 size={14} /> Delete preset
                        </button>
                      )}
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => setIsMeasurementPresetFormOpen(false)}
                      >
                        Cancel
                      </button>
                      <button className="primary-button" type="submit">
                        <Check size={15} />{" "}
                        {measurementPresetCategoryId !==
                          newMeasurementGarmentOption &&
                        ((measurementPresets[measurementPresetCategoryId] ?? [])
                          .length > 0 ||
                          measurementPresetClothAmounts[
                            measurementPresetCategoryId
                          ] !== undefined)
                          ? "Save changes"
                          : "Save preset"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>
            )}
          </section>
        ) : activePage === "Customers" ? (
          <>
            {customerFormOpen ? (
              <section
                className="customer-add-page"
                aria-labelledby="add-customer-title"
              >
                <div className="customer-add-header">
                  <h2 id="add-customer-title">Add Customer</h2>
                  <button
                    className="customer-back-button"
                    type="button"
                    onClick={closeCustomerForm}
                  >
                    <ChevronLeft size={15} /> Back
                  </button>
                </div>
                <form className="customer-add-form" onSubmit={saveCustomer}>
                  <div className="customer-add-fields">
                    <label>
                      Full Name <span className="required-mark">*</span>
                      <input
                        autoFocus
                        name="name"
                        placeholder="Enter full name"
                        defaultValue={customerNamePrefill}
                        required
                      />
                    </label>
                    <label>
                      Phone Number <span className="required-mark">*</span>
                      <input
                        name="phone"
                        type="tel"
                        placeholder="055 123 4567"
                        required
                      />
                    </label>
                    <label>
                      WhatsApp Number
                      <input
                        name="whatsapp"
                        type="tel"
                        placeholder="055 123 4567"
                      />
                    </label>
                    <label>
                      Gender
                      <select
                        className="form-select"
                        name="gender"
                        defaultValue="Female"
                      >
                        <option>Female</option>
                        <option>Male</option>
                        <option>Other</option>
                        <option>Prefer not to say</option>
                      </select>
                    </label>
                    <label>
                      Address
                      <input
                        name="address"
                        placeholder="Street, town or city"
                      />
                    </label>
                    <label>
                      Email (Optional)
                      <input
                        name="email"
                        type="email"
                        placeholder="name@example.com"
                      />
                    </label>
                    <div className="customer-add-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={closeCustomerForm}
                      >
                        Cancel
                      </button>
                      <button
                        className="secondary-button save-and-measure-button"
                        type="submit"
                        name="submitAction"
                        value="save-and-measure"
                      >
                        <Ruler size={15} /> Save and add measurements
                      </button>
                      <button
                        className="primary-button"
                        type="submit"
                        name="submitAction"
                        value="save"
                      >
                        <Plus size={15} /> Save Customer
                      </button>
                    </div>
                  </div>
                  <div className="customer-photo-field">
                    <span className="customer-photo-label">Customer Photo</span>
                    <button
                      className={`customer-upload${customerPhotoPreview ? " has-photo" : ""}`}
                      type="button"
                      onClick={() => openPhotoPicker("customer")}
                    >
                      {customerPhotoPreview ? (
                        <img
                          className="customer-photo-preview"
                          src={customerPhotoPreview}
                          alt="Selected customer"
                        />
                      ) : (
                        <span className="customer-upload-prompt">
                          <Camera size={21} strokeWidth={1.5} />
                          <span>Take or upload a customer photo</span>
                        </span>
                      )}
                    </button>
                    <span className="customer-photo-hint">
                      Camera, upload, or gallery · JPG/PNG up to 5 MB
                    </span>
                  </div>
                </form>
              </section>
            ) : (
              <>
                <section
                  className="customer-page"
                  aria-label="Customer management"
                >
                  <div className="customer-page-heading">
                    <div>
                      <p>Manage your customer profiles and measurements</p>
                    </div>
                    <button
                      className="primary-button add-customer-button"
                      type="button"
                      onClick={() => {
                        setContinueToOrder(false);
                        setCustomerFormOpen(true);
                        setCustomerPhotoPreview("");
                        setCustomerPhotoFile(null);
                      }}
                    >
                      <Plus size={16} /> Add Customer
                    </button>
                  </div>

                  <div className="customer-toolbar">
                    <label className="customer-search">
                      <Search size={16} aria-hidden="true" />
                      <input
                        aria-label="Search customers"
                        onChange={(event) => {
                          setCustomerSearch(event.target.value);
                          setCustomerPage(1);
                        }}
                        placeholder="Search by name, phone or customer ID"
                        value={customerSearch}
                      />
                      {customerSearch && (
                        <button
                          type="button"
                          aria-label="Clear customer search"
                          onClick={() => setCustomerSearch("")}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <label className="customer-select">
                      <span className="sr-only">Garment type</span>
                      <select
                        value={garmentFilter}
                        onChange={(event) => {
                          setGarmentFilter(event.target.value);
                          setCustomerPage(1);
                        }}
                      >
                        <option>All Garment Types</option>
                        <option>Dresses</option>
                        <option>Gowns</option>
                        <option>Suits</option>
                        <option>Kaftans</option>
                      </select>
                      <ChevronDown size={14} />
                    </label>
                    <label className="customer-select status-select">
                      <span className="sr-only">Measurement status</span>
                      <select
                        value={customerStatusFilter}
                        onChange={(event) => {
                          setCustomerStatusFilter(event.target.value);
                          setCustomerPage(1);
                        }}
                      >
                        <option>All Statuses</option>
                        <option>Measurements saved</option>
                        <option>Measurements missing</option>
                      </select>
                      <ChevronDown size={14} />
                    </label>
                    <button
                      className={`filter-button${showCustomerFilters ? " selected" : ""}`}
                      type="button"
                      onClick={() =>
                        setShowCustomerFilters((current) => !current)
                      }
                    >
                      <Filter size={15} /> Filter
                    </button>
                  </div>

                  {showCustomerFilters && (
                    <div className="customer-filter-panel">
                      <label>
                        <input
                          type="checkbox"
                          checked={ordersOnly}
                          onChange={(event) => {
                            setOrdersOnly(event.target.checked);
                            setCustomerPage(1);
                          }}
                        />{" "}
                        Customers with orders
                      </label>
                      <span>{filteredCustomers.length} matching customers</span>
                    </div>
                  )}

                  <div className="customer-results-bar">
                    <p>
                      Showing{" "}
                      {filteredCustomers.length === 0
                        ? 0
                        : (customerPage - 1) * 8 + 1}
                      -{Math.min(customerPage * 8, filteredCustomers.length)} of{" "}
                      {filteredCustomers.length} customers
                    </p>
                    <div
                      className="customer-view-toggle"
                      aria-label="Customer display mode"
                    >
                      <button
                        className={customerView === "grid" ? "active" : ""}
                        type="button"
                        aria-label="Grid view"
                        title="Grid view"
                        onClick={() => setCustomerView("grid")}
                      >
                        <Grid2X2 size={17} />
                      </button>
                      <button
                        className={customerView === "list" ? "active" : ""}
                        type="button"
                        aria-label="List view"
                        title="List view"
                        onClick={() => setCustomerView("list")}
                      >
                        <List size={18} />
                      </button>
                    </div>
                  </div>

                  {visibleCustomers.length ? (
                    <div
                      className={`customer-grid${customerView === "list" ? " list-view" : ""}`}
                    >
                      {visibleCustomers.map((customer) => (
                        <article
                          id={`customers-record-${customer.id}`}
                          className={`customer-card${highlightedRecord?.page === "Customers" && highlightedRecord.id === customer.id ? " record-target-highlight" : ""}`}
                          key={customer.id}
                        >
                          <div className="customer-photo">
                            <span>
                              {customer.name
                                .split(" ")
                                .map((part) => part[0])
                                .slice(0, 2)
                                .join("")}
                            </span>
                            {customer.photo && (
                              <img
                                src={portraitUrl(customer.photo)}
                                alt={`${customer.name} profile`}
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";
                                }}
                              />
                            )}
                          </div>
                          <div className="customer-card-body">
                            <h3>{customer.name}</h3>
                            <p className="customer-id">{customer.id}</p>
                            <p className="customer-phone">{customer.phone}</p>
                            <div className="customer-badges">
                              <span className="orders-badge">
                                {customer.orders}{" "}
                                {customer.orders === 1 ? "Order" : "Orders"}
                              </span>
                              <span
                                className={`measurements-badge${customer.measurementsSaved ? "" : " missing"}`}
                              >
                                {customer.measurementsSaved
                                  ? "Measurements saved"
                                  : "Measurements missing"}
                              </span>
                            </div>
                            <div className="customer-card-actions">
                              <button
                                type="button"
                                aria-label={`View ${customer.name}`}
                                title="View customer"
                                onClick={() =>
                                  openCustomerModal("view", customer)
                                }
                              >
                                <Eye size={17} />
                              </button>
                              <button
                                type="button"
                                aria-label={`Edit ${customer.name}`}
                                title="Edit customer"
                                onClick={() =>
                                  openCustomerModal("edit", customer)
                                }
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                className="delete-customer-button"
                                type="button"
                                aria-label={`Delete ${customer.name}`}
                                title="Delete customer"
                                onClick={() => void deleteCustomer(customer)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="customer-empty-state">
                      <Users size={24} />
                      <strong>No customers found</strong>
                      <span>Try changing your search or filters.</span>
                    </div>
                  )}

                  {customerPageCount > 1 && (
                    <nav
                      className="customer-pagination"
                      aria-label="Customer pages"
                    >
                      <button
                        type="button"
                        aria-label="Previous page"
                        disabled={customerPage === 1}
                        onClick={() =>
                          setCustomerPage((page) => Math.max(1, page - 1))
                        }
                      >
                        <ChevronLeft size={17} />
                      </button>
                      {Array.from(
                        { length: customerPageCount },
                        (_, index) => index + 1,
                      ).map((page) => (
                        <button
                          className={customerPage === page ? "active" : ""}
                          key={page}
                          type="button"
                          aria-label={`Page ${page}`}
                          aria-current={
                            customerPage === page ? "page" : undefined
                          }
                          onClick={() => setCustomerPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                      <button
                        type="button"
                        aria-label="Next page"
                        disabled={customerPage === customerPageCount}
                        onClick={() =>
                          setCustomerPage((page) =>
                            Math.min(customerPageCount, page + 1),
                          )
                        }
                      >
                        <ChevronRight size={17} />
                      </button>
                    </nav>
                  )}
                </section>

                {customerModal && (
                  <div
                    className="modal-backdrop"
                    onMouseDown={(event) => {
                      if (event.target === event.currentTarget)
                        setCustomerModal(null);
                    }}
                  >
                    <section
                      className={`order-modal customer-modal${customerModal === "view" ? " customer-detail-modal" : ""}`}
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="customer-modal-title"
                    >
                      <div className="modal-heading">
                        <div>
                          <span className="modal-kicker">
                            CUSTOMER PROFILES
                          </span>
                          <h2 id="customer-modal-title">
                            {customerModal === "view"
                              ? "Customer details"
                              : customerModal === "edit"
                                ? "Edit customer"
                                : "Add customer"}
                          </h2>
                        </div>
                        <button
                          className="icon-button"
                          aria-label="Close dialog"
                          type="button"
                          onClick={() => setCustomerModal(null)}
                        >
                          <X size={18} />
                        </button>
                      </div>
                      {customerModal === "view" && selectedCustomer ? (
                        <div className="customer-detail-content">
                          <div className="customer-detail-profile">
                            <div className="customer-detail-photo">
                              <span>
                                {selectedCustomer.name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .slice(0, 2)
                                  .join("")}
                              </span>
                              {selectedCustomer.photo && (
                                <img
                                  src={portraitUrl(selectedCustomer.photo)}
                                  alt=""
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                />
                              )}
                            </div>
                            <div>
                              <h3>{selectedCustomer.name}</h3>
                              <p>{selectedCustomer.id}</p>
                            </div>
                          </div>
                          <dl>
                            <div>
                              <dt>Phone number</dt>
                              <dd>{selectedCustomer.phone}</dd>
                            </div>
                            <div>
                              <dt>Garment type</dt>
                              <dd>{selectedCustomer.garment}</dd>
                            </div>
                            <div>
                              <dt>Orders</dt>
                              <dd>{selectedCustomer.orders}</dd>
                            </div>
                            <div>
                              <dt>Measurements</dt>
                              <dd>
                                {selectedCustomer.measurementsSaved
                                  ? "Saved"
                                  : "Not saved yet"}
                              </dd>
                            </div>
                          </dl>
                          <section
                            className="customer-timeline"
                            aria-labelledby="customer-timeline-title"
                          >
                            <div className="customer-gallery-history-heading">
                              <div>
                                <h3 id="customer-timeline-title">
                                  Activity timeline
                                </h3>
                                <p>
                                  Orders, payments, measurements, and customer
                                  notes.
                                </p>
                              </div>
                              <span>{selectedCustomerTimeline.length}</span>
                            </div>
                            <form
                              className="customer-note-form"
                              onSubmit={addCustomerNote}
                            >
                              <label htmlFor="customer-note">
                                Add a customer note
                              </label>
                              <textarea
                                id="customer-note"
                                name="customerNote"
                                maxLength={500}
                                placeholder="Add fitting preferences, reminders, or other important details..."
                              />
                              <button
                                className="secondary-button"
                                type="submit"
                              >
                                <Plus size={14} /> Add note
                              </button>
                            </form>
                            {selectedCustomerTimeline.length ? (
                              <ol className="customer-timeline-list">
                                {selectedCustomerTimeline.map((item) => (
                                  <li
                                    className={`customer-timeline-item ${item.type}`}
                                    key={item.id}
                                  >
                                    <span className="customer-timeline-marker">
                                      <Activity size={14} />
                                    </span>
                                    <div className="customer-timeline-copy">
                                      <div>
                                        <strong>{item.title}</strong>
                                        <time>{item.date}</time>
                                      </div>
                                      <p>{item.description}</p>
                                      {item.images?.length ? (
                                        <div className="customer-timeline-photos">
                                          {item.images.map((image, index) => (
                                            <img
                                              key={`${item.id}-${index}`}
                                              src={image.url}
                                              alt={`Measurement garment or style reference ${index + 1}`}
                                              loading="lazy"
                                            />
                                          ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="customer-gallery-history-empty">
                                No activity recorded for this customer yet.
                              </p>
                            )}
                          </section>
                          <section
                            className="customer-garments-section"
                            aria-labelledby="customer-garments-title"
                          >
                            <div className="customer-gallery-history-heading">
                              <h3 id="customer-garments-title">
                                Garments & measurements
                              </h3>
                              <span>{selectedCustomerGarments.length}</span>
                            </div>
                            {selectedCustomerGarments.length ? (
                              <div className="customer-garment-list">
                                {selectedCustomerGarments.map((garment) => {
                                  const styleRecord = clothRecords.find(
                                    (record) =>
                                      record.kind === "style" &&
                                      record.name === garment.styleName,
                                  );
                                  const fabricRecord = clothRecords.find(
                                    (record) =>
                                      record.kind === "fabric" &&
                                      record.name === garment.fabricName,
                                  );
                                  return (
                                    <article
                                      className="customer-garment-card"
                                      key={garment.id}
                                    >
                                      <div className="customer-garment-card-heading">
                                        <div className="customer-garment-visuals">
                                          {garment.photo && (
                                            <img
                                              src={garment.photo}
                                              alt={`${garment.garmentName} cloth`}
                                            />
                                          )}
                                          {styleRecord && (
                                            <div
                                              className={`customer-garment-swatch style-preview fabric-pattern-${styleRecord.pattern}`}
                                              role="img"
                                              aria-label={`${styleRecord.name} style`}
                                              style={
                                                styleRecord.photo
                                                  ? {
                                                      backgroundImage: `url("${styleRecord.photo}")`,
                                                    }
                                                  : undefined
                                              }
                                            >
                                              <span>{styleRecord.name}</span>
                                            </div>
                                          )}
                                          {fabricRecord && (
                                            <div
                                              className={`customer-garment-swatch fabric-swatch fabric-pattern-${fabricRecord.pattern}`}
                                              role="img"
                                              aria-label={`${fabricRecord.name} fabric`}
                                              style={
                                                fabricRecord.photo
                                                  ? {
                                                      backgroundImage: `url("${fabricRecord.photo}")`,
                                                    }
                                                  : undefined
                                              }
                                            >
                                              <span>{fabricRecord.name}</span>
                                            </div>
                                          )}
                                          {!garment.photo &&
                                            !styleRecord &&
                                            !fabricRecord && (
                                              <span className="customer-garment-placeholder">
                                                <Shirt size={20} />
                                              </span>
                                            )}
                                        </div>
                                        <div>
                                          <strong>{garment.garmentName}</strong>
                                          <span>
                                            {[
                                              garment.styleName,
                                              garment.fabricName,
                                            ]
                                              .filter(Boolean)
                                              .join(" · ") || "Custom cloth"}
                                          </span>
                                        </div>
                                        <button
                                          className="secondary-button"
                                          type="button"
                                          onClick={() => {
                                            setEditingGarmentId(
                                              editingGarmentId === garment.id
                                                ? null
                                                : garment.id,
                                            );
                                            setGarmentEditValues(
                                              garment.measurements,
                                            );
                                          }}
                                        >
                                          <Pencil size={14} />{" "}
                                          {editingGarmentId === garment.id
                                            ? "Cancel"
                                            : "Edit"}
                                        </button>
                                      </div>
                                      {editingGarmentId === garment.id ? (
                                        <div className="customer-garment-edit">
                                          {measurementFieldNames.map(
                                            (field) => (
                                              <label key={field}>
                                                {field} (
                                                {garment.unit === "inches"
                                                  ? "in"
                                                  : "cm"}
                                                )
                                                <input
                                                  type="number"
                                                  min="0.1"
                                                  step="0.1"
                                                  value={
                                                    garmentEditValues[field] ??
                                                    ""
                                                  }
                                                  onChange={(event) =>
                                                    setGarmentEditValues(
                                                      (values) => ({
                                                        ...values,
                                                        [field]:
                                                          event.target.value,
                                                      }),
                                                    )
                                                  }
                                                />
                                              </label>
                                            ),
                                          )}
                                          <button
                                            className="primary-button"
                                            type="button"
                                            onClick={() =>
                                              saveGarmentMeasurements(
                                                garment.id,
                                              )
                                            }
                                          >
                                            Save measurements
                                          </button>
                                        </div>
                                      ) : (
                                        <dl className="customer-garment-measurement-list">
                                          {Object.entries(garment.measurements)
                                            .length ? (
                                            Object.entries(
                                              garment.measurements,
                                            ).map(([field, value]) => (
                                              <div key={field}>
                                                <dt>{field}</dt>
                                                <dd>
                                                  {value}{" "}
                                                  {garment.unit === "inches"
                                                    ? "in"
                                                    : "cm"}
                                                </dd>
                                              </div>
                                            ))
                                          ) : (
                                            <p>
                                              No measurements recorded for this
                                              garment.
                                            </p>
                                          )}
                                        </dl>
                                      )}
                                    </article>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="customer-gallery-history-empty">
                                No garments or measurements have been added yet.
                              </p>
                            )}
                          </section>
                          <section
                            className="customer-gallery-history"
                            aria-labelledby="customer-gallery-history-title"
                          >
                            <div className="customer-gallery-history-heading">
                              <h3 id="customer-gallery-history-title">
                                Cloth & style history
                              </h3>
                              <span>
                                {selectedCustomerGalleryHistory.length}
                              </span>
                            </div>
                            {selectedCustomerGalleryHistory.length ? (
                              <div className="customer-gallery-history-list">
                                {selectedCustomerGalleryHistory.map((entry) => (
                                  <article
                                    className="customer-gallery-history-item"
                                    key={entry.id}
                                  >
                                    {clothRecords.find(
                                      (record) =>
                                        record.id === entry.galleryItemId,
                                    )?.photo && (
                                      <img
                                        src={
                                          clothRecords.find(
                                            (record) =>
                                              record.id === entry.galleryItemId,
                                          )?.photo
                                        }
                                        alt=""
                                      />
                                    )}
                                    <div>
                                      <strong>{entry.itemName}</strong>
                                      <span>
                                        {entry.itemKind === "fabric"
                                          ? "Fabric"
                                          : "Cloth style"}{" "}
                                        · {entry.category}
                                      </span>
                                      <small>{entry.color}</small>
                                      {entry.details && <p>{entry.details}</p>}
                                    </div>
                                    <time>
                                      {new Date(
                                        entry.savedAt,
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })}
                                    </time>
                                  </article>
                                ))}
                              </div>
                            ) : (
                              <p className="customer-gallery-history-empty">
                                No fabrics or styles have been saved for this
                                customer yet.
                              </p>
                            )}
                          </section>
                          <div className="modal-actions">
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => setCustomerModal(null)}
                            >
                              Close
                            </button>
                            <button
                              className="primary-button"
                              type="button"
                              onClick={editSelectedCustomer}
                            >
                              <Pencil size={14} /> Edit customer
                            </button>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={saveCustomer}>
                          <label>
                            Customer name
                            <input
                              autoFocus
                              name="name"
                              defaultValue={
                                customerModal === "edit"
                                  ? selectedCustomer?.name
                                  : ""
                              }
                              placeholder="Full name"
                              required
                            />
                          </label>
                          <label>
                            Phone number
                            <input
                              name="phone"
                              defaultValue={
                                customerModal === "edit"
                                  ? selectedCustomer?.phone
                                  : ""
                              }
                              placeholder="055 123 4567"
                              required
                            />
                          </label>
                          <label>
                            Garment type
                            <select
                              className="form-select"
                              name="garment"
                              defaultValue={
                                customerModal === "edit"
                                  ? selectedCustomer?.garment
                                  : "Dresses"
                              }
                            >
                              <option>Dresses</option>
                              <option>Gowns</option>
                              <option>Suits</option>
                              <option>Kaftans</option>
                            </select>
                          </label>
                          {customerModal === "edit" && selectedCustomer && (
                            <div className="customer-edit-photo-field">
                              <span>Customer photo</span>
                              <button
                                className="customer-edit-photo-picker"
                                type="button"
                                onClick={() => openPhotoPicker("customer")}
                              >
                                <span className="customer-edit-photo-preview">
                                  {customerPhotoPreview ? (
                                    <img
                                      src={customerPhotoPreview}
                                      alt={`${selectedCustomer.name} profile preview`}
                                      onError={(event) => {
                                        event.currentTarget.style.display =
                                          "none";
                                      }}
                                    />
                                  ) : (
                                    selectedCustomer.name
                                      .split(" ")
                                      .map((part) => part[0])
                                      .slice(0, 2)
                                      .join("")
                                  )}
                                </span>
                                <span>
                                  {customerPhotoPreview
                                    ? "Change customer image"
                                    : "Set customer image"}
                                </span>
                                <Camera size={16} />
                              </button>
                            </div>
                          )}
                          <div className="modal-actions">
                            <button
                              className="secondary-button"
                              type="button"
                              onClick={() => setCustomerModal(null)}
                            >
                              Cancel
                            </button>
                            <button className="primary-button" type="submit">
                              <Plus size={15} />{" "}
                              {customerModal === "edit"
                                ? "Save changes"
                                : "Add customer"}
                            </button>
                          </div>
                        </form>
                      )}
                    </section>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div
              className={`mobile-create-row${isSearchOpen ? " search-active" : ""}`}
            >
              <button
                className="primary-button"
                type="button"
                onClick={startCustomerOrder}
              >
                <Plus size={16} /> New Order
              </button>
            </div>

            <section className="stats-grid" aria-label="Shop overview">
              <article className="stat-card">
                <span className="stat-label">Total Customers</span>
                <strong className="stat-value">{customerRecords.length}</strong>
                <span className="stat-change positive">
                  Saved customer profiles
                </span>
              </article>
              <article className="stat-card">
                <span className="stat-label">Orders In Progress</span>
                <strong className="stat-value">{activeOrderCount}</strong>
                <button
                  className="text-link"
                  type="button"
                  onClick={() => setActivePage("Orders")}
                >
                  View all orders
                </button>
              </article>
              <article className="stat-card">
                <span className="stat-label">Completed Orders</span>
                <strong className="stat-value">{completedOrderCount}</strong>
                <span className="stat-change positive">
                  Completed or delivered
                </span>
              </article>
              <article className="stat-card revenue-stat">
                <span className="stat-label">Revenue Collected</span>
                <strong className="stat-value">
                  {formatCurrency(totalRevenue)}
                </strong>
                <span className="stat-change positive">
                  Across recorded payments
                </span>
              </article>
            </section>

            <section
              className="overview-grid"
              aria-label="Orders and customers overview"
            >
              <article className="panel status-panel">
                <h2>Orders by Status</h2>
                <div className="status-content">
                  <svg
                    className="donut-chart"
                    viewBox="0 0 100 100"
                    role="group"
                    aria-label={`Orders by status: ${orders.length} total orders`}
                  >
                    <circle className="donut-track" cx="50" cy="50" r="42" />
                    {statusChartSegments.map((status) => (
                      <circle
                        className="donut-segment"
                        key={status.label}
                        cx="50"
                        cy="50"
                        r="42"
                        stroke={statusChartColors[status.color]}
                        strokeDasharray={`${status.fraction * 263.89} 263.89`}
                        strokeDashoffset={`${-status.offset * 263.89}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`${status.label}: ${status.count} orders. Select to view orders.`}
                        onMouseEnter={() => setActiveStatusChart(status.label)}
                        onMouseLeave={() => setActiveStatusChart(null)}
                        onFocus={() => setActiveStatusChart(status.label)}
                        onBlur={() => setActiveStatusChart(null)}
                        onClick={() => {
                          setOrderStatusFilter(status.label);
                          setActivePage("Orders");
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setOrderStatusFilter(status.label);
                            setActivePage("Orders");
                          }
                        }}
                      >
                        <title>
                          {status.label}: {status.count} orders
                        </title>
                        <animate
                          attributeName="stroke-dasharray"
                          from="0 263.89"
                          to={`${status.fraction * 263.89} 263.89`}
                          dur="900ms"
                          fill="freeze"
                        />
                      </circle>
                    ))}
                    <text className="donut-center-value" x="50" y="48">
                      {activeStatusChart
                        ? (statusChartSegments.find(
                            (status) => status.label === activeStatusChart,
                          )?.count ?? "0")
                        : orders.length}
                    </text>
                    <text className="donut-center-label" x="50" y="60">
                      {activeStatusChart ?? "Orders"}
                    </text>
                  </svg>
                  <ul className="status-legend">
                    {statusChartRows.map((status) => (
                      <li key={status.label}>
                        <button
                          className="status-legend-item"
                          type="button"
                          onClick={() => {
                            setOrderStatusFilter(status.label);
                            setActivePage("Orders");
                          }}
                        >
                          <span className={`legend-dot ${status.color}`} />
                          <span>{status.label}</span>
                          <strong>{status.count}</strong>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>

              <article className="panel delivery-panel">
                <div className="panel-heading">
                  <h2>Upcoming Deliveries</h2>
                  <button
                    className="icon-button panel-more"
                    type="button"
                    aria-label="View calendar"
                    onClick={() => setActivePage("Calendar")}
                  >
                    <CalendarDays size={16} />
                  </button>
                </div>
                <div className="people-list delivery-list">
                  {upcomingDeliveries.map((order, index) => (
                    <button
                      className="person-row record-link"
                      key={order.id}
                      type="button"
                      onClick={() => openRecord("Orders", order.id)}
                    >
                      <span
                        className={`avatar ${["rose", "orange", "blue", "green"][index]}`}
                      >
                        {order.customer
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span className="person-copy">
                        <strong>{order.customer}</strong>
                        <small>{order.item}</small>
                      </span>
                      <time>{order.date}</time>
                    </button>
                  ))}
                  {upcomingDeliveries.length === 0 && (
                    <p className="dashboard-empty-message">
                      No upcoming deliveries recorded.
                    </p>
                  )}
                </div>
                <button
                  className="panel-link"
                  type="button"
                  onClick={() => setActivePage("Calendar")}
                >
                  View calendar
                </button>
              </article>

              <article className="panel customers-panel">
                <div className="panel-heading">
                  <h2>Recent Customers</h2>
                  <button
                    className="icon-button panel-more"
                    type="button"
                    aria-label="View customers"
                    onClick={() => setActivePage("Customers")}
                  >
                    <Users size={16} />
                  </button>
                </div>
                <div className="people-list customer-list">
                  {recentCustomers.map((customer, index) => (
                    <button
                      className="person-row record-link"
                      key={customer.id}
                      type="button"
                      onClick={() => openRecord("Customers", customer.id)}
                    >
                      <span
                        className={`avatar ${["peach", "lavender", "mint", "sand"][index]}`}
                      >
                        {customer.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <span className="person-copy">
                        <strong>{customer.name}</strong>
                        <small>
                          {customer.orders}{" "}
                          {customer.orders === 1 ? "order" : "orders"}
                        </small>
                      </span>
                    </button>
                  ))}
                  {recentCustomers.length === 0 && (
                    <p className="dashboard-empty-message">
                      No customer profiles saved yet.
                    </p>
                  )}
                </div>
                <button
                  className="panel-link"
                  type="button"
                  onClick={() => setActivePage("Customers")}
                >
                  View all customers
                </button>
              </article>
            </section>

            <section
              className="bottom-grid"
              aria-label="Recent orders and revenue"
            >
              <article className="panel orders-panel">
                <div className="panel-heading">
                  <h2>Recent Orders</h2>
                  <button
                    className="icon-button panel-more"
                    type="button"
                    aria-label="Create order"
                    onClick={startCustomerOrder}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Item</th>
                        <th>Status</th>
                        <th>Delivery Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <a
                              href={`#${order.id.slice(1)}`}
                              onClick={(event) => {
                                event.preventDefault();
                                openRecord("Orders", order.id);
                              }}
                            >
                              {order.id}
                            </a>
                          </td>
                          <td>{order.customer}</td>
                          <td>{order.item}</td>
                          <td>
                            <span
                              className={`order-status ${order.status.toLowerCase()}`}
                            >
                              {order.status}
                            </span>
                          </td>
                          <td>{order.date}</td>
                        </tr>
                      ))}
                      {filteredOrders.length === 0 && (
                        <tr>
                          <td className="empty-state" colSpan={5}>
                            No matching orders
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>

              <article className="panel revenue-panel">
                <div className="panel-heading">
                  <h2>Revenue Overview</h2>
                  <label className="period-select">
                    <span className="sr-only">Revenue period</span>
                    <select
                      value={period}
                      onChange={(event) => {
                        setPeriod(event.target.value as typeof period);
                        setActiveRevenuePoint(null);
                      }}
                    >
                      <option>This Month</option>
                      <option>Last Month</option>
                      <option>This Year</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
                <strong className="chart-value">
                  {formatCurrency(revenuePeriodTotal)}
                </strong>
                <span className="chart-change">
                  {activeRevenuePoint === null
                    ? `Received ${period.toLowerCase()}`
                    : `${revenuePoints[activeRevenuePoint].date.toLocaleDateString("en-US", { month: "short", day: period === "This Year" ? undefined : "numeric" })}: ${formatCurrency(revenuePoints[activeRevenuePoint].amount)}`}
                </span>
                <div
                  className="revenue-chart"
                  role="group"
                  aria-label={`Revenue by ${period.toLowerCase()}`}
                >
                  <div className="chart-y-labels">
                    <span>{compactCurrency(revenueAxisMax)}</span>
                    <span>
                      {compactCurrency(Math.round(revenueAxisMax * 0.75))}
                    </span>
                    <span>
                      {compactCurrency(Math.round(revenueAxisMax * 0.5))}
                    </span>
                    <span>
                      {compactCurrency(Math.round(revenueAxisMax * 0.25))}
                    </span>
                    <span>0</span>
                  </div>
                  <svg viewBox="0 0 360 146" preserveAspectRatio="none">
                    <defs>
                      <linearGradient
                        id="revenueFill"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#9b4de0"
                          stopOpacity=".22"
                        />
                        <stop
                          offset="100%"
                          stopColor="#9b4de0"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                    <path
                      className="chart-area"
                      key={`area-${period}-${revenueSeriesKey}`}
                      d={revenueAreaPath}
                    />
                    <path
                      className="chart-line"
                      key={`line-${period}-${revenueSeriesKey}`}
                      pathLength="1"
                      d={revenueLinePath}
                    />
                    {revenuePoints.map((point, index) => (
                      <circle
                        className={activeRevenuePoint === index ? "active" : ""}
                        key={`${period}-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r={activeRevenuePoint === index ? 4 : 2.4}
                        tabIndex={0}
                        role="img"
                        aria-label={`${point.date.toLocaleDateString("en-US", { month: "long", day: period === "This Year" ? undefined : "numeric" })}: ${formatCurrency(point.amount)}`}
                        style={{
                          animationDelay: `${Math.min(index * 30, 800)}ms`,
                        }}
                        onMouseEnter={() => setActiveRevenuePoint(index)}
                        onMouseLeave={() => setActiveRevenuePoint(null)}
                        onFocus={() => setActiveRevenuePoint(index)}
                        onBlur={() => setActiveRevenuePoint(null)}
                      >
                        <title>{`${point.date.toLocaleDateString("en-US", { month: "long", day: period === "This Year" ? undefined : "numeric" })}: ${formatCurrency(point.amount)}`}</title>
                      </circle>
                    ))}
                  </svg>
                  <div className="chart-x-labels">
                    {revenueLabelIndices.map((index) => (
                      <span key={index}>
                        {period === "This Year"
                          ? revenuePoints[index].date.toLocaleDateString(
                              "en-US",
                              { month: "short" },
                            )
                          : revenuePoints[index].date.toLocaleDateString(
                              "en-US",
                              { day: "numeric", month: "short" },
                            )}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </section>
          </>
        )}
      </main>

      {cameraTarget && (
        <div className="photo-capture-backdrop" role="presentation">
          <section
            className="photo-capture-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="photo-capture-title"
          >
            <div className="photo-capture-heading">
              <button
                className="customer-back-button"
                type="button"
                onClick={closePhotoPicker}
              >
                <ChevronLeft size={16} /> Back
              </button>
              <div>
                <span>PHOTO STUDIO</span>
                <h2 id="photo-capture-title">
                  {cameraTarget === "customer"
                    ? "Customer photo"
                    : cameraTarget === "measurementStyle"
                      ? "Style reference"
                      : "Garment photo"}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close photo studio"
                type="button"
                onClick={closePhotoPicker}
              >
                <X size={18} />
              </button>
            </div>
            <div
              className="photo-capture-tabs"
              role="tablist"
              aria-label="Photo source"
            >
              {(["Camera", "Upload", "Gallery"] as const).map((tab) => (
                <button
                  className={cameraTab === tab ? "active" : ""}
                  id={`photo-tab-${tab.toLowerCase()}`}
                  role="tab"
                  aria-selected={cameraTab === tab}
                  key={tab}
                  type="button"
                  onClick={() => {
                    setCameraError("");
                    setCameraTab(tab);
                  }}
                >
                  {tab === "Camera" ? (
                    <Camera size={16} />
                  ) : tab === "Upload" ? (
                    <Upload size={16} />
                  ) : (
                    <Images size={16} />
                  )}
                  {tab}
                </button>
              ))}
            </div>
            {cameraTab === "Camera" ? (
              <div className="photo-capture-camera">
                <video
                  ref={cameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  aria-label="Live camera preview"
                />
                {cameraError && (
                  <p className="photo-capture-error" role="status">
                    {cameraError}
                  </p>
                )}
                <button
                  className="photo-capture-button"
                  type="button"
                  aria-label="Capture photo"
                  onClick={capturePhoto}
                >
                  <Camera size={22} />
                </button>
              </div>
            ) : cameraTab === "Upload" ? (
              <div className="photo-capture-upload">
                <Upload size={28} />
                <strong>Choose a photo from this device</strong>
                <p>JPG or PNG, up to 5 MB.</p>
                <label className="primary-button">
                  <input
                    accept="image/jpeg,image/png"
                    type="file"
                    onChange={handlePhotoPickerFile}
                  />
                  Browse photos
                </label>
              </div>
            ) : (
              <div className="photo-capture-gallery">
                {clothRecords.filter(
                  (record) =>
                    record.photo &&
                    (cameraTarget !== "measurementStyle" ||
                      record.kind === "style"),
                ).length ? (
                  clothRecords
                    .filter(
                      (record) =>
                        record.photo &&
                        (cameraTarget !== "measurementStyle" ||
                          record.kind === "style"),
                    )
                    .map((record) => (
                      <button
                        type="button"
                        key={record.id}
                        onClick={() => selectGalleryPhoto(record.photo ?? "")}
                      >
                        <img src={record.photo} alt="" />
                        <span>{record.name}</span>
                        <small>
                          {record.kind === "fabric" ? "Fabric" : "Cloth style"}
                        </small>
                      </button>
                    ))
                ) : (
                  <p>
                    {cameraTarget === "measurementStyle"
                      ? "No saved styles yet. Add a style image in Cloth Gallery or use Upload."
                      : "No saved gallery photos yet. Add an image in Cloth Gallery or use Upload."}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <nav
        className={`mobile-nav${customerFormOpen ? " form-open" : ""}`}
        aria-label="Mobile navigation"
      >
        <button
          className={activePage === "Dashboard" ? "selected" : ""}
          type="button"
          onClick={() => setActivePage("Dashboard")}
        >
          <LayoutDashboard size={17} />
          <span>Dashboard</span>
        </button>
        <button
          className={activePage === "Customers" ? "selected" : ""}
          type="button"
          onClick={() => setActivePage("Customers")}
        >
          <Users size={17} />
          <span>Customers</span>
        </button>
        <button
          className="mobile-add"
          type="button"
          aria-label="New order"
          onClick={startCustomerOrder}
        >
          <Plus size={20} />
        </button>
        <button
          className={activePage === "Orders" ? "selected" : ""}
          type="button"
          onClick={() => setActivePage("Orders")}
        >
          <ClipboardList size={17} />
          <span>Orders</span>
        </button>
        <button
          className={`${isMoreMenuOpen || ["Calendar", "Cloth Gallery", "Measurements", "Apprentices", "Tasks", "Payments", "Reports", "Settings", "Notifications", "Help"].includes(activePage) ? "selected" : ""}`}
          type="button"
          aria-expanded={isMoreMenuOpen}
          aria-controls="mobile-more-menu"
          onClick={() => setIsMoreMenuOpen((open) => !open)}
        >
          <Ellipsis size={19} />
          <span>More</span>
        </button>
      </nav>

      {isMoreMenuOpen && (
        <>
          <button
            className="mobile-more-backdrop"
            type="button"
            aria-label="Close more pages menu"
            onClick={() => setIsMoreMenuOpen(false)}
          />
          <nav
            className="mobile-more-menu"
            id="mobile-more-menu"
            aria-label="More pages"
          >
            <div className="mobile-more-heading">
              <span>More pages</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setIsMoreMenuOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            {[
              { label: "Notifications", icon: Bell },
              { label: "Help", icon: BookOpen },
              { label: "Calendar", icon: CalendarDays },
              { label: "Cloth Gallery", icon: Images },
              { label: "Measurements", icon: Ruler },
              { label: "Apprentices", icon: UserRound },
              { label: "Tasks", icon: ListChecks },
              { label: "Payments", icon: CreditCard },
              { label: "Reports", icon: BarChart3 },
              { label: "Settings", icon: Settings },
            ].map(({ label, icon: Icon }) => (
              <button
                className={activePage === label ? "selected" : ""}
                key={label}
                role="menuitem"
                type="button"
                onClick={() => {
                  setActivePage(label);
                  setIsMoreMenuOpen(false);
                }}
              >
                <Icon size={17} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      {notice && (
        <div className="toast" role="status">
          <Check size={15} />
          {notice}
        </div>
      )}

      {confirmationDialog && (
        <div
          className="modal-backdrop confirmation-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget)
              resolveConfirmation(false);
          }}
        >
          <section
            className="order-modal confirmation-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirmation-dialog-title"
            aria-describedby="confirmation-dialog-message"
          >
            <div className="modal-heading">
              <div>
                <span className="modal-kicker">
                  {confirmationDialog.destructive ? "PLEASE CONFIRM" : "CONFIRMATION"}
                </span>
                <h2 id="confirmation-dialog-title">
                  {confirmationDialog.title}
                </h2>
              </div>
            </div>
            <p id="confirmation-dialog-message">
              {confirmationDialog.message}
            </p>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                autoFocus
                onClick={() => resolveConfirmation(false)}
              >
                Cancel
              </button>
              <button
                className={
                  confirmationDialog.destructive
                    ? "confirmation-danger-button"
                    : "primary-button"
                }
                type="button"
                onClick={() => resolveConfirmation(true)}
              >
                {confirmationDialog.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}

      {isOrderOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOrderOpen(false);
          }}
        >
          <section
            className="order-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-title"
          >
            <div className="modal-heading">
              <div>
                <span className="modal-kicker">ORDER MANAGEMENT</span>
                <h2 id="order-title">Create new order</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close dialog"
                type="button"
                onClick={() => setIsOrderOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={createOrder}>
              <label>
                Customer
                {isSupabaseConfigured ? (
                  <select
                    autoFocus
                    className="form-select"
                    name="customer"
                    defaultValue={newOrderCustomerName}
                    required
                  >
                    <option value="" disabled>
                      Select a saved customer
                    </option>
                    {customerRecords.map((customer) => (
                      <option key={customer.id} value={customer.name}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    autoFocus
                    name="customer"
                    defaultValue={newOrderCustomerName}
                    placeholder="Customer name"
                    required
                  />
                )}
              </label>
              <label>
                Garment or design
                <input
                  name="item"
                  placeholder="e.g. Two Piece Dress"
                  required
                />
              </label>
              <div className="form-row">
                <label>
                  Delivery date
                  <input name="deliveryDate" type="date" required />
                </label>
                <label>
                  Estimated price
                  <input
                    name="price"
                    type="number"
                    min="0"
                    placeholder={`${shopSettings.currency === "GHS" ? "GH₵" : "$"} 0.00`}
                    required
                  />
                </label>
              </div>
              {orderFormError && (
                <p className="payment-form-error" role="alert">
                  {orderFormError}
                </p>
              )}
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setIsOrderOpen(false);
                    setOrderFormError("");
                  }}
                >
                  Cancel
                </button>
                <button className="primary-button" type="submit">
                  <Plus size={15} /> Create order
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {selectedOrder && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedOrderId(null);
          }}
        >
          <section
            className="order-modal order-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title"
          >
            <div className="modal-heading">
              <div>
                <span className="modal-kicker">ORDER DETAILS</span>
                <h2 id="order-detail-title">{selectedOrder.id}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close dialog"
                type="button"
                onClick={() => setSelectedOrderId(null)}
              >
                <X size={18} />
              </button>
            </div>
            <dl className="order-detail-grid">
              <div>
                <dt>Customer</dt>
                <dd>{selectedOrder.customer}</dd>
              </div>
              <div>
                <dt>Garment / Design</dt>
                <dd>{selectedOrder.item}</dd>
              </div>
              <div>
                <dt>Delivery date</dt>
                <dd>
                  <span
                    className={`order-delivery-date ${orderDeliveryState(selectedOrder)}`}
                  >
                    {selectedOrder.date}
                    {orderDeliveryState(selectedOrder) === "overdue" ? (
                      <small>Overdue</small>
                    ) : orderDeliveryState(selectedOrder) === "today" ? (
                      <small>Due today</small>
                    ) : orderDeliveryState(selectedOrder) === "soon" ? (
                      <small>Due soon</small>
                    ) : null}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Order total</dt>
                <dd>{formatCurrency(selectedOrder.amount)}</dd>
              </div>
              {selectedOrder.quantity !== undefined && (
                <>
                  <div>
                    <dt>Garment quantity</dt>
                    <dd>{selectedOrder.quantity}</dd>
                  </div>
                  <div>
                    <dt>Price per garment</dt>
                    <dd>{formatCurrency(selectedOrder.unitPrice ?? 0)}</dd>
                  </div>
                  {(selectedOrder.clothAmount ?? 0) > 0 && (
                    <div>
                      <dt>Cloth per garment</dt>
                      <dd>{formatCurrency(selectedOrder.clothAmount ?? 0)}</dd>
                    </div>
                  )}
                  {(selectedOrder.discountAmount ?? 0) > 0 && (
                    <div>
                      <dt>Discount</dt>
                      <dd>
                        −{formatCurrency(selectedOrder.discountAmount ?? 0)}
                      </dd>
                    </div>
                  )}
                </>
              )}
              <div>
                <dt>Current status</dt>
                <dd>
                  <span
                    className={`order-status ${selectedOrder.status.toLowerCase()}`}
                  >
                    {selectedOrder.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Payment balance</dt>
                <dd>
                  {formatCurrency(selectedOrderBalance)}
                  {selectedOrderPayment?.paid ? (
                    <small className="order-payment-summary">
                      {" "}
                      · {formatCurrency(selectedOrderPayment.paid)} paid
                    </small>
                  ) : null}
                </dd>
              </div>
            </dl>
            <div className="order-detail-quick-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSelectedOrderId(null);
                  if (selectedOrderCustomer) {
                    setSelectedCustomerId(selectedOrderCustomer.id);
                    setCustomerModal("view");
                    setActivePage("Customers");
                  } else {
                    setActivePage("Customers");
                  }
                }}
              >
                <Users size={14} /> View customer
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={!selectedOrderPayment || selectedOrderBalance <= 0}
                onClick={() => {
                  if (!selectedOrderPayment || selectedOrderBalance <= 0)
                    return;
                  setSelectedOrderId(null);
                  openPaymentForm(selectedOrderPayment);
                  setActivePage("Payments");
                }}
              >
                <CreditCard size={14} />{" "}
                {selectedOrderBalance > 0 ? "Record payment" : "Paid in full"}
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setTaskOrderPrefill(selectedOrder.id);
                  setSelectedOrderId(null);
                  setActivePage("Tasks");
                  setIsTaskFormOpen(true);
                }}
              >
                <ListChecks size={14} /> Add task
              </button>
            </div>
            <div className="modal-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setSelectedOrderId(null)}
              >
                Close
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setSelectedOrderId(null);
                  setNewOrderCustomerName(selectedOrder.customer);
                  setIsOrderOpen(true);
                }}
              >
                <Pencil size={14} /> Create another
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
