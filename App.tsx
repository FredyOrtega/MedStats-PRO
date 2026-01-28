
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import Papa from 'papaparse';
import { 
  FileUp, 
  Download, 
  Users, 
  Activity, 
  ChevronRight, 
  FileText,
  Search,
  Filter,
  RefreshCw,
  Info,
  ShieldCheck,
  Stethoscope,
  CalendarDays
} from 'lucide-react';
import { RadiologyRecord } from './types';
import { COLUMN_MAPPING } from './constants';
import { classifyRecord, getSummaryBySpecialist, getModalityStats, normalize } from './utils/dataProcessor';
import { exportToWord } from './utils/wordExport';

// URL del logo de FortBA (versión raw para renderizado)
const FORTBA_LOGO_URL = "https://raw.githubusercontent.com/FredyOrtega/favicon/07bd67da473f85b36caf42192c7b8ce9e5b53545/formato%20png.png";
const FORTBA_URL = "https://fortba.com/";

// Modalidades permitidas por el usuario
const ALLOWED_MODALITIES = ['CT', 'US', 'CR', 'MG'];

export default function App() {
  const [data, setData] = useState<RadiologyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterSpecialist, setFilterSpecialist] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      
      let headerIndex = lines.findIndex(line => {
        const nLine = normalize(line);
        return nLine.includes('ID PACIENTE') || 
               nLine.includes('DESCRIPCION') || 
               nLine.includes('MODALIDAD');
      });

      if (headerIndex === -1) {
        alert("No se encontró la fila de encabezado válida. Verifique el formato del archivo.");
        setLoading(false);
        return;
      }

      const validCsv = lines.slice(headerIndex).join('\n');

      Papa.parse(validCsv, {
        header: true,
        skipEmptyLines: true,
        delimiter: "|",
        complete: (results) => {
          if (results.data.length === 0) {
            setLoading(false);
            return;
          }

          const rowKeys = Object.keys(results.data[0]);
          const parsed = results.data.map((row: any) => {
            const record: any = {};
            const rowValues = Object.values(row);
            
            Object.entries(COLUMN_MAPPING).forEach(([csvCol, internalKey]) => {
              const matchingKey = rowKeys.find(k => normalize(k) === normalize(csvCol));
              let val = matchingKey ? row[matchingKey] : '';
              
              if (internalKey === 'descripcion' && (!val || val.trim() === '') && rowValues[2]) {
                val = rowValues[2] as string;
              }
              
              record[internalKey] = val?.trim() || '';
            });

            return classifyRecord(record as RadiologyRecord);
          });
          
          const cleanData = parsed.filter(d => {
            const hasId = d.id_paciente && d.id_paciente.trim() !== '';
            const mod = (d.modalidad || '').trim().toUpperCase();
            const isAllowedMod = ALLOWED_MODALITIES.includes(mod);
            return hasId && isAllowedMod;
          });

          if (cleanData.length === 0 && parsed.length > 0) {
            alert("El archivo se leyó pero ninguna fila coincide con las modalidades permitidas (CT, US, CR, MG).");
          }

          setData(cleanData);
          setLoading(false);
        },
        error: (err) => {
          console.error("Error parsing CSV:", err);
          setLoading(false);
          alert("Error al leer el archivo.");
        }
      });
    };
    reader.readAsText(file);
  };

  const specialists = useMemo(() => {
    const set = new Set(data.map(d => d.realizado_por));
    return Array.from(set).filter(Boolean).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      const matchSpec = filterSpecialist === 'All' || d.realizado_por === filterSpecialist;
      const matchSearch = (d.nombre_paciente || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (d.id_paciente || '').includes(searchTerm);
      return matchSpec && matchSearch;
    });
  }, [data, filterSpecialist, searchTerm]);

  // Cálculo del periodo analizado basado en la columna FECHA REALIZADO
  const dateRange = useMemo(() => {
    if (filteredData.length === 0) return { min: '', max: '' };
    
    // Asumimos formato que permite ordenación simple o intentamos parsear
    // Filtramos fechas vacías primero
    const validDates = filteredData
      .map(d => d.fecha_realizado)
      .filter(f => f && f.trim() !== '');

    if (validDates.length === 0) return { min: 'N/A', max: 'N/A' };

    // Para encontrar min/max de forma segura, convertimos a milisegundos si es posible
    // o simplemente ordenamos si el formato es consistente YYYY-MM-DD o DD/MM/YYYY (aunque este último es más complejo de ordenar así)
    // Intentaremos un ordenamiento robusto
    const sorted = [...validDates].sort((a, b) => {
      const parseDate = (s: string) => {
        const parts = s.split(/[\/\-]/);
        if (parts.length === 3) {
          // Si parece DD/MM/YYYY
          if (parts[0].length === 2 && parts[2].length === 4) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
          // Si parece YYYY/MM/DD
          return new Date(s).getTime();
        }
        return new Date(s).getTime();
      };
      return parseDate(a) - parseDate(b);
    });

    return { min: sorted[0], max: sorted[sorted.length - 1] };
  }, [filteredData]);

  const summary = useMemo(() => getSummaryBySpecialist(filteredData), [filteredData]);
  const totalStudies = filteredData.length;
  const contrastCount = filteredData.filter(d => d.subcategory === 'CONTRASTADOS').length;
  const specialCount = filteredData.filter(d => d.subcategory === 'ESPECIALES').length;

  return (
    <div className="flex flex-col min-h-screen bg-[#fcfcfc]">
      <header className="sticky top-0 z-50 bg-[#252525] text-white px-8 py-5 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-6">
          <div className="bg-[#02a58d] p-3 rounded-2xl flex items-center justify-center shadow-lg shadow-[#02a58d]/20 border border-[#02a58d]/30">
            <Stethoscope size={28} className="text-white" />
          </div>
          
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tighter">
                MedStats <span className="text-[#02a58d]">PRO</span>
              </h1>
              <div className="h-6 w-[1px] bg-slate-700 mx-1"></div>
              <a 
                href={FORTBA_URL} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 group opacity-75 hover:opacity-100 transition-all cursor-pointer transform hover:translate-x-1"
              >
                <img 
                  src={FORTBA_LOGO_URL} 
                  alt="FortBA Brand" 
                  className="h-8 w-auto object-contain filter brightness-0 invert group-hover:scale-110 transition-transform duration-300" 
                />
                <span className="text-[10px] font-bold text-slate-400 tracking-tighter leading-none group-hover:text-[#02a58d] transition-colors">
                  by <br/><span className="text-white">FortBA®</span>
                </span>
              </a>
            </div>
            <p className="text-[9px] text-slate-500 font-extrabold uppercase tracking-[0.4em] mt-1">Radiology Intelligence System</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={() => exportToWord(data, filterSpecialist, dateRange)}
            disabled={data.length === 0}
            className="group flex items-center gap-3 bg-gradient-to-r from-[#02a58d] to-[#018470] text-white px-7 py-3.5 rounded-2xl text-xs font-black hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-[#02a58d]/30 disabled:opacity-30 disabled:grayscale uppercase tracking-widest border border-white/10"
          >
            <Download size={16} className="group-hover:-translate-y-1 transition-transform" />
            <span>Generar Reporte</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] mx-auto w-full px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          <aside className="lg:col-span-3 space-y-8">
            <div className="bg-[#252525] text-white p-7 rounded-[2.5rem] shadow-2xl overflow-hidden relative border border-slate-700">
              <div className="absolute -bottom-6 -right-6 opacity-5 transform -rotate-12">
                <img src={FORTBA_LOGO_URL} alt="" className="w-32 filter brightness-0 invert" />
              </div>
              <h3 className="text-xs font-black text-[#02a58d] uppercase tracking-widest mb-6 flex items-center gap-2">
                <FileUp size={16} />
                Gestión de Datos
              </h3>
              <label className="group flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-slate-600 rounded-3xl cursor-pointer bg-slate-800/20 hover:bg-slate-800/40 hover:border-[#02a58d] transition-all duration-300">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <FileText className="w-10 h-10 mb-3 text-slate-500 group-hover:text-[#02a58d] group-hover:scale-110 transition-transform" />
                  <p className="mb-2 text-xs font-bold text-slate-300 text-center px-4">Cargue su archivo plano</p>
                  <p className="text-[9px] text-[#02a58d] font-mono font-bold uppercase tracking-widest mt-2">PIPE DELIMITED (|)</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 tracking-tighter italic">Solo CT, US, CR, MG</p>
                </div>
                <input type="file" className="hidden" accept=".csv,.txt" onChange={handleFileUpload} />
              </label>
              {data.length > 0 && (
                <div className="mt-6 space-y-3">
                  <div className="p-4 bg-[#02a58d]/10 border border-[#02a58d]/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[#02a58d]">
                      <ShieldCheck size={16} />
                      <span className="text-xs font-black uppercase tracking-tighter">Registros Listos</span>
                    </div>
                    <span className="bg-[#02a58d] text-white text-[10px] px-2 py-0.5 rounded-lg font-black">{data.length}</span>
                  </div>
                  
                  {/* Visualización del Periodo Analizado */}
                  {dateRange.min && (
                    <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-2xl">
                      <div className="flex items-center gap-2 text-slate-400 mb-2">
                        <CalendarDays size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Periodo Analizado</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[8px] text-[#02a58d] font-bold uppercase">Desde</span>
                          <span className="text-xs font-black text-white">{dateRange.min}</span>
                        </div>
                        <ChevronRight size={14} className="text-slate-600" />
                        <div className="flex flex-col text-right">
                          <span className="text-[8px] text-[#02a58d] font-bold uppercase">Hasta</span>
                          <span className="text-xs font-black text-white">{dateRange.max}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-7 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
              <h3 className="text-xs font-black text-[#252525] uppercase tracking-[0.2em] mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <Filter size={16} className="text-[#02a58d]" />
                Filtros Activos
              </h3>
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Especialista</label>
                  <select 
                    value={filterSpecialist}
                    onChange={(e) => setFilterSpecialist(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-4 text-sm font-bold text-[#252525] focus:ring-4 focus:ring-[#02a58d]/10 focus:border-[#02a58d] transition-all appearance-none cursor-pointer shadow-sm"
                  >
                    <option value="All">Todos los Especialistas</option>
                    {specialists.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-widest">Búsqueda Rápida</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Nombre o ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-[#252525] focus:ring-4 focus:ring-[#02a58d]/10 focus:border-[#02a58d] transition-all shadow-sm"
                    />
                    <Search className="absolute left-4 top-[18px] text-slate-400" size={18} />
                  </div>
                </div>
                <button 
                  onClick={() => {setFilterSpecialist('All'); setSearchTerm('');}}
                  className="w-full text-xs font-black text-[#ff4d63] hover:bg-[#ff4d63]/5 flex items-center justify-center gap-2 py-4 border-2 border-[#ff4d63]/20 rounded-2xl transition-all"
                >
                  <RefreshCw size={14} />
                  RESETEAR VISTA
                </button>
              </div>
            </div>
          </aside>

          <div className="lg:col-span-9 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-[#252525] text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group border border-slate-700">
                <div className="absolute -bottom-4 -right-4 text-[#02a58d]/10 transition-transform group-hover:scale-125 duration-500">
                  <Activity size={120} />
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estudios Procesados</p>
                <div className="flex items-center justify-between mt-4 relative z-10">
                  <h4 className="text-5xl font-black">{totalStudies.toLocaleString()}</h4>
                  <div className="p-4 bg-[#02a58d]/20 text-[#02a58d] rounded-2xl border border-[#02a58d]/20">
                    <Activity size={28} />
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-l-[12px] border-[#ff4d63] flex flex-col justify-between group hover:translate-y-[-4px] transition-transform">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estudios Contrastados</p>
                <div className="flex items-end justify-between mt-4">
                  <h4 className="text-5xl font-black text-[#252525]">{contrastCount.toLocaleString()}</h4>
                  <div className="text-right">
                    <span className="text-xs font-black text-[#ff4d63] bg-[#ff4d63]/10 px-3 py-1 rounded-full border border-[#ff4d63]/10">SUBCAT</span>
                    <p className="text-sm font-black text-slate-400 mt-2">{totalStudies > 0 ? ((contrastCount / totalStudies) * 100).toFixed(1) : 0}% participación</p>
                  </div>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-l-[12px] border-[#02a58d] flex flex-col justify-between group hover:translate-y-[-4px] transition-transform">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Procedimientos Especiales</p>
                <div className="flex items-end justify-between mt-4">
                  <h4 className="text-5xl font-black text-[#252525]">{specialCount.toLocaleString()}</h4>
                  <div className="text-right">
                    <span className="text-xs font-black text-[#02a58d] bg-[#02a58d]/10 px-3 py-1 rounded-full border border-[#02a58d]/10">ESPECIAL</span>
                    <p className="text-sm font-black text-slate-400 mt-2">Análisis de Modalidad</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden">
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-8 bg-[#02a58d] rounded-full"></div>
                  <h3 className="text-lg font-black text-[#252525] uppercase tracking-wider">Productividad por Especialista</h3>
                </div>
                <Users size={22} className="text-[#02a58d]" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#252525] text-[11px] font-black text-slate-300 uppercase tracking-[0.25em]">
                    <tr>
                      <th className="px-10 py-6">Especialista</th>
                      <th className="px-6 py-6 text-center">Total</th>
                      <th className="px-10 py-6">Detalle Modalidades</th>
                      <th className="px-10 py-6">Subcategorías</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-10 py-24 text-center">
                          <div className="flex flex-col items-center opacity-20">
                            <FileText size={60} className="mb-4 text-[#252525]" />
                            <p className="text-lg font-black text-[#252525] italic uppercase tracking-widest">A la espera de datos...</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      summary.map((row) => (
                        <tr key={row.specialist} className="hover:bg-[#02a58d]/5 transition-all group">
                          <td className="px-10 py-8">
                            <div className="flex items-center gap-5">
                              <div className="h-12 w-12 rounded-2xl bg-[#02a58d] text-white flex items-center justify-center text-sm font-black shadow-xl shadow-[#02a58d]/20 group-hover:rotate-6 transition-transform">
                                {row.specialist.split(' ').filter(n => n.length > 2).map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="text-base font-black text-[#252525] tracking-tight block">{row.specialist}</span>
                                <span className="text-[10px] text-[#02a58d] font-bold uppercase tracking-widest">Radiólogo Adscrito</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-8 text-center">
                            <span className="text-xl font-black text-[#252525] bg-slate-100 px-5 py-2 rounded-2xl shadow-sm border border-slate-200">{row.totalStudies}</span>
                          </td>
                          <td className="px-10 py-8">
                            <div className="flex flex-wrap gap-2 max-w-[300px]">
                              {Object.entries(row.modalities).map(([mod, count]) => (
                                <div key={mod} className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                                  <span className="text-[11px] font-black text-[#252525]">{mod}</span>
                                  <span className="text-[10px] font-black bg-[#02a58d] text-white px-2 py-0.5 rounded-lg">{count}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-10 py-8">
                            <div className="space-y-2">
                              {Object.entries(row.subcategories).map(([sub, count]) => {
                                if (count === 0) return null;
                                return (
                                  <div key={sub} className="flex items-center justify-between gap-4 border-b border-slate-50 pb-1">
                                    <span className={`text-[10px] font-black uppercase tracking-widest ${sub !== 'STANDARD' ? 'text-[#ff4d63]' : 'text-slate-400'}`}>
                                      {sub}
                                    </span>
                                    <span className="text-xs font-black text-[#252525]">{count}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-auto py-12 px-8 bg-[#252525] text-white border-t border-slate-800">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="flex items-center gap-6">
             <div className="bg-[#02a58d] p-2 rounded-xl h-11 w-11 flex items-center justify-center border border-[#02a58d]/30 shadow-lg shadow-[#02a58d]/10">
                <Stethoscope size={22} className="text-white" />
             </div>
             <div>
               <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.6em]">
                 Radiology Analytics • Enterprise v2.6
               </p>
               <div className="flex items-center gap-2 mt-1">
                 <p className="text-white text-sm font-bold">MedStats <span className="text-[#02a58d]">PRO</span></p>
                 <span className="text-[10px] text-slate-500">by</span>
                 <a 
                    href={FORTBA_URL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 group cursor-pointer hover:bg-white/5 px-2 py-1 rounded-lg transition-colors"
                  >
                   <img 
                      src={FORTBA_LOGO_URL} 
                      alt="FortBA" 
                      className="h-5 w-auto filter brightness-0 invert opacity-60 group-hover:opacity-100 transition-opacity" 
                    />
                    <span className="text-white text-[10px] font-black group-hover:text-[#02a58d] transition-colors">FortBA®</span>
                 </a>
               </div>
             </div>
          </div>
          <div className="flex gap-10 text-[10px] font-black uppercase tracking-widest text-slate-500">
             <span className="hover:text-[#02a58d] cursor-pointer transition-colors underline decoration-[#02a58d]/30 underline-offset-4">POLÍTICA DE PRIVACIDAD</span>
             <span className="hover:text-[#02a58d] cursor-pointer transition-colors underline decoration-[#02a58d]/30 underline-offset-4">SOPORTE TÉCNICO</span>
             <div className="flex items-center gap-3 text-[#02a58d] bg-[#02a58d]/5 px-4 py-2 rounded-xl border border-[#02a58d]/20">
               <div className="w-2 h-2 bg-[#02a58d] rounded-full animate-pulse shadow-[0_0_8px_#02a58d]"></div>
               <span className="font-bold tracking-[0.2em]">SISTEMA SEGURO</span>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
