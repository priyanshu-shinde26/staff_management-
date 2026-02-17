import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Calendar, DollarSign, LogOut, Plus, 
  CheckCircle, XCircle, FileText, ChevronRight, 
  Download, UserCheck, UserPlus, X, MapPin, Clock, Home, Wallet, UserCircle2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, writeBatch } from 'firebase/firestore';
import { auth, firestoreDb } from './firebase';

// --- TYPES & INTERFACES ---

type Role = 'Manager' | 'Staff';
type Shift = 'Morning' | 'Afternoon' | 'Night';
type Availability = 'Pending' | 'Available' | 'Not Available';
type Attendance = 'Present' | 'Absent' | 'Not Marked';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  password?: string;
  isPermanent: boolean;
  isContractor: boolean;
  isActive: boolean;
}

interface CateringEvent {
  id: string;
  eventName: string;
  eventDate: string;
  eventTime?: string;
  shift: Shift;
  location: string;
  description: string;
  createdBy: string;
}

interface Assignment {
  id: string;
  eventId: string;
  staffId: string;
  availabilityStatus: Availability;
  attendanceStatus: Attendance;
  paymentAmount: number;
  basePaymentAmount?: number; // Tracks the agreed amount set by manager
  paymentReceived: boolean;
  markedByManager: boolean;
}

interface SeedStaffUser {
  uid: string;
  name: string;
  email: string;
  password: string;
  isContractor: boolean;
}

// --- CONSTANTS ---

const EVENT_TYPES = [
  "Wedding",
  "Reception",
  "Engagement",
  "Birthday Party",
  "Anniversary",
  "Corporate Event",
  "Baby Shower",
  "Other"
];

const APP_COLORS = {
  primary: '#D97706',
  secondary: '#1E293B',
  accent: '#10B981',
  background: '#F8FAFC',
  card: '#FFFFFF',
  error: '#EF4444',
  warning: '#F59E0B'
};

// --- MOCK DATA & SEEDING ---

const SEED_STAFF_DATA: SeedStaffUser[] = [
  { uid: 'mNhVk8AihfgkLAbN0Fn0R7UnDsp1', name: 'Adarsh Rajurkar', email: 'adarsh.rajurkar@maabhawani.com', password: 'MB@Adarsh2026', isContractor: true },
  { uid: 'qCyREVrytYhScQevPyzJuagteJ82', name: 'Prajwal Hawge', email: 'prajwal.hawge@maabhawani.com', password: 'MB@Prajwal2026', isContractor: false },
  { uid: 'C81QWUNpYWa3WKFzf4gnBTJPm8p2', name: 'Nikhil Shende', email: 'nikhil.shende@maabhawani.com', password: 'MB@Nikhil2026', isContractor: false },
  { uid: 'agtz3Bca6ZUgTTryHONtoqS3TB43', name: 'Amit Kavre', email: 'amit.kavre@maabhawani.com', password: 'MB@Amit2026', isContractor: false },
  { uid: '7z31mMJIrEbSPIEwTE2fpAPE7793', name: 'Manish Raut', email: 'manish.raut@maabhawani.com', password: 'MB@Manish2026', isContractor: false },
  { uid: 'pSbvzbqberVZ60mSzlWzkoHTe233', name: 'Shrawan Salankar', email: 'shrawan.salankar@maabhawani.com', password: 'MB@Shrawan2026', isContractor: false },
  { uid: 'QSPtVGbaqUP7GMMp6MD7jqKuiZ83', name: 'Harsh Chole', email: 'harsh.chole@maabhawani.com', password: 'MB@Harsh2026', isContractor: false },
  { uid: 'CAg6f2CWovUmm0YbhvU358TCEKf1', name: 'Yash Bhopale', email: 'yash.bhopale@maabhawani.com', password: 'MB@Yash2026', isContractor: false },
  { uid: 'ITipwk0usWTsOQ5aXaCw64OZT4E3', name: 'Om Chatarkar', email: 'om.chatarkar@maabhawani.com', password: 'MB@Om2026', isContractor: false },
  { uid: 'npbWnwv020cTFzMfcANn0jFMo032', name: 'Mayur Bhange', email: 'mayur.bhange@maabhawani.com', password: 'MB@Mayur2026', isContractor: false },
  { uid: '7IaxABBmCXOmPVMz2fsuDN7ZzNG2', name: 'Navnit Wanjari', email: 'navnit.wanjari@maabhawani.com', password: 'MB@Navnit2026', isContractor: false },
  { uid: 'pfdTSTQiCihFfGKMONCE3DpvXEd2', name: 'Sarthak Mohekar', email: 'sarthak.mohekar@maabhawani.com', password: 'MB@Sarthak2026', isContractor: false },
  { uid: 'mgjtee8WbbVpc6mSnJJj3CV2hzl2', name: 'Himanshu Dhange', email: 'himanshu.dhange@maabhawani.com', password: 'MB@Himanshu2026', isContractor: false },
  { uid: 'LgRiEkoKfTbxEXHyY8IdYy5xiQD2', name: 'Karan Aatram', email: 'karan.aatram@maabhawani.com', password: 'MB@Karan2026', isContractor: false },
  { uid: 'VR893mi6zqUK3tSvfg9wy2d7bBc2', name: 'Mayur Aatram', email: 'mayur.aatram@maabhawani.com', password: 'MB@MayurA2026', isContractor: false },
];

const SEED_MANAGER: User = {
  id: 'mgr-1',
  name: 'System Manager',
  email: 'maabhawani2026@gmail.com',
  role: 'Manager',
  password: 'maabhawani2026',
  isPermanent: true,
  isContractor: false,
  isActive: true
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

// --- SERVICES (Simulating Backend) ---

const COLLECTIONS = {
  users: 'users',
  events: 'events',
  assignments: 'assignments'
} as const;

const readCollection = async <T extends { id: string }>(collectionName: string): Promise<T[]> => {
  const snap = await getDocs(collection(firestoreDb, collectionName));
  return snap.docs.map((d) => {
    const data = d.data() as Partial<T>;
    return {
      ...(data as T),
      id: (data.id as string) || d.id
    } as T;
  });
};

const setCollection = async <T extends { id: string }>(collectionName: string, rows: T[]) => {
  if (rows.length === 0) return;
  const batch = writeBatch(firestoreDb);
  rows.forEach((row) => batch.set(doc(firestoreDb, collectionName, row.id), row));
  await batch.commit();
};

const upsertDoc = async <T extends { id: string }>(collectionName: string, row: T) => {
  await setDoc(doc(firestoreDb, collectionName, row.id), row);
};

const upsertManyDocs = async <T extends { id: string }>(collectionName: string, rows: T[]) => {
  if (rows.length === 0) return;
  const batch = writeBatch(firestoreDb);
  rows.forEach((row) => batch.set(doc(firestoreDb, collectionName, row.id), row));
  await batch.commit();
};

const usersEquivalent = (a: User | undefined, b: User) => {
  if (!a) return false;
  return (
    a.id === b.id &&
    a.name === b.name &&
    normalizeEmail(a.email) === normalizeEmail(b.email) &&
    a.role === b.role &&
    !!a.isPermanent === !!b.isPermanent &&
    !!a.isContractor === !!b.isContractor &&
    !!a.isActive === !!b.isActive &&
    (a.password || '') === (b.password || '')
  );
};

const DB = {
  getUsers: async (): Promise<User[]> => readCollection<User>(COLLECTIONS.users),
  setUsers: async (users: User[]) => setCollection<User>(COLLECTIONS.users, users),
  upsertUser: async (user: User) => upsertDoc<User>(COLLECTIONS.users, user),
  upsertUsers: async (users: User[]) => upsertManyDocs<User>(COLLECTIONS.users, users),
  getEvents: async (): Promise<CateringEvent[]> => readCollection<CateringEvent>(COLLECTIONS.events),
  setEvents: async (events: CateringEvent[]) => setCollection<CateringEvent>(COLLECTIONS.events, events),
  upsertEvent: async (event: CateringEvent) => upsertDoc<CateringEvent>(COLLECTIONS.events, event),
  getAssignments: async (): Promise<Assignment[]> => readCollection<Assignment>(COLLECTIONS.assignments),
  setAssignments: async (asg: Assignment[]) => setCollection<Assignment>(COLLECTIONS.assignments, asg),
  upsertAssignment: async (asg: Assignment) => upsertDoc<Assignment>(COLLECTIONS.assignments, asg),
  upsertAssignments: async (asg: Assignment[]) => upsertManyDocs<Assignment>(COLLECTIONS.assignments, asg),
  
  init: async () => {
    const existingUsers = await DB.getUsers();

    const byIdOrEmail = new Map<string, User>();
    existingUsers.forEach((u) => {
      const key = u.id || normalizeEmail(u.email || '');
      if (key) byIdOrEmail.set(key, u);
    });

    const upsertSeedUser = (seed: User) => {
      const emailKey = normalizeEmail(seed.email);
      const existing =
        byIdOrEmail.get(seed.id) ||
        Array.from(byIdOrEmail.values()).find((u) => normalizeEmail(u.email) === emailKey);

      const merged: User = {
        ...seed,
        ...(existing || {}),
        id: seed.id,
        email: seed.email,
        role: seed.role,
        isContractor: typeof existing?.isContractor === 'boolean' ? existing.isContractor : seed.isContractor,
        isPermanent: !(typeof existing?.isContractor === 'boolean' ? existing.isContractor : seed.isContractor),
        isActive: typeof existing?.isActive === 'boolean' ? existing.isActive : true,
        password: existing?.password || seed.password
      };

      byIdOrEmail.set(seed.id, merged);
    };

    upsertSeedUser(SEED_MANAGER);

    SEED_STAFF_DATA.forEach((s) => {
      upsertSeedUser({
        id: s.uid,
        name: s.name,
        email: s.email,
        role: 'Staff',
        password: s.password,
        isPermanent: !s.isContractor,
        isContractor: s.isContractor,
        isActive: true
      });
    });

    const mergedUsers = Array.from(byIdOrEmail.values());
    const existingById = new Map(existingUsers.map((u) => [u.id, u]));
    const usersToUpsert = mergedUsers.filter((u) => !usersEquivalent(existingById.get(u.id), u));
    await DB.upsertUsers(usersToUpsert);

    if (existingUsers.length === 0) {
      await DB.setEvents([]);
      await DB.setAssignments([]);
    }
  }
};

// --- COMPONENTS ---

// 1. LOGIN COMPONENT
const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitLockRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || loading) return;
    submitLockRef.current = true;
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, normalizeEmail(email.trim()), password);
    } catch {
      setError('Invalid credentials or unauthorized account.');
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(145deg, ${APP_COLORS.secondary} 0%, #0f172a 55%, #111827 100%)` }}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full border border-slate-200">
        <div className="p-6 text-center" style={{ backgroundColor: APP_COLORS.primary }}>
          <h1 className="text-2xl font-bold text-white">Maa Bhawani Catering</h1>
          <p className="text-amber-100 text-sm mt-1">Smart Staff Management System</p>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm text-center">{error}</div>}
          <div className="relative">
            <input 
              type="email" 
              required
              className="peer block w-full px-3 pt-6 pb-2 border border-slate-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder=" "
            />
            <label className="absolute left-3 top-2 text-xs text-slate-500 transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:top-4 peer-focus:top-2 peer-focus:text-xs peer-focus:text-amber-600">Email Address</label>
          </div>
          <div className="relative">
            <input 
              type="password" 
              required
              className="peer block w-full px-3 pt-6 pb-2 border border-slate-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder=" "
            />
            <label className="absolute left-3 top-2 text-xs text-slate-500 transition-all peer-placeholder-shown:text-sm peer-placeholder-shown:top-4 peer-focus:top-2 peer-focus:text-xs peer-focus:text-amber-600">Password</label>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full min-h-11 flex justify-center items-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        
        </form>
      </div>
    </div>
  );
};

// 3. FEATURE COMPONENTS

const StatusBadge = ({ status, type }: { status: string | boolean, type: 'avail' | 'attend' | 'pay' }) => {
  const styles: any = {
    'Available': 'bg-emerald-100 text-emerald-700',
    'Not Available': 'bg-red-100 text-red-700',
    'Pending': 'bg-amber-100 text-amber-700',
    'Present': 'bg-blue-100 text-blue-700',
    'Absent': 'bg-slate-200 text-slate-700',
    'Not Marked': 'bg-slate-100 text-slate-500',
    'Paid': 'bg-emerald-100 text-emerald-700',
    'Unpaid': 'bg-amber-100 text-amber-700',
  };
  
  let displayStatus = status;
  let styleKey = String(status);

  if (type === 'pay') {
    // Handle boolean true/false for payment status correctly
    const isPaid = String(status) === 'true';
    displayStatus = isPaid ? 'Received' : 'Pending';
    styleKey = isPaid ? 'Paid' : 'Unpaid';
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${styles[styleKey] || 'bg-slate-100 text-slate-700'}`}>
      {displayStatus}
    </span>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState('dashboard');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  
  // App Data State
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<CateringEvent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // UI State (frontend only)
  const [staffSearch, setStaffSearch] = useState('');
  const [staffSort, setStaffSort] = useState<'name' | 'email'>('name');
  const [staffPage, setStaffPage] = useState(1);
  const [eventsSearch, setEventsSearch] = useState('');
  const [eventsPage, setEventsPage] = useState(1);
  const rowsPerPage = 8;

  // Add Staff Modal State
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffType, setNewStaffType] = useState('Permanent');
  const [showExitToast, setShowExitToast] = useState(false);
  const allowBrowserExitRef = useRef(false);
  const createEventLockRef = useRef(false);
  const lastCreatedEventSigRef = useRef<{ sig: string; at: number } | null>(null);
  const assigningKeysRef = useRef<Set<string>>(new Set());

  // Create Event State
  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Hydrate Data on Mount
  useEffect(() => {
    const bootstrap = async () => {
      try {
        await DB.init();
      } catch (error) {
        console.error('Bootstrap failed:', error);
      }
    };
    bootstrap();

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setCurrentUser(null);
        setView('dashboard');
        return;
      }

      const email = normalizeEmail(firebaseUser.email || '');
      const isManagerEmail = email === normalizeEmail(SEED_MANAGER.email);
      const seedStaff = SEED_STAFF_DATA.find((s) => s.uid === firebaseUser.uid || normalizeEmail(s.email) === email);
      let localUsers: User[] = [];
      let localUser: User | undefined;
      let hasUserStore = true;
      let userDocData: Partial<User> | null = null;

      try {
        const userSnap = await getDoc(doc(firestoreDb, 'users', firebaseUser.uid));
        if (userSnap.exists()) {
          userDocData = userSnap.data() as Partial<User>;
        }
      } catch {
        // Firestore role lookup is optional fallback.
      }

      if (!isManagerEmail && !seedStaff && !userDocData) {
        try {
          localUsers = await DB.getUsers();
          localUser = localUsers.find((u) => u.id === firebaseUser.uid) || localUsers.find((u) => normalizeEmail(u.email) === email);
        } catch (error) {
          hasUserStore = false;
          console.error('Failed to load users during auth hydration:', error);
        }
      }

      let role: Role = 'Staff';
      let name = seedStaff?.name || localUser?.name || userDocData?.name || (firebaseUser.displayName || email);
      let isContractor = seedStaff?.isContractor ?? localUser?.isContractor ?? userDocData?.isContractor ?? false;
      let isActive = localUser?.isActive ?? userDocData?.isActive ?? true;

      if (userDocData) {
        if (userDocData.role === 'Manager' || userDocData.role === 'Staff') role = userDocData.role;
        if (userDocData.name) name = userDocData.name;
        if (typeof userDocData.isContractor === 'boolean') isContractor = userDocData.isContractor;
        if (typeof userDocData.isActive === 'boolean') isActive = userDocData.isActive;
      }

      if (isManagerEmail) {
        role = 'Manager';
        name = SEED_MANAGER.name;
        isContractor = false;
      } else if (hasUserStore && !seedStaff && !localUser && !userDocData) {
        await firebaseSignOut(auth);
        setCurrentUser(null);
        setView('dashboard');
        return;
      }

      if (!isActive) {
        await firebaseSignOut(auth);
        setCurrentUser(null);
        setView('dashboard');
        return;
      }

      const hydratedUser: User = {
        id: firebaseUser.uid,
        name,
        email,
        role,
        isPermanent: !isContractor,
        isContractor,
        isActive
      };

      setCurrentUser(hydratedUser);
      setView('dashboard');

      const existingLocalUser =
        localUser ||
        localUsers.find((u) => u.id === hydratedUser.id) ||
        localUsers.find((u) => normalizeEmail(u.email) === email);
      const preservedPassword =
        existingLocalUser?.password ||
        (typeof userDocData?.password === 'string' ? userDocData.password : undefined);

      void DB.upsertUser({
          ...hydratedUser,
          password: preservedPassword
        }).catch((error) => {
        console.error('Failed to persist hydrated user:', error);
      });
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    setStaffPage(1);
  }, [staffSearch, staffSort]);

  useEffect(() => {
    setEventsPage(1);
  }, [eventsSearch]);

  useEffect(() => {
    if (!currentUser) {
      setSyncStatus('connecting');
      return;
    }

    setSyncStatus('connecting');
    let usersReady = false;
    let eventsReady = false;
    let assignmentsReady = false;
    const markReady = () => {
      if (usersReady && eventsReady && assignmentsReady) {
        setSyncStatus('connected');
      }
    };

    const unsubUsers = onSnapshot(
      collection(firestoreDb, COLLECTIONS.users),
      (snap) => {
        const nextUsers = snap.docs.map((d) => {
          const data = d.data() as Partial<User>;
          return {
            ...(data as User),
            id: (data.id as string) || d.id
          } as User;
        });
        setUsers(nextUsers);
        usersReady = true;
        markReady();
      },
      (error) => {
        setSyncStatus('error');
        console.error('Users snapshot failed:', error);
      }
    );

    const unsubEvents = onSnapshot(
      collection(firestoreDb, COLLECTIONS.events),
      (snap) => {
        const nextEvents = snap.docs.map((d) => {
          const data = d.data() as Partial<CateringEvent>;
          return {
            ...(data as CateringEvent),
            id: (data.id as string) || d.id
          } as CateringEvent;
        });
        setEvents(nextEvents);
        eventsReady = true;
        markReady();
      },
      (error) => {
        setSyncStatus('error');
        console.error('Events snapshot failed:', error);
      }
    );

    const unsubAssignments = onSnapshot(
      collection(firestoreDb, COLLECTIONS.assignments),
      (snap) => {
        const nextAssignments = snap.docs.map((d) => {
          const data = d.data() as Partial<Assignment>;
          return {
            ...(data as Assignment),
            id: (data.id as string) || d.id
          } as Assignment;
        });
        setAssignments(nextAssignments);
        assignmentsReady = true;
        markReady();
      },
      (error) => {
        setSyncStatus('error');
        console.error('Assignments snapshot failed:', error);
      }
    );

    return () => {
      unsubUsers();
      unsubEvents();
      unsubAssignments();
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || view !== 'dashboard') {
      setShowExitToast(false);
      return;
    }

    allowBrowserExitRef.current = false;
    const guardState = { app: 'staff-management-exit-guard', ts: Date.now() };
    window.history.pushState(guardState, '', window.location.href);

    const onPopState = () => {
      if (allowBrowserExitRef.current) return;
      setShowExitToast(true);
      window.history.pushState({ ...guardState, ts: Date.now() }, '', window.location.href);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [currentUser, view]);

  const confirmExitWebsite = () => {
    allowBrowserExitRef.current = true;
    setShowExitToast(false);
    window.history.back();
  };

  const refreshData = async () => {
    const [usersResult, eventsResult, assignmentsResult] = await Promise.allSettled([
      DB.getUsers(),
      DB.getEvents(),
      DB.getAssignments()
    ]);

    if (usersResult.status === 'fulfilled') setUsers(usersResult.value);
    if (eventsResult.status === 'fulfilled') setEvents(eventsResult.value);
    if (assignmentsResult.status === 'fulfilled') setAssignments(assignmentsResult.value);
  };

  const managerStaff = users.filter((u) => u.role === 'Staff');
  const todayISO = new Date().toISOString().split('T')[0];
  const isEventPast = (eventDate: string) => eventDate < todayISO;
  const normalizeEventTime = (value: string) => {
    const clean = value.trim().toUpperCase().replace(/\s+/g, ' ');
    const match = clean.match(/^(0[1-9]|1[0-2]):([0-5][0-9])\s(AM|PM)$/);
    if (!match) return null;
    return `${match[1]}:${match[2]} ${match[3]}`;
  };
  const getEventDateTime = (event: CateringEvent) =>
    event.eventTime ? `${event.eventDate} • ${event.eventTime}` : `${event.eventDate} • Time not set`;
  const activeEvents = events.filter((e) => !isEventPast(e.eventDate));
  const archivedEvents = events.filter((e) => isEventPast(e.eventDate));

  const filteredStaff = managerStaff
    .filter((u) => {
      const q = staffSearch.trim().toLowerCase();
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    })
    .sort((a, b) => (staffSort === 'name' ? a.name.localeCompare(b.name) : a.email.localeCompare(b.email)));
  const paginatedStaff = filteredStaff.slice((staffPage - 1) * rowsPerPage, staffPage * rowsPerPage);
  const staffTotalPages = Math.max(1, Math.ceil(filteredStaff.length / rowsPerPage));

  const filteredEvents = activeEvents
    .filter((e) => {
      const q = eventsSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        e.eventName.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.eventDate.toLowerCase().includes(q) ||
        (e.eventTime || '').toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
  const paginatedEvents = filteredEvents.slice((eventsPage - 1) * rowsPerPage, eventsPage * rowsPerPage);
  const eventsTotalPages = Math.max(1, Math.ceil(filteredEvents.length / rowsPerPage));

  const filteredArchivedEvents = archivedEvents
    .filter((e) => {
      const q = eventsSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        e.eventName.toLowerCase().includes(q) ||
        e.location.toLowerCase().includes(q) ||
        e.eventDate.toLowerCase().includes(q) ||
        (e.eventTime || '').toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));

  const handleLogout = async () => {
    await firebaseSignOut(auth);
    setCurrentUser(null);
    setView('dashboard');
  };

  // --- ACTIONS ---

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createEventLockRef.current) return;
    createEventLockRef.current = true;
    setIsCreatingEvent(true);
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);

    try {
      // Logic for Event Name (Dropdown or Custom)
      let finalEventName = eventType;
      if (eventType === 'Other') {
          finalEventName = formData.get('customEventName') as string;
      }
      const eventHour = (formData.get('eventHour') as string) || '';
      const eventMinute = (formData.get('eventMinute') as string) || '';
      const eventPeriod = (formData.get('eventPeriod') as string) || '';
      const normalizedEventTime = normalizeEventTime(`${eventHour}:${eventMinute} ${eventPeriod}`);
      if (!normalizedEventTime) {
        alert('Please enter reporting time in 12-hour format, e.g. 07:30 PM.');
        return;
      }
      const normalizedName = finalEventName.trim().toLowerCase();
      const normalizedLocation = ((formData.get('location') as string) || '').trim().toLowerCase();
      const eventDate = (formData.get('eventDate') as string) || '';
      const shift = formData.get('shift') as Shift;
      const sig = `${normalizedName}|${eventDate}|${normalizedEventTime}|${shift}|${normalizedLocation}|${currentUser!.id}`;
      const now = Date.now();
      if (lastCreatedEventSigRef.current && lastCreatedEventSigRef.current.sig === sig && now - lastCreatedEventSigRef.current.at < 10000) {
        return;
      }
      const alreadyExists = events.some((ev) => {
        const evSig = `${ev.eventName.trim().toLowerCase()}|${ev.eventDate}|${ev.eventTime || ''}|${ev.shift}|${ev.location.trim().toLowerCase()}|${ev.createdBy}`;
        return evSig === sig;
      });
      if (alreadyExists) {
        alert('Same event already exists.');
        return;
      }

      const newEvent: CateringEvent = {
        id: `evt-${Date.now()}`,
        eventName: finalEventName,
        eventDate,
        eventTime: normalizedEventTime,
        shift,
        location: (formData.get('location') as string) || '',
        description: formData.get('description') as string,
        createdBy: currentUser!.id
      };

      await DB.upsertEvent(newEvent);
      lastCreatedEventSigRef.current = { sig, at: now };
      setEvents((prev) => (prev.some((ev) => ev.id === newEvent.id) ? prev : [...prev, newEvent]));
      setView('events');
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('Could not create event. Please try again.');
    } finally {
      createEventLockRef.current = false;
      setIsCreatingEvent(false);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;

    // Generate Creds
    const nameParts = newStaffName.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : 'Staff';
    
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@maabhawani.com`;
    const password = `MB@${firstName.charAt(0).toUpperCase() + firstName.slice(1)}2026`;

    const newUser: User = {
      id: `stf-${Date.now()}`,
      name: newStaffName,
      email: email,
      role: 'Staff',
      password: password,
      isPermanent: newStaffType === 'Permanent',
      isContractor: newStaffType === 'Contractor',
      isActive: true
    };

    try {
      await DB.upsertUser(newUser);
      setUsers((prev) => [...prev, newUser]);
      setShowAddStaffModal(false);
      setNewStaffName('');
      setNewStaffType('Permanent');
      alert(`Staff Added!\nEmail: ${email}\nPassword: ${password}`);
    } catch (error) {
      console.error('Failed to add staff:', error);
      alert('Could not add staff. Please try again.');
    }
  };

  const assignStaff = async (eventId: string, staffIds: string[]) => {
    const safeStaffIds = Array.from(new Set(staffIds.filter((sid): sid is string => typeof sid === 'string' && sid.trim().length > 0)));
    const unlockedStaffIds = safeStaffIds.filter((sid) => {
      const key = `${eventId}::${sid}`;
      if (assigningKeysRef.current.has(key)) return false;
      assigningKeysRef.current.add(key);
      return true;
    });
    if (unlockedStaffIds.length === 0) return;

    try {
      const existingForEvent = assignments.filter((a) => a.eventId === eventId);
      const existingByStaff = new Map(existingForEvent.map((a) => [a.staffId, a]));
      const staleIdsToDelete: string[] = [];
      const toUpsert: Assignment[] = [];

      unlockedStaffIds.forEach((sid) => {
        const deterministicId = `asg-${eventId}-${sid}`;
        const existing = existingByStaff.get(sid);
        if (existing && existing.id === deterministicId) return;
        if (existing && existing.id !== deterministicId) staleIdsToDelete.push(existing.id);

        toUpsert.push({
          id: deterministicId,
          eventId,
          staffId: sid,
          availabilityStatus: 'Pending' as Availability,
          attendanceStatus: 'Not Marked' as Attendance,
          paymentAmount: 300,
          basePaymentAmount: 300,
          paymentReceived: false,
          markedByManager: false
        });
      });

      if (toUpsert.length === 0 && staleIdsToDelete.length === 0) return;

      const batch = writeBatch(firestoreDb);
      staleIdsToDelete.forEach((id) => batch.delete(doc(firestoreDb, COLLECTIONS.assignments, id)));
      toUpsert.forEach((asg) => batch.set(doc(firestoreDb, COLLECTIONS.assignments, asg.id), asg));
      await batch.commit();

      setAssignments((prev) => {
        const withoutStale = prev.filter((a) => !staleIdsToDelete.includes(a.id));
        const byId = new Map(withoutStale.map((a) => [a.id, a]));
        toUpsert.forEach((a) => byId.set(a.id, a));
        return Array.from(byId.values());
      });
    } catch (error) {
      console.error('Failed to assign staff:', error);
      const err = error as { code?: string; message?: string };
      alert(`Could not assign staff. ${err.code ? `(${err.code}) ` : ''}${err.message || ''}`.trim());
    } finally {
      unlockedStaffIds.forEach((sid) => assigningKeysRef.current.delete(`${eventId}::${sid}`));
    }
  };

  const updateAssignment = async (id: string, updates: Partial<Assignment>) => {
    // Optimistic Update for UI speed
    const newAssignments = assignments.map(a => {
      if (a.id === id) {
        
        // 1. Resolve Base Amount (Migration for existing data that might lack basePaymentAmount)
        const existingBase = a.basePaymentAmount ?? (a.paymentAmount > 0 ? a.paymentAmount : 300);
        let newBase = existingBase;

        // If manager explicitly updates pay (via updates.paymentAmount), that becomes the new base
        if (updates.paymentAmount !== undefined) {
          newBase = updates.paymentAmount;
        }

        // 2. Determine New Payment Amount based on Status Logic
        let newPaymentAmount = updates.paymentAmount !== undefined ? updates.paymentAmount : a.paymentAmount;
        let newAttendance = updates.attendanceStatus !== undefined ? updates.attendanceStatus : a.attendanceStatus;

        // Rule 1: Not Available -> Attendance reset, Pay 0
        if (updates.availabilityStatus === 'Not Available') {
          newAttendance = 'Not Marked';
          newPaymentAmount = 0;
        }

        // Rule 2: Absent -> Pay 0
        if (updates.attendanceStatus === 'Absent') {
          newPaymentAmount = 0;
        }

        // Rule 3: Present -> Restore from Base Amount (The Fix)
        if (updates.attendanceStatus === 'Present') {
          newPaymentAmount = newBase;
        }

        // Rule 4: If changing to Available, and attendance isn't marked, potentially show base pay
        if (updates.availabilityStatus === 'Available' && newAttendance === 'Not Marked') {
           newPaymentAmount = newBase;
        }

        // Rule 5: Explicitly handle paymentReceived to ensure persistence
        const newPaymentReceived = updates.paymentReceived !== undefined ? updates.paymentReceived : a.paymentReceived;

        return {
           ...a,
           ...updates,
           attendanceStatus: newAttendance,
           paymentAmount: newPaymentAmount,
           basePaymentAmount: newBase,
           paymentReceived: newPaymentReceived // Force update
        };
      }
      return a;
    });
    
    // Update State Immediately
    setAssignments(newAssignments);
    // Persist only the changed assignment to avoid full-collection write lag
    const changed = newAssignments.find((a) => a.id === id);
    if (changed) {
      try {
        await DB.upsertAssignment(changed);
      } catch (error) {
        console.error('Failed to update assignment:', error);
      }
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!currentUser || currentUser.role !== 'Manager') return;
    const eventToDelete = events.find((ev) => ev.id === eventId);
    if (!eventToDelete) return;
    const linkedAssignments = assignments.filter((a) => a.eventId === eventId);
    const ok = confirm(
      `Delete "${eventToDelete.eventName}" on ${getEventDateTime(eventToDelete)}?\nThis will remove ${linkedAssignments.length} staff assignment(s).`
    );
    if (!ok) return;

    try {
      const batch = writeBatch(firestoreDb);
      batch.delete(doc(firestoreDb, COLLECTIONS.events, eventId));
      linkedAssignments.forEach((a) => {
        batch.delete(doc(firestoreDb, COLLECTIONS.assignments, a.id));
      });
      await batch.commit();
      setEvents((prev) => prev.filter((ev) => ev.id !== eventId));
      setAssignments((prev) => prev.filter((a) => a.eventId !== eventId));
      setSelectedEventId(null);
      setView('events');
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('Could not delete event. Please try again.');
    }
  };

  const removeAssignedStaff = async (assignmentId: string) => {
    if (!currentUser || currentUser.role !== 'Manager') return;
    const assignment = assignments.find((a) => a.id === assignmentId);
    if (!assignment) return;
    const staff = users.find((u) => u.id === assignment.staffId);
    const ok = confirm(`Remove ${staff?.name || 'this staff'} from this event?`);
    if (!ok) return;

    try {
      const batch = writeBatch(firestoreDb);
      batch.delete(doc(firestoreDb, COLLECTIONS.assignments, assignmentId));
      await batch.commit();
      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (error) {
      console.error('Failed to remove assigned staff:', error);
      alert('Could not remove assigned staff. Please try again.');
    }
  };

  // --- PDF GENERATOR ---
  const generatePDF = (mode: 'single' | 'all', staffId?: string) => {
    const printWindow = window.open('', '', 'height=600,width=800');
    if(!printWindow) return alert('Please allow popups for PDF');

    const relevantAssignments = assignments.filter(a => {
      if (mode === 'single') return a.staffId === staffId;
      return true;
    });

    const getEvent = (id: string) => events.find(e => e.id === id);
    const getStaff = (id: string) => users.find(u => u.id === id);

    let htmlContent = `
      <html>
        <head>
          <title>Payslip Statement</title>
          <style>
            body { font-family: sans-serif; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total { font-weight: bold; text-align: right; margin-top: 20px; font-size: 1.2em; }
            .status-paid { color: green; }
            .status-pending { color: orange; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Maa Bhawani Catering</h1>
            <p>Staff Payment Statement - Year 2026</p>
          </div>
    `;

    if (mode === 'single') {
       const staff = getStaff(staffId!);
       htmlContent += `<h3>Statement for: ${staff?.name} (${staff?.role})</h3>`;
    } else {
       htmlContent += `<h3>Master Payroll Summary</h3>`;
    }

    htmlContent += `
      <table>
        <thead>
          <tr>
            ${mode === 'all' ? '<th>Staff Name</th>' : ''}
            <th>Date</th>
            <th>Event</th>
            <th>Shift</th>
            <th>Attendance</th>
            <th>Status</th>
            <th>Amount (INR)</th>
          </tr>
        </thead>
        <tbody>
    `;

    let total = 0;

    relevantAssignments.forEach(a => {
       const ev = getEvent(a.eventId);
       const st = getStaff(a.staffId);
       if (!ev || !st) return;
       if (a.attendanceStatus === 'Not Marked') return;

       total += a.paymentAmount;
       htmlContent += `
         <tr>
           ${mode === 'all' ? `<td>${st.name}</td>` : ''}
           <td>${getEventDateTime(ev)}</td>
           <td>${ev.eventName}</td>
           <td>${ev.shift}</td>
           <td>${a.attendanceStatus}</td>
           <td class="${a.paymentReceived ? 'status-paid' : 'status-pending'}">
             ${a.paymentReceived ? 'Received' : 'Pending'}
           </td>
           <td>₹${a.paymentAmount}</td>
         </tr>
       `;
    });

    htmlContent += `
        </tbody>
      </table>
      <div class="total">Total Payable: ₹${total}</div>
      <br/><br/>
      <p>Manager Signature: __________________________</p>
      <script>window.print();</script>
    </body>
    </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };


  // --- VIEWS ---

  if (!currentUser) return <Login />;

  const pageTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    events: 'Events',
    createEvent: 'Create Event',
    eventDetails: 'Event Details',
    staff: 'Staff Management',
    reports: 'Payroll & Reports',
    payments: 'My Payments'
  };

  const managerNav = [
    { label: 'Dashboard', icon: Home, targetView: 'dashboard' },
    { label: 'Events', icon: Calendar, targetView: 'events' },
    { label: 'Staff', icon: UserCheck, targetView: 'staff' },
    { label: 'Payroll', icon: FileText, targetView: 'reports' },
    { label: 'Profile', icon: UserCircle2, targetView: 'dashboard' }
  ];
  const staffNav = [
    { label: 'Dashboard', icon: Home, targetView: 'dashboard' },
    { label: 'Events', icon: Calendar, targetView: 'dashboard' },
    { label: 'Payroll', icon: Wallet, targetView: 'payments' },
    { label: 'Profile', icon: UserCircle2, targetView: 'dashboard' }
  ];
  const bottomNavItems = currentUser.role === 'Manager' ? managerNav : staffNav;
  const syncPillClass =
    syncStatus === 'connected'
      ? 'bg-emerald-100 text-emerald-700'
      : syncStatus === 'error'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';
  const syncLabel = syncStatus === 'connected' ? 'Synced' : syncStatus === 'error' ? 'Sync issue' : 'Syncing';

  const NavButton = ({ label, icon: Icon, targetView }: any) => (
    <button 
      onClick={() => setView(targetView)}
      className={`w-full min-h-11 flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'space-x-3 px-4'} py-3 rounded-xl transition-colors ${
        view === targetView
          ? 'text-white shadow-sm'
          : 'text-slate-300 hover:text-white hover:bg-slate-700'
      }`}
      style={view === targetView ? { backgroundColor: APP_COLORS.primary } : {}}
    >
      <Icon size={20} />
      {!sidebarCollapsed && <span className="font-medium">{label}</span>}
    </button>
  );

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: APP_COLORS.background }}>
      {/* SIDEBAR */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-20' : 'w-64'
        } bg-slate-900 text-white hidden md:flex flex-col fixed h-full z-30 transition-all duration-200`}
      >
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div>
              <h2 className="text-lg font-bold">Maa Bhawani</h2>
              <p className="text-xs text-slate-400 mt-1">{currentUser.name}</p>
            </div>
          )}
          <button
            className="p-2 rounded-lg hover:bg-slate-700"
            onClick={() => setSidebarCollapsed((p) => !p)}
            aria-label="Toggle sidebar"
          >
            {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavButton label="Dashboard" icon={Users} targetView="dashboard" />
          {currentUser.role === 'Manager' ? (
            <>
              <NavButton label="Events" icon={Calendar} targetView="events" />
              <NavButton label="Staff Management" icon={UserCheck} targetView="staff" />
              <NavButton label="Reports & Payroll" icon={FileText} targetView="reports" />
            </>
          ) : (
            <NavButton label="My Payments" icon={DollarSign} targetView="payments" />
          )}
        </nav>
        <div className="p-4 border-t border-slate-700">
          <button onClick={handleLogout} className="w-full min-h-11 flex items-center justify-center md:justify-start space-x-2 px-3 py-2 rounded-xl text-red-300 hover:text-white hover:bg-red-600/20 transition-colors">
            <LogOut size={18} />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className={`flex-1 ${sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'} pb-24 md:pb-6 overflow-y-auto transition-all`}>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur px-4 md:px-8 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-slate-800">{pageTitles[view] || 'Dashboard'}</h1>
            <p className="text-xs md:text-sm text-slate-500">Logged in as {currentUser.role}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${syncPillClass}`}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {syncLabel}
            </span>
            <button onClick={handleLogout} className="md:hidden min-h-11 px-4 rounded-xl text-white text-sm font-semibold" style={{ backgroundColor: APP_COLORS.secondary }}>
              Logout
            </button>
          </div>
        </header>
        <div className="p-4 md:p-8 space-y-6">
        
        {/* VIEW: DASHBOARD (Manager & Staff) */}
        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="rounded-2xl p-4 md:p-5 text-white shadow-sm" style={{ background: `linear-gradient(120deg, ${APP_COLORS.secondary}, #334155)` }}>
              <p className="text-sm text-slate-200">Welcome back</p>
              <h2 className="text-xl md:text-2xl font-bold">{currentUser.name}</h2>
            </div>
            
            {currentUser.role === 'Manager' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="text-slate-500 text-sm">Total Staff</div>
                  <div className="text-3xl font-bold text-slate-800">{users.filter(u => u.role === 'Staff').length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="text-slate-500 text-sm">Total Events</div>
                  <div className="text-3xl font-bold text-slate-800">{activeEvents.length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="text-slate-500 text-sm">Pending Payments</div>
                  <div className="text-3xl font-bold text-slate-800">
                    {assignments.filter(a => !a.paymentReceived && a.attendanceStatus === 'Present').length}
                  </div>
                </div>
              </div>
            ) : (
              // Staff Stats
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="text-slate-500 text-sm">Assignments</div>
                  <div className="text-3xl font-bold text-slate-800">
                    {assignments.filter(a => a.staffId === currentUser.id).length}
                  </div>
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                  <div className="text-slate-500 text-sm">Total Earnings</div>
                  <div className="text-3xl font-bold text-slate-800">
                     ₹{assignments.filter(a => a.staffId === currentUser.id && a.attendanceStatus === 'Present').reduce((acc, curr) => acc + curr.paymentAmount, 0)}
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Events List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">
                  {currentUser.role === 'Manager' ? 'Upcoming Events' : 'My Upcoming Jobs'}
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {activeEvents.slice().reverse().map(event => {
                  const isAssigned = assignments.some(a => a.eventId === event.id && a.staffId === currentUser.id);
                  if (currentUser.role === 'Staff' && !isAssigned) return null;

                  // Staff Availability Action
                  const myAssignment = assignments.find(a => a.eventId === event.id && a.staffId === currentUser.id);

                  return (
                    <div key={event.id} className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center hover:bg-slate-50">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                           <h4 className="font-bold text-lg text-gray-800">{event.eventName}</h4>
                           <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">{event.shift}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1 flex items-center space-x-4">
                          <span className="flex items-center"><Calendar size={14} className="mr-1"/> {event.eventDate}</span>
                          <span className="flex items-center"><Clock size={14} className="mr-1"/> {event.eventTime || 'Time not set'}</span>
                          <span className="flex items-center"><MapPin size={14} className="mr-1"/> {event.location}</span>
                        </div>
                      </div>
                      
                      <div className="mt-4 md:mt-0 flex items-center space-x-3">
                        {currentUser.role === 'Manager' && (
                          <button 
                            onClick={() => { setSelectedEventId(event.id); setView('eventDetails'); }}
                            className="text-amber-700 hover:text-amber-800 text-sm font-medium flex items-center"
                          >
                            Manage <ChevronRight size={16} />
                          </button>
                        )}
                        {currentUser.role === 'Staff' && myAssignment && (
                          <div className="flex flex-col items-end space-y-2">
                            {/* 1. Availability Section */}
                            <div className="flex items-center space-x-2">
                               <span className="text-xs text-gray-400 uppercase font-bold">Avail:</span>
                               {myAssignment.markedByManager ? (
                                 <span className="text-sm text-gray-500">Locked</span>
                               ) : (
                                 <>
                                   <button 
                                     onClick={() => updateAssignment(myAssignment.id, { availabilityStatus: 'Available' })}
                                     className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${myAssignment.availabilityStatus === 'Available' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-green-600 border-green-600 hover:bg-green-50'}`}
                                   >
                                     Yes
                                   </button>
                                   <button 
                                     onClick={() => updateAssignment(myAssignment.id, { availabilityStatus: 'Not Available' })}
                                     className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${myAssignment.availabilityStatus === 'Not Available' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-600 hover:bg-red-50'}`}
                                   >
                                     No
                                   </button>
                                 </>
                               )}
                            </div>

                            {/* 2. Attendance Section (Staff Self-Mark) */}
                            {myAssignment.availabilityStatus === 'Available' && (
                               <div className="flex items-center space-x-2">
                                 <span className="text-xs text-gray-400 uppercase font-bold">Attend:</span>
                                 {myAssignment.attendanceStatus === 'Present' ? (
                                     <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded flex items-center">
                                       <CheckCircle size={12} className="mr-1"/> Marked Present
                                     </span>
                                 ) : (
                                     <button
                                      onClick={() => updateAssignment(myAssignment.id, { attendanceStatus: 'Present' })}
                                      className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 flex items-center"
                                     >
                                       Mark Present
                                     </button>
                                 )}
                               </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {activeEvents.length === 0 && <div className="p-6 text-center text-gray-500">No active events found.</div>}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: EVENTS (Manager Only) */}
        {view === 'events' && currentUser.role === 'Manager' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
              <div className="w-full sm:max-w-sm">
                <input
                  value={eventsSearch}
                  onChange={(e) => setEventsSearch(e.target.value)}
                  placeholder="Search events, date, location"
                  className="w-full min-h-11 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                />
              </div>
              <button onClick={() => { setView('createEvent'); setEventType(EVENT_TYPES[0]); }} className="min-h-11 bg-amber-600 text-white px-4 py-2 rounded-xl flex items-center justify-center space-x-2 hover:bg-amber-700">
                <Plus size={18} /> <span>Create Event</span>
              </button>
            </div>

            <div className="space-y-3 md:hidden">
              {paginatedEvents.map((ev) => (
                <div key={ev.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-800">{ev.eventName}</h3>
                    <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">{ev.shift}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">{getEventDateTime(ev)}</p>
                  <p className="text-sm text-slate-500">{ev.location}</p>
                  <p className="text-xs text-slate-400 mt-2">Assigned: {assignments.filter(a => a.eventId === ev.id).length}</p>
                  <button onClick={() => { setSelectedEventId(ev.id); setView('eventDetails'); }} className="mt-3 min-h-11 w-full rounded-xl bg-slate-900 text-white text-sm font-medium">Details</button>
                </div>
              ))}
              {paginatedEvents.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">No active events found.</div>
              )}
            </div>

            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
               <table className="min-w-full divide-y divide-slate-200">
                 <thead className="bg-slate-50">
                   <tr>
                     <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Event Name</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date/Shift</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                     <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Staff Assigned</th>
                     <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-slate-200">
                    {paginatedEvents.map((ev, idx) => (
                      <tr key={ev.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-amber-50`}>
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{ev.eventName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{getEventDateTime(ev)} <br/><span className="text-xs bg-slate-100 px-1 rounded">{ev.shift}</span></td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{ev.location}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                          {assignments.filter(a => a.eventId === ev.id).length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => { setSelectedEventId(ev.id); setView('eventDetails'); }} className="text-amber-700 hover:text-amber-800">Details</button>
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
            {paginatedEvents.length === 0 && (
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
                No active events found.
              </div>
            )}
            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                onClick={() => setEventsPage((p) => Math.max(1, p - 1))}
                disabled={eventsPage === 1}
                className="min-h-11 px-4 rounded-xl border border-slate-300 text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">Page {eventsPage} of {eventsTotalPages}</span>
              <button
                onClick={() => setEventsPage((p) => Math.min(eventsTotalPages, p + 1))}
                disabled={eventsPage === eventsTotalPages}
                className="min-h-11 px-4 rounded-xl border border-slate-300 text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm md:text-base font-semibold text-slate-800">Archived Events (Past Dates)</h3>
                <span className="text-xs text-slate-500">{filteredArchivedEvents.length}</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredArchivedEvents.map((ev) => (
                  <div key={`arch-${ev.id}`} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{ev.eventName}</p>
                      <p className="text-xs text-slate-500">{getEventDateTime(ev)} • {ev.location}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedEventId(ev.id); setView('eventDetails'); }}
                      className="min-h-11 px-3 rounded-xl border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                    >
                      View
                    </button>
                  </div>
                ))}
                {filteredArchivedEvents.length === 0 && <p className="text-sm text-slate-500">No archived events yet.</p>}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: CREATE EVENT */}
        {view === 'createEvent' && (
          <div className="max-w-2xl mx-auto bg-white p-5 md:p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-xl md:text-2xl font-bold mb-6 text-slate-800">Create New Event</h2>
            <form onSubmit={createEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Event Type</label>
                <select 
                  className="mt-1 block w-full min-h-11 border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                >
                  {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {eventType === 'Other' && (
                <div>
                   <label className="block text-sm font-medium text-slate-700">Custom Event Name</label>
                   <input name="customEventName" required type="text" className="mt-1 block w-full min-h-11 border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" placeholder="e.g. Political Rally" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Date</label>
                  <input name="eventDate" required type="date" className="mt-1 block w-full min-h-11 border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Reporting Time (12-hour)</label>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <select
                      name="eventHour"
                      required
                      defaultValue="07"
                      className="min-h-11 border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        const hour = String(i + 1).padStart(2, '0');
                        return <option key={hour} value={hour}>{hour}</option>;
                      })}
                    </select>
                    <select
                      name="eventMinute"
                      required
                      defaultValue="00"
                      className="min-h-11 border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    >
                      {Array.from({ length: 12 }, (_, i) => {
                        const minute = String(i * 5).padStart(2, '0');
                        return <option key={minute} value={minute}>{minute}</option>;
                      })}
                    </select>
                    <select
                      name="eventPeriod"
                      required
                      defaultValue="PM"
                      className="min-h-11 border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Shift</label>
                <select name="shift" className="mt-1 block w-full min-h-11 border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none">
                  <option>Morning</option>
                  <option>Afternoon</option>
                  <option>Night</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Location</label>
                <input name="location" required type="text" className="mt-1 block w-full min-h-11 border border-slate-300 rounded-xl px-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Description</label>
                <textarea name="description" className="mt-1 block w-full border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none min-h-28"></textarea>
              </div>
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                <button type="button" onClick={() => setView('events')} className="min-h-11 px-4 py-2 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50">Cancel</button>
                <button
                  type="submit"
                  disabled={isCreatingEvent}
                  className="min-h-11 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isCreatingEvent ? 'Saving...' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* VIEW: EVENT DETAILS (The Core Logic) */}
        {view === 'eventDetails' && selectedEventId && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <button onClick={() => setView('events')} className="text-gray-500 hover:text-gray-900 flex items-center"><ChevronRight className="rotate-180 mr-1"/> Back</button>
               <div className="flex items-center gap-3">
                 <h2 className="text-xl font-bold">Event Management Details</h2>
                 {currentUser.role === 'Manager' && (
                   <button
                     onClick={() => deleteEvent(selectedEventId)}
                     className="min-h-10 px-3 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm"
                   >
                     Delete Event
                   </button>
                 )}
               </div>
            </div>
            
            {(() => {
              const event = events.find(e => e.id === selectedEventId);
              if (!event) return <div>Event not found</div>;
              
              const currentAssignments = assignments.filter(a => a.eventId === selectedEventId);
              const assignedStaffIds = currentAssignments.map(a => a.staffId);
              const availableStaff = users.filter(u => u.role === 'Staff' && !assignedStaffIds.includes(u.id));

              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                   {/* Left Col: Event Info & Add Staff */}
                   <div className="space-y-6">
                      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                        <h3 className="font-bold text-lg mb-2">{event.eventName}</h3>
                        <p className="text-gray-500 text-sm mb-4">{getEventDateTime(event)} | {event.shift}</p>
                        <p className="text-gray-600 text-sm">{event.description || 'No description provided.'}</p>
                      </div>

                      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                        <h3 className="font-bold text-sm text-gray-800 mb-4">Assign New Staff</h3>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                           {availableStaff.map(s => (
                             <div key={s.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded border border-gray-100">
                               <div className="text-sm">
                                 <div className="font-medium">{s.name}</div>
                                 <div className="text-xs text-gray-400">{s.isContractor ? 'Contractor' : 'Permanent'}</div>
                               </div>
                               <button 
                                 onClick={() => assignStaff(event.id, [s.id])}
                                 className="text-xs bg-indigo-50 text-amber-700 px-2 py-1 rounded hover:bg-indigo-100"
                               >
                                 + Add
                               </button>
                             </div>
                           ))}
                           {availableStaff.length === 0 && <p className="text-xs text-gray-400 text-center">All staff assigned.</p>}
                        </div>
                      </div>
                   </div>

                   {/* Right Col: Assignment Management Table */}
                   <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                     <div className="px-4 md:px-6 py-4 border-b border-slate-100 font-bold flex justify-between">
                       <span>Staff Roster ({currentAssignments.length})</span>
                       <span className="text-xs font-normal text-slate-500">Edit amounts & attendance here</span>
                     </div>
                     <div className="p-4 space-y-3 md:hidden">
                       {currentAssignments.map(asg => {
                         const staff = users.find(u => u.id === asg.staffId);
                         return (
                           <details key={asg.id} className="border border-slate-200 rounded-xl p-3">
                             <summary className="flex items-center justify-between cursor-pointer text-sm font-medium">
                               <span>{staff?.name}</span>
                               <StatusBadge status={asg.attendanceStatus} type="attend" />
                             </summary>
                             <div className="mt-3 space-y-3">
                               <div>
                                 <label className="text-xs text-slate-500 block mb-1">Attendance</label>
                                 <select
                                   value={asg.attendanceStatus}
                                   onChange={(e) => updateAssignment(asg.id, { attendanceStatus: e.target.value as Attendance, markedByManager: true })}
                                   className="w-full min-h-11 text-sm border border-slate-300 rounded-xl p-2"
                                 >
                                   <option value="Not Marked">Not Marked</option>
                                   <option value="Present">Present</option>
                                   <option value="Absent">Absent</option>
                                 </select>
                               </div>
                               <div>
                                 <label className="text-xs text-slate-500 block mb-1">Payment (INR)</label>
                                 <input
                                   type="number"
                                   value={asg.paymentAmount}
                                   onChange={(e) => updateAssignment(asg.id, { paymentAmount: parseInt(e.target.value) || 0 })}
                                   className="w-full min-h-11 text-sm border border-slate-300 rounded-xl p-2"
                                 />
                               </div>
                               <button
                                 type="button"
                                 onClick={() => removeAssignedStaff(asg.id)}
                                 className="w-full min-h-11 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-sm"
                               >
                                 Remove Staff
                               </button>
                             </div>
                           </details>
                         );
                       })}
                     </div>
                     <div className="hidden md:block overflow-x-auto">
                     <table className="min-w-full divide-y divide-slate-200">
                       <thead className="bg-slate-50">
                         <tr>
                           <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Staff</th>
                           <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Availability</th>
                           <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Attendance</th>
                           <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Payment (₹)</th>
                           <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Received?</th>
                           <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Action</th>
                         </tr>
                       </thead>
                       <tbody className="bg-white divide-y divide-slate-200">
                         {currentAssignments.map(asg => {
                           const staff = users.find(u => u.id === asg.staffId);
                           return (
                             <tr key={asg.id}>
                               <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                 {staff?.name}
                                 {staff?.isContractor && <span className="ml-1 text-xs text-amber-600">(C)</span>}
                               </td>
                               <td className="px-4 py-3 text-sm">
                                 <StatusBadge status={asg.availabilityStatus} type="avail" />
                               </td>
                               <td className="px-4 py-3 text-sm">
                                 <select 
                                   value={asg.attendanceStatus} 
                                   onChange={(e) => updateAssignment(asg.id, { 
                                     attendanceStatus: e.target.value as Attendance, 
                                     markedByManager: true 
                                   })}
                                   className={`text-xs border-gray-300 rounded shadow-sm p-1 font-medium ${asg.attendanceStatus === 'Present' ? 'text-blue-700 bg-blue-50 border-blue-200' : ''}`}
                                 >
                                   <option value="Not Marked">Not Marked</option>
                                   <option value="Present">Present</option>
                                   <option value="Absent">Absent</option>
                                 </select>
                               </td>
                               <td className="px-4 py-3 text-sm">
                                 <input 
                                   type="number" 
                                   value={asg.paymentAmount}
                                   onChange={(e) => updateAssignment(asg.id, { paymentAmount: parseInt(e.target.value) || 0 })}
                                   className="w-20 text-xs border border-gray-300 rounded p-1"
                                 />
                               </td>
                               <td className="px-4 py-3 text-sm text-center">
                                 {asg.paymentReceived ? (
                                   <CheckCircle size={18} className="text-green-600 inline" />
                                 ) : (
                                   <span className="text-gray-300">-</span>
                                 )}
                               </td>
                               <td className="px-4 py-3 text-sm text-right">
                                 <button
                                   type="button"
                                   onClick={() => removeAssignedStaff(asg.id)}
                                   className="text-red-700 hover:text-red-800"
                                 >
                                   Remove
                                 </button>
                               </td>
                             </tr>
                           );
                         })}
                         {currentAssignments.length === 0 && (
                           <tr><td colSpan={6} className="p-4 text-center text-gray-500 text-sm">No staff assigned yet.</td></tr>
                         )}
                       </tbody>
                     </table>
                     </div>
                   </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* VIEW: STAFF MANAGEMENT */}
        {view === 'staff' && currentUser.role === 'Manager' && (
           <div className="space-y-6">
             <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
               <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                 <input
                   value={staffSearch}
                   onChange={(e) => setStaffSearch(e.target.value)}
                   placeholder="Search name or email"
                   className="min-h-11 w-full sm:w-64 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                 />
                 <select
                   value={staffSort}
                   onChange={(e) => setStaffSort(e.target.value as 'name' | 'email')}
                   className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                 >
                   <option value="name">Sort: Name</option>
                   <option value="email">Sort: Email</option>
                 </select>
               </div>
               <button onClick={() => setShowAddStaffModal(true)} className="min-h-11 bg-amber-600 text-white px-4 py-2 rounded-xl flex items-center justify-center space-x-2 hover:bg-amber-700">
                <UserPlus size={18} /> <span>Enroll Staff</span>
              </button>
             </div>
             
             {/* ADD STAFF MODAL */}
             {showAddStaffModal && (
               <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                 <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                   <div className="flex justify-between items-center mb-4">
                     <h3 className="text-xl font-bold">Enroll New Staff</h3>
                     <button onClick={() => setShowAddStaffModal(false)}><X size={20} className="text-gray-500"/></button>
                   </div>
                   <form onSubmit={handleAddStaff} className="space-y-4">
                     <div>
                       <label className="block text-sm font-medium text-gray-700">Full Name</label>
                       <input 
                         required
                         type="text" 
                         value={newStaffName}
                         onChange={(e) => setNewStaffName(e.target.value)}
                         className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                         placeholder="e.g. Rahul Patil"
                       />
                     </div>
                     <div>
                       <label className="block text-sm font-medium text-gray-700">Employment Type</label>
                       <select 
                         value={newStaffType}
                         onChange={(e) => setNewStaffType(e.target.value)}
                         className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                       >
                         <option value="Permanent">Permanent</option>
                         <option value="Contractor">Contractor</option>
                       </select>
                     </div>
                     
                     {newStaffName && (
                       <div className="bg-slate-50 p-3 rounded text-sm text-gray-600 space-y-1">
                         <p className="font-semibold text-gray-800">Preview Credentials:</p>
                         <p>Email: {newStaffName.split(' ')[0].toLowerCase()}.{newStaffName.split(' ').length > 1 ? newStaffName.split(' ')[newStaffName.split(' ').length-1].toLowerCase() : 'staff'}@maabhawani.com</p>
                         <p>Password: MB@{newStaffName.charAt(0).toUpperCase() + newStaffName.split(' ')[0].slice(1)}2026</p>
                       </div>
                     )}

                     <div className="flex space-x-3 pt-2">
                       <button type="button" onClick={() => setShowAddStaffModal(false)} className="flex-1 py-2 border rounded-md hover:bg-slate-50">Cancel</button>
                       <button type="submit" className="flex-1 py-2 bg-amber-600 text-white rounded-md hover:bg-amber-700">Create Account</button>
                     </div>
                   </form>
                 </div>
               </div>
             )}

             <div className="space-y-3 md:hidden">
               {paginatedStaff.map((u) => (
                 <div key={u.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                   <div className="flex items-start justify-between gap-2">
                     <div>
                       <h4 className="font-semibold text-slate-800">{u.name}</h4>
                       <p className="text-sm text-slate-500">{u.email}</p>
                     </div>
                     <span className={`px-2 py-1 rounded-full text-xs ${u.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                       {u.isActive ? 'Active' : 'Inactive'}
                     </span>
                   </div>
                   <p className="text-xs text-slate-500 mt-2">Type: {u.isContractor ? 'Contractor' : 'Permanent'}</p>
                   <p className="text-xs font-mono text-slate-400 mt-1">Password: {u.password}</p>
                 </div>
               ))}
             </div>

             <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Password</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {paginatedStaff.map((u, idx) => (
                      <tr key={u.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'} hover:bg-amber-50`}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{u.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-400">{u.password}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                           {u.isContractor ? 'Contractor' : 'Permanent'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                           <span className={`px-2 py-1 rounded-full text-xs ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                             {u.isActive ? 'Active' : 'Inactive'}
                           </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
             <div className="flex items-center justify-between gap-3 pt-1">
               <button
                 onClick={() => setStaffPage((p) => Math.max(1, p - 1))}
                 disabled={staffPage === 1}
                 className="min-h-11 px-4 rounded-xl border border-slate-300 text-slate-700 disabled:opacity-50"
               >
                 Previous
               </button>
               <span className="text-sm text-slate-500">Page {staffPage} of {staffTotalPages}</span>
               <button
                 onClick={() => setStaffPage((p) => Math.min(staffTotalPages, p + 1))}
                 disabled={staffPage === staffTotalPages}
                 className="min-h-11 px-4 rounded-xl border border-slate-300 text-slate-700 disabled:opacity-50"
               >
                 Next
               </button>
             </div>
           </div>
        )}

        {/* VIEW: REPORTS (Manager) */}
        {view === 'reports' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">Payroll & Reports</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                <h3 className="font-bold text-lg mb-4">Master Payroll Report</h3>
                <p className="text-slate-500 text-sm mb-6">Generate a summary PDF of all staff payments and attendance.</p>
                <button 
                  onClick={() => generatePDF('all')}
                  className="w-full bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 flex justify-center items-center gap-2"
                >
                  <Download size={18} /> Generate All Staff Statement
                </button>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                 <h3 className="font-bold text-lg mb-4">Individual Staff Report</h3>
                 <div className="space-y-4">
                   <select id="staffSelector" className="w-full min-h-11 border border-slate-300 rounded-xl px-3 text-sm">
                      {users.filter(u => u.role === 'Staff').map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                   </select>
                   <button 
                     onClick={() => {
                        const sel = document.getElementById('staffSelector') as HTMLSelectElement;
                        generatePDF('single', sel.value);
                     }}
                     className="w-full min-h-11 border border-slate-700 text-amber-700 py-2 rounded-xl hover:bg-slate-50 flex justify-center items-center gap-2"
                   >
                     <FileText size={18} /> Generate Single Statement
                   </button>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: PAYMENTS (Staff) */}
        {view === 'payments' && currentUser.role === 'Staff' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">My Payment History</h1>

            <div className="space-y-3 md:hidden">
              {assignments
                .filter(a => a.staffId === currentUser.id && a.attendanceStatus !== 'Not Marked')
                .map(a => {
                  const ev = events.find(e => e.id === a.eventId);
                  return (
                    <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                      <h3 className="font-semibold text-slate-800">{ev?.eventName}</h3>
                      <p className="text-sm text-slate-500 mt-1">{ev ? getEventDateTime(ev) : '-'}</p>
                      <div className="mt-2"><StatusBadge status={a.attendanceStatus} type="attend" /></div>
                      <p className="text-sm font-bold text-slate-800 mt-2">₹{a.paymentAmount}</p>
                      {a.paymentReceived ? (
                        <span className="mt-2 inline-flex text-emerald-700 text-sm font-semibold">Received</span>
                      ) : (
                        <button
                          onClick={() => {
                            if(confirm('Confirm you received this payment?')) {
                              updateAssignment(a.id, { paymentReceived: true });
                            }
                          }}
                          className="mt-3 w-full min-h-11 text-sm bg-amber-600 text-white rounded-xl hover:bg-amber-700"
                        >
                          Mark Received
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>

            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Event</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Attendance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Received?</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {assignments
                    .filter(a => a.staffId === currentUser.id && a.attendanceStatus !== 'Not Marked')
                    .map(a => {
                      const ev = events.find(e => e.id === a.eventId);
                      return (
                        <tr key={a.id} className="hover:bg-amber-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{ev?.eventName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{ev ? getEventDateTime(ev) : '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                             <StatusBadge status={a.attendanceStatus} type="attend" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-800">₹{a.paymentAmount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {a.paymentReceived ? (
                              <span className="text-green-600 flex items-center gap-1 font-bold animate-pulse">
                                <CheckCircle size={16}/> Received
                              </span>
                            ) : (
                              <button 
                                onClick={() => {
                                  if(confirm("Confirm you received this payment?")) {
                                    updateAssignment(a.id, { paymentReceived: true });
                                  }
                                }}
                                className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded shadow-sm hover:bg-amber-700 active:scale-95 transition-all"
                              >
                                Mark Received
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 flex justify-end">
               <button 
                 onClick={() => generatePDF('single', currentUser.id)}
                 className="flex items-center space-x-2 text-amber-700 font-medium hover:text-amber-800"
               >
                 <Download size={18} /> <span>Download Payment Statement</span>
               </button>
            </div>
          </div>
        )}
        </div>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 bg-white">
          <div className="grid grid-cols-5">
            {bottomNavItems.map(({ label, icon: Icon, targetView }) => (
              <button
                key={`${label}-${targetView}`}
                onClick={() => setView(targetView)}
                className={`min-h-14 flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  view === targetView ? 'text-amber-700' : 'text-slate-500'
                }`}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>
        {showExitToast && (
          <div className="fixed bottom-20 md:bottom-6 right-4 z-50 w-[min(92vw,360px)] rounded-xl border border-slate-200 bg-white shadow-lg p-4">
            <p className="text-sm font-medium text-slate-800">Leave website?</p>
            <p className="text-xs text-slate-500 mt-1">Press Leave to exit, or Stay to continue here.</p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowExitToast(false)}
                className="min-h-10 px-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={confirmExitWebsite}
                className="min-h-10 px-3 rounded-lg bg-amber-600 text-white hover:bg-amber-700 text-sm"
              >
                Leave
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}



