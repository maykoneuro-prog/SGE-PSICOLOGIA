import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  query, 
  where, 
  serverTimestamp,
  getDoc,
  onSnapshot,
  getCountFromServer
} from 'firebase/firestore';
import { db, auth } from '../firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function applyUnitSecurity(q: any, filters: any, userId: string): { query: any, isAllowed: boolean } {
  const isSuperAdmin = filters?.isAdmin === true;
  const allowedUnits = (filters?.allowedUnits || []).map((u: string) => u.trim().toUpperCase());
  
  if (isSuperAdmin) {
    if (filters?.unit && !['Administração Central', 'Sede', 'ADMINISTRAÇÃO CENTRAL', 'SEDE'].includes(filters.unit.trim().toUpperCase())) {
      const unitValue = String(filters.unit).trim().toUpperCase();
      return { query: query(q, where('unit', '==', unitValue)), isAllowed: true };
    }
    return { query: q, isAllowed: true };
  }

  // Não é Super Admin: restrição por unidade ou propriedade
  if (allowedUnits.length > 0) {
    if (filters?.unit && !['Administração Central', 'Sede', 'ADMINISTRAÇÃO CENTRAL', 'SEDE'].includes(filters.unit.trim().toUpperCase())) {
      const requestedUnit = String(filters.unit).trim().toUpperCase();
      const isAllowed = allowedUnits.some(u => {
        const cleanAllowed = u.replace(/^(SESI|UNIDADE|ESCOLA|CENTRO|DEPARTAMENTO)\s+/gi, "").trim();
        const cleanRequested = requestedUnit.replace(/^(SESI|UNIDADE|ESCOLA|CENTRO|DEPARTAMENTO)\s+/gi, "").trim();
        return u === requestedUnit || (cleanAllowed !== "" && cleanAllowed === cleanRequested);
      });
      
      if (!isAllowed) return { query: q, isAllowed: false };
      return { query: query(q, where('unit', '==', requestedUnit)), isAllowed: true };
    } else {
      if (allowedUnits.length <= 30) {
        return { query: query(q, where('unit', 'in', allowedUnits)), isAllowed: true };
      } else {
        return { query: query(q, where(filters?.professionalId === userId ? 'professionalId' : 'ownerId', '==', userId)), isAllowed: true };
      }
    }
  } else {
    return { query: query(q, where(filters?.professionalId === userId ? 'professionalId' : 'ownerId', '==', userId)), isAllowed: true };
  }
}

export const api = {
  // Helper for generic fetch (if needed for seed or other things)
  async fetch(endpoint: string, options: any = {}) {
    const response = await fetch(`/api${endpoint}`, options);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Something went wrong");
    }
    return response.json();
  },

  users: {
    list: async () => {
      const path = 'users';
      try {
        const snapshot = await getDocs(collection(db, path));
        return snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    findByEmail: async (email: string) => {
      const path = 'users';
      try {
        const q = query(collection(db, path), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const docSnap = snapshot.docs[0];
        return { ...(docSnap.data() as any), id: docSnap.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    },
    create: async (data: any) => {
      const path = 'users';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          createdAt: serverTimestamp()
        });
        return { ...data, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    update: async (id: string, data: any) => {
      const path = `users/${id}`;
      try {
        await updateDoc(doc(db, 'users', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    updateStatus: async (id: string, status: string) => {
      const path = `users/${id}`;
      try {
        await updateDoc(doc(db, 'users', id), { status });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    delete: async (id: string) => {
      const path = `users/${id}`;
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    initializeTrial: async (user: any, extraData?: any) => {
      const path = `users/${user.uid}`;
      try {
        // Check if user already exists
        const q = query(collection(db, 'users'), where('email', '==', user.email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const existing = snapshot.docs[0].data();
          // Update whatsapp if provided and missing
          if (extraData?.phoneNumber && !existing.phoneNumber) {
            await updateDoc(doc(db, 'users', snapshot.docs[0].id), { phoneNumber: extraData.phoneNumber });
          }
          return { ...existing, id: snapshot.docs[0].id };
        }

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        
        const trialData = {
          name: user.displayName || user.email.split('@')[0],
          email: user.email,
          phoneNumber: extraData?.phoneNumber || '',
          role: 'psychologist',
          status: 'active',
          planId: 'trial',
          expiresAt: expiresAt.toISOString(),
          units: ['ADMINISTRAÇÃO CENTRAL'], // Default for trials
          trialLimits: {
            appointments: 10,
            schools: 1,
            letterheads: 1
          },
          permissions: ['dashboard', 'reports', 'appointments', 'scheduling_requests', 'documents', 'psychological_listening', 'instructions', 'settings', 'students', 'schools'],
          createdAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'users', user.uid), trialData);
        return { ...trialData, id: user.uid };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  },

  students: {
    list: async (filters?: any) => {
      const path = 'students';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        
        const { query: qSecure, isAllowed } = applyUnitSecurity(query(collection(db, path)), filters, userId);
        if (!isAllowed) return [];

        let q = qSecure;

        try {
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }));
        } catch (queryErr) {
          if (String(queryErr).includes('index')) {
            console.warn("Fallback local unit filtering for students");
            let results = await api.students.list(Object.assign({}, filters, { unit: undefined }));
            
            if (filters?.unit && !['Administração Central', 'Sede', 'ADMINISTRAÇÃO CENTRAL', 'SEDE'].includes(filters.unit.trim().toUpperCase())) {
              const u = String(filters.unit).toUpperCase();
              results = results.filter((r: any) => 
                (r.unit || "").toUpperCase() === u || 
                (r.schoolUnit || "").toUpperCase() === u
              );
            }
            return results;
          }
          throw queryErr;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    findByRA: async (ra: string) => {
      const path = 'students';
      try {
        const q = query(collection(db, path), where('ra', '==', ra));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const docSnap = snapshot.docs[0];
        return { ...(docSnap.data() as any), id: docSnap.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    },
    create: async (data: any) => {
      const path = 'students';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          ownerId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
        return { ...data, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    update: async (id: string, data: any) => {
      const path = `students/${id}`;
      try {
        await updateDoc(doc(db, 'students', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    delete: async (id: string) => {
      const path = `students/${id}`;
      try {
        await deleteDoc(doc(db, 'students', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    count: async (filters?: any) => {
      const path = 'students';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return 0;
        
        let q = query(collection(db, path));
        const { query: qSecure, isAllowed } = applyUnitSecurity(q, filters, userId);
        if (!isAllowed) return 0;
        
        q = qSecure;

        try {
          const snapshot = await getCountFromServer(q);
          return snapshot.data().count;
        } catch (countErr) {
          if (String(countErr).includes('index')) {
            console.warn("Fallback local count for students");
            const items = await api.students.list(filters);
            return items.length;
          }
          throw countErr;
        }
      } catch (error) {
        console.error("Error counting students:", error);
        return 0;
      }
    },
    deleteAll: async () => {
      const path = 'students';
      try {
        const snapshot = await getDocs(collection(db, path));
        const docs = snapshot.docs;
        const CHUNK_SIZE = 50;
        for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
          const chunk = docs.slice(i, i + CHUNK_SIZE);
          await Promise.all(chunk.map(doc => deleteDoc(doc.ref)));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },

  appointments: {
    list: async (filters?: any) => {
      const path = 'appointments';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        
        const { query: qSecure, isAllowed } = applyUnitSecurity(query(collection(db, path)), filters, userId);
        if (!isAllowed) return [];

        let q = qSecure;
        
        if (filters?.startDate) {
          q = query(q, where('date', '>=', filters.startDate));
        }
        if (filters?.endDate) {
          q = query(q, where('date', '<=', filters.endDate));
        }

        try {
          const snapshot = await getDocs(q);
          let results = snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id })) as any[];

          if (filters?.professionalId) {
            results = results.filter(r => r.professionalId === filters.professionalId);
          }
          if (filters?.type) {
            results = results.filter(r => r.type === filters.type);
          }
          return results;
        } catch (queryErr) {
          if (String(queryErr).includes('index')) {
            console.warn("Fallback local filtering for appointments");
            // Recursive call without unit to get broader results safely
            let results = await api.appointments.list(Object.assign({}, filters, { unit: undefined }));
            
            if (filters?.unit && !['Administração Central', 'Sede', 'ADMINISTRAÇÃO CENTRAL', 'SEDE'].includes(filters.unit.trim().toUpperCase())) {
              const u = String(filters.unit).toUpperCase();
              results = results.filter((r: any) => (r.unit || "").toUpperCase() === u);
            }
            return results;
          }
          throw queryErr;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    count: async (filters?: any) => {
      const path = 'appointments';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return 0;

        // Se houver filtros que exigem índice composto, usamos list() que já tem fallback local
        if (filters?.professionalId || filters?.type) {
          const items = await api.appointments.list(filters);
          return items.length;
        }

        let q = query(collection(db, path));

        if (!filters?.isAdmin) {
          const hasSignificantUnitFilter = filters?.unit && filters.unit !== 'Administração Central' && filters.unit !== 'Sede';
          if (!hasSignificantUnitFilter) {
            const allowedUnits = filters?.allowedUnits || [];
            if (allowedUnits.length > 0 && allowedUnits.length <= 30) {
              q = query(q, where('unit', 'in', allowedUnits));
            } else {
              if (filters?.professionalId === userId) {
                q = query(q, where('professionalId', '==', userId));
              } else {
                q = query(q, where('ownerId', '==', userId));
              }
            }
          }
        }

        if (filters?.unit && filters.unit !== 'Administração Central' && filters.unit !== 'Sede') {
          const unitValue = String(filters.unit).trim();
          const cleanValue = unitValue.replace(/^(sesi|unidade|escola|centro|departamento)\s+/gi, "").trim();
          
          if (cleanValue && cleanValue !== unitValue) {
            q = query(q, where('unit', 'in', [unitValue, cleanValue]));
          } else {
            q = query(q, where('unit', '==', unitValue));
          }
        }
        if (filters?.startDate) {
          q = query(q, where('date', '>=', filters.startDate));
        }
        if (filters?.endDate) {
          q = query(q, where('date', '<=', filters.endDate));
        }
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
      } catch (error) {
        if (String(error).includes('index')) {
          console.warn("Index missing for count, using list fallback");
          const items = await api.appointments.list(filters);
          return items.length;
        }
        handleFirestoreError(error, OperationType.GET, path);
        return 0; // Fallback final
      }
    },
    create: async (data: any) => {
      const path = 'appointments';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          ownerId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
        return { ...data, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    delete: async (id: string) => {
      const path = `appointments/${id}`;
      try {
        await deleteDoc(doc(db, 'appointments', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    update: async (id: string, data: any) => {
      const path = `appointments/${id}`;
      try {
        await updateDoc(doc(db, 'appointments', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  },

  appointmentTypes: {
    list: async (filters?: any) => {
      const path = 'appointment_types';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        
        let q = query(collection(db, path));
        if (!filters?.isAdmin) {
          q = query(q, where('ownerId', '==', userId));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    create: async (data: any) => {
      const path = 'appointment_types';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          ownerId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
        return { ...data, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    delete: async (id: string) => {
      const path = `appointment_types/${id}`;
      try {
        await deleteDoc(doc(db, 'appointment_types', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },

  categories: {
    list: async (filters?: any) => {
      const path = 'categories';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        
        let q = query(collection(db, path));
        if (!filters?.isAdmin) {
          q = query(q, where('ownerId', '==', userId));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    create: async (data: any) => {
      const path = 'categories';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          ownerId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
        return { ...data, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  },

  documents: {
    list: async (filters?: any) => {
      const path = 'documents';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        
        const { query: qSecure, isAllowed } = applyUnitSecurity(query(collection(db, path)), filters, userId);
        if (!isAllowed) return [];

        let q = qSecure;

        if (filters?.studentId) {
          q = query(q, where('studentId', '==', filters.studentId));
        }
        if (filters?.startDate) {
          q = query(q, where('date', '>=', filters.startDate));
        }
        if (filters?.endDate) {
          q = query(q, where('date', '<=', filters.endDate));
        }

        try {
          const snapshot = await getDocs(q);
          let results = snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id })) as any[];
          
          if (filters?.type) results = results.filter(r => r.type === filters.type);
          if (filters?.professionalId) results = results.filter(r => r.professionalId === filters.professionalId);
          
          return results;
        } catch (queryErr) {
          if (String(queryErr).includes('index')) {
            console.warn("Fallback local filtering for documents");
            let results = await api.documents.list(Object.assign({}, filters, { unit: undefined }));
            
            if (filters?.unit && !['Administração Central', 'Sede', 'ADMINISTRAÇÃO CENTRAL', 'SEDE'].includes(filters.unit.trim().toUpperCase())) {
              const u = String(filters.unit).toUpperCase();
              results = results.filter((r: any) => (r.unit || "").toUpperCase() === u);
            }
            return results;
          }
          throw queryErr;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    create: async (data: any) => {
      const path = 'documents';
      try {
        const { id, ...dataWithoutId } = data;
        const docRef = await addDoc(collection(db, path), {
          ...dataWithoutId,
          ownerId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
        return { ...dataWithoutId, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    get: async (id: string) => {
      const path = `documents/${id}`;
      try {
        const docSnap = await getDoc(doc(db, 'documents', id));
        if (docSnap.exists()) {
          return { ...docSnap.data(), id: docSnap.id };
        }
        return null;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    },
    delete: async (id: string) => {
      const path = `documents/${id}`;
      try {
        console.log(`[API] Tentando excluir documento Firestore: ${id}`);
        await deleteDoc(doc(db, 'documents', id));
        console.log(`[API] Documento ${id} excluído com sucesso.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    },
    update: async (id: string, data: any) => {
      const path = `documents/${id}`;
      try {
        const { id: _, ...dataWithoutId } = data;
        await updateDoc(doc(db, 'documents', id), {
          ...dataWithoutId,
          updatedAt: serverTimestamp()
        });
        return { ...dataWithoutId, id };
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  },

  schools: {
    list: async (filters?: any) => {
      const path = 'schools';
      try {
        const userId = auth.currentUser?.uid;
        let q = query(collection(db, path));
        
        if (filters?.public) {
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        }

        if (!userId) return [];

        const { query: qSecure, isAllowed } = applyUnitSecurity(q, filters, userId);
        if (!isAllowed) return [];
        q = qSecure;

        const snapshot = await getDocs(q);
        let results = snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id })) as any[];
        
        if (filters?.unit && !['Administração Central', 'Sede', 'ADMINISTRAÇÃO CENTRAL', 'SEDE'].includes(filters.unit.trim().toUpperCase())) {
           const u = filters.unit.toUpperCase();
           results = results.filter((r: any) => 
             (r.unit || "").toUpperCase() === u || 
             (r.name || "").toUpperCase() === u
           );
        }

        return results;
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    findByName: async (name: string) => {
      const path = 'schools';
      try {
        const q = query(collection(db, path), where('name', '==', name.trim()));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        const docSnap = snapshot.docs[0];
        return { ...docSnap.data(), id: docSnap.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    },
    create: async (data: any) => {
      const path = 'schools';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          ownerId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
        return { ...data, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    update: async (id: string, data: any) => {
      const path = `schools/${id}`;
      try {
        await updateDoc(doc(db, 'schools', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    delete: async (id: string) => {
      const path = `schools/${id}`;
      try {
        await deleteDoc(doc(db, 'schools', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },
  schedulingRequests: {
    list: async (filters?: any) => {
      const path = 'scheduling_requests';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        
        const { query: qSecure, isAllowed } = applyUnitSecurity(query(collection(db, path)), filters, userId);
        if (!isAllowed) return [];

        let q = qSecure;

        if (filters?.schoolId) {
          q = query(q, where('schoolId', '==', filters.schoolId));
        }
        if (filters?.status) {
          q = query(q, where('status', '==', filters.status));
        }

        try {
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }));
        } catch (queryErr) {
          if (String(queryErr).includes('index')) {
            console.warn("Fallback local filtering for scheduling_requests");
            let results = await api.schedulingRequests.list(Object.assign({}, filters, { unit: undefined }));
            if (filters?.unit && !['Administração Central', 'Sede', 'ADMINISTRAÇÃO CENTRAL', 'SEDE'].includes(filters.unit.trim().toUpperCase())) {
              const u = String(filters.unit).toUpperCase();
              results = results.filter((r: any) => (r.unit || "").toUpperCase() === u);
            }
            return results;
          }
          throw queryErr;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    count: async (filters?: any) => {
      const path = 'scheduling_requests';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return 0;
        
        const { query: qSecure, isAllowed } = applyUnitSecurity(query(collection(db, path)), filters, userId);
        if (!isAllowed) return 0;

        let q = qSecure;
        if (filters?.schoolId) {
          q = query(q, where('schoolId', '==', filters.schoolId));
        }
        if (filters?.status) {
          q = query(q, where('status', '==', filters.status));
        }

        try {
          const snapshot = await getCountFromServer(q);
          return snapshot.data().count;
        } catch (countErr) {
          if (String(countErr).includes('index')) {
            const items = await api.schedulingRequests.list(filters);
            return items.length;
          }
          throw countErr;
        }
      } catch (error) {
        console.error("Error counting requests:", error);
        return 0;
      }
    },
    create: async (data: any) => {
      const path = 'scheduling_requests';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          ownerId: auth.currentUser?.uid,
          status: 'pending',
          createdAt: serverTimestamp()
        });
        return { ...data, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    updateStatus: async (id: string, status: string, updatedBy?: string) => {
      const path = `scheduling_requests/${id}`;
      try {
        const docRef = doc(db, 'scheduling_requests', id);
        await updateDoc(docRef, {
          status,
          updatedBy,
          updatedAt: serverTimestamp()
        });

        // Automatically create an appointment if approved
        if (status === 'approved') {
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            
            // Try to find the student by RA to get the correct studentId
            const studentsRef = collection(db, 'students');
            const q = query(studentsRef, where('ra', '==', data.studentRA));
            const studentSnap = await getDocs(q);
            
            let studentId = data.studentRA; // Fallback to RA if student not found
            if (!studentSnap.empty) {
              studentId = studentSnap.docs[0].id;
            }

            await addDoc(collection(db, 'appointments'), {
              studentId,
              studentPhone: data.studentPhone || '', // Persist phone number for quick access
              categoryId: data.categoryId,
              type: data.type || 'pedagogical', // Default type
              date: new Date().toISOString(), // Default to now, to be adjusted in agenda
              description: `Solicitação aprovada em ${new Date().toLocaleDateString()}`,
              professionalId: updatedBy || 'unknown',
              status: 'confirmed',
              source: 'request',
              requestId: id,
              createdAt: serverTimestamp()
            });
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    delete: async (id: string) => {
      const path = `scheduling_requests/${id}`;
      try {
        await deleteDoc(doc(db, 'scheduling_requests', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },

  letterheads: {
    list: async () => {
      const path = 'letterheads';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        
        const q = query(collection(db, path), where('ownerId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    listAvailable: async (userId?: string, unit?: string) => {
      const path = 'letterheads';
      try {
        const currentUserId = auth.currentUser?.uid;
        const snapshot = await getDocs(collection(db, path));
        const all = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as any[];
        
        // Se for admin da central, vê tudo
        if (unit === 'Administração Central' || unit === 'Sede') return all;

        return all.filter(l => {
          // O usuário é dono?
          if (currentUserId && l.ownerId === currentUserId) return true;

          // O padrão está sempre disponível
          if (l.isDefault) return true;
          
          // Verificar permissão por usuário
          if (userId && l.allowedUsers && Array.isArray(l.allowedUsers) && l.allowedUsers.includes(userId)) {
            return true;
          }
          
          // Verificar permissão por unidade
          if (unit && l.allowedUnits && Array.isArray(l.allowedUnits) && l.allowedUnits.includes(unit)) {
            return true;
          }

          return false;
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    create: async (data: any) => {
      const path = 'letterheads';
      try {
        const { id, ...dataWithoutId } = data; // Prevent manual ID from being saved
        const docRef = await addDoc(collection(db, path), {
          ...dataWithoutId,
          ownerId: auth.currentUser?.uid,
          createdAt: serverTimestamp()
        });
        return { ...dataWithoutId, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    update: async (id: string, data: any) => {
      const path = `letterheads/${id}`;
      try {
        await updateDoc(doc(db, 'letterheads', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    delete: async (id: string) => {
      const path = `letterheads/${id}`;
      try {
        await deleteDoc(doc(db, 'letterheads', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },

  leads: {
    create: async (data: any) => {
      const path = 'leads';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          status: 'new',
          createdAt: new Date().toISOString()
        });
        return { ...data, id: docRef.id };
      } catch (error) {
        // We don't want to block registration if lead capture fails
        console.error("Lead capture error:", error);
      }
    }
  },

  documentLayouts: {
    list: async (filters?: any) => {
      const path = 'document_layouts';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return [];
        
        let q = query(collection(db, path));
        if (!filters?.isAdmin) {
          q = query(q, where('ownerId', '==', userId));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    getByType: async (typeId: string) => {
      const path = 'document_layouts';
      try {
        const userId = auth.currentUser?.uid;
        // Se quisermos ser estritos, documentTypeLookup também deve considerar ownerId
        const q = query(collection(db, path), where('documentTypeId', '==', typeId));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        
        // Se houver múltiplos, pegamos o do usuário ou o primeiro se for admin
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    },
    upsert: async (typeId: string, data: any) => {
      const path = 'document_layouts';
      try {
        const userId = auth.currentUser?.uid;
        const existing = await api.documentLayouts.getByType(typeId);
        if (existing) {
          await updateDoc(doc(db, 'document_layouts', existing.id), {
            ...data,
            updatedAt: serverTimestamp()
          });
          return { ...data, id: existing.id };
        } else {
          const docRef = await addDoc(collection(db, path), {
            ...data,
            documentTypeId: typeId,
            ownerId: userId,
            updatedAt: serverTimestamp()
          });
          return { ...data, id: docRef.id };
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  anonymousReports: {
    list: async (filters?: any) => {
      const path = 'anonymous_reports';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId && !filters?.public) return [];
        
        const { query: qSecure, isAllowed } = applyUnitSecurity(query(collection(db, path)), filters, userId || "anonymous");
        if (!isAllowed) return [];

        let q = qSecure;

        if (filters?.analyzed !== undefined) {
          q = query(q, where('analyzed', '==', filters.analyzed));
        }

        try {
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({ ...(doc.data() as any), id: doc.id }));
        } catch (queryErr) {
          if (String(queryErr).includes('index')) {
            console.warn("Fallback local filtering for anonymous_reports");
            let results = await api.anonymousReports.list(Object.assign({}, filters, { unit: undefined }));
            if (filters?.unit && !['Administração Central', 'Sede', 'ADMINISTRAÇÃO CENTRAL', 'SEDE'].includes(filters.unit.trim().toUpperCase())) {
              const u = String(filters.unit).toUpperCase();
              results = results.filter((r: any) => (r.unit || "").toUpperCase() === u);
            }
            return results;
          }
          throw queryErr;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    count: async (filters?: any) => {
      const path = 'anonymous_reports';
      try {
        const userId = auth.currentUser?.uid;
        if (!userId) return 0;

        const { query: qSecure, isAllowed } = applyUnitSecurity(query(collection(db, path)), filters, userId);
        if (!isAllowed) return 0;

        let q = qSecure;

        if (filters?.analyzed !== undefined) {
          q = query(q, where('analyzed', '==', filters.analyzed));
        }
        
        try {
          const snapshot = await getCountFromServer(q);
          return snapshot.data().count;
        } catch (countErr) {
          if (String(countErr).includes('index')) {
            const items = await api.anonymousReports.list(filters);
            return items.length;
          }
          throw countErr;
        }
      } catch (error) {
        console.error("Error counting reports:", error);
        return 0;
      }
    },
    create: async (data: any) => {
      const path = 'anonymous_reports';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          ownerId: data.ownerId || auth.currentUser?.uid,
          analyzed: false,
          createdAt: serverTimestamp()
        });
        return { ...data, id: docRef.id, analyzed: false };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    update: async (id: string, data: any) => {
      const path = `anonymous_reports/${id}`;
      try {
        await updateDoc(doc(db, 'anonymous_reports', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    delete: async (id: string) => {
      const path = `anonymous_reports/${id}`;
      try {
        await deleteDoc(doc(db, 'anonymous_reports', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },
  
  appSettings: {
    get: async () => {
      const path = 'app_settings';
      try {
        const docRef = doc(db, path, 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return { ...docSnap.data(), id: docSnap.id };
        }
        return { 
          name: "SGE Psicologia", 
          logoUrl: "https://images.weserv.nl/?url=i.imgur.com/NR6kaz6.png",
          id: 'global' 
        };
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    },
    update: async (data: any) => {
      const path = 'app_settings';
      try {
        const { setDoc } = await import('firebase/firestore');
        const docRef = doc(db, path, 'global');
        await setDoc(docRef, {
          ...data,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  },
  
  plans: {
    list: async () => {
      const path = 'plans';
      try {
        const snapshot = await getDocs(collection(db, path));
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    create: async (data: any) => {
      const path = 'plans';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          createdAt: serverTimestamp()
        });
        return { ...data, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    },
    update: async (id: string, data: any) => {
      const path = `plans/${id}`;
      try {
        await updateDoc(doc(db, 'plans', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }
  },

  subscriptions: {
    list: async () => {
      const path = 'subscriptions';
      try {
        const snapshot = await getDocs(collection(db, path));
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    getByUnit: async (unitId: string) => {
      const path = 'subscriptions';
      try {
        const unitValue = unitId.trim();
        const cleanValue = unitValue.replace(/^(sesi|unidade|escola|centro|departamento)\s+/gi, "").trim();
        
        let q;
        if (cleanValue && cleanValue !== unitValue) {
          q = query(collection(db, path), where('unitId', 'in', [unitValue, cleanValue]));
        } else {
          q = query(collection(db, path), where('unitId', '==', unitValue));
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return { ...(snapshot.docs[0].data() as any), id: snapshot.docs[0].id };
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    },
    update: async (id: string, data: any) => {
      const path = `subscriptions/${id}`;
      try {
        await updateDoc(doc(db, 'subscriptions', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    create: async (data: any) => {
      const path = 'subscriptions';
      try {
        const docRef = await addDoc(collection(db, path), {
          ...data,
          createdAt: serverTimestamp()
        });
        return { ...data, id: docRef.id };
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  },

  usageLogs: {
    list: async (unitId: string) => {
      const path = 'usage_logs';
      try {
        const q = query(collection(db, path), where('unitId', '==', unitId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, path);
      }
    },
    create: async (data: any) => {
      const path = 'usage_logs';
      try {
        await addDoc(collection(db, path), {
          ...data,
          timestamp: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }
  },

  seed: async () => {
    // We can still use the backend seed or implement a client-side seed
    return api.fetch("/seed", { method: "POST" });
  },

  utils: {
    restore: async (collectionName: string, id: string, data: any) => {
      try {
        const { id: _, ...dataWithoutId } = data;
        await setDoc(doc(db, collectionName, id), {
          ...dataWithoutId,
          restoredAt: serverTimestamp()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `${collectionName}/${id}`);
      }
    }
  }
};
