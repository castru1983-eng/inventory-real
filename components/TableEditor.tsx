
import React, { useState, useRef, useEffect } from 'react';
import { TableData } from '../types.ts';

interface TableEditorProps {
  table: TableData;
  onUpdate: (updatedTable: TableData) => void;
  onDelete: (id: string) => void;
  onDuplicate: () => void;
  searchQuery?: string;
}

const AutoHeightTextarea: React.FC<{
  value: string;
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
  textAlign?: 'left' | 'center' | 'right';
}> = ({ value, onChange, className, placeholder, textAlign = 'left' }) => {
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
      style={{ textAlign }}
      className={`resize-none overflow-hidden block w-full bg-transparent focus:outline-none transition-all ${className}`}
      onInput={adjustHeight}
    />
  );
};

export const TableEditor: React.FC<TableEditorProps> = ({ table, onUpdate, onDelete, onDuplicate, searchQuery = '' }) => {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const emptyRowIndices = table.rows.reduce((acc, row, idx) => {
    if (row.every(cell => !cell || !cell.trim())) acc.push(idx);
    return acc;
  }, [] as number[]);

  const hasEmptyRows = emptyRowIndices.length > 0;

  const addRow = () => {
    const newRows = [...table.rows, new Array(table.columns.length).fill('')];
    onUpdate({ ...table, rows: newRows });
  };

  const addColumn = () => {
    const newColumns = [...table.columns, `新欄位`];
    const newRows = table.rows.map(row => [...row, '']);
    onUpdate({ ...table, columns: newColumns, rows: newRows });
  };

  const removeRow = (index: number) => {
    if (table.rows.length <= 1) {
      onUpdate({ ...table, rows: [new Array(table.columns.length).fill('')] });
      return;
    }
    onUpdate({ ...table, rows: table.rows.filter((_, i) => i !== index) });
  };

  const pruneEmptyRows = () => {
    const filteredRows = table.rows.filter(row => row.some(cell => cell && cell.trim() !== ''));
    onUpdate({ ...table, rows: filteredRows.length > 0 ? filteredRows : [new Array(table.columns.length).fill('')] });
  };

  const removeColumn = (index: number) => {
    if (table.columns.length <= 1) return;
    const newColumns = table.columns.filter((_, i) => i !== index);
    const newRows = table.rows.map(row => row.filter((_, i) => i !== index));
    onUpdate({ ...table, columns: newColumns, rows: newRows });
  };

  const updateCell = (rowIndex: number, colIndex: number, value: string) => {
    const newRows = [...table.rows];
    newRows[rowIndex][colIndex] = value;
    onUpdate({ ...table, rows: newRows });
  };

  const updateHeader = (colIndex: number, value: string) => {
    const newColumns = [...table.columns];
    newColumns[colIndex] = value;
    onUpdate({ ...table, columns: newColumns });
  };

  const downloadCSV = () => {
    const escapeCSV = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
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

  const isMatch = (text: string) => {
    if (!searchQuery.trim()) return false;
    return (text || '').toLowerCase().includes(searchQuery.toLowerCase().trim());
  };

  return (
    <div className="bg-white rounded-xl overflow-hidden border-4 border-black mb-16 transition-all shadow-[12px_12px_0px_0px_rgba(0,0,0,1)]">
      <div className="p-6 border-b-4 border-black flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white relative z-50">
        <div className="flex-1">
          <AutoHeightTextarea
            value={table.title}
            onChange={(val) => onUpdate({ ...table, title: val })}
            className={`text-3xl font-black text-black border-b-2 border-black pb-1 uppercase italic focus:bg-yellow-50 ${isMatch(table.title) ? 'bg-yellow-200' : ''}`}
            placeholder="表格標題..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasEmptyRows && (
            <button onClick={pruneEmptyRows} className="flex items-center gap-2 px-3 py-1.5 border-2 border-black rounded-lg font-black bg-yellow-400 hover:bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all text-xs">
              <i className="fas fa-broom"></i> 清除空列
            </button>
          )}
          <button onClick={onDuplicate} className="p-2 border-2 border-black rounded-lg hover:bg-gray-100 transition-all text-sm font-black"><i className="fas fa-copy"></i></button>
          <button onClick={downloadCSV} className="p-2 border-2 border-black rounded-lg bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-50 active:translate-y-0.5 transition-all text-sm font-black"><i className="fas fa-download"></i></button>
          {isConfirmingDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setIsConfirmingDelete(false)} className="px-3 py-1.5 rounded-lg font-black border-2 border-black bg-white hover:bg-gray-100 text-xs">取消</button>
              <button onClick={() => onDelete(table.id)} className="px-3 py-1.5 rounded-lg font-black border-2 border-black bg-red-600 text-white hover:bg-red-700 text-xs">刪除</button>
            </div>
          ) : (
            <button onClick={() => setIsConfirmingDelete(true)} className="p-2 rounded-lg font-black border-2 border-black bg-red-600 text-white hover:bg-red-700 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 text-sm"><i className="fas fa-trash-alt"></i></button>
          )}
        </div>
      </div>

      <div className="max-h-[600px] overflow-auto custom-scrollbar relative bg-gray-100">
        <table className="border-separate border-spacing-0 w-max min-w-full">
          <thead>
            <tr className="sticky top-0 z-[60]">
              {table.columns.map((col, idx) => (
                <th key={idx} className={`p-3 border-b-4 border-r-2 border-black relative group transition-all min-w-[140px] max-w-[200px] text-center ${idx === 0 ? 'sticky left-0 z-[70] border-r-4 shadow-[4px_0_4px_-2px_rgba(0,0,0,0.1)] bg-yellow-400' : 'bg-white'}`}>
                  <AutoHeightTextarea 
                    value={col} 
                    onChange={(v) => updateHeader(idx, v)} 
                    className={`text-black uppercase placeholder:text-black/30 ${idx === 0 ? 'text-lg font-black' : 'text-xs font-black'} ${isMatch(col) ? 'bg-white/40 rounded-sm' : ''}`} 
                    placeholder={`欄位 ${idx + 1}`}
                    textAlign="center"
                  />
                  <button onClick={() => removeColumn(idx)} className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 text-black/20 hover:text-red-600 transition-opacity p-1"><i className="fas fa-times-circle text-[10px]"></i></button>
                </th>
              ))}
              <th className="p-3 w-10 border-b-4 border-black bg-yellow-500 text-center sticky right-0 top-0 z-[65]">
                <button onClick={addColumn} className="hover:scale-125 transition-transform"><i className="fas fa-plus-circle text-lg text-black"></i></button>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-yellow-50 transition-colors group bg-white">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className={`p-2 border-b-2 border-r-2 border-black text-black transition-all min-w-[140px] max-w-[200px] ${cIdx === 0 ? 'sticky left-0 z-50 bg-yellow-400 font-black border-r-4 shadow-[4px_0_4px_-2px_rgba(0,0,0,0.1)]' : 'font-medium bg-white'}`}>
                    <AutoHeightTextarea 
                      value={cell} 
                      onChange={(v) => updateCell(rIdx, cIdx, v)} 
                      textAlign={cIdx === 0 ? 'center' : 'left'}
                      className={`text-black leading-tight ${cIdx === 0 ? 'text-lg font-black' : 'text-xs'} ${isMatch(cell) ? 'bg-white/60 ring-1 ring-black rounded-sm' : ''}`} 
                    />
                  </td>
                ))}
                <td className="p-1 border-b-2 border-black text-center w-10 bg-gray-100 sticky right-0 z-20">
                  <button onClick={() => removeRow(rIdx)} className="hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><i className="fas fa-trash-can text-sm"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-6 bg-white flex justify-center border-t-4 border-black relative z-50">
        <button onClick={addRow} className="flex items-center gap-3 bg-black text-white px-10 py-3 rounded-lg font-black text-base border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-900 active:translate-y-0.5 transition-all uppercase italic">
          <i className="fas fa-plus-square"></i> 插入新行
        </button>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { height: 10px; width: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #fff; border: 1px solid black; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border: 2px solid #fff; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        .sticky.left-0::after { content: ''; position: absolute; top: 0; right: -4px; bottom: 0; width: 4px; pointer-events: none; }
      `}</style>
    </div>
  );
};
