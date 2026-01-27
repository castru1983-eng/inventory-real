
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TableData, PageData } from './types.ts';
import { TableEditor } from './components/TableEditor.tsx';

const STORAGE_KEY = 'table_architect_v5_final';

const generateId = () => {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  }
};

const App: React.FC = () => {
  const [pages, setPages] = useState<PageData[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingPageName, setIsEditingPageName] = useState<string | null>(null);
  const [pageIdToConfirmDelete, setPageIdToConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsedPages = JSON.parse(saved);
        if (Array.isArray(parsedPages) && parsedPages.length > 0) {
          setPages(parsedPages);
          setActivePageId(parsedPages[0].id);
        } else {
          createDefaultPage();
        }
      } catch (e) {
        createDefaultPage();
      }
    } else {
      createDefaultPage();
    }
  }, []);

  const createDefaultPage = () => {
    const defaultId = generateId();
    const defaultPage: PageData = {
      id: defaultId,
      name: '預設工作區',
      tables: []
    };
    setPages([defaultPage]);
    setActivePageId(defaultId);
  };

  useEffect(() => {
    if (pages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
    }
  }, [pages]);

  const activePage = useMemo(() => 
    pages.find(p => p.id === activePageId) || null, 
    [pages, activePageId]
  );

  const addNewPage = () => {
    const newId = generateId();
    const newPage: PageData = { id: newId, name: `新工作區 ${pages.length + 1}`, tables: [] };
    setPages(prev => [...prev, newPage]);
    setActivePageId(newId);
    setTimeout(() => setIsEditingPageName(newId), 50);
  };

  const renamePage = (id: string, newName: string) => {
    setPages(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const executeDeletePage = (id: string) => {
    const deletedIndex = pages.findIndex(p => p.id === id);
    const newPages = pages.filter(p => p.id !== id);
    if (newPages.length === 0) {
      createDefaultPage();
    } else {
      setPages(newPages);
      if (activePageId === id) {
        const nextIndex = Math.max(0, Math.min(deletedIndex, newPages.length - 1));
        setActivePageId(newPages[nextIndex].id);
      }
    }
    setPageIdToConfirmDelete(null);
  };

  const addNewTable = () => {
    if (!activePageId) return;
    const newTable: TableData = {
      id: generateId(),
      title: '未命名表格',
      columns: ['標題 1', '標題 2', '標題 3'],
      rows: [['', '', '']]
    };
    setPages(prev => prev.map(p => p.id === activePageId ? { ...p, tables: [newTable, ...p.tables] } : p));
    setSearchQuery('');
  };

  const updateTable = (updatedTable: TableData) => {
    setPages(prev => prev.map(p => 
      p.id === activePageId ? { ...p, tables: p.tables.map(t => t.id === updatedTable.id ? updatedTable : t) } : p
    ));
  };

  const deleteTable = (id: string) => {
    setPages(prev => prev.map(p => 
      p.id === activePageId ? { ...p, tables: p.tables.filter(t => t.id !== id) } : p
    ));
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activePageId) return;

    const fileName = file.name.split('.').slice(0, -1).join('.') || '匯入的表格';

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      /**
       * 強健的 CSV 解析器：支援單元格內換行
       * 遍歷所有字元，只有在「非引號內」遇到的換行才視為新列。
       */
      const parseCSVToRows = (csvText: string): string[][] => {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i++) {
          const char = csvText[i];
          const nextChar = csvText[i + 1];

          if (inQuotes) {
            // 在引號內處理引號轉義 "" -> "
            if (char === '"' && nextChar === '"') {
              currentCell += '"';
              i++;
            } else if (char === '"') {
              inQuotes = false;
            } else {
              currentCell += char;
            }
          } else {
            if (char === '"') {
              inQuotes = true;
            } else if (char === ',') {
              currentRow.push(currentCell);
              currentCell = '';
            } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
              // 真正的列換行
              if (char === '\r') i++; // 跳過 \r
              currentRow.push(currentCell);
              rows.push(currentRow);
              currentRow = [];
              currentCell = '';
            } else if (char !== '\r') {
              currentCell += char;
            }
          }
        }
        // 處理最後殘留的資料
        if (currentCell !== '' || currentRow.length > 0) {
          currentRow.push(currentCell);
          rows.push(currentRow);
        }
        return rows;
      };

      const allParsedRows = parseCSVToRows(text);
      if (allParsedRows.length === 0) return;

      const detectedTables: TableData[] = [];
      let currentTable: TableData | null = null;

      // 檢查是否為本系統導出的多表格格式 (檢查所有列的第一欄)
      const isMultiTableFile = allParsedRows.some(row => 
        (row[0] || '').trim().startsWith('>>> 表格：')
      );

      if (!isMultiTableFile) {
        // 標準單一表格處理
        const headers = allParsedRows[0].map(h => h.trim());
        const dataRows = allParsedRows.slice(1)
          .filter(row => row.some(cell => cell.trim() !== "")); 
        
        detectedTables.push({
          id: generateId(),
          title: fileName,
          columns: headers,
          rows: dataRows.length > 0 ? dataRows : [new Array(headers.length).fill('')]
        });
      } else {
        // 多表格解析邏輯
        allParsedRows.forEach(row => {
          const firstCellContent = (row[0] || '').trim();

          if (firstCellContent.startsWith('>>> 表格：') && firstCellContent.endsWith('<<<')) {
            // 偵測到新表格標籤
            const extractedTitle = firstCellContent.replace('>>> 表格：', '').replace('<<<', '').trim();
            currentTable = {
              id: generateId(),
              title: extractedTitle,
              columns: [],
              rows: []
            };
            detectedTables.push(currentTable);
          } else if (currentTable) {
            // 如果該列全部是空的（例如匯出時的空行分隔），則略過
            if (!row.some(c => c.trim() !== "")) return;

            if (currentTable.columns.length === 0) {
              // 標記後的非空行視為欄位標頭
              currentTable.columns = row.map(c => c.trim());
            } else {
              // 之後的行視為資料列
              currentTable.rows.push(row.map(c => c.toString()));
            }
          }
        });
      }

      // 最終清理
      detectedTables.forEach(t => {
        if (t.rows.length === 0) {
          t.rows = [new Array(t.columns.length).fill('')];
        }
      });

      if (detectedTables.length > 0) {
        setPages(prev => prev.map(p => 
          p.id === activePageId 
            ? { ...p, tables: [...p.tables, ...detectedTables] } 
            : p
        ));
        setSearchQuery('');
      }
      
      event.target.value = '';
    };
    reader.readAsText(file);
  };

  const exportAllTablesOnPage = () => {
    if (!activePage || activePage.tables.length === 0) return;
    const escapeCSV = (str: string) => `"${(str || '').toString().replace(/"/g, '""')}"`;
    const csvContent = activePage.tables.map(table => {
      const titleRow = [`>>> 表格：${table.title} <<<`].map(escapeCSV).join(',');
      const headerRow = table.columns.map(escapeCSV).join(',');
      const dataRows = table.rows.map(row => row.map(escapeCSV).join(',')).join('\n');
      // 表格之間留空行增加可讀性
      return `${titleRow}\n${headerRow}\n${dataRows}`;
    }).join('\n\n\n'); 

    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activePage.name}_全頁匯出.csv`;
    link.click();
  };

  const filteredTables = useMemo(() => {
    if (!activePage) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return activePage.tables;
    return activePage.tables.filter(table => 
      table.title.toLowerCase().includes(q) || 
      table.columns.some(col => (col || '').toLowerCase().includes(q)) ||
      table.rows.some(row => row.some(cell => (cell || '').toString().toLowerCase().includes(q)))
    );
  }, [activePage, searchQuery]);

  const firstMatchTableId = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q || filteredTables.length === 0) return null;
    return filteredTables[0].id;
  }, [filteredTables, searchQuery]);

  return (
    <div className="min-h-screen pb-32 bg-[#fcfcfc] text-black font-medium selection:bg-yellow-200">
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv" className="hidden" />
      
      <header className="sticky top-0 z-[100] bg-white border-b-4 border-black px-8 py-5 flex flex-col md:flex-row items-center justify-between shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-black border-2 border-black rounded flex items-center justify-center text-white shadow-[4px_4px_0px_0px_rgba(255,255,0,1)]">
            <i className="fas fa-table-list text-2xl"></i>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic leading-none">Table Expert</h1>
            <p className="text-[10px] font-black mt-1 bg-black text-white px-1 w-fit">AUTO-SCROLL ENABLED</p>
          </div>
        </div>

        <div className="flex-1 max-w-xl w-full relative">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input 
            type="text" 
            placeholder="搜尋關鍵字，將自動定位結果..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full bg-gray-50 border-4 border-black rounded-xl py-2.5 pl-12 pr-4 font-black focus:outline-none focus:bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all" 
          />
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleImportClick} className="px-4 py-3 rounded-lg font-black border-2 border-black hover:bg-gray-100 transition-all active:translate-y-0.5">
            <i className="fas fa-file-import mr-2"></i>匯入 CSV
          </button>
          <button onClick={exportAllTablesOnPage} className="px-4 py-3 rounded-lg font-black border-2 border-black hover:bg-yellow-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all">
            <i className="fas fa-file-export mr-2"></i>匯出全頁
          </button>
          <button onClick={addNewTable} className="px-6 py-3 bg-black text-white rounded-lg font-black border-2 border-black hover:bg-gray-800 shadow-[4px_4px_0px_0px_rgba(255,255,0,0.5)] active:translate-y-0.5 transition-all">
            <i className="fas fa-plus mr-2"></i>新增表格
          </button>
        </div>
      </header>

      <div className="bg-white border-b-4 border-black px-8 pt-6 flex items-end gap-1 overflow-x-auto no-scrollbar">
        {pages.map((page) => (
          <div 
            key={page.id} 
            className={`group relative flex items-center transition-all px-5 py-3 border-t-4 border-x-4 border-black rounded-t-xl cursor-pointer min-w-[200px] ${activePageId === page.id ? 'bg-yellow-400 -mb-1 translate-y-[-4px] z-10' : 'bg-gray-100 hover:bg-gray-200'}`} 
            onClick={() => setActivePageId(page.id)}
          >
            {pageIdToConfirmDelete === page.id ? (
              <div className="flex items-center justify-between w-full gap-2 animate-pulse" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs font-black uppercase text-red-600 italic">刪除？</span>
                <div className="flex gap-1">
                  <button onClick={(e) => { e.stopPropagation(); executeDeletePage(page.id); }} className="px-2 py-1 bg-red-600 text-white text-[10px] rounded border border-black font-black">是</button>
                  <button onClick={(e) => { e.stopPropagation(); setPageIdToConfirmDelete(null); }} className="px-2 py-1 bg-white text-black text-[10px] rounded border border-black font-black">否</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 flex items-center gap-2 overflow-hidden">
                  <i className={`fas ${activePageId === page.id ? 'fa-folder-open' : 'fa-folder'} text-sm`}></i>
                  {isEditingPageName === page.id ? (
                    <input autoFocus className="bg-white/50 border-b-2 border-black font-black w-full outline-none px-1" value={page.name} onChange={(e) => renamePage(page.id, e.target.value)} onBlur={() => setIsEditingPageName(null)} onKeyDown={(e) => e.key === 'Enter' && setIsEditingPageName(null)} onClick={(e) => e.stopPropagation()} />
                  ) : (
                    <span className="font-black truncate text-base" onDoubleClick={() => setIsEditingPageName(page.id)}>{page.name}</span>
                  )}
                </div>
                <button onClick={(e) => { e.stopPropagation(); setPageIdToConfirmDelete(page.id); }} className="opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center hover:bg-red-600 hover:text-white rounded-md text-red-600 transition-all ml-2"><i className="fas fa-times text-xs"></i></button>
              </>
            )}
          </div>
        ))}
        <button onClick={addNewPage} className="mb-3 ml-4 w-10 h-10 bg-black text-white rounded-full hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] flex items-center justify-center"><i className="fas fa-plus"></i></button>
      </div>

      <main className="max-w-7xl mx-auto px-8 pt-12">
        {activePage && activePage.tables.length === 0 ? (
          <div className="py-48 text-center border-4 border-dashed border-black rounded-[2rem] bg-white shadow-[16px_16px_0px_0px_rgba(0,0,0,0.05)]">
            <h2 className="text-4xl font-black mb-10 italic uppercase tracking-tight">「{activePage.name}」目前沒有表格</h2>
            <div className="flex justify-center gap-4">
              <button onClick={handleImportClick} className="bg-white text-black px-8 py-4 rounded-xl font-black text-xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 transition-all">匯入 CSV 檔案</button>
              <button onClick={addNewTable} className="bg-black text-white px-8 py-4 rounded-xl font-black text-xl border-4 border-black shadow-[6px_6px_0px_0px_rgba(255,255,0,0.4)] active:translate-y-1 transition-all">手動新增表格</button>
            </div>
          </div>
        ) : (
          <div className="space-y-24">
            {filteredTables.map(table => (
              <TableEditor 
                key={table.id} 
                table={table} 
                onUpdate={updateTable} 
                onDelete={deleteTable} 
                onDuplicate={() => {
                  const newTable = { ...JSON.parse(JSON.stringify(table)), id: generateId(), title: `${table.title} (副本)` };
                  setPages(prev => prev.map(p => p.id === activePageId ? { ...p, tables: [...p.tables, newTable] } : p));
                }} 
                searchQuery={searchQuery} 
                isFirstMatch={table.id === firstMatchTableId}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
