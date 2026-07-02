/**
 * Type declarations for Clinical Rehabilitation Scheduling System
 */

export type PatientCategory = 'INPATIENT' | 'INPATIENT_COMPLEX' | 'OUTPATIENT_COMPLEX' | 'MODERATE' | 'LIGHT' | 'SPLINT';

export interface Patient {
  id: string;
  name: string;
  medicalId: string; // 病歷號
  category: PatientCategory; // 個案類別
  urgency: 'HIGH' | 'MEDIUM' | 'LOW'; // 優先度/緊急度
  note?: string;
  scheduledDate?: string; // 排程的日期
}

export interface Therapist {
  id: string;
  name: string;
  code: string; // OT, OU, OV, OB, OC
  color: string; // Tailwind color class for badges/etc
  isActive: boolean;
}

export interface ScheduleCell {
  id: string; // unique cell id e.g. "INPATIENT-slot1-therapistA"
  category: PatientCategory; // Which grid section
  slotIndex: number; // 0-based index of slot inside this section (e.g. 0-7, where 0-3 are morning, 4-7 are afternoon)
  slotLabel: string; // e.g. "上午 Session 1", "下午 Session 2"
  therapistId: string; // Bound therapist
  patientId: string | null; // Occupied by patient ID (null if blank)
  isBlockedByLeave: boolean; // Dynamic block due to therapist leave
  isSystemBlocked: boolean; // Standard grey slots from excel template
}

export interface TherapistLeave {
  id: string;
  therapistId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  slots: string; // Description e.g., "整天", "上午", "下午"
}

// 換日歸檔的排班記錄（去正規化，不依賴 patients/therapists 現存資料）
export interface ArchivedAssignment {
  id: string;            // 唯一鍵：date-cellId-medicalId（防止重複歸檔）
  date: string;          // 排程日期 YYYY-MM-DD
  patientName: string;
  medicalId: string;
  category: PatientCategory;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  therapistId: string;
  therapistCode: string;
  therapistName: string;
  slotIndex: number;     // <100 上午、>=100 下午
  archivedAt: string;    // 歸檔時間 ISO
}

export interface LoggedSchedule {
  id: string;
  timestamp: string;
  patientId: string;
  patientName: string;
  therapistId: string;
  therapistName: string;
  category: PatientCategory;
  slots: number[]; // Slot indexes occupied (1 for regular, 2 for complex)
  type: 'AUTO' | 'MANUAL';
}

// 前台具名使用者（由管理員在後台管理）
export interface AppUser {
  id: string;
  name: string;
  password: string; // ponytail: 明文儲存方便管理員後台檢視；管理員密碼才用雜湊
}

// 排程稽核紀錄：誰在什麼時候把誰排給哪位治療師
export interface AuditEntry {
  id: string;
  timestamp: string; // ISO
  userName: string;
  action: '指派' | '撤銷' | '調整';
  patientName: string;
  medicalId: string;
  therapistName: string;
  detail: string; // 日期/時段描述
}
