
import React, { useState, useRef, useEffect } from 'react';
import { TableData } from '../types.ts';

interface TableEditorProps {
  table: TableData;
  onUpdate: (updatedTable: TableData) => void;
  onDelete: (id: string) => void;
  onDuplicate: () => void;
  isEditMode: boolean; // 新增 prop
  searchQuery?: string;
  isFirstMatch?: boolean;
}

const AutoHeightTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  textAlign?: 'left' | 'center' | 'right';
  isMatched?: boolean;
  readOnly?: boolean; // 新增 readOnly
}> = ({ value, onChange, className, placeholder, textAlign = 'left', isMatched = false, readOnly = false }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const node = textareaRef.current;
    if (node) {
      node.style.height = 'auto';
      node.style.height = `${node.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={1}
      readOnly={readOnly}
      style={{ textAlign }}
      className={`resize-none overflow-hidden block w-full bg-transparent focus:outline-none transition-all ${
        readOnly ? 'cursor-default' : 'cursor-text'
      } ${
        isMatched 
          ? 'bg-yellow-300 text-black rounded px-1 -mx-1 shadow-sm' 
          : ''
      } ${className}`}
      onInput={adjustHeight}
    />
  );
};

export const TableEditor: React.FC<TableEditorProps> = ({ table, onUpdate, onDelete, onDuplicate, isEditMode, searchQuery = '', isFirstMatch = false }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 判斷文字是否匹配搜尋
  const isMatch = (text: string) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return false;
    return (text || '').toString().toLowerCase().includes(q);
  };

  // 自動捲動邏輯
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (isFirstMatch && q && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });

      setTimeout(() => {
        if (scrollContainerRef.current) {
          const matchTarget = scrollContainerRef.current.querySelector('[data-matched="true"]');
          if (matchTarget) {
            matchTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      }, 500);
    }
  }, [searchQuery, isFirstMatch]);

  const addRow = () => {
    if (!isEditMode) return;
    const newRows = [...table.rows, new Array(table.columns.length).fill('')];
    onUpdate({ ...table, rows: newRows });
  };

  const addColumn = () => {
    if (!isEditMode) return;
    const newColumns = [...table.columns, `新欄位`];
    const newRows = table.rows.map(row => [...row, '']);
    onUpdate({ ...table, columns: newColumns, rows: newRows });
  };

  const removeRow = (index: number) => {
    if (!isEditMode) return;
    if (table.rows.length <= 1) {
      onUpdate({ ...table, rows: [new Array(table.columns.length).fill('')] });
      return;
    }
    onUpdate({ ...table, rows: table.rows.filter((_, i) => i !== index) });
  };

  const removeColumn = (index: number) => {
    if (!isEditMode || table.columns.length <= 1) return;
    const newColumns = table.columns.filter((_, i) => i !== index);
    const newRows = table.rows.map(row => row.filter((_, i) => i !== index));
    onUpdate({ ...table, columns: newColumns, rows: newRows });
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    if (!isEditMode) return;
    const newRows = [...table.rows];
    newRows[rowIndex][colIndex] = value;
    onUpdate({ ...table, rows: newRows });
  };

  const updateHeader = (colIndex: number, value: string) => {
    if (!isEditMode) return;
    const newColumns = [...table.columns];
    newColumns[colIndex] = value;
    onUpdate({ ...table, columns: newColumns });
  };

  const downloadCSV = () => {
    const escapeCSV = (str: string) => `"${(str || '').toString().replace(/"/g, '""')}"`;
    const csvContent = [
      table.columns.map(escapeCSV).join(','),
      ...table.rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');
    const blob = new Blob([`\ufeff${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${table.title || 'table'}.csv`;
    link.click();
  };

  return (
    <div ref={containerRef} className={`bg-white rounded-xl overflow-hidden border-4 border-black mb-16 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-colors ${!isEditMode ? 'bg-gray-50/30' : ''}`}>
      <div className="p-6 border-b-4 border-black flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white relative z-50">
        <div className="flex-1">
          <AutoHeightTextarea
            value={table.title}
            onChange={(val) => onUpdate({ ...table, title: val })}
            readOnly={!isEditMode}
            className="text-3xl font-black text-black border-b-2 border-black pb-1 uppercase italic"
            isMatched={isMatch(table.title)}
            placeholder="表格標題..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEditMode && (
            <button onClick={onDuplicate} title="複製表格" className="p-2 border-2 border-black rounded-lg hover:bg-gray-100 transition-all text-sm font-black"><i className="fas fa-copy"></i></button>
          )}
          <button onClick={downloadCSV} title="匯出 CSV" className="p-2 border-2 border-black rounded-lg bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 active:translate-y-0.5 transition-all text-sm font-black"><i className="fas fa-download"></i></button>
          
          {isEditMode && (
            isConfirmingDelete ? (
              <div className="flex items-center gap-1">
                <button onClick={() => setIsConfirmingDelete(false)} className="px-3 py-1.5 rounded-lg font-black border-2 border-black bg-white text-xs">取消</button>
                <button onClick={() => onDelete(table.id)} className="px-3 py-1.5 rounded-lg font-black border-2 border-black bg-red-600 text-white text-xs">刪除</button>
              </div>
            ) : (
              <button onClick={() => setIsConfirmingDelete(true)} title="刪除表格" className="p-2 rounded-lg font-black border-2 border-black bg-red-600 text-white hover:bg-red-700 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 text-sm"><i className="fas fa-trash-alt"></i></button>
            )
          )}
        </div>
      </div>

      <div ref={scrollContainerRef} className="max-h-[600px] overflow-auto custom-scrollbar relative bg-white">
        <table className="border-separate border-spacing-0 w-max min-w-full">
          <thead>
            <tr className="sticky top-0 z-[60]">
              {table.columns.map((col, idx) => (
                <th 
                  key={idx} 
                  className={`p-3 border-b-4 border-r-2 border-black relative group text-center
                    ${idx === 0 
                      ? 'sticky left-0 z-[70] border-r-4 bg-gray-50 min-w-[80px] w-[80px]' 
                      : 'bg-white min-w-[210px] w-[210px] text-left'
                    }
                  `}
                >
                  <AutoHeightTextarea 
                    value={col} 
                    onChange={(v) => updateHeader(idx, v)} 
                    readOnly={!isEditMode}
                    className={`text-black uppercase placeholder:text-black/30 ${idx === 0 ? 'text-lg font-black' : 'text-xs font-black'}`} 
                    isMatched={isMatch(col)}
                    placeholder={idx === 0 ? "ID" : `欄位 ${idx + 1}`}
                    textAlign={idx === 0 ? 'center' : 'left'}
                  />
                  {isEditMode && (
                    <button onClick={() => removeColumn(idx)} className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 text-black/20 hover:text-red-600 transition-opacity p-1"><i className="fas fa-times-circle text-[10px]"></i></button>
                  )}
                </th>
              ))}
              {isEditMode && (
                <th className="p-3 w-10 border-b-4 border-black bg-gray-100 text-center sticky right-0 top-0 z-[65]">
                  <button onClick={addColumn} className="hover:scale-125 transition-transform"><i className="fas fa-plus-circle text-lg text-black"></i></button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-gray-50 transition-colors group">
                {row.map((cell, cIdx) => (
                  <td 
                    key={cIdx} 
                    data-matched={isMatch(cell)}
                    className={`p-2 border-b-2 border-r-2 border-black text-black transition-all
                      ${cIdx === 0 
                        ? 'sticky left-0 z-50 bg-gray-50 font-black border-r-4 min-w-[80px] w-[80px] text-center' 
                        : 'font-medium bg-white min-w-[210px] w-[210px] text-left'
                      }
                    `}
                  >
                    <AutoHeightTextarea 
                      value={cell} 
                      onChange={(v) => updateCell(rIdx, cIdx, v)} 
                      readOnly={!isEditMode}
                      textAlign={cIdx === 0 ? 'center' : 'left'}
                      isMatched={isMatch(cell)}
                      className={`text-black leading-tight ${cIdx === 0 ? 'text-lg font-black' : 'text-xs'}`} 
                    />
                  </td>
                ))}
                {isEditMode && (
                  <td className="p-1 border-b-2 border-black text-center w-10 bg-white sticky right-0 z-20">
                    <button onClick={() => removeRow(rIdx)} className="hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-trash-can text-sm"></i></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isEditMode && (
        <div className="p-6 bg-white flex justify-center border-t-4 border-black relative z-50">
          <button onClick={addRow} className="flex items-center gap-3 bg-black text-white px-10 py-3 rounded-lg font-black text-base border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:bg-gray-900 active:translate-y-0.5 transition-all uppercase italic">
            <i className="fas fa-plus-square"></i> 插入新行
          </button>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #fff; border: 1px solid black; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border: 2px solid #fff; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        .sticky.left-0::after { content: ''; position: absolute; top: 0; right: -4px; bottom: 0; width: 4px; pointer-events: none; border-right: 1px solid rgba(0,0,0,0.1); }
      `}</style>
    </div>
  );
};
