import { Patient, Therapist, PatientCategory, ScheduleCell, TherapistLeave } from './types';

// Initial Therapist List based on the Excel sample
export const initialTherapists: Therapist[] = [
  { id: 't1', name: '趙長宥', code: 'OT', color: 'emerald', isActive: true },
  { id: 't2', name: '潘亮全', code: 'OU', color: 'blue', isActive: true },
  { id: 't3', name: '姜壯坤', code: 'OV', color: 'indigo', isActive: true },
  { id: 't4', name: '蘇柏臻', code: 'OB', color: 'purple', isActive: true },
  { id: 't5', name: '邱申棟', code: 'OC', color: 'pink', isActive: true },
];

// Initial Patients with diverse categories and details
export const initialPatients: Patient[] = [];

// Therapist initial leave intervals
export const initialLeaves: TherapistLeave[] = [];

// Helper to initialize the scheduling grid based on the Excel template structure
export function generateInitialSchedule(therapists: Therapist[]): ScheduleCell[] {
  const categories: PatientCategory[] = ['INPATIENT', 'INPATIENT_COMPLEX', 'OUTPATIENT_COMPLEX', 'MODERATE', 'SPLINT'];
  const cells: ScheduleCell[] = [];

  categories.forEach(category => {
    // 8 slots per section: 0,1,2,3 for Morning (slotIndex < 100), 100,101,102,103 for Afternoon (slotIndex >= 100)
    for (let i = 0; i < 8; i++) {
      const isMorning = i < 4;
      const slotIndex = isMorning ? i : 100 + (i - 4);
      const slotLabel = isMorning 
        ? `上午診 0${8 + i}:30` 
        : `下午診 1${i}:30`;

      therapists.forEach(therapist => {
        // According to user request, we do not restrict any of the scheduling slots (no grey admin/system blocks)
        const isSystemBlocked = false;

        cells.push({
          id: `${category}-S${slotIndex}-${therapist.id}`,
          category,
          slotIndex,
          slotLabel,
          therapistId: therapist.id,
          patientId: null,
          isBlockedByLeave: false,
          isSystemBlocked
        });
      });
    }
  });

  return cells;
}

// Database schema configuration for display/design
export const databaseSchema = {
  title: '臨床復健科網頁排班系統 (Clinical Rehab Room Database Schema)',
  description: '此關聯式資料庫結構專為滿足治療師公平排班、彈性手動覆寫、個案連續多格權重以及請假排程所設計。採用 PostgreSQL 語法標準。',
  tables: [
    {
      name: 'patients (個案基本資料表)',
      columns: [
        { name: 'id', type: 'UUID', keys: 'PRIMARY KEY', desc: '個案唯一識別碼' },
        { name: 'name', type: 'VARCHAR(100)', keys: 'NOT NULL', desc: '個案姓名' },
        { name: 'medical_id', type: 'VARCHAR(50)', keys: 'NOT NULL, UNIQUE', desc: '病歷號 (用於快速查詢、避免重複)' },
        { name: 'category', type: 'VARCHAR(50)', keys: 'NOT NULL', desc: '個案類別 (\'INPATIENT\', \'OUTPATIENT_COMPLEX\', \'MODERATE\', \'SPLINT\')' },
        { name: 'urgency', type: 'VARCHAR(20)', keys: 'DEFAULT \'MEDIUM\'', desc: '排序優先級 (\'HIGH\', \'MEDIUM\', \'LOW\')' },
        { name: 'note', type: 'TEXT', keys: 'NULL', desc: '病況或排班特殊註記' },
        { name: 'created_at', type: 'TIMESTAMP', keys: 'DEFAULT CURRENT_TIMESTAMP', desc: '建立時間' },
      ],
      indexes: [
        'CREATE INDEX idx_patients_category ON patients (category);',
        'CREATE INDEX idx_patients_medical_id ON patients (medical_id);'
      ]
    },
    {
      name: 'therapists (治療師資料表)',
      columns: [
        { name: 'id', type: 'UUID', keys: 'PRIMARY KEY', desc: '治療師唯一識別碼' },
        { name: 'name', type: 'VARCHAR(100)', keys: 'NOT NULL', desc: '治療師真實姓名' },
        { name: 'code', type: 'VARCHAR(10)', keys: 'NOT NULL, UNIQUE', desc: '治療師代號 (例如: OT, OU, OV, OB, OC)' },
        { name: 'rotation_order', type: 'INTEGER', keys: 'NOT NULL', desc: 'Round-Robin 自動輪替順序編號 (排序權重)' },
        { name: 'is_active', type: 'BOOLEAN', keys: 'DEFAULT TRUE', desc: '是否在職中 (可用於暫停排班)' },
        { name: 'created_at', type: 'TIMESTAMP', keys: 'DEFAULT CURRENT_TIMESTAMP', desc: '建立時間' },
      ],
      indexes: [
        'CREATE INDEX idx_therapists_order ON therapists (rotation_order);'
      ]
    },
    {
      name: 'therapist_leaves (治療師請假/非排班設定表)',
      columns: [
        { name: 'id', type: 'UUID', keys: 'PRIMARY KEY', desc: '請假紀錄主鍵' },
        { name: 'therapist_id', type: 'UUID', keys: 'FOREIGN KEY -> therapists(id)', desc: '請假治療師外鍵' },
        { name: 'start_date', type: 'DATE', keys: 'NOT NULL', desc: '請假開始日期' },
        { name: 'end_date', type: 'DATE', keys: 'NOT NULL', desc: '請假結束日期' },
        { name: 'period_type', type: 'VARCHAR(20)', keys: 'NOT NULL', desc: '請假區間 (\'ALL_DAY\', \'MORNING\', \'AFTERNOON\')' },
      ],
      indexes: [
        'CREATE INDEX idx_leaves_date ON therapist_leaves (start_date, end_date);'
      ],
      constraints: 'FOREIGN KEY (therapist_id) REFERENCES therapists (id) ON DELETE CASCADE'
    },
    {
      name: 'schedule_grid_templates (課表基本診次時段表)',
      columns: [
        { name: 'id', type: 'UUID', keys: 'PRIMARY KEY', desc: '時段模版唯一碼' },
        { name: 'category', type: 'VARCHAR(50)', keys: 'NOT NULL', desc: '時段所屬大項 (住院, 門診複雜, 等)' },
        { name: 'slot_index', type: 'INTEGER', keys: 'NOT NULL', desc: '日/週診次順序 (0-7)' },
        { name: 'slot_label', type: 'VARCHAR(50)', keys: 'NOT NULL', desc: '人性化標記 (如: 上午課 09:30)' },
        { name: 'therapist_id', type: 'UUID', keys: 'FOREIGN KEY -> therapists(id)', desc: '該診次負責/綁定治療師' },
        { name: 'is_system_blocked', type: 'BOOLEAN', keys: 'DEFAULT FALSE', desc: '灰色預留屬性 (True 代表示行政、會議等不可排)' },
      ],
      constraints: 'FOREIGN KEY (therapist_id) REFERENCES therapists (id)'
    },
    {
      name: 'schedule_assignments (排班紀錄/預約結果表)',
      columns: [
        { name: 'id', type: 'UUID', keys: 'PRIMARY KEY', desc: '排班預約唯一主鍵' },
        { name: 'patient_id', type: 'UUID', keys: 'FOREIGN KEY -> patients(id)', desc: '排入個案外鍵 (可為空，代表釋放)' },
        { name: 'category', type: 'VARCHAR(50)', keys: 'NOT NULL', desc: '排班項目 (住院, 門診複雜, 等)' },
        { name: 'slot_index', type: 'INTEGER', keys: 'NOT NULL', desc: '排入之時段格序' },
        { name: 'therapist_id', type: 'UUID', keys: 'FOREIGN KEY -> therapists(id)', desc: '排班治療師外鍵' },
        { name: 'assignment_method', type: 'VARCHAR(20)', keys: 'NOT NULL', desc: '指派方式 (\'AUTO\' 自動輪替, \'MANUAL\' 手動設定)' },
        { name: 'schedule_date', type: 'DATE', keys: 'NOT NULL', desc: '此堂課的具體日期' },
        { name: 'created_at', type: 'TIMESTAMP', keys: 'DEFAULT CURRENT_TIMESTAMP', desc: '操作成立時間' }
      ],
      indexes: [
        'CREATE UNIQUE INDEX uq_therapist_slot ON schedule_assignments (therapist_id, schedule_date, category, slot_index); // 確保不撞診',
        'CREATE INDEX idx_assignments_patient ON schedule_assignments (patient_id);'
      ],
      constraints: 'FOREIGN KEY (patient_id) REFERENCES patients (id) ON DELETE CASCADE, FOREIGN KEY (therapist_id) REFERENCES therapists (id)'
    }
  ]
};

// Markdown version of the core pseudocode algorithm
export const pseudocodeContent = `\`\`\`typescript
/**
 * 臨床復健科「公平自動輪替與複雜個案連續多格權重」排班演算法
 * 
 * 核心規則：
 * 1. 依個案「優先級」(Urgency) 與「病患大項」(Category) 清單對待排病人排序
 * 2. 治療師(Therapist) 依自訂「輪替順序」(Rotation Order) 進行名單循環 (Round-Robin)
 * 3. 「複雜」個案(OUTPATIENT_COMPLEX) 權重為 2：必須連續佔用該治療師底下的兩格連續空白格子。
 *    若不滿足，暫時跳過該治療師，將該分配機會給予下一位符合連續空檔條件的治療師。
 * 4. 「一般/中重複中度、住院、副木」個案權重為 1：佔用 1 個非灰色空白格子。
 */

interface AlgorithmResult {
  assignments: Map<CellId, PatientId>;
  unscheduled: Patient[];
  rotationIndex: number;
}

function runClinicalRoundRobinScheduler(
  pendingPatients: Patient[],
  activeTherapists: Therapist[], // 已依自訂輪替優先權 (rotation_order) 排序好
  scheduleCells: ScheduleCell[],
  startRotationIdx: number = 0
): AlgorithmResult {
  
  // 1. 初始化資料結構
  const currentAssignments = new Map<string, string>(); // CellId -> PatientId
  const unscheduledPatients: Patient[] = [];
  let therapistsQueueIndex = startRotationIdx;
  const numTherapists = activeTherapists.length;
  
  if (numTherapists === 0) {
    return { assignments: currentAssignments, unscheduled: pendingPatients, rotationIndex: 0 };
  }

  // 2. 優先度排序：緊急 (HIGH) -> 中等 (MEDIUM) -> 普通 (LOW)
  // 若優先度相同，複雜個案(2格)優先排，因為空間限制最大
  const sortedPatients = [...pendingPatients].sort((a, b) => {
    const urgencyWeight = { HIGH: 3, MEDIUM: 2, LOW: 1 };
    const diff = urgencyWeight[b.urgency] - urgencyWeight[a.urgency];
    if (diff !== 0) return diff;
    
    // 複雜個案優先 (權重較高，需要先卡位以避免無連續空檔)
    const isAComplex = a.category === 'OUTPATIENT_COMPLEX' ? 1 : 0;
    const isBComplex = b.category === 'OUTPATIENT_COMPLEX' ? 1 : 0;
    return isBComplex - isAComplex;
  });

  // 3. 遍歷排序後的個案
  for (const patient of sortedPatients) {
    let patientAssigned = false;
    let attempts = 0; // 避免無限迴圈，最多尋找一輪治療師 (numTherapists)

    while (!patientAssigned && attempts < numTherapists) {
      const currentTherapist = activeTherapists[therapistsQueueIndex];
      const tId = currentTherapist.id;
      const category = patient.category;

      // 取得該治療師在該個案類別下，依序由早到晚 (slotIndex 0 到 7) 的所有課表格子
      const therapistCells = scheduleCells
        .filter(c => c.category === category && c.therapistId === tId)
        .sort((a, b) => a.slotIndex - b.slotIndex);

      if (category === 'OUTPATIENT_COMPLEX') {
        // [複雜個案：需要連續 2 格空白可用格子]
        let foundConsecutivePair = -1;

        for (let i = 0; i < therapistCells.length - 1; i++) {
          const cell1 = therapistCells[i];
          const cell2 = therapistCells[i + 1];

          // 核心檢查：
          // 1. 兩格必須屬於同一半天 (例如：不能跨越上午 Slot 3 和下午 Slot 4)
          // 2. 兩格均未被指派
          // 3. 兩格均非系統灰色預留、亦無請假卡位
          const cell1Available = !cell1.patientId && !cell1.isSystemBlocked && !cell1.isBlockedByLeave && !currentAssignments.has(cell1.id);
          const cell2Available = !cell2.patientId && !cell2.isSystemBlocked && !cell2.isBlockedByLeave && !currentAssignments.has(cell2.id);
          
          // 上午時段 (0,1,2,3) 下午時段 (4,5,6,7) 判別，避免連續格跨越上午診與下午診
          const isSameHalfDay = (cell1.slotIndex < 4 && cell2.slotIndex < 4) || (cell1.slotIndex >= 4 && cell2.slotIndex >= 4);

          if (cell1Available && cell2Available && isSameHalfDay) {
            foundConsecutivePair = i;
            break;
          }
        }

        if (foundConsecutivePair !== -1) {
          // 匹配成功：將個案排入此治療師之兩個連續時段格中
          const targetCell1 = therapistCells[foundConsecutivePair];
          const targetCell2 = therapistCells[foundConsecutivePair + 1];
          
          currentAssignments.set(targetCell1.id, patient.id);
          currentAssignments.set(targetCell2.id, patient.id);
          
          patientAssigned = true;
          // 完成本次轮替配對，輪替指針移至下一位，並跳出本次 Patient 迴圈
          therapistsQueueIndex = (therapistsQueueIndex + 1) % numTherapists;
        } else {
          // 此治療師無符合其「門診複雜個案」之連續課空格。
          // 依演算法「跳過該治療師」，尋找下一輪
          therapistsQueueIndex = (therapistsQueueIndex + 1) % numTherapists;
          attempts++;
        }

      } else {
        // [標準/一般/住院/副木個案：僅需 1 格空白可用格子]
        let foundSingleCellIndex = -1;

        for (let i = 0; i < therapistCells.length; i++) {
          const cell = therapistCells[i];
          const isAvailable = !cell.patientId && !cell.isSystemBlocked && !cell.isBlockedByLeave && !currentAssignments.has(cell.id);
          
          if (isAvailable) {
            foundSingleCellIndex = i;
            break;
          }
        }

        if (foundSingleCellIndex !== -1) {
          // 匹配成功：指派單一格子
          const targetCell = therapistCells[foundSingleCellIndex];
          currentAssignments.set(targetCell.id, patient.id);
          
          patientAssigned = true;
          // 公平輪替：指標往後
          therapistsQueueIndex = (therapistsQueueIndex + 1) % numTherapists;
        } else {
          // 無合適空白格，跳過該治療師，交由下一位輪替
          therapistsQueueIndex = (therapistsQueueIndex + 1) % numTherapists;
          attempts++;
        }
      }
    }

    // 4. 若所有治療師皆無可用空缺時段，列入未排程清單
    if (!patientAssigned) {
      unscheduledPatients.push(patient);
    }
  }

  return {
    assignments: currentAssignments,
    unscheduled: unscheduledPatients,
    rotationIndex: therapistsQueueIndex
  };
}
\`\`\``;
