import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Calendar, 
  Users, 
  Sliders, 
  Database, 
  Code, 
  Plus, 
  Trash2, 
  Download, 
  Sparkles, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  CalendarOff, 
  Search, 
  FileText, 
  Layers, 
  Settings, 
  ChevronUp, 
  ChevronDown, 
  HelpCircle, 
  UserPlus, 
  BarChart3,
  Undo,
  Edit,
  RotateCcw,
  Lock
} from 'lucide-react';
import { Patient, Therapist, PatientCategory, ScheduleCell, TherapistLeave, LoggedSchedule } from './types';
import { initialTherapists, initialPatients, initialLeaves, generateInitialSchedule, databaseSchema, pseudocodeContent } from './data';
import { db, FIREBASE_CONFIGURED } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// --- Custom Fixed Therapist Sequences based on user specification ---
export const ROTATION_SEQUENCES: Record<string, string[]> = {
  am_regular: ['t1', 't2', 't3', 't4', 't1', 't2', 't3', 't4', 't1', 't3', 't4'], // 趙長宥、潘亮全、姜壯坤、蘇柏臻、趙長宥、潘亮全、姜壯坤、蘇柏臻、趙長宥、姜壯坤、蘇柏臻
  pm_regular: ['t1', 't5', 't3', 't4', 't1', 't5', 't3', 't4', 't1', 't3', 't4'], // 趙長宥、邱申棟、姜壯坤、蘇柏臻、趙長宥、邱申棟、姜壯坤、蘇柏臻、趙長宥、姜壯坤、蘇柏臻
  am_splint: ['t1', 't2', 't3', 't4', 't1', 't4'], // 趙長宥、潘亮全、姜壯坤、蘇柏臻、趙長宥、蘇柏臻
  pm_splint: ['t1', 't5', 't3', 't4', 't1', 't4']  // 趙長宥、邱申棟、姜壯坤、蘇柏臻、趙長宥、蘇柏臻
};

export default function App() {
  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState<'scheduler' | 'admin'>('scheduler');

  // --- Real State (Simulated Cloud DB with localStorage Persistence) ---
  const [patients, setPatients] = useState<Patient[]>(() => {
    const saved = localStorage.getItem('app_patients');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return initialPatients;
  });
  const [therapists, setTherapists] = useState<Therapist[]>(() => {
    const saved = localStorage.getItem('app_therapists');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return initialTherapists;
  });
  const [leaves, setLeaves] = useState<TherapistLeave[]>(() => {
    const saved = localStorage.getItem('app_leaves');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return initialLeaves;
  });
  const [scheduleCells, setScheduleCells] = useState<ScheduleCell[]>(() => {
    const saved = localStorage.getItem('app_schedule_cells');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((c: any) => ({
            ...c,
            isBlockedByLeave: false,
            isSystemBlocked: false
          }));
        }
      } catch (e) { console.error(e); }
    }
    return generateInitialSchedule(initialTherapists);
  });
  const [therapistOrder, setTherapistOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('app_therapist_order');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return ['t1', 't2', 't3', 't4', 't5'];
  });
  const [nextRotationIndex, setNextRotationIndex] = useState<number>(() => {
    const saved = localStorage.getItem('app_next_rotation_index');
    if (saved !== null) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed)) return parsed;
    }
    return 0;
  });

  // --- Inline Edit state for Therapists ---
  const [editingTherapistId, setEditingTherapistId] = useState<string | null>(null);
  const [editTherapistName, setEditTherapistName] = useState<string>('');
  const [editTherapistCode, setEditTherapistCode] = useState<string>('');

  // --- Inline Edit state for Patients ---
  const [editingPatientId, setEditingPatientId] = useState<string | null>(null);
  const [editPatientName, setEditPatientName] = useState<string>('');
  const [editPatientMedicalId, setEditPatientMedicalId] = useState<string>('');
  const [editPatientCategory, setEditPatientCategory] = useState<PatientCategory>('INPATIENT');
  const [editPatientUrgency, setEditPatientUrgency] = useState<'HIGH' | 'MEDIUM' | 'LOW'>('MEDIUM');
  const [editPatientNote, setEditPatientNote] = useState<string>('');
  const [editPatientTherapistId, setEditPatientTherapistId] = useState<string>('');
  const [editPatientScheduledDate, setEditPatientScheduledDate] = useState<string>('');
  
  // Custom rotation pointers for the four queues, offset to start with different therapists
  const [rotationIndices, setRotationIndices] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('app_rotation_indices');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { console.error(e); }
    }
    return {
      am_regular: 0, // Starts with 't1' (趙長宥)
      pm_regular: 1, // Starts with 't5' (邱申棟)
      am_splint: 2,  // Starts with 't3' (姜壯坤)
      pm_splint: 3   // Starts with 't4' (蘇柏臻)
    };
  });

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // --- Back-end Password Security State ---
  const [adminPassword, setAdminPassword] = useState<string | null>(() => localStorage.getItem('admin_pwd_hash'));
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(false);
  const [pwdInput, setPwdInput] = useState<string>('');
  const [pwdSetupInput, setPwdSetupInput] = useState<string>('');
  const [pwdSetupConfirmInput, setPwdSetupConfirmInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  
  // Notification logs for user activities (to keep UX interactive and responsive)
  const [notif, setNotif] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>({
    message: '職能治療排程管理系統載入成功！已依範本初始化 5 名治療師及預設課表。',
    type: 'success'
  });

  // Custom dialog state for iframe-safe browser-native alternative confirmations
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const triggerConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(null);
      }
    });
  };

  // Automatically lock the admin tab when navigating away
  useEffect(() => {
    if (activeTab !== 'admin') {
      setIsAdminAuthenticated(false);
      setPwdInput('');
      setLoginError('');
    }
  }, [activeTab]);

  // --- LocalStorage persistence synchronization ---
  useEffect(() => {
    localStorage.setItem('app_patients', JSON.stringify(patients));
  }, [patients]);

  useEffect(() => {
    localStorage.setItem('app_therapists', JSON.stringify(therapists));
  }, [therapists]);

  useEffect(() => {
    localStorage.setItem('app_leaves', JSON.stringify(leaves));
  }, [leaves]);

  useEffect(() => {
    localStorage.setItem('app_schedule_cells', JSON.stringify(scheduleCells));
  }, [scheduleCells]);

  useEffect(() => {
    localStorage.setItem('app_therapist_order', JSON.stringify(therapistOrder));
  }, [therapistOrder]);

  useEffect(() => {
    localStorage.setItem('app_next_rotation_index', String(nextRotationIndex));
  }, [nextRotationIndex]);

  useEffect(() => {
    localStorage.setItem('app_rotation_indices', JSON.stringify(rotationIndices));
  }, [rotationIndices]);

  // Search keyword for patients lists
  const [patientSearch, setPatientSearch] = useState('');

  // Handle auto-dismiss for notifications
  useEffect(() => {
    if (notif) {
      const timer = setTimeout(() => setNotif(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notif]);

  // Trigger leave recalculation to turn grid slots grey when leaves change (Disabled per user request)
  useEffect(() => {
    setScheduleCells(prevCells => {
      return prevCells.map(cell => {
        return {
          ...cell,
          isBlockedByLeave: false,
          isSystemBlocked: false,
          patientId: cell.patientId
        };
      });
    });
  }, [leaves]);

  // --- Cross-tab sync via localStorage storage events (zero-token test mode) ---
  useEffect(() => {
    if (FIREBASE_CONFIGURED) return;
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.newValue === null) return;
      try {
        const val = JSON.parse(e.newValue);
        if (e.key === 'app_patients') setPatients(val);
        else if (e.key === 'app_therapists') setTherapists(val);
        else if (e.key === 'app_leaves') setLeaves(val);
        else if (e.key === 'app_schedule_cells') setScheduleCells(
          val.map((c: any) => ({ ...c, isBlockedByLeave: false, isSystemBlocked: false }))
        );
        else if (e.key === 'app_therapist_order') setTherapistOrder(val);
        else if (e.key === 'app_next_rotation_index') setNextRotationIndex(val);
        else if (e.key === 'app_rotation_indices') setRotationIndices(val);
        else if (e.key === 'admin_pwd_hash') setAdminPassword(val || null);
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // --- Firebase Real-time Sync ---
  const isFromFirebase = useRef(false);
  const firebaseReady = useRef(!FIREBASE_CONFIGURED); // true immediately if Firebase not configured
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [syncStatus, setSyncStatus] = useState<'offline' | 'syncing' | 'synced' | 'error'>(
    FIREBASE_CONFIGURED ? 'syncing' : 'offline'
  );

  // Listen for Firestore remote state changes
  useEffect(() => {
    if (!FIREBASE_CONFIGURED || !db) return;
    const docRef = doc(db, 'scheduleApp', 'sharedState');
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) {
        // No remote data yet — mark ready so we push local state up
        firebaseReady.current = true;
        setSyncStatus('synced');
        return;
      }
      const data = snap.data();
      isFromFirebase.current = true;
      if (Array.isArray(data.patients)) setPatients(data.patients);
      if (Array.isArray(data.therapists)) setTherapists(data.therapists);
      if (Array.isArray(data.leaves)) setLeaves(data.leaves);
      if (Array.isArray(data.scheduleCells)) {
        setScheduleCells(data.scheduleCells.map((c: any) => ({
          ...c, isBlockedByLeave: false, isSystemBlocked: false
        })));
      }
      if (Array.isArray(data.therapistOrder)) setTherapistOrder(data.therapistOrder);
      if (typeof data.nextRotationIndex === 'number') setNextRotationIndex(data.nextRotationIndex);
      if (data.rotationIndices) setRotationIndices(data.rotationIndices);
      if (data.adminPassword !== undefined) {
        setAdminPassword(data.adminPassword || null);
        if (data.adminPassword) localStorage.setItem('admin_pwd_hash', data.adminPassword);
        else localStorage.removeItem('admin_pwd_hash');
      }
      firebaseReady.current = true;
      setSyncStatus('synced');
      setTimeout(() => { isFromFirebase.current = false; }, 300);
    }, () => {
      setSyncStatus('error');
    });
    return () => unsub();
  }, []);

  // Push local state changes to Firestore (debounced 1.5s)
  useEffect(() => {
    if (!FIREBASE_CONFIGURED || !db || !firebaseReady.current || isFromFirebase.current) return;
    setSyncStatus('syncing');
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      if (isFromFirebase.current || !db) return;
      try {
        await setDoc(doc(db, 'scheduleApp', 'sharedState'), {
          patients, therapists, leaves, scheduleCells,
          therapistOrder, nextRotationIndex, rotationIndices,
          adminPassword: adminPassword || null,
          lastUpdated: new Date().toISOString()
        });
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }, 1500);
  }, [patients, therapists, leaves, scheduleCells, therapistOrder, nextRotationIndex, rotationIndices, adminPassword]);

  // --- Simplified Clerk Workflow States ---
  const [clerkMedicalId, setClerkMedicalId] = useState('');
  const [clerkPatientName, setClerkPatientName] = useState('');
  const [clerkCategory, setClerkCategory] = useState<PatientCategory | null>(null);
  const [clerkTimeMode, setClerkTimeMode] = useState<'AM' | 'PM'>(() => {
    const hours = new Date().getHours();
    return hours < 13 ? 'AM' : 'PM';
  });
  const [clerkScheduleDate, setClerkScheduleDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [statsMonth, setStatsMonth] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const monthStr = `${yyyy}-${mm}`;
    return monthStr >= '2026-06' ? monthStr : '2026-06';
  });

  // Dynamically compile the list of uniquely selectable months starting strictly from June 2026
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    // Default start from June 2026
    months.add('2026-06');
    months.add('2026-07');
    
    patients.forEach(p => {
      if (p.scheduledDate) {
        const m = p.scheduledDate.substring(0, 7);
        if (/^\d{4}-\d{2}$/.test(m)) {
          // 只列出2026年6月及以後
          if (m >= '2026-06') {
            months.add(m);
          }
        }
      }
    });
    
    // Sort descending so latest is on top, then backwards in history
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [patients]);
  const [recommendedResult, setRecommendedResult] = useState<{
    therapist: Therapist;
    cellIds: string[];
    slotLabel: string;
    category: PatientCategory;
    seqIndexUsed?: number;
    seqKey?: string;
  } | null>(null);

  // --- Dynamic Form States (for creating/editing patients & leaves) ---
  const [newPatient, setNewPatient] = useState<Omit<Patient, 'id'>>({
    name: '',
    medicalId: '',
    category: 'INPATIENT',
    urgency: 'MEDIUM',
    note: '',
    scheduledDate: ''
  });

  const getNextTherapistInSeq = (key: string) => {
    const seq = ROTATION_SEQUENCES[key];
    const index = rotationIndices[key];
    if (!seq) return '無';
    const tId = seq[index];
    const t = therapists.find(item => item.id === tId);
    return t ? t.name : '無';
  };

  const getRotationHighlightKey = () => {
    const isMorning = clerkTimeMode === 'AM';
    if (clerkCategory === 'SPLINT') {
      return isMorning ? 'am_splint' : 'pm_splint';
    } else if (clerkCategory) {
      return isMorning ? 'am_regular' : 'pm_regular';
    }
    return '';
  };

  const [newLeave, setNewLeave] = useState<Omit<TherapistLeave, 'id'>>({
    therapistId: 't1',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
    slots: '整天'
  });

  // Helper dictionary to get patient details
  const patientMap = useMemo(() => {
    return new Map<string, Patient>(patients.map(p => [p.id, p]));
  }, [patients]);

  const therapistMap = useMemo(() => {
    return new Map<string, Therapist>(therapists.map(t => [t.id, t]));
  }, [therapists]);

  // Get current ordered list of therapists for Round Robin
  const sortedTherapistsInRotation = useMemo(() => {
    return therapistOrder
      .map(id => therapists.find(t => t.id === id))
      .filter((t): t is Therapist => !!t && t.isActive);
  }, [therapistOrder, therapists]);

  // Get count of scheduled patients in the primary scheduler grid
  const scheduledPatientIdsList = useMemo(() => {
    const list = new Set<string>();
    scheduleCells.forEach(c => {
      if (c.patientId) list.add(c.patientId);
    });
    return list;
  }, [scheduleCells]);

  // Compute assigned pairs for compact ledger representation
  const assignedPairs = useMemo(() => {
    const pairs: Array<{
      cellId: string;
      patientId: string;
      patientName: string;
      medicalId: string;
      category: PatientCategory;
      therapistId: string;
      therapistName: string;
      therapistCode: string;
      slots: string;
      slotIndex: number;
    }> = [];

    const seenCombined = new Set<string>();

    scheduleCells.forEach(cell => {
      if (cell.patientId) {
        const patientObj = patientMap.get(cell.patientId);
        if (!patientObj) return;

        const ampmKey = cell.slotIndex < 100 ? 'AM' : 'PM';
        const key = `${cell.patientId}-${cell.category}-${cell.therapistId}-${ampmKey}`;
        if (seenCombined.has(key)) {
          const existing = pairs.find(p => p.patientId === cell.patientId && p.category === cell.category && p.therapistId === cell.therapistId && (p.slotIndex < 100 === cell.slotIndex < 100));
          if (existing) {
            existing.slots += `、第 ${cell.slotIndex < 100 ? cell.slotIndex + 1 : cell.slotIndex - 99} 診`;
          }
          return;
        }

        seenCombined.add(key);
        const therapistObj = therapists.find(t => t.id === cell.therapistId);
        pairs.push({
          cellId: cell.id,
          patientId: cell.patientId,
          patientName: patientObj.name,
          medicalId: patientObj.medicalId,
          category: cell.category,
          therapistId: cell.therapistId,
          therapistName: therapistObj?.name || '未知',
          therapistCode: therapistObj?.code || '',
          slots: `第 ${cell.slotIndex < 100 ? cell.slotIndex + 1 : cell.slotIndex - 99} 診`,
          slotIndex: cell.slotIndex,
        });
      }
    });

    // Sort by morning/afternoon, then slot index
    pairs.sort((a, b) => {
      const ampmA = a.slotIndex < 100 ? 0 : 1;
      const ampmB = b.slotIndex < 100 ? 0 : 1;
      if (ampmA !== ampmB) return ampmA - ampmB;
      return a.slotIndex - b.slotIndex;
    });

    return pairs;
  }, [scheduleCells, patientMap, therapists]);

  // List of patients currently waiting (unscheduled)
  const pendingPatients = useMemo(() => {
    return patients.filter(p => !scheduledPatientIdsList.has(p.id));
  }, [patients, scheduledPatientIdsList]);

  // Filtered Patients List for CRUD
  const filteredPatientsForCrud = useMemo(() => {
    if (!patientSearch) return patients;
    const kw = patientSearch.toLowerCase();
    return patients.filter(p => 
      p.name.toLowerCase().includes(kw) || 
      p.medicalId.toLowerCase().includes(kw) || 
      p.note?.toLowerCase().includes(kw)
    );
  }, [patients, patientSearch]);

  // Selected Patient computed recommendation slots
  const eligibleRecommendationCells = useMemo(() => {
    if (!selectedPatientId) return new Set<string>();
    const patientObj = patientMap.get(selectedPatientId);
    if (!patientObj) return new Set<string>();

    const targetCategory = patientObj.category;
    const isComplex = false; // 複雜皆改為只要佔用一格即可
    const eligibleIds = new Set<string>();

    // For each therapist, find valid grid positions
    therapists.forEach(therapist => {
      const cellsForTherapist = scheduleCells
        .filter(c => c.category === targetCategory && c.therapistId === therapist.id)
        .sort((a, b) => a.slotIndex - b.slotIndex);

      if (isComplex) {
        // Complex weight = 2 consecutive blank slots in same half-day
        for (let i = 0; i < cellsForTherapist.length - 1; i++) {
          const c1 = cellsForTherapist[i];
          const c2 = cellsForTherapist[i + 1];

          const isC1Free = !c1.patientId && !c1.isSystemBlocked && !c1.isBlockedByLeave;
          const isC2Free = !c2.patientId && !c2.isSystemBlocked && !c2.isBlockedByLeave;
          const isSameHalf = (c1.slotIndex < 4 && c2.slotIndex < 4) || (c1.slotIndex >= 4 && c2.slotIndex >= 4);

          if (isC1Free && isC2Free && isSameHalf) {
            eligibleIds.add(c1.id);
            eligibleIds.add(c2.id);
          }
        }
      } else {
        // Regular = single blank slot
        cellsForTherapist.forEach(cell => {
          if (!cell.patientId && !cell.isSystemBlocked && !cell.isBlockedByLeave) {
            eligibleIds.add(cell.id);
          }
        });
      }
    });

    return eligibleIds;
  }, [selectedPatientId, scheduleCells, therapists, patientMap]);

  // Highlight the FAIR automatic recommendation based on current Round Robin Index
  const fairRecommendationCells = useMemo(() => {
    const defaultRecs = new Set<string>();
    if (!selectedPatientId || eligibleRecommendationCells.size === 0) return defaultRecs;
    const patientObj = patientMap.get(selectedPatientId);
    if (!patientObj) return defaultRecs;

    // Find the next available therapist in rotation order starting from nextRotationIndex
    let targetIndex = nextRotationIndex;
    const numTherapists = sortedTherapistsInRotation.length;
    let foundEligibleTherapistId: string | null = null;

    for (let attempts = 0; attempts < numTherapists; attempts++) {
      const idx = (targetIndex + attempts) % numTherapists;
      const t = sortedTherapistsInRotation[idx];
      
      // Check if this therapist has any highlighted slots
      const hasSlot = [...eligibleRecommendationCells].some(cellId => {
        const c = scheduleCells.find(cell => cell.id === cellId);
        return c && c.therapistId === t.id;
      });

      if (hasSlot) {
        foundEligibleTherapistId = t.id;
        break;
      }
    }

    if (foundEligibleTherapistId) {
      // Return only the eligible cells belonging to this specific recommended therapist
      scheduleCells.forEach(cell => {
        if (cell.category === patientObj.category && 
            cell.therapistId === foundEligibleTherapistId && 
            eligibleRecommendationCells.has(cell.id)) {
          defaultRecs.add(cell.id);
        }
      });
    }

    return defaultRecs;
  }, [selectedPatientId, eligibleRecommendationCells, sortedTherapistsInRotation, nextRotationIndex, scheduleCells, patientMap]);


  // --- Core Application Scheduling Action Hooks ---

  // Assign a patient to a specific slot
  const handleAssignPatient = (cellId: string, pId: string, isManualOverride: boolean = false) => {
    const patientObj = patientMap.get(pId);
    if (!patientObj) return;

    const cellObj = scheduleCells.find(c => c.id === cellId);
    if (!cellObj) return;

    // Stamp scheduling date on patient if not set
    const todayStr = new Date().toISOString().split('T')[0];
    setPatients(prev => prev.map(p => p.id === pId ? { ...p, scheduledDate: p.scheduledDate || todayStr } : p));

    const isComplex = false; // 複雜皆改為只要佔用一格即可

    setScheduleCells(prev => {
      // Find the therapist's sorted cells for this section
      const cellsForT = prev
        .filter(c => c.category === patientObj.category && c.therapistId === cellObj.therapistId)
        .sort((a, b) => a.slotIndex - b.slotIndex);

      if (isComplex) {
        // Complex patient. Must assign the consecutive pair
        // Find which position the clicked cell occupies
        const clickedIdx = cellsForT.findIndex(c => c.id === cellId);
        if (clickedIdx === -1) return prev;

        // Determine the consecutive pair index (try forward first, then backward, avoiding cross-day splits)
        let pairIdx1 = -1;
        let pairIdx2 = -1;

        const forwardSecondCell = cellsForT[clickedIdx + 1];
        if (forwardSecondCell && 
            !forwardSecondCell.patientId && 
            !forwardSecondCell.isSystemBlocked && 
            !forwardSecondCell.isBlockedByLeave &&
            ((cellObj.slotIndex < 4 && forwardSecondCell.slotIndex < 4) || (cellObj.slotIndex >= 4 && forwardSecondCell.slotIndex >= 4))
        ) {
          pairIdx1 = clickedIdx;
          pairIdx2 = clickedIdx + 1;
        } else {
          const backwardFirstCell = cellsForT[clickedIdx - 1];
          if (backwardFirstCell && 
              !backwardFirstCell.patientId && 
              !backwardFirstCell.isSystemBlocked && 
              !backwardFirstCell.isBlockedByLeave &&
              ((backwardFirstCell.slotIndex < 4 && cellObj.slotIndex < 4) || (backwardFirstCell.slotIndex >= 4 && cellObj.slotIndex >= 4))
          ) {
            pairIdx1 = clickedIdx - 1;
            pairIdx2 = clickedIdx;
          }
        }

        if (pairIdx1 === -1 || pairIdx2 === -1) {
          // No room for continuous slots! Show error
          setNotif({
            message: `排班失敗：複雜個案 ${patientObj.name} 需要該治療師有連續 2 格且不跨越半天的空檔！`,
            type: 'error'
          });
          return prev;
        }

        const c1Id = cellsForT[pairIdx1].id;
        const c2Id = cellsForT[pairIdx2].id;

        // Log notification
        const therapistObj = therapistMap.get(cellObj.therapistId);
        setNotif({
          message: `${isManualOverride ? '[手動微調] ' : '[自動輪替] '}指派成功！個案 ${patientObj.name} 已安排至治療師 ${therapistObj?.name} 下午/上午連續 2 格診。`,
          type: 'success'
        });

        // Return updated state
        return prev.map(c => {
          if (c.id === c1Id || c.id === c2Id) {
            return { ...c, patientId: pId };
          }
          return c;
        });

      } else {
        // Regular weight = 1 cell
        const therapistObj = therapistMap.get(cellObj.therapistId);
        setNotif({
          message: `${isManualOverride ? '[手動微調] ' : '[智慧指派] '}已將 ${patientObj.name} 排入 ${therapistObj?.name} ${cellObj.slotLabel}。`,
          type: 'success'
        });

        return prev.map(c => {
          if (c.id === cellId) {
            return { ...c, patientId: pId };
          }
          return c;
        });
      }
    });

    // Update Round-Robin state: point to the next therapist in priority after successful rotation assignment
    if (!isManualOverride) {
      const activeIdxInRotation = sortedTherapistsInRotation.findIndex(t => t.id === cellObj.therapistId);
      if (activeIdxInRotation !== -1) {
        setNextRotationIndex((activeIdxInRotation + 1) % sortedTherapistsInRotation.length);
      }
    }

    setSelectedPatientId(null);
  };

  // Remove a patient from their scheduled cell
  const handleRemoveAssignment = (cellId: string) => {
    const cell = scheduleCells.find(c => c.id === cellId);
    if (!cell || !cell.patientId) return;

    const patientObj = patientMap.get(cell.patientId);
    if (!patientObj) return;

    const targetPatientId = cell.patientId;

    // Is complex? We need to free both cells
    const isComplex = false; // 複雜皆改為只要佔用一格即可

    setScheduleCells(prev => {
      const updated = prev.map(c => {
        if (c.id === cellId) {
          return { ...c, patientId: null };
        }
        return c;
      });

      // If the patient is no longer assigned in ANY cells, clear scheduledDate
      const stillAssigned = updated.some(c => c.patientId === targetPatientId);
      if (!stillAssigned) {
        setPatients(prevPatients => prevPatients.map(p => p.id === targetPatientId ? { ...p, scheduledDate: undefined } : p));
      }

      return updated;
    });

    setNotif({
      message: `已移除個案 ${patientObj.name} 並釋放治療課表格子。`,
      type: 'info'
    });
  };

  // Modify therapist assignment from the assigned pairs table with full grid sync
  const handleModifyTherapist = (
    patientId: string,
    category: PatientCategory,
    oldTherapistId: string,
    newTherapistId: string,
    ampm: 'AM' | 'PM'
  ) => {
    if (oldTherapistId === newTherapistId) return;

    const isMorning = ampm === 'AM';
    const oldCells = scheduleCells.filter(c => 
      c.patientId === patientId &&
      c.category === category &&
      c.therapistId === oldTherapistId &&
      (isMorning ? c.slotIndex < 100 : c.slotIndex >= 100)
    );

    if (oldCells.length === 0) {
      setNotif({
        message: '⚠️ 找不到對應的原指派紀錄！',
        type: 'error'
      });
      return;
    }

    const slotIndexes = oldCells.map(c => c.slotIndex);
    const newCellsToAssign: ScheduleCell[] = [];
    const occupiedInfo: string[] = [];

    // Local copy of schedule cells in case we need to dynamically append
    let localCells = [...scheduleCells];
    let cellsUpdated = false;

    for (const sIdx of slotIndexes) {
      let targetCell = localCells.find(c => 
        c.category === category &&
        c.slotIndex === sIdx &&
        c.therapistId === newTherapistId
      );

      if (!targetCell) {
        const isM = sIdx < 100;
        const displaySlot = isM ? sIdx + 1 : sIdx - 99;
        const slotLabel = isM ? `上午診 第 ${displaySlot} 診` : `下午診 第 ${displaySlot} 診`;
        
        targetCell = {
          id: `${category}-S${sIdx}-${newTherapistId}`,
          category,
          slotIndex: sIdx,
          slotLabel,
          therapistId: newTherapistId,
          patientId: null,
          isBlockedByLeave: false,
          isSystemBlocked: false
        };
        localCells.push(targetCell);
        cellsUpdated = true;
      }

      // Check occupied or blocked
      if (targetCell.patientId !== null && targetCell.patientId !== patientId) {
        const destPatient = patientMap.get(targetCell.patientId);
        occupiedInfo.push(`第 ${sIdx < 100 ? sIdx + 1 : sIdx - 99} 診已被個案 ${destPatient?.name || '未知'} 佔用`);
      } else if (targetCell.isBlockedByLeave) {
        occupiedInfo.push(`第 ${sIdx < 100 ? sIdx + 1 : sIdx - 99} 診該治療師請假中`);
      } else if (targetCell.isSystemBlocked) {
        occupiedInfo.push(`第 ${sIdx < 100 ? sIdx + 1 : sIdx - 99} 診為系統行政禁行時段`);
      } else {
        newCellsToAssign.push(targetCell);
      }
    }

    if (cellsUpdated) {
      setScheduleCells(localCells);
    }

    if (occupiedInfo.length > 0) {
      const newTherapistName = therapists.find(t => t.id === newTherapistId)?.name || '未知';
      setNotif({
        message: `⚠️ 無法變更至 ${newTherapistName}：${occupiedInfo.join('、')}`,
        type: 'error'
      });
      return;
    }

    // Perform atomic state migration
    setScheduleCells(prev => {
      const targetIds = newCellsToAssign.map(c => c.id);
      const oldIds = oldCells.map(c => c.id);

      return prev.map(c => {
        if (oldIds.includes(c.id)) {
          return { ...c, patientId: null };
        }
        if (targetIds.includes(c.id)) {
          return { ...c, patientId: patientId };
        }
        return c;
      });
    });

    const patientName = patientMap.get(patientId)?.name || '個案';
    const oldName = therapists.find(t => t.id === oldTherapistId)?.name || '原治療師';
    const newName = therapists.find(t => t.id === newTherapistId)?.name || '新治療師';

    setNotif({
      message: `🔄 變更成功！已將個案 ${patientName} 的課表，由 ${oldName} 的時段更換至 ${newName}`,
      type: 'success'
    });
  };

  // --- Simplified Clerk Handlers & UI Interactions ---
  const handleClerkSelectOption = (category: PatientCategory) => {
    setClerkCategory(category);
    
    // Normalise Medical ID (upper case)
    const normalizedMedId = clerkMedicalId.trim().toUpperCase();
    if (!normalizedMedId) {
      setNotif({
        message: '⚠️ 請先輸入個案之病歷號！（病歷號預設為大寫英文與數字交替）',
        type: 'error'
      });
      setRecommendedResult(null);
      return;
    }

    const isMorning = clerkTimeMode === 'AM';
    const seqKey = category === 'SPLINT' 
      ? (isMorning ? 'am_splint' : 'pm_splint')
      : (isMorning ? 'am_regular' : 'pm_regular');

    const seq = ROTATION_SEQUENCES[seqKey];
    const startIndex = rotationIndices[seqKey];
    const N = seq.length;

    // Dynamically expand schedule cells if any active therapist does not have a free slot
    let currentCells = [...scheduleCells];
    let expanded = false;
    const activeTs = therapists.filter(t => t.isActive);

    activeTs.forEach(t => {
      const tCells = currentCells.filter(c => c.category === category && c.therapistId === t.id);
      const halfDayCells = tCells.filter(c => isMorning ? c.slotIndex < 100 : c.slotIndex >= 100);
      const hasFree = halfDayCells.some(c => !c.patientId && !c.isSystemBlocked && !c.isBlockedByLeave);
      
      if (!hasFree) {
        expanded = true;
        const activeSlotIndexes = halfDayCells.map(c => c.slotIndex);
        const maxIdx = activeSlotIndexes.length > 0 ? Math.max(...activeSlotIndexes) : (isMorning ? -1 : 99);
        const newSlotIndex = maxIdx + 1;
        const displaySlotNum = isMorning ? newSlotIndex + 1 : newSlotIndex - 99;
        const slotLabel = isMorning 
          ? `上午診 第 ${displaySlotNum} 診` 
          : `下午診 第 ${displaySlotNum} 診`;

        currentCells.push({
          id: `${category}-S${newSlotIndex}-${t.id}`,
          category,
          slotIndex: newSlotIndex,
          slotLabel,
          therapistId: t.id,
          patientId: null,
          isBlockedByLeave: false,
          isSystemBlocked: false
        });
      }
    });

    if (expanded) {
      setScheduleCells(currentCells);
    }

    let foundRec: { therapist: Therapist; cellIds: string[]; slotLabel: string; seqIndexUsed: number; seqKey: string } | null = null;

    // Start searching from the current sequence index
    for (let i = 0; i < N; i++) {
      const currentSeqIdx = (startIndex + i) % N;
      const tId = seq[currentSeqIdx];
      
      const therapistObj = therapists.find(t => t.id === tId);
      if (!therapistObj || !therapistObj.isActive) continue;

      const tCells = currentCells
        .filter(c => c.category === category && c.therapistId === tId)
        .sort((a, b) => a.slotIndex - b.slotIndex);
      
      const filteredTCells = tCells.filter(c => isMorning ? c.slotIndex < 100 : c.slotIndex >= 100);

      // 複雜皆改成只要佔用一格即可 - treated exactly like moderate/light/etc
      const freeCell = filteredTCells.find(c => !c.patientId && !c.isSystemBlocked && !c.isBlockedByLeave);
      if (freeCell) {
        foundRec = {
          therapist: therapistObj,
          cellIds: [freeCell.id],
          slotLabel: freeCell.slotLabel,
          seqIndexUsed: currentSeqIdx,
          seqKey
        };
        break;
      }
    }

    if (foundRec) {
      setRecommendedResult({
        therapist: foundRec.therapist,
        cellIds: foundRec.cellIds,
        slotLabel: foundRec.slotLabel,
        category: category,
        seqIndexUsed: foundRec.seqIndexUsed,
        seqKey: foundRec.seqKey
      });
    } else {
      setRecommendedResult(null);
      setNotif({
        message: `⚠️ 抱歉！在 ${clerkTimeMode === 'AM' ? '上午' : '下午'} 時段中，所有治療師的【${getCategoryLabel(category)}】皆無空餘排班格，請切換時段或手動清空。`,
        type: 'error'
      });
    }
  };

  const handleConfirmClerkAssignment = () => {
    if (!recommendedResult) return;

    const finalMedicalId = clerkMedicalId.trim().toUpperCase();
    if (!finalMedicalId) return;

    // Check if patient already exists, or create a brand new one
    let existingPatient = patients.find(p => p.medicalId === finalMedicalId);
    let pId = '';
    let finalName = clerkPatientName.trim();

    if (existingPatient) {
      pId = existingPatient.id;
      // Option to update patient's name and/or dynamic schedule date
      setPatients(prev => prev.map(p => p.id === existingPatient.id ? { ...p, name: finalName, scheduledDate: clerkScheduleDate } : p));
    } else {
      // Create new
      pId = `clerk-p-${Date.now()}`;
      if (!finalName) {
        finalName = `病患 ${finalMedicalId}`;
      }
      const newPatientObj: Patient = {
        id: pId,
        name: finalName,
        medicalId: finalMedicalId,
        category: recommendedResult.category,
        urgency: 'MEDIUM',
        note: '由前台書記簡易快排指派',
        scheduledDate: clerkScheduleDate
      };
      setPatients(prev => [...prev, newPatientObj]);
    }

    // Set scheduling cells
    setScheduleCells(prev => {
      return prev.map(c => {
        if (recommendedResult.cellIds.includes(c.id)) {
          return { ...c, patientId: pId };
        }
        return c;
      });
    });

    // Notify success
    setNotif({
      message: `🎉 指派成功！已將個案 ${finalName} (${finalMedicalId}) 排入 ${recommendedResult.therapist.name} 的課表！`,
      type: 'success'
    });

    // Advance custom sequence state pointer!
    if (recommendedResult.seqKey && recommendedResult.seqIndexUsed !== undefined) {
      const key = recommendedResult.seqKey;
      const indexUsed = recommendedResult.seqIndexUsed;
      setRotationIndices(prev => ({
        ...prev,
        [key]: (indexUsed + 1) % ROTATION_SEQUENCES[key].length
      }));
    } else {
      // Fallback fallback
      const activeIdxInRotation = sortedTherapistsInRotation.findIndex(t => t.id === recommendedResult.therapist.id);
      if (activeIdxInRotation !== -1) {
        setNextRotationIndex((activeIdxInRotation + 1) % sortedTherapistsInRotation.length);
      }
    }

    // Clear input forms
    setClerkMedicalId('');
    setClerkPatientName('');
    setClerkCategory(null);
    setRecommendedResult(null);
  };

  // Batch Auto-Schedule Algorithm Trigger (Run memory mock of the core Pseudocode)
  const handleBatchAutoSchedule = () => {
    if (pendingPatients.length === 0) {
      setNotif({
        message: '目前待排班清單已無任何等待個案！',
        type: 'info'
      });
      return;
    }

    if (sortedTherapistsInRotation.length === 0) {
      setNotif({
        message: '排班終止：沒有任何可用的在職治療師，請於後台勾選啟用或新增治療師。',
        type: 'error'
      });
      return;
    }

    // Clone grid cells and patients queue to execute localized simulation
    const currentQueue = [...pendingPatients].sort((a, b) => {
      const urgencyWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      const diff = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
      if (diff !== 0) return diff;
      
      const isAComplex = 0; // 複雜皆改為只要佔用一格即可
      const isBComplex = 0;
      return isBComplex - isAComplex;
    });

    let localRotationIdx = nextRotationIndex;
    const numTherapists = sortedTherapistsInRotation.length;
    let scheduledCount = 0;
    let unscheduledCount = 0;

    // Simulate assignments step-by-step
    const simulatedCells = [...scheduleCells];

    for (const patient of currentQueue) {
      let patientAssigned = false;
      let attempts = 0;

      while (!patientAssigned && attempts < numTherapists) {
        const currentTherapist = sortedTherapistsInRotation[localRotationIdx];
        const tId = currentTherapist.id;
        const category = patient.category;

        // Get this therapist's cells
        let therapistCells = simulatedCells
          .filter(c => c.category === category && c.therapistId === tId)
          .sort((a, b) => a.slotIndex - b.slotIndex);

        // If there are no free slots, dynamically append a morning slot
        const hasFree = therapistCells.some(c => !c.patientId && !c.isSystemBlocked && !c.isBlockedByLeave);
        if (!hasFree) {
          const amCells = therapistCells.filter(c => c.slotIndex < 100);
          const activeSlotIndexes = amCells.map(c => c.slotIndex);
          const maxIdx = activeSlotIndexes.length > 0 ? Math.max(...activeSlotIndexes) : -1;
          const newSlotIndex = maxIdx + 1;
          const displaySlotNum = newSlotIndex + 1;
          const slotLabel = `上午診 第 ${displaySlotNum} 診`;

          const newCell = {
            id: `${category}-S${newSlotIndex}-${tId}`,
            category,
            slotIndex: newSlotIndex,
            slotLabel,
            therapistId: tId,
            patientId: null,
            isBlockedByLeave: false,
            isSystemBlocked: false
          };
          simulatedCells.push(newCell);
          
          // Re-fetch therapist's cells
          therapistCells = simulatedCells
            .filter(c => c.category === category && c.therapistId === tId)
            .sort((a, b) => a.slotIndex - b.slotIndex);
        }

        const isComplex = false; // 複雜皆改為只要佔用一格即可

        if (isComplex) {
          // Dead code block kept for structural compile reasons
          let foundConsecutivePair = -1;
          for (let i = 0; i < therapistCells.length - 1; i++) {
            const cell1 = therapistCells[i];
            const cell2 = therapistCells[i + 1];
            const c1Available = !cell1.patientId && !cell1.isSystemBlocked && !cell1.isBlockedByLeave;
            const c2Available = !cell2.patientId && !cell2.isSystemBlocked && !cell2.isBlockedByLeave;
            const isSameHalf = (cell1.slotIndex < 100 && cell2.slotIndex < 100) || (cell1.slotIndex >= 100 && cell2.slotIndex >= 100);
            if (c1Available && c2Available && isSameHalf) {
              foundConsecutivePair = i;
              break;
            }
          }
          if (foundConsecutivePair !== -1) {
            const cell1Id = therapistCells[foundConsecutivePair].id;
            const cell2Id = therapistCells[foundConsecutivePair + 1].id;
            simulatedCells.forEach(c => {
              if (c.id === cell1Id || c.id === cell2Id) {
                c.patientId = patient.id;
              }
            });
            patientAssigned = true;
            localRotationIdx = (localRotationIdx + 1) % numTherapists;
            scheduledCount++;
          } else {
            localRotationIdx = (localRotationIdx + 1) % numTherapists;
            attempts++;
          }
        } else {
          // Standard / Moderate / Splint / Complex
          let foundSingleIndex = -1;
          for (let i = 0; i < therapistCells.length; i++) {
            const cell = therapistCells[i];
            if (!cell.patientId && !cell.isSystemBlocked && !cell.isBlockedByLeave) {
              foundSingleIndex = i;
              break;
            }
          }

          if (foundSingleIndex !== -1) {
            const targetCellId = therapistCells[foundSingleIndex].id;
            simulatedCells.forEach(c => {
              if (c.id === targetCellId) {
                c.patientId = patient.id;
              }
            });
            patientAssigned = true;
            localRotationIdx = (localRotationIdx + 1) % numTherapists;
            scheduledCount++;
          } else {
            localRotationIdx = (localRotationIdx + 1) % numTherapists;
            attempts++;
          }
        }
      }

      if (!patientAssigned) {
        unscheduledCount++;
      }
    }

    // Apply simulated state back to production React states
    setScheduleCells(simulatedCells);
    setNextRotationIndex(localRotationIdx);

    // Stamp scheduling date on all scheduled patients
    const todayStr = new Date().toISOString().split('T')[0];
    setPatients(prev => prev.map(p => {
      const isNowScheduled = simulatedCells.some(c => c.patientId === p.id);
      if (isNowScheduled) {
        return { ...p, scheduledDate: p.scheduledDate || todayStr };
      }
      return p;
    }));

    setNotif({
      message: `🤖 智慧自動輪替完成！成功排入 ${scheduledCount} 位個案。${unscheduledCount > 0 ? `有 ${unscheduledCount} 人因無足夠空格而列為待補。` : '全部個案指派完畢！'}`,
      type: scheduledCount > 0 ? 'success' : 'info'
    });
  };

  // Full reset scheduling cell assignments
  const handleClearAllSchedule = () => {
    triggerConfirm(
      '確認空檔重設',
      '確定要清空整個月的所有排班內容，將格子全部重設為可用狀態嗎？',
      () => {
        setScheduleCells(prev => prev.map(c => ({ ...c, patientId: null })));
        setSelectedPatientId(null);
        setNotif({
          message: '課表已全部清空，所有病患已退回待排班隊伍。',
          type: 'info'
        });
      }
    );
  };


  // --- Drag and Drop Action Functions (Manual Override Interface) ---

  const handleDragStart = (e: React.DragEvent, payload: string) => {
    // payload can be "PENDING:patientId" or "SCHEDULED:cellId"
    e.dataTransfer.setData('application/clinic-sched', payload);
  };

  const handleDragOver = (e: React.DragEvent, cellId: string) => {
    // Only allow if this target cell ID is eligible or if we are dropping for manual adjustments
    if (eligibleRecommendationCells.has(cellId)) {
      e.preventDefault();
    } else {
      // Allow overriding freely to let clerk force assign anywhere (overwriting standard warnings)
      e.preventDefault();
    }
  };

  const handleDrop = (e: React.DragEvent, targetCellId: string) => {
    e.preventDefault();
    const payload = e.dataTransfer.getData('application/clinic-sched');
    if (!payload) return;

    const [type, data] = payload.split(':');

    if (type === 'PENDING') {
      const patientId = data;
      const targetCell = scheduleCells.find(c => c.id === targetCellId);
      if (!targetCell) return;

      const patientObj = patientMap.get(patientId);
      if (!patientObj) return;

      // Ensure patient category matches target category block!
      if (patientObj.category !== targetCell.category) {
        setNotif({
          message: `類別衝突：無法將【${getCategoryLabel(patientObj.category)}】類型的病患拖曳至【${getCategoryLabel(targetCell.category)}】區。`,
          type: 'error'
        });
        return;
      }

      handleAssignPatient(targetCellId, patientId, true);

    } else if (type === 'SCHEDULED') {
      const sourceCellId = data;
      if (sourceCellId === targetCellId) return;

      const sourceCell = scheduleCells.find(c => c.id === sourceCellId);
      const targetCell = scheduleCells.find(c => c.id === targetCellId);
      if (!sourceCell || !targetCell || !sourceCell.patientId) return;

      const patientId = sourceCell.patientId;
      const patientObj = patientMap.get(patientId);
      if (!patientObj) return;

      if (patientObj.category !== targetCell.category) {
        setNotif({
          message: `類別衝突：無法將病患跨大類拖曳。`,
          type: 'error'
        });
        return;
      }

      // Step 1: Temporarily remove original assignment
      const isComplex = false; // 複雜皆改為只要佔用一格即可
      
      setScheduleCells(prev => {
        // Free original
        const afterOriginFreed = prev.map(c => {
          if (isComplex) {
            if (c.therapistId === sourceCell.therapistId && c.patientId === patientId) {
              return { ...c, patientId: null };
            }
          } else {
            if (c.id === sourceCellId) {
              return { ...c, patientId: null };
            }
          }
          return c;
        });

        // Now place in new targetCell
        const cellsForT = afterOriginFreed
          .filter(c => c.category === targetCell.category && c.therapistId === targetCell.therapistId)
          .sort((a, b) => a.slotIndex - b.slotIndex);

        if (isComplex) {
          const clickedIdx = cellsForT.findIndex(c => c.id === targetCellId);
          if (clickedIdx === -1) return prev;

          let pairIdx1 = -1;
          let pairIdx2 = -1;

          const forwardSecondCell = cellsForT[clickedIdx + 1];
          if (forwardSecondCell && 
              !forwardSecondCell.patientId && 
              !forwardSecondCell.isSystemBlocked && 
              !forwardSecondCell.isBlockedByLeave &&
              ((targetCell.slotIndex < 4 && forwardSecondCell.slotIndex < 4) || (targetCell.slotIndex >= 4 && forwardSecondCell.slotIndex >= 4))
          ) {
            pairIdx1 = clickedIdx;
            pairIdx2 = clickedIdx + 1;
          } else {
            const backwardFirstCell = cellsForT[clickedIdx - 1];
            if (backwardFirstCell && 
                !backwardFirstCell.patientId && 
                !backwardFirstCell.isSystemBlocked && 
                !backwardFirstCell.isBlockedByLeave &&
                ((backwardFirstCell.slotIndex < 4 && targetCell.slotIndex < 4) || (backwardFirstCell.slotIndex >= 4 && targetCell.slotIndex >= 4))
            ) {
              pairIdx1 = clickedIdx - 1;
              pairIdx2 = clickedIdx;
            }
          }

          if (pairIdx1 === -1 || pairIdx2 === -1) {
            alert(`搬移失敗：本治療師連續空間不足，無法容納複雜型個案 ${patientObj.name}。`);
            return prev;
          }

          const c1Id = cellsForT[pairIdx1].id;
          const c2Id = cellsForT[pairIdx2].id;

          setTimeout(() => setNotif({
            message: `[手動微調] 個案 ${patientObj.name} 已成功轉指派至 ${therapistMap.get(targetCell.therapistId)?.name}。`,
            type: 'info'
          }), 1);

          return afterOriginFreed.map(c => {
            if (c.id === c1Id || c.id === c2Id) {
              return { ...c, patientId: patientId };
            }
            return c;
          });

        } else {
          // Regular
          setTimeout(() => setNotif({
            message: `[手動調整] 已成功將 ${patientObj.name} 的課表改至 ${therapistMap.get(targetCell.therapistId)?.name} ${targetCell.slotLabel}。`,
            type: 'info'
          }), 1);

          return afterOriginFreed.map(c => {
            if (c.id === targetCellId) {
              return { ...c, patientId: patientId };
            }
            return c;
          });
        }
      });
    }
  };


  // --- CSV Export (Saves local assignment report as downloadable file) ---
  const handleExportCSV = () => {
    // Complete structured CSV creation
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF'; // Add BOM for excel auto Chinese character parsing
    
    csvContent += '臨床復建科排班大表-報表紀錄\r\n';
    const statsMonthLabel = statsMonth.replace('-', '年') + '月';
    csvContent += `報表日期,${statsMonthLabel} (當月自動/手動統計資料)\r\n`;
    csvContent += `列印時間,${new Date().toLocaleString()}\r\n\r\n`;

    csvContent += '個案類別,時段,治療師代碼,治療師姓名,個案名字,個案病歷號,緊急度,排程日期\r\n';

    // Loop through categorization blocks
    const categories: PatientCategory[] = ['INPATIENT', 'INPATIENT_COMPLEX', 'OUTPATIENT_COMPLEX', 'MODERATE', 'SPLINT'];
    
    categories.forEach(cat => {
      const catCells = scheduleCells.filter(c => c.category === cat).sort((a,b) => a.slotIndex - b.slotIndex);
      catCells.forEach(cell => {
        if (cell.patientId) {
          const therapyObj = therapistMap.get(cell.therapistId);
          const patientObj = patientMap.get(cell.patientId);
          const pScheduledDate = patientObj?.scheduledDate || '';
          
          // Filter lines written to CSV based on statsMonth
          const matchesStatsMonth = pScheduledDate && pScheduledDate.startsWith(statsMonth);
          if (matchesStatsMonth) {
            const catName = getCategoryLabel(cat);
            const periodName = cell.slotIndex < 100 ? '上午' : '下午';
            const therapistCode = therapyObj?.code || '';
            const therapistName = therapyObj?.name || '';
            const pName = patientObj?.name || '';
            const pMedId = patientObj?.medicalId || '';
            const pUrgency = patientObj?.urgency || '';

            csvContent += `"${catName}","${periodName}","${therapistCode}","${therapistName}","${pName}","${pMedId}","${pUrgency}","${pScheduledDate}"\r\n`;
          }
        }
      });
    });

    // Append statistical workload indicators for administrator overview (服務量)
    csvContent += '\r\n\r\n治療師當期服務量總覽 (統計指標)\r\n';
    csvContent += '治療師姓名,職稱代號,中複病人佔用,住院複雜佔用 (佔用雙格),門診複雜診次 (佔用雙格),中度佔用,副木佔用,總計服務診次 (Slots Used),空檔未利用\r\n';

    therapists.forEach(t => {
      const therapistAllCells = scheduleCells.filter(c => c.therapistId === t.id);
      
      const inpatientCount = therapistAllCells.filter(c => {
        if (c.category !== 'INPATIENT' || !c.patientId) return false;
        const p = patientMap.get(c.patientId);
        return (p?.scheduledDate ? p.scheduledDate.substring(0, 7) : '2026-06') === statsMonth;
      }).length;

      const inpatientComplexCount = therapistAllCells.filter(c => {
        if (c.category !== 'INPATIENT_COMPLEX' || !c.patientId) return false;
        const p = patientMap.get(c.patientId);
        return (p?.scheduledDate ? p.scheduledDate.substring(0, 7) : '2026-06') === statsMonth;
      }).length;

      const outpatientComplexCells = therapistAllCells.filter(c => {
        if (c.category !== 'OUTPATIENT_COMPLEX' || !c.patientId) return false;
        const p = patientMap.get(c.patientId);
        return (p?.scheduledDate ? p.scheduledDate.substring(0, 7) : '2026-06') === statsMonth;
      }).length;

      const moderateCount = therapistAllCells.filter(c => {
        if (c.category !== 'MODERATE' || !c.patientId) return false;
        const p = patientMap.get(c.patientId);
        return (p?.scheduledDate ? p.scheduledDate.substring(0, 7) : '2026-06') === statsMonth;
      }).length;

      const splintCount = therapistAllCells.filter(c => {
        if (c.category !== 'SPLINT' || !c.patientId) return false;
        const p = patientMap.get(c.patientId);
        return (p?.scheduledDate ? p.scheduledDate.substring(0, 7) : '2026-06') === statsMonth;
      }).length;
      
      const totalUsedSlots = inpatientCount + inpatientComplexCount + outpatientComplexCells + moderateCount + splintCount;
      const freeSlotsCount = therapistAllCells.filter(c => !c.patientId && !c.isSystemBlocked && !c.isBlockedByLeave).length;

      csvContent += `"${t.name}","${t.code}",${inpatientCount},${inpatientComplexCount},${outpatientComplexCells},${moderateCount},${splintCount},${totalUsedSlots},${freeSlotsCount}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rehab_Schedule_Report_${statsMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setNotif({
      message: `📥 報表 CSV 檔案已成功生成並匯出！包含 ${statsMonthLabel} 詳細課表與治療師個別當月服務量。`,
      type: 'success'
    });
  };


  // --- Patient CRUD Actions ---

  const handleResetTherapistSchedule = (therapistId: string, therapistName: string) => {
    setScheduleCells(prev => prev.map(c => c.therapistId === therapistId ? { ...c, patientId: null } : c));
    setNotif({
      message: `已重置 治療師 ${therapistName} 的所有排定課程！`,
      type: 'success'
    });
  };

  const handleResetMonthWorkload = (monthValue: string) => {
    const formattedMonth = monthValue.replace('-', '年') + '月';
    triggerConfirm(
      `重置當期服務量 (${formattedMonth})`,
      `確認要重置並清空 ${formattedMonth} 所有的預約排班嗎？此動作將使 ${formattedMonth} 的臨床服務量歸零，並把格子完全重設為可用。`,
      () => {
        // Determine which patient IDs are scheduled in this month
        const targetPatientIds = new Set<string>();
        patients.forEach(p => {
          const pMonth = p.scheduledDate ? p.scheduledDate.substring(0, 7) : '2026-06';
          if (pMonth === monthValue) {
            targetPatientIds.add(p.id);
          }
        });

        setScheduleCells(prev => prev.map(c => {
          if (c.patientId && targetPatientIds.has(c.patientId)) {
            return { ...c, patientId: null };
          }
          return c;
        }));

        setPatients(prev => prev.map(p => {
          const pMonth = p.scheduledDate ? p.scheduledDate.substring(0, 7) : '2026-06';
          if (pMonth === monthValue) {
            return { ...p, scheduledDate: undefined };
          }
          return p;
        }));

        setNotif({
          message: `🔄 ${formattedMonth} 的所有人工作量已成功重置！當期服務量已歸零。`,
          type: 'success'
        });
      }
    );
  };

  const handleStartEditTherapist = (t: Therapist) => {
    setEditingTherapistId(t.id);
    setEditTherapistName(t.name);
    setEditTherapistCode(t.code);
  };

  const handleSaveTherapistEdit = (id: string) => {
    if (!editTherapistName.trim() || !editTherapistCode.trim()) {
      alert('請填寫姓名與代碼！');
      return;
    }
    setTherapists(prev => prev.map(t => t.id === id ? { ...t, name: editTherapistName, code: editTherapistCode } : t));
    setEditingTherapistId(null);
    setNotif({
      message: '治療師資料已順利更新！',
      type: 'success'
    });
  };



  const handleSetAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdSetupInput.trim()) {
      setLoginError('密碼不可為空！');
      return;
    }
    if (pwdSetupInput !== pwdSetupConfirmInput) {
      setLoginError('兩次輸入的密碼不一致！');
      return;
    }
    localStorage.setItem('admin_pwd_hash', pwdSetupInput);
    setAdminPassword(pwdSetupInput);
    setIsAdminAuthenticated(true);
    setPwdSetupInput('');
    setPwdSetupConfirmInput('');
    setLoginError('');
    setNotif({
      message: '管理者密碼設定成功！已成功進入系統後台。',
      type: 'success'
    });
  };

  const handleVerifyAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdInput === adminPassword) {
      setIsAdminAuthenticated(true);
      setPwdInput('');
      setLoginError('');
      setNotif({
        message: '密碼驗證成功，歡迎進入後台。',
        type: 'success'
      });
    } else {
      setLoginError('密碼錯誤，請重新輸入！');
    }
  };

  const handleResetPatientSchedule = (patientId: string, patientName: string) => {
    setScheduleCells(prev => prev.map(c => c.patientId === patientId ? { ...c, patientId: null } : c));
    setNotif({
      message: `已重置與撤銷病患 ${patientName} 的所有排課時段！`,
      type: 'info'
    });
  };

  const handleStartEditPatient = (p: Patient) => {
    setEditingPatientId(p.id);
    setEditPatientName(p.name);
    setEditPatientMedicalId(p.medicalId);
    setEditPatientCategory(p.category);
    setEditPatientUrgency(p.urgency);
    setEditPatientNote(p.note || '');
    setEditPatientScheduledDate(p.scheduledDate || '');
    
    // Determine which therapist is assigned to this patient (if any)
    const assignedCell = scheduleCells.find(c => c.patientId === p.id);
    setEditPatientTherapistId(assignedCell ? assignedCell.therapistId : '');
  };

  const handleSavePatientEdit = (id: string) => {
    if (!editPatientName.trim() || !editPatientMedicalId.trim()) {
      alert('請填寫病患真實姓名與病歷號！');
      return;
    }

    // Save therapist change in schedule cells
    setScheduleCells(prev => {
      const assignedCells = prev.filter(c => c.patientId === id);
      const oldTherapistId = assignedCells.length > 0 ? assignedCells[0].therapistId : '';

      // 1. If therapist is empty/unassigned, remove scheduling
      if (!editPatientTherapistId) {
        if (oldTherapistId) {
          return prev.map(c => c.patientId === id ? { ...c, patientId: null } : c);
        }
        return prev;
      }

      // 2. If therapist is changed
      if (oldTherapistId && oldTherapistId !== editPatientTherapistId) {
        const patientSlots = assignedCells.map(c => c.slotIndex);
        return prev.map(c => {
          // Empty previous therapist slots
          if (c.patientId === id && c.therapistId === oldTherapistId) {
            return { ...c, patientId: null };
          }
          // Move to new therapist's identical slot indices
          if (c.therapistId === editPatientTherapistId && patientSlots.includes(c.slotIndex)) {
            return { ...c, patientId: id };
          }
          return c;
        });
      }

      // 3. If originally unassigned but therapist is newly chosen
      if (!oldTherapistId && editPatientTherapistId) {
        // Find available slot(s) for the patient category
        // Outpatient complex behaves like others, only needing 1 slot
        if (false) {
          // Find first available consecutive pair
          const therapistCells = prev
            .filter(c => c.category === editPatientCategory && c.therapistId === editPatientTherapistId)
            .sort((a,b) => a.slotIndex - b.slotIndex);
          
          let foundIdx = -1;
          for (let i = 0; i < therapistCells.length - 1; i++) {
            const cell1 = therapistCells[i];
            const cell2 = therapistCells[i + 1];
            const isSameHalf = (cell1.slotIndex < 100 && cell2.slotIndex < 100) || (cell1.slotIndex >= 100 && cell2.slotIndex >= 100);
            if (!cell1.patientId && !cell1.isSystemBlocked && !cell1.isBlockedByLeave &&
                !cell2.patientId && !cell2.isSystemBlocked && !cell2.isBlockedByLeave && isSameHalf) {
              foundIdx = i;
              break;
            }
          }
          if (foundIdx !== -1) {
            const pairIndexes = [therapistCells[foundIdx].slotIndex, therapistCells[foundIdx + 1].slotIndex];
            return prev.map(c => {
              if (c.category === editPatientCategory && c.therapistId === editPatientTherapistId && pairIndexes.includes(c.slotIndex)) {
                return { ...c, patientId: id };
              }
              return c;
            });
          }
        } else {
          // Simple or Complex category - 1 slot
          const availableCell = prev.find(
            c => c.category === editPatientCategory && 
                 c.therapistId === editPatientTherapistId && 
                 !c.patientId && 
                 !c.isSystemBlocked && 
                 !c.isBlockedByLeave
          );
          if (availableCell) {
            return prev.map(c => c.id === availableCell.id ? { ...c, patientId: id } : c);
          }
        }
      }

      return prev;
    });

    setPatients(prev => prev.map(p => p.id === id ? {
      ...p,
      name: editPatientName,
      medicalId: editPatientMedicalId,
      category: editPatientCategory,
      urgency: editPatientUrgency,
      note: editPatientNote,
      scheduledDate: editPatientScheduledDate || p.scheduledDate
    } : p));

    setEditingPatientId(null);
    setNotif({
      message: `病患 ${editPatientName} 的個案基本項目及治療師指派已儲存變更！`,
      type: 'success'
    });
  };

  const handleAddPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name || !newPatient.medicalId) {
      alert('請填寫病患姓名與病歷號！');
      return;
    }

    const checkExist = patients.some(p => p.medicalId === newPatient.medicalId);
    if (checkExist) {
      alert('此病歷號已存在於系統中，請檢查是否重複。');
      return;
    }

    const created: Patient = {
      ...newPatient,
      id: `p${Date.now()}`
    };

    setPatients(prev => [created, ...prev]);
    setNewPatient({
      name: '',
      medicalId: '',
      category: 'INPATIENT',
      urgency: 'MEDIUM',
      note: '',
      scheduledDate: ''
    });

    setNotif({
      message: `病患 ${created.name} (${getCategoryLabel(created.category)}) 已成功建立並加入待排班庫。`,
      type: 'success'
    });
  };

  const handleDeletePatient = (id: string, name: string) => {
    triggerConfirm(
      '刪除病患確認',
      `確定要刪除個案 ${name} 嗎？這將會同步撤銷其所有已排班的名單格子。`,
      () => {
        // 1. Clear scheduling grids matching this patient
        setScheduleCells(prev => prev.map(c => c.patientId === id ? { ...c, patientId: null } : c));
        // 2. Clear from patient queue
        setPatients(prev => prev.filter(p => p.id !== id));
        if (selectedPatientId === id) setSelectedPatientId(null);
        
        setNotif({
          message: `已刪除病患 ${name} 及其相關課程預約。`,
          type: 'info'
        });
      }
    );
  };


  // --- Therapist priority leave Actions ---

  const handleAddLeave = (e: React.FormEvent) => {
    e.preventDefault();
    const created: TherapistLeave = {
      ...newLeave,
      id: `l${Date.now()}`
    };

    setLeaves(prev => [...prev, created]);
    const name = therapistMap.get(created.therapistId)?.name || '';
    setNotif({
      message: `已建立 治療師 ${name} 自 ${created.startDate} 至 ${created.endDate} (${created.slots}) 的請假區段，相關課表時段將自動變為灰色並釋出原個案。`,
      type: 'success'
    });
  };

  const handleDeleteLeave = (id: string, therapistId: string) => {
    setLeaves(prev => prev.filter(l => l.id !== id));
    const name = therapistMap.get(therapistId)?.name || '';
    setNotif({
      message: `已取消 治療師 ${name} 的請假註記。相關課表格子已還原。`,
      type: 'info'
    });
  };

  const handleAdjustTherapistPriority = (id: string, direction: 'UP' | 'DOWN') => {
    const idx = therapistOrder.indexOf(id);
    if (idx === -1) return;

    const newOrder = [...therapistOrder];
    if (direction === 'UP' && idx > 0) {
      const temp = newOrder[idx - 1];
      newOrder[idx - 1] = newOrder[idx];
      newOrder[idx] = temp;
    } else if (direction === 'DOWN' && idx < therapistOrder.length - 1) {
      const temp = newOrder[idx + 1];
      newOrder[idx + 1] = newOrder[idx];
      newOrder[idx] = temp;
    }

    setTherapistOrder(newOrder);
    setNotif({
      message: `已成功變更自動排班輪替優先權！`,
      type: 'info'
    });
  };


  // --- Helper Functions to Render Labels gracefully ---

  function getCategoryLabel(cat: PatientCategory): string {
    switch (cat) {
      case 'INPATIENT':
        return '中複病人';
      case 'INPATIENT_COMPLEX':
        return '住院複雜';
      case 'OUTPATIENT_COMPLEX':
        return '門診複雜';
      case 'MODERATE':
        return '中度';
      case 'LIGHT':
        return '輕度';
      case 'SPLINT':
        return '副木製作';
    }
  }

  function getCategoryColorClass(cat: PatientCategory): string {
    switch (cat) {
      case 'INPATIENT':
        return 'indigo';
      case 'INPATIENT_COMPLEX':
        return 'orange';
      case 'OUTPATIENT_COMPLEX':
        return 'amber';
      case 'MODERATE':
        return 'emerald';
      case 'LIGHT':
        return 'sky';
      case 'SPLINT':
        return 'rose';
    }
  }

  function getUrgencyBadge(urgency: 'HIGH' | 'MEDIUM' | 'LOW') {
    switch (urgency) {
      case 'HIGH':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-red-100 text-red-700">高權重 / 急</span>;
      case 'MEDIUM':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-yellow-105 bg-amber-100 text-amber-700">中權重</span>;
      case 'LOW':
        return <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-sm bg-gray-105 bg-gray-100 text-gray-600">低權重</span>;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased">
      
      {/* Header Block with Clinic Logos */}
      <header id="main-header" className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-800 tracking-tight">職能治療排程管理系統</h1>
                <span className="bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-indigo-100">
                  前台書記 + 後台管理
                </span>
                {FIREBASE_CONFIGURED ? (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                    syncStatus === 'synced' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    syncStatus === 'syncing' ? 'bg-sky-50 text-sky-700 border-sky-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                      syncStatus === 'synced' ? 'bg-emerald-500' :
                      syncStatus === 'syncing' ? 'bg-sky-500 animate-pulse' :
                      'bg-rose-500'
                    }`} />
                    {syncStatus === 'synced' ? '☁️ 雲端同步' : syncStatus === 'syncing' ? '同步中...' : '⚠️ 同步失敗'}
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                    分頁同步
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                符合「公平輪替 (Round-Robin)」與「複雜型個案佔雙格 (Double-Slot Weights)」演算法
              </p>
            </div>
          </div>

          {/* Quick Real-Time Status metrics */}
          <div className="flex items-center gap-3 self-stretch md:self-auto justify-end">
            <button
              onClick={handleExportCSV}
              id="export-csv-btn"
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs px-3.5 py-2 rounded-lg font-medium shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>匯出月課表 CSV</span>
            </button>
          </div>

        </div>
      </header>

      {/* Dynamic Activity Logs & System Notification Overlay */}
      {notif && (
        <div className="bg-slate-900 border-b border-slate-800 text-slate-100 text-xs py-2.5 px-4 sticky top-[61px] z-40 transition-all duration-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {notif.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : notif.type === 'error' ? (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
              )}
              <span className="font-medium tracking-wide">{notif.message}</span>
            </div>
            <button 
              onClick={() => setNotif(null)} 
              className="text-slate-400 hover:text-white font-bold px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Navigation Sub-Menu Tab Header */}
      <nav className="bg-slate-100 border-b border-slate-200 overflow-x-auto whitespace-nowrap">
        <div className="max-w-7xl mx-auto px-4 min-w-max md:min-w-0">
          <div className="flex space-x-1 py-2">
            <button
              onClick={() => { setActiveTab('scheduler'); setSelectedPatientId(null); }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'scheduler' 
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>📋 書記排班作業板 (前台)</span>
            </button>

            <button
              onClick={() => { setActiveTab('admin'); setSelectedPatientId(null); }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'admin' 
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span>⚙️ 系統設定與後台 (管理員)</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">

        {/* ========================================================== */}
        {/* TAB 1: 📋 書記排班作業面板                                 */}
        {/* ========================================================== */}
        {activeTab === 'scheduler' && (
          <div className="w-full space-y-6 flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Clerk Quick Panel + Today's assigned records */}
              <div className="lg:col-span-12 max-w-2xl mx-auto w-full space-y-6">
                
                {/* Sidebar Column: Simplified Clerk Interactive Assignment Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col shadow-md space-y-4">
              
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <span className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-[15px]">書記快速指派面板</h3>
                  <p className="text-[10.5px] text-slate-400">登錄病歷與類別，秒級媒合輪替</p>
                </div>
              </div>

              {/* Patient Basics inputs */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    病歷號 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="請輸入病歷號 (如 A124 或 M202)"
                    value={clerkMedicalId}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setClerkMedicalId(val);
                      setRecommendedResult(null);
                    }}
                    className="w-full text-base lg:text-sm px-3 py-2 border border-slate-250 bg-slate-50 focus:bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-800"
                  />
                  <p className="text-[10px] text-slate-450 mt-1 text-slate-500">系統將自動轉換為「大寫英數字」</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    病人姓名 <span className="text-slate-400">(選填)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="個案姓名 (未填則自訂帶入)"
                    value={clerkPatientName}
                    onChange={(e) => {
                      setClerkPatientName(e.target.value);
                      setRecommendedResult(null);
                    }}
                    className="w-full text-base lg:text-xs px-3 py-2 border border-slate-250 bg-slate-50 focus:bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    📅 排程日期 <span className="text-amber-650 font-bold">*</span>
                  </label>
                  <input
                    type="date"
                    value={clerkScheduleDate}
                    onChange={(e) => {
                      setClerkScheduleDate(e.target.value);
                      setRecommendedResult(null);
                    }}
                    className="w-full text-base lg:text-xs px-3 py-2 border border-amber-200 bg-amber-50/20 focus:bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                  />
                  <p className="text-[10px] text-amber-800 mt-1">選取的排程日期將同步寫入本個案排程記錄，並匯出於 CSV 報表。</p>
                </div>

                {/* AM/PM System Time with Manual Override Trigger */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                    <span>🕒 系統排班診期</span>
                    <span className="text-[10.5px] font-mono text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">
                      {clerkTimeMode === 'AM' ? '🌅 上午時段' : '🌇 下午時段'}
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setClerkTimeMode('AM');
                        setRecommendedResult(null);
                      }}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1 ${
                        clerkTimeMode === 'AM'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>🌅 上午</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setClerkTimeMode('PM');
                        setRecommendedResult(null);
                      }}
                      className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1 ${
                        clerkTimeMode === 'PM'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>🌇 下午</span>
                    </button>
                  </div>
                </div>

                {/* Patient option selection for assigning */}
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-600 mb-2">
                    點選病人本堂類別：
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleClerkSelectOption('INPATIENT_COMPLEX')}
                      className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center gap-1 transition-all ${
                        clerkCategory === 'INPATIENT_COMPLEX'
                          ? 'bg-orange-50 border-orange-500 text-orange-850 ring-2 ring-orange-500/10'
                          : 'bg-white hover:bg-orange-50/20 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                      <span>住院複雜 (單格)</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleClerkSelectOption('OUTPATIENT_COMPLEX')}
                      className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center gap-1 transition-all ${
                        clerkCategory === 'OUTPATIENT_COMPLEX'
                          ? 'bg-amber-50 border-amber-500 text-amber-805 ring-2 ring-amber-500/10'
                          : 'bg-white hover:bg-amber-50/20 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>門診複雜 (單格)</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleClerkSelectOption('INPATIENT')}
                      className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center gap-1 transition-all ${
                        clerkCategory === 'INPATIENT'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-805 ring-2 ring-indigo-500/10'
                          : 'bg-white hover:bg-indigo-50/20 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span>中複病人 (單格)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleClerkSelectOption('MODERATE')}
                      className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center gap-1 transition-all ${
                        clerkCategory === 'MODERATE'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-805 ring-2 ring-emerald-500/10'
                          : 'bg-white hover:bg-emerald-50/20 border-slate-200 text-slate-700'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>中度 (單格)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleClerkSelectOption('SPLINT')}
                      className={`p-2.5 rounded-xl border text-xs font-extrabold flex flex-col items-center justify-center gap-1 transition-all ${
                        clerkCategory === 'SPLINT'
                          ? 'bg-rose-50 border-rose-500 text-rose-805 ring-2 ring-rose-500/10'
                          : 'bg-white hover:bg-rose-50/20 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        <span>副木製作 (單格)</span>
                      </div>
                    </button>
                  </div>
                </div>

              </div>

              {/* POPUP RECOMMENDATION HUD / 智慧輪替指派結果跳出卡 */}
              {recommendedResult && (
                <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3.5 shadow-md border border-slate-800 animate-fadeIn mt-2 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">✨ 智慧輪替媒合</span>
                    <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                      Fair Rotation
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">系統推薦指派治療師：</p>
                    <p className="text-lg font-black text-white tracking-wide">
                      {recommendedResult.therapist.name} 
                      <span className="text-xs font-bold text-slate-400 ml-1.5">({recommendedResult.therapist.code})</span>
                    </p>
                  </div>

                  {/* Manual Override Option */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
                    <label className="block text-[10.5px] font-semibold text-amber-300">
                      🛠️ 手動更改指派治療師 (Override):
                    </label>
                    <select
                      value={recommendedResult.therapist.id}
                      onChange={(e) => {
                        const targetTId = e.target.value;
                        const targetT = therapists.find(t => t.id === targetTId);
                        if (targetT) {
                          const isMorning = clerkTimeMode === 'AM';
                          const tCells = scheduleCells
                            .filter(c => c.category === recommendedResult.category && c.therapistId === targetTId)
                            .sort((a, b) => a.slotIndex - b.slotIndex);
                          const filteredTCells = tCells.filter(c => isMorning ? c.slotIndex < 4 : c.slotIndex >= 4);

                          if (recommendedResult.category === 'OUTPATIENT_COMPLEX') {
                            let foundPairAt = -1;
                            for (let j = 0; j < filteredTCells.length - 1; j++) {
                              const c1 = filteredTCells[j];
                              const c2 = filteredTCells[j+1];
                              if (!c1.patientId && !c1.isSystemBlocked && !c1.isBlockedByLeave &&
                                  !c2.patientId && !c2.isSystemBlocked && !c2.isBlockedByLeave) {
                                foundPairAt = j;
                                break;
                              }
                            }
                            if (foundPairAt !== -1) {
                              setRecommendedResult(prev => prev ? {
                                ...prev,
                                therapist: targetT,
                                cellIds: [filteredTCells[foundPairAt].id, filteredTCells[foundPairAt+1].id],
                                slotLabel: `${filteredTCells[foundPairAt].slotLabel} ＋ ${filteredTCells[foundPairAt+1].slotLabel.split(' ').pop()}`
                              } : null);
                            } else {
                              setNotif({
                                message: `⚠️ 治療師 ${targetT.name} 在本時段無連續 2 格空檔可用！`,
                                type: 'error'
                              });
                            }
                          } else {
                            const freeCell = filteredTCells.find(c => !c.patientId && !c.isSystemBlocked && !c.isBlockedByLeave);
                            if (freeCell) {
                              setRecommendedResult(prev => prev ? {
                                ...prev,
                                therapist: targetT,
                                cellIds: [freeCell.id],
                                slotLabel: freeCell.slotLabel
                              } : null);
                            } else {
                              setNotif({
                                message: `⚠️ 治療師 ${targetT.name} 在本時段無任何空餘排班格！`,
                                type: 'error'
                              });
                            }
                          }
                        }
                      }}
                      className="w-full text-base lg:text-xs bg-slate-800 border border-slate-700 text-white rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
                    >
                      {therapists.filter(t => t.isActive).map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-[11.5px] text-slate-300 bg-slate-800/80 p-2.5 rounded border border-slate-700/60 leading-relaxed font-sans mt-2">
                    <div>📌 <strong>個案分類：</strong> {getCategoryLabel(recommendedResult.category)}</div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmClerkAssignment}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-extrabold text-xs rounded-lg shadow-sm transition-all text-center flex items-center justify-center gap-1.5 ring-2 ring-emerald-500/20 cursor-pointer"
                  >
                    <span>確定排定個案課表 (Confirm & Assign)</span>
                  </button>
                </div>
              )}

              {/* Dynamic rotation queue dashboard view */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3 text-xs text-slate-700 font-sans">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600 animate-spin-slow" />
                    <span>🌀 臨床治療師四大輪替佇列</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRotationIndices({ am_regular: 0, pm_regular: 1, am_splint: 2, pm_splint: 3 })}
                    className="text-[9px] text-slate-500 hover:text-slate-800 px-1 border border-slate-200 bg-white shadow-xs rounded"
                  >
                    重置
                  </button>
                </div>

                <div className="space-y-2">
                  {/* AM Regular */}
                  <div className={`p-2 rounded-lg border text-[11px] ${getRotationHighlightKey() === 'am_regular' ? 'bg-amber-50/50 border-amber-300 text-slate-900 font-medium' : 'bg-white border-slate-150 text-slate-600'}`}>
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span>🌅 上午 住院/門診/中常</span>
                      <strong className="text-indigo-600 font-bold">下位主角: {getNextTherapistInSeq('am_regular')}</strong>
                    </div>
                    <div className="text-[9.5px] font-mono text-slate-400 mt-1 line-clamp-1 break-all">
                      {ROTATION_SEQUENCES.am_regular.map((id, idx) => {
                        const name = therapists.find(t => t.id === id)?.name || id;
                        const isNext = rotationIndices.am_regular === idx;
                        return (
                          <span key={idx} className={isNext ? 'bg-amber-100 text-amber-900 border border-amber-300 px-0.5 rounded font-black font-sans' : 'px-0.5 font-sans'}>
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* PM Regular */}
                  <div className={`p-2 rounded-lg border text-[11px] ${getRotationHighlightKey() === 'pm_regular' ? 'bg-indigo-50/50 border-indigo-300 text-slate-900 font-medium' : 'bg-white border-slate-150 text-slate-600'}`}>
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span>🌇 下午 住院/門診/中常</span>
                      <strong className="text-indigo-600 font-bold">下位主角: {getNextTherapistInSeq('pm_regular')}</strong>
                    </div>
                    <div className="text-[9.5px] font-mono text-slate-400 mt-1 line-clamp-1 break-all">
                      {ROTATION_SEQUENCES.pm_regular.map((id, idx) => {
                        const name = therapists.find(t => t.id === id)?.name || id;
                        const isNext = rotationIndices.pm_regular === idx;
                        return (
                          <span key={idx} className={isNext ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 px-0.5 rounded font-black font-sans' : 'px-0.5 font-sans'}>
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* AM Splint */}
                  <div className={`p-2 rounded-lg border text-[11px] ${getRotationHighlightKey() === 'am_splint' ? 'bg-rose-50/50 border-rose-300 text-slate-900 font-medium' : 'bg-white border-slate-150 text-slate-600'}`}>
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span>🌅 上午 副木製作</span>
                      <strong className="text-indigo-600 font-bold">下位主角: {getNextTherapistInSeq('am_splint')}</strong>
                    </div>
                    <div className="text-[9.5px] font-mono text-slate-400 mt-1 line-clamp-1 break-all">
                      {ROTATION_SEQUENCES.am_splint.map((id, idx) => {
                        const name = therapists.find(t => t.id === id)?.name || id;
                        const isNext = rotationIndices.am_splint === idx;
                        return (
                          <span key={idx} className={isNext ? 'bg-rose-100 text-rose-900 border border-rose-300 px-0.5 rounded font-black font-sans' : 'px-0.5 font-sans'}>
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* PM Splint */}
                  <div className={`p-2 rounded-lg border text-[11px] ${getRotationHighlightKey() === 'pm_splint' ? 'bg-rose-50/50 border-rose-300 text-slate-900 font-medium' : 'bg-white border-slate-150 text-slate-600'}`}>
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span>🌇 下午 副木製作</span>
                      <strong className="text-indigo-600 font-bold">下位主角: {getNextTherapistInSeq('pm_splint')}</strong>
                    </div>
                    <div className="text-[9.5px] font-mono text-slate-400 mt-1 line-clamp-1 break-all">
                      {ROTATION_SEQUENCES.pm_splint.map((id, idx) => {
                        const name = therapists.find(t => t.id === id)?.name || id;
                        const isNext = rotationIndices.pm_splint === idx;
                        return (
                          <span key={idx} className={isNext ? 'bg-rose-100 text-rose-900 border border-rose-300 px-0.5 rounded font-black font-sans' : 'px-0.5 font-sans'}>
                            {name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                  <span>登錄個案庫總數：<strong className="text-slate-700">{patients.length} 位</strong></span>
                  <span>選取時段：<strong className="text-indigo-600 font-bold">{clerkTimeMode === 'AM' ? '🌅 上午 (AM)' : '🌇 下午 (PM)'}</strong></span>
                </div>
              </div>

            </div>

            {/* List of successfully assigned records */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                    <CheckCircle className="w-4.5 h-4.5" />
                  </span>
                  <h3 className="font-extrabold text-[15px] text-slate-800">
                    今日已指派課表 ({assignedPairs.length})
                  </h3>
                </div>
                {assignedPairs.length > 0 && (
                  <button
                    onClick={handleClearAllSchedule}
                    className="text-[11px] font-bold text-rose-600 hover:text-white hover:bg-rose-600 border border-slate-250 px-2.5 py-1 rounded-lg transition-all"
                  >
                    清空全部
                  </button>
                )}
              </div>

              {assignedPairs.length === 0 ? (
                <div className="py-10 text-center text-slate-400 flex flex-col items-center justify-center">
                  <p className="text-xs font-semibold text-slate-500">🍃 尚未有任何指派課表登錄</p>
                  <p className="text-[10px] text-slate-400 mt-1">請在上方面板輸入病歷號並點選類別以進行智慧指派。</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs text-slate-600">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-500 font-bold bg-slate-50/50">
                        <th className="py-2 px-3">個案病歷 (姓名)</th>
                        <th className="py-2 px-3">類別</th>
                        <th className="py-2 px-3">治療師</th>
                        <th className="py-2 px-3 text-center w-12">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedPairs.map(record => {
                        const catColor = getCategoryColorClass(record.category);
                        const isMorning = record.slotIndex < 4;
                        return (
                          <tr key={record.cellId} className="border-b border-slate-100 hover:bg-slate-50/30">
                            <td className="py-2.5 px-3 font-mono">
                              <span className="font-bold text-slate-800">{record.medicalId}</span>
                              <span className="text-slate-500 text-[10.5px] ml-1.5">({record.patientName})</span>
                              <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded ml-2">
                                {isMorning ? '上午' : '下午'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border bg-${catColor}-50/50 text-${catColor}-800 border-${catColor}-200`}>
                                {getCategoryLabel(record.category).split(' ').pop()}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <select
                                value={record.therapistId}
                                onChange={(e) => handleModifyTherapist(
                                  record.patientId,
                                  record.category,
                                  record.therapistId,
                                  e.target.value,
                                  isMorning ? 'AM' : 'PM'
                                )}
                                className="bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer max-w-[130px] shadow-sm hover:border-slate-350 transition-colors"
                              >
                                {therapists.filter(t => t.isActive).map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.code})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleRemoveAssignment(record.cellId)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="撤銷指派"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </div>
            </div>
          </div>
          </div>
        )}



        {/* ========================================================== */}
        {/* TAB 2: ⚙️ 系統設定與後台管理                                 */}
        {/* ========================================================== */}
        {activeTab === 'admin' && !isAdminAuthenticated && !adminPassword && (
          <div id="admin-setup-password-card" className="max-w-md mx-auto my-12 bg-white border border-slate-200 rounded-2xl p-6 shadow-md transition-all duration-300">
            <div className="flex flex-col items-center text-center space-y-3 mb-6">
              <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-800">🔑 初始化設定管理者密碼</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                這是您第一次進入後台系統設定與管理員名單。請指定一組高度安全的登入密碼，之後再次切換至此分頁將必須進行驗證。
              </p>
            </div>

            <form onSubmit={handleSetAdminPassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">設定管理密碼</label>
                <input
                  type="password"
                  value={pwdSetupInput}
                  onChange={(e) => setPwdSetupInput(e.target.value)}
                  className="w-full text-sm p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  placeholder="輸入管理密碼..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">再次確認密碼</label>
                <input
                  type="password"
                  value={pwdSetupConfirmInput}
                  onChange={(e) => setPwdSetupConfirmInput(e.target.value)}
                  className="w-full text-sm p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  placeholder="確認管理密碼..."
                />
              </div>

              {loginError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg font-medium">
                  ⚠️ {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                啟用管理者並登入
              </button>
            </form>
          </div>
        )}

        {activeTab === 'admin' && !isAdminAuthenticated && adminPassword && (
          <div id="admin-verify-password-card" className="max-w-md mx-auto my-12 bg-white border border-slate-200 rounded-2xl p-6 shadow-md transition-all duration-300">
            <div className="flex flex-col items-center text-center space-y-3 mb-6">
              <div className="p-3 bg-indigo-50 rounded-full text-indigo-600">
                <Lock className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-extrabold text-slate-800">🔐 請輸入管理者密碼</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                欲訪問職能治療後台（含治療師資料、病人排程資料庫），請輸入設定的管理密碼。
              </p>
            </div>

            <form onSubmit={handleVerifyAdminPassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">管理密碼</label>
                <input
                  type="password"
                  value={pwdInput}
                  onChange={(e) => setPwdInput(e.target.value)}
                  className="w-full text-sm p-2.5 border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  placeholder="請輸入密碼..."
                  autoFocus
                />
              </div>

              {loginError && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg font-medium">
                  ⚠️ {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                驗證並登入後台
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerConfirm(
                      '重置密碼確認',
                      '重置將完全清除已儲存的管理者密碼，您將需要重新設定新密碼，是否繼續？',
                      () => {
                        localStorage.removeItem('admin_pwd_hash');
                        setAdminPassword(null);
                        setIsAdminAuthenticated(false);
                        setPwdInput('');
                        setLoginError('');
                      }
                    );
                  }}
                  className="text-[10px] text-slate-400 hover:text-rose-600 underline font-medium cursor-pointer"
                >
                  重置管理者密碼 ⚙️
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'admin' && isAdminAuthenticated && (
          <div className="space-y-8 w-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* COLUMN 1: Clinical therapist workload service indicators */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-extrabold text-slate-800 text-base">臨床治療師當期服務量</h3>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                    活動期: {statsMonth}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 mb-4 bg-slate-50 p-2.5 rounded border border-slate-150 font-sans leading-relaxed">
                  💡 以下為各月份服務量統計（已依月份一直排下去）。您可以點擊任一月份的 <strong>設為報表期</strong> 即時切換系統當前活動期以進行匯出。
                </p>

                {/* Vertical flow list of all selectable months */}
                <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
                  {availableMonths.map(currentM => {
                    const isSelected = statsMonth === currentM;
                    const displayMonthLabel = currentM.replace('-', '年 ') + '月';
                    
                    return (
                      <div 
                        key={currentM} 
                        className={`p-3 rounded-xl border transition-all ${
                          isSelected 
                            ? 'bg-indigo-50/20 border-indigo-200 shadow-3xs' 
                            : 'bg-white border-slate-150'
                        }`}
                      >
                        {/* Month Header in Flow */}
                        <div className="flex items-center justify-between pb-1.5 mb-2.5 border-b border-dashed border-slate-200">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-xs text-slate-800">{displayMonthLabel}</span>
                            {isSelected && (
                              <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-semibold">
                                當前活動期
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {!isSelected && (
                              <button
                                type="button"
                                onClick={() => setStatsMonth(currentM)}
                                className="text-[9px] bg-white hover:bg-slate-100 text-indigo-600 border border-indigo-200 py-0.5 px-1.5 rounded transition-all cursor-pointer font-semibold"
                              >
                                設為報表期
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleResetMonthWorkload(currentM)}
                              className="text-[9px] text-rose-600 hover:bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded transition-all cursor-pointer font-extrabold"
                              title="重置本期排班量"
                            >
                              重置排班
                            </button>
                          </div>
                        </div>

                        {/* List of therapists for this specific month */}
                        <div className="space-y-3">
                          {therapists.map(t => {
                            const allCells = scheduleCells.filter(c => c.therapistId === t.id);
                            const total = allCells.length;
                            
                            // Filter counts per this currentM
                            const occupied = allCells.filter(c => {
                              if (!c.patientId) return false;
                              const p = patientMap.get(c.patientId);
                              if (!p) return false;
                              const pMonth = p.scheduledDate ? p.scheduledDate.substring(0, 7) : '2026-06';
                              return pMonth === currentM;
                            }).length;

                            const occupiedWidth = total > 0 ? (occupied / total) * 100 : 0;

                            const colorMap: Record<string, string> = {
                              emerald: 'bg-emerald-500',
                              blue: 'bg-blue-500',
                              indigo: 'bg-indigo-500',
                              purple: 'bg-purple-500',
                              pink: 'bg-pink-500',
                            };
                            const activeColorClass = colorMap[t.color] || 'bg-slate-500';

                            return (
                              <div key={`${currentM}-${t.id}`} className="space-y-1">
                                <div className="flex justify-between items-center text-[11px] font-sans">
                                  <div className="flex items-center gap-1">
                                    <span className="font-extrabold text-slate-700">{t.name}</span>
                                    <span className="text-[9px] font-mono font-bold text-slate-400 bg-slate-50 px-1 rounded border border-slate-100">{t.code}</span>
                                  </div>
                                  <span className="text-indigo-600 font-extrabold font-mono text-[10px]">已排: {occupied} 診</span>
                                </div>

                                <div className="w-full bg-slate-100 h-1.5 rounded-lg overflow-hidden flex shadow-1xs border border-slate-200/40">
                                  {occupied > 0 && (
                                    <div 
                                      className={`${activeColorClass} h-full transition-all duration-300`} 
                                      style={{ width: `${occupiedWidth}%` }}
                                      title={`已指派: ${occupied} 診`}
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* General Therapist Info Management Block */}
              <div className="mt-4 pt-3 border-t border-slate-200 bg-slate-50/50 p-2.5 rounded-xl">
                <div className="text-[11px] font-extrabold text-slate-500 mb-2 flex items-center justify-between">
                  <span>⚙️ 治療師基本資料管理</span>
                  <span className="text-[9px] font-mono bg-slate-200 py-0.2 px-1 rounded">系統控制</span>
                </div>
                <div className="space-y-2">
                  {therapists.map(t => {
                    const isEditing = editingTherapistId === t.id;
                    if (isEditing) {
                      return (
                        <div key={`manage-${t.id}`} className="p-2.5 border border-indigo-200 bg-indigo-50/20 rounded-xl space-y-2">
                          <input
                            type="text"
                            value={editTherapistName}
                            onChange={(e) => setEditTherapistName(e.target.value)}
                            className="w-full text-xs p-1.5 border border-slate-250 rounded bg-white focus:outline-none"
                            placeholder="治療師姓名"
                          />
                          <input
                            type="text"
                            value={editTherapistCode}
                            onChange={(e) => setEditTherapistCode(e.target.value)}
                            className="w-full text-xs p-1.5 border border-slate-250 rounded bg-white focus:outline-none font-mono"
                            placeholder="英文簡碼"
                          />
                          <div className="flex justify-end gap-1.5 pt-1.5">
                            <button
                              onClick={() => setEditingTherapistId(null)}
                              className="px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 bg-white border border-slate-200 rounded-md cursor-pointer"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => handleSaveTherapistEdit(t.id)}
                              className="px-3 py-1 text-[11px] font-bold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer"
                            >
                              儲存
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={`manage-${t.id}`} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-slate-700">{t.name}</span>
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-100 px-1 py-0.2 rounded border border-slate-150">{t.code}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEditTherapist(t)}
                            className="px-1.5 py-1 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-250 text-[10px] text-slate-600 rounded flex items-center gap-0.5 cursor-pointer font-sans"
                            title="修改基本資料"
                          >
                            <Edit className="w-2.5 h-2.5" /> 修改
                          </button>
                          <button
                            onClick={() => handleResetTherapistSchedule(t.id, t.name)}
                            className="px-1.5 py-1 hover:bg-rose-50 border border-slate-200 hover:border-rose-250 text-[10px] text-slate-600 rounded flex items-center gap-0.5 cursor-pointer font-sans"
                            title="重置此治療師的所有課表"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> 重置
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* COLUMN 2: Therapist Rotation Priority Metrics */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                <Sliders className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-base">自動排班輪替指標與順序</h3>
              </div>

              <p className="text-xs text-slate-500 mb-4 bg-slate-50 p-2 bg-slate-50 rounded">
                💡 點擊「上移」或「下移」來更動治療師在演算法裡的優先順序。自動智慧排程會依此順序平均輪流分配病患！
              </p>

              <div className="space-y-2">
                {therapistOrder.map((id, index) => {
                  const t = therapists.find(item => item.id === id);
                  if (!t) return null;
                  
                  return (
                    <div 
                      key={id} 
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-white shadow-3xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-mono font-bold text-xs flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-800 text-sm">{t.name}</span>
                          <span className="ml-2 text-xs text-slate-400 font-mono font-semibold">({t.code})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleAdjustTherapistPriority(id, 'UP')}
                          disabled={index === 0}
                          className="p-1 px-2 border rounded hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                          title="上移順序"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleAdjustTherapistPriority(id, 'DOWN')}
                          disabled={index === therapistOrder.length - 1}
                          className="p-1 px-2 border rounded hover:bg-slate-50 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                          title="下移順序"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 3: Active Patients database master list */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-extrabold text-slate-800 text-base">病人排程資料庫名冊 ({patients.length})</h3>
                </div>
              </div>

              {/* Master CRUD Table */}
              <div className="relative mb-3.5 text-xs">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="快速搜尋名冊..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full text-xs pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredPatientsForCrud.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <p className="text-slate-400 text-xs italic">排程資料庫目前為空，請至前台或在此分頁上方新增個案。</p>
                  </div>
                ) : (
                  filteredPatientsForCrud.map(p => {
                    const isAssigned = !pendingPatients.some(pending => pending.id === p.id);
                    const catColor = getCategoryColorClass(p.category);

                    if (editingPatientId === p.id) {
                      return (
                        <div key={p.id} className="p-3 border border-indigo-100 rounded-xl bg-indigo-50/20 space-y-2.5 text-xs">
                          <div className="font-bold text-indigo-800 text-[11px] flex items-center gap-1 border-b pb-1">
                            <Edit className="w-3 h-3" /> 編輯病患排程資料
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5 font-sans">個案姓名</label>
                              <input
                                type="text"
                                value={editPatientName}
                                onChange={(e) => setEditPatientName(e.target.value)}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5 font-sans">病歷號碼</label>
                              <input
                                type="text"
                                value={editPatientMedicalId}
                                onChange={(e) => setEditPatientMedicalId(e.target.value)}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-mono"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5 font-sans">疾病大項</label>
                              <select
                                value={editPatientCategory}
                                onChange={(e) => setEditPatientCategory(e.target.value as PatientCategory)}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-sans"
                              >
                                <option value="INPATIENT">中複病人 (INPATIENT)</option>
                                <option value="INPATIENT_COMPLEX">住院複雜 (INPATIENT_COMPLEX)</option>
                                <option value="OUTPATIENT_COMPLEX">門診複雜 (OUTPATIENT_COMPLEX)</option>
                                <option value="MODERATE">門診中度 (MODERATE)</option>
                                <option value="SPLINT">輔具副木 (SPLINT)</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5 font-sans">緊急程度</label>
                              <select
                                value={editPatientUrgency}
                                onChange={(e) => setEditPatientUrgency(e.target.value as 'HIGH' | 'MEDIUM' | 'LOW')}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none font-sans"
                              >
                                <option value="HIGH">高 (HIGH)</option>
                                <option value="MEDIUM">中 (MEDIUM)</option>
                                <option value="LOW">低 (LOW)</option>
                              </select>
                            </div>
                          </div>

                           <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5 font-sans">備註說明</label>
                              <input
                                type="text"
                                value={editPatientNote}
                                onChange={(e) => setEditPatientNote(e.target.value)}
                                className="w-full text-xs p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 focus:outline-none bg-white font-sans"
                                placeholder="例如: 需安排在下午、或是特定治療師"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-500 mb-0.5 font-sans font-bold text-indigo-700">指派負責治療師</label>
                              <select
                                value={editPatientTherapistId}
                                onChange={(e) => setEditPatientTherapistId(e.target.value)}
                                className="w-full text-xs p-1.5 border border-indigo-200 rounded bg-white text-indigo-900 focus:ring-1 focus:ring-indigo-500 focus:outline-none font-sans font-semibold"
                              >
                                <option value="">(佇列待排 - 自課表撤下)</option>
                                {therapists.map(t => (
                                  <option key={t.id} value={t.id}>
                                    {t.name} ({t.code})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] text-amber-800 mb-0.5 font-sans font-bold">排程預約日期</label>
                            <input
                              type="date"
                              value={editPatientScheduledDate}
                              onChange={(e) => setEditPatientScheduledDate(e.target.value)}
                              className="w-full text-xs p-1.5 border border-amber-200 rounded focus:ring-1 focus:ring-amber-500 focus:outline-none bg-white font-sans font-medium"
                            />
                          </div>

                          <div className="flex justify-end gap-1.5 pt-1">
                            <button
                              onClick={() => setEditingPatientId(null)}
                              className="px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => handleSavePatientEdit(p.id)}
                              className="px-3 py-1 text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer"
                            >
                              儲存個案
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div 
                        key={p.id} 
                        className="p-3 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 transition-all flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-800">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">病歷: {p.medicalId}</span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-${catColor}-50 text-${catColor}-700 border-${catColor}-200`}>
                              {getCategoryLabel(p.category)}
                            </span>
                            {getUrgencyBadge(p.urgency)}
                            {isAssigned ? (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                                已排入課表 {(() => {
                                  const assignedCells = scheduleCells.filter(c => c.patientId === p.id);
                                  const names = Array.from(new Set(assignedCells.map(c => {
                                    const t = therapists.find(item => item.id === c.therapistId);
                                    return t ? t.name : '';
                                  }).filter(Boolean))).join(', ');
                                  return names ? `(治療師: ${names})` : '';
                                })()}
                              </span>
                            ) : (
                              <span className="text-[9px] bg-slate-50 text-slate-700 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                                佇列待排
                              </span>
                            )}
                            {p.scheduledDate && (
                              <span className="text-[9px] bg-amber-50 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                                排程日期: {p.scheduledDate}
                              </span>
                            )}
                          </div>

                          {p.note && (
                            <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 mt-2 italic">
                              "{p.note}"
                            </p>
                          )}
                        </div>

                        {/* Individual Column actions as fields requested: Modify & Delete */}
                        <div className="flex flex-col gap-1 shrink-0 justify-center">
                          <button
                            onClick={() => handleStartEditPatient(p)}
                            className="p-1 border border-slate-20 w-16 text-[9.5px] font-extrabold text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50/50 rounded flex items-center justify-center gap-0.5 cursor-pointer transition-colors"
                            title="修改個案基本資料"
                          >
                            <Edit className="w-2.5 h-2.5" />
                            <span>修改</span>
                          </button>
                          <button
                            onClick={() => handleDeletePatient(p.id, p.name)}
                            className="p-1 border border-slate-20 w-16 text-[9.5px] font-extrabold text-slate-650 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50/50 rounded flex items-center justify-center gap-0.5 cursor-pointer transition-colors"
                            title="刪除此個案記錄"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                            <span>刪除</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>

          </div>
          </div>
        )}

      </main>

      {/* Footer System Credits */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 職能治療排程管理系統. Crafted with clinical precision.</p>
          <div className="flex gap-4">
            <span className="hover:text-indigo-600 transition-colors">使用手冊</span>
            <span className="hover:text-indigo-600 transition-colors">系統稽核紀錄</span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-2 pt-2 border-t border-slate-100">
          <p className="text-[10px] text-slate-400">
            Powered by{' '}
            <a
              href="https://github.com/kukocliao/OTscheduleV3"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-600 transition-colors font-medium"
            >
              OTscheduleV3
            </a>
            {' '}· Developed by{' '}
            <a
              href="https://github.com/kukocliao"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-600 transition-colors font-medium"
            >
              kukocliao
            </a>
            {' '}· CC BY-NC 4.0
          </p>
        </div>
      </footer>

      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xl max-w-sm w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-50 rounded-full text-amber-600 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-slate-800 text-sm">{confirmDialog.title}</h4>
                <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-line leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-3 py-1.5 text-xs font-extrabold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className="px-4 py-1.5 text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer shadow-xs transition-colors"
              >
                確認執行
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
