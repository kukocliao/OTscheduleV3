// 備份資料版本遷移：每次改版動到備份 JSON 的欄位結構時，
// 在此加一筆 { from: 舊版號, migrate: 轉換成 from+1 格式 } 並將 CURRENT_SCHEMA_VERSION +1。
// 舊備份匯入時會依序套用中間所有 migration，補齊成目前格式。

export const CURRENT_SCHEMA_VERSION = 2;

type Migration = { from: number; migrate: (data: any) => any };

const migrations: Migration[] = [
  {
    // 使用者制上線前排定的個案／歸檔紀錄沒有「指派使用者」欄位，一律預設為管理者
    from: 1,
    migrate: (data) => ({
      ...data,
      scheduleCells: Array.isArray(data.scheduleCells)
        ? data.scheduleCells.map((c: any) => c.patientId ? { ...c, assignedBy: c.assignedBy || '管理者' } : c)
        : data.scheduleCells,
      archiveByMonth: data.archiveByMonth
        ? Object.fromEntries(Object.entries(data.archiveByMonth).map(([month, records]: [string, any]) =>
            [month, Array.isArray(records) ? records.map((r: any) => ({ ...r, userName: r.userName || '管理者' })) : records]
          ))
        : data.archiveByMonth,
    }),
  },
];

export function migrateBackup(data: any): any {
  let version = typeof data.version === 'number' ? data.version : 1;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations.find(m => m.from === version);
    if (!step) break; // 找不到對應 migration，保留現況交給呼叫端的欄位防呆處理
    data = step.migrate(data);
    version += 1;
  }
  data.version = version;
  return data;
}
