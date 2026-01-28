
import * as XLSX from 'xlsx';
import { RadiologyRecord } from '../types';

export const exportToExcel = (data: RadiologyRecord[], specialist: string) => {
  const filtered = specialist === 'All' 
    ? data 
    : data.filter(d => d.realizado_por === specialist);

  // Relación resumida: Cantidad de estudios por fecha y tipo de estudio
  const summaryMap = filtered.reduce((acc, curr) => {
    const key = `${curr.fecha_realizado}_${curr.modalidad}_${curr.subcategory || 'STANDARD'}`;
    if (!acc[key]) {
      acc[key] = {
        'Fecha': curr.fecha_realizado,
        'Modalidad': curr.modalidad,
        'Subcategoría': curr.subcategory || 'STANDARD',
        'Cantidad': 0
      };
    }
    acc[key]['Cantidad']++;
    return acc;
  }, {} as Record<string, any>);

  const worksheet = XLSX.utils.json_to_sheet(Object.values(summaryMap));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Resumen Estudios");
  
  // Also add raw data for audit
  const rawWorksheet = XLSX.utils.json_to_sheet(filtered);
  XLSX.utils.book_append_sheet(workbook, rawWorksheet, "Detalle Datos");

  XLSX.writeFile(workbook, `Reporte_Estadistico_${specialist.replace(/\s/g, '_')}.xlsx`);
};
