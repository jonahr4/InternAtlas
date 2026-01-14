import { getFirestore, collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, Timestamp } from "firebase/firestore";
import { app } from "./firebase";

// Get Firestore instance
const db = getFirestore(app);

export interface CustomTable {
  id: string;
  userId: string;
  name: string;
  titleKeywords: string[];
  locationKeywords: string[];
  companyFilter: string;
  selectedPlatforms: string[];
  lastSeenAt: Date | null;
  newJobCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomTableInput {
  userId: string;
  name: string;
  titleKeywords: string[];
  locationKeywords: string[];
  companyFilter: string;
  selectedPlatforms: string[];
}

// Convert Firestore document to CustomTable
function docToCustomTable(docId: string, data: any): CustomTable {
  return {
    id: docId,
    userId: data.userId,
    name: data.name,
    titleKeywords: data.titleKeywords || [],
    locationKeywords: data.locationKeywords || [],
    companyFilter: data.companyFilter || "",
    selectedPlatforms: data.selectedPlatforms || ["GREENHOUSE", "LEVER", "WORKDAY", "ICIMS"],
    lastSeenAt: data.lastSeenAt?.toDate() || null,
    newJobCount: data.newJobCount || 0,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

// Get all custom tables for a user
export async function getUserCustomTables(userId: string): Promise<CustomTable[]> {
  try {
    // Try with orderBy first (requires index)
    const q = query(
      collection(db, "customTables"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => docToCustomTable(doc.id, doc.data()));
  } catch (error: any) {
    // If index not created yet, fall back to query without orderBy
    if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
      console.warn('Firestore index not created yet. Using simple query. Create index in Firebase Console for better performance.');
      const q = query(
        collection(db, "customTables"),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(q);
      const tables = snapshot.docs.map(doc => docToCustomTable(doc.id, doc.data()));
      // Sort client-side
      return tables.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    throw error;
  }
}

// Get a single custom table
export async function getCustomTable(tableId: string): Promise<CustomTable | null> {
  const docRef = doc(db, "customTables", tableId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return docToCustomTable(docSnap.id, docSnap.data());
}

// Create a new custom table
export async function createCustomTable(input: CreateCustomTableInput): Promise<string> {
  const now = Timestamp.now();
  
  const docRef = await addDoc(collection(db, "customTables"), {
    userId: input.userId,
    name: input.name,
    titleKeywords: input.titleKeywords,
    locationKeywords: input.locationKeywords,
    companyFilter: input.companyFilter,
    selectedPlatforms: input.selectedPlatforms,
    lastSeenAt: null,
    newJobCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  
  return docRef.id;
}

// Update a custom table
export async function updateCustomTable(
  tableId: string,
  updates: Partial<Omit<CustomTable, "id" | "userId" | "createdAt">>
): Promise<void> {
  const docRef = doc(db, "customTables", tableId);
  
  const firestoreUpdates: any = {
    ...updates,
    updatedAt: Timestamp.now(),
  };
  
  // Convert Date to Timestamp if lastSeenAt is provided
  if (updates.lastSeenAt) {
    firestoreUpdates.lastSeenAt = Timestamp.fromDate(updates.lastSeenAt);
  }
  
  await updateDoc(docRef, firestoreUpdates);
}

// Delete a custom table
export async function deleteCustomTable(tableId: string): Promise<void> {
  const docRef = doc(db, "customTables", tableId);
  await deleteDoc(docRef);
}

// Mark all jobs as seen (updates lastSeenAt and resets newJobCount)
export async function markTableAsSeen(tableId: string): Promise<void> {
  const docRef = doc(db, "customTables", tableId);
  await updateDoc(docRef, {
    lastSeenAt: Timestamp.now(),
    newJobCount: 0,
    updatedAt: Timestamp.now(),
  });
}

// Update new job count for a table
export async function updateNewJobCount(tableId: string, count: number): Promise<void> {
  const docRef = doc(db, "customTables", tableId);
  await updateDoc(docRef, {
    newJobCount: count,
    updatedAt: Timestamp.now(),
  });
}

// ============================================================
// APPLICATION TRACKING
// ============================================================

export interface TrackedJob {
  id: string;
  userId: string;
  jobId: string; // ID from the Job table in Postgres
  status: "to_apply" | "applied";
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTrackedJobInput {
  userId: string;
  jobId: string;
  status: "to_apply" | "applied";
}

// Convert Firestore document to TrackedJob
function docToTrackedJob(docId: string, data: any): TrackedJob {
  return {
    id: docId,
    userId: data.userId,
    jobId: data.jobId,
    status: data.status,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  };
}

// Get all tracked jobs for a user
export async function getUserTrackedJobs(userId: string): Promise<TrackedJob[]> {
  try {
    const q = query(
      collection(db, "trackedJobs"),
      where("userId", "==", userId),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => docToTrackedJob(doc.id, doc.data()));
  } catch (error: any) {
    if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
      console.warn('Firestore index not created yet. Using simple query. Create index in Firebase Console for better performance.');
      const q = query(
        collection(db, "trackedJobs"),
        where("userId", "==", userId)
      );
      const snapshot = await getDocs(q);
      const jobs = snapshot.docs.map(doc => docToTrackedJob(doc.id, doc.data()));
      return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    throw error;
  }
}

// Get tracked jobs by status
export async function getUserTrackedJobsByStatus(
  userId: string,
  status: "to_apply" | "applied"
): Promise<TrackedJob[]> {
  try {
    const q = query(
      collection(db, "trackedJobs"),
      where("userId", "==", userId),
      where("status", "==", status),
      orderBy("createdAt", "desc")
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => docToTrackedJob(doc.id, doc.data()));
  } catch (error: any) {
    if (error?.code === 'failed-precondition' || error?.message?.includes('index')) {
      console.warn('Firestore index not created yet. Using simple query.');
      const q = query(
        collection(db, "trackedJobs"),
        where("userId", "==", userId),
        where("status", "==", status)
      );
      const snapshot = await getDocs(q);
      const jobs = snapshot.docs.map(doc => docToTrackedJob(doc.id, doc.data()));
      return jobs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
    throw error;
  }
}

// Add a job to tracking
export async function addTrackedJob(input: CreateTrackedJobInput): Promise<string> {
  const now = Timestamp.now();
  
  // Check if job already exists for this user
  const existingQuery = query(
    collection(db, "trackedJobs"),
    where("userId", "==", input.userId),
    where("jobId", "==", input.jobId)
  );
  
  const existingSnapshot = await getDocs(existingQuery);
  
  if (!existingSnapshot.empty) {
    // Update existing entry
    const existingDoc = existingSnapshot.docs[0];
    await updateDoc(doc(db, "trackedJobs", existingDoc.id), {
      status: input.status,
      updatedAt: now,
    });
    return existingDoc.id;
  }
  
  // Create new entry
  const docRef = await addDoc(collection(db, "trackedJobs"), {
    userId: input.userId,
    jobId: input.jobId,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  });
  
  return docRef.id;
}

// Update tracked job status
export async function updateTrackedJobStatus(
  trackedJobId: string,
  status: "to_apply" | "applied"
): Promise<void> {
  const docRef = doc(db, "trackedJobs", trackedJobId);
  await updateDoc(docRef, {
    status,
    updatedAt: Timestamp.now(),
  });
}

// Delete a tracked job
export async function deleteTrackedJob(trackedJobId: string): Promise<void> {
  const docRef = doc(db, "trackedJobs", trackedJobId);
  await deleteDoc(docRef);
}

// Bulk add tracked jobs
export async function bulkAddTrackedJobs(
  userId: string,
  jobIds: string[],
  status: "to_apply" | "applied"
): Promise<void> {
  const promises = jobIds.map(jobId =>
    addTrackedJob({ userId, jobId, status })
  );
  await Promise.all(promises);
}
