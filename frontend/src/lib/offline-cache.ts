import type { WorkspaceData } from "./workspace";

const databaseName = "qt-fashion-offline";
const databaseVersion = 1;
const workspaceStoreName = "workspaces";

type CachedWorkspace = {
  userId: string;
  savedAt: string;
  data: WorkspaceData;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(workspaceStoreName)) {
        database.createObjectStore(workspaceStoreName, { keyPath: "userId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open offline storage."));
  });
}

export async function saveCachedWorkspace(
  userId: string,
  data: WorkspaceData,
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(workspaceStoreName, "readwrite");
      transaction.objectStore(workspaceStoreName).put({
        userId,
        savedAt: new Date().toISOString(),
        data,
      } satisfies CachedWorkspace);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not save offline records."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Offline record storage was interrupted."));
    });
  } finally {
    database.close();
  }
}

export async function loadCachedWorkspace(
  userId: string,
): Promise<CachedWorkspace | null> {
  const database = await openDatabase();
  try {
    return await new Promise<CachedWorkspace | null>((resolve, reject) => {
      const transaction = database.transaction(workspaceStoreName, "readonly");
      const request = transaction.objectStore(workspaceStoreName).get(userId);
      request.onsuccess = () =>
        resolve((request.result as CachedWorkspace | undefined) ?? null);
      request.onerror = () =>
        reject(request.error ?? new Error("Could not read offline records."));
    });
  } finally {
    database.close();
  }
}

export async function removeCachedWorkspace(userId: string): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(workspaceStoreName, "readwrite");
      transaction.objectStore(workspaceStoreName).delete(userId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Could not remove offline records."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Offline record cleanup was interrupted."));
    });
  } finally {
    database.close();
  }
}
