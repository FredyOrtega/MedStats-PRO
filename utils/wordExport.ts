
import { RadiologyRecord } from '../types';

export const exportToWord = (data: RadiologyRecord[], filterSpecialist: string, dateRange: { min: string, max: string }) => {
  const filtered = filterSpecialist === 'All' 
    ? data 
    : data.filter(d => d.realizado_por === filterSpecialist);

  // Group 1: Complex Summary by Specialist and Modality Columns
  const specStats: Record<string, any> = {};
  filtered.forEach(record => {
    const spec = (record.realizado_por || 'N/A').trim();
    if (!specStats[spec]) {
      specStats[spec] = {
        name: spec,
        total: 0,
        ct_std: 0,
        ct_cont: 0,
        cr_std: 0,
        cr_esp: 0,
        mg: 0,
        us: 0,
        otros: 0
      };
    }
    
    const stats = specStats[spec];
    stats.total++;
    
    const mod = (record.modalidad || '').toUpperCase().trim();
    const sub = record.subcategory;

    if (mod === 'CT') {
      if (sub === 'CONTRASTADOS') stats.ct_cont++;
      else stats.ct_std++;
    } else if (mod === 'CR') {
      if (sub === 'ESPECIALES') stats.cr_esp++;
      else stats.cr_std++;
    } else if (mod === 'MG') {
      stats.mg++;
    } else if (mod === 'US') {
      stats.us++;
    } else {
      stats.otros++;
    }
  });

  // Sort patients for the detailed list
  const sortedPatients = [...filtered].sort((a, b) => {
    const specComp = (a.realizado_por || '').localeCompare(b.realizado_por || '');
    if (specComp !== 0) return specComp;
    return (a.fecha_reporte || '').localeCompare(b.fecha_reporte || '');
  });

  // Build HTML for Word
  let html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Reporte Estadístico Consolidado</title>
    <style>
      body { font-family: 'Arial', sans-serif; line-height: 1.2; color: #252525; }
      h1 { color: #02a58d; text-align: center; font-size: 16pt; margin-bottom: 5px; text-transform: uppercase; border-bottom: 2px solid #02a58d; }
      h2 { color: #ffffff; background-color: #252525; padding: 5px 10px; margin-top: 20px; font-size: 12pt; border-radius: 4px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; table-layout: fixed; }
      th, td { border: 1px solid #000; padding: 4px; text-align: center; font-size: 7.5pt; word-wrap: break-word; }
      th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; }
      .text-left { text-align: left; }
      .footer { margin-top: 30px; font-size: 7pt; color: #666; text-align: center; }
      .highlight-contrast { background-color: #fff0f0; color: #ff4d63; font-weight: bold; }
      .highlight-special { background-color: #f0fff4; color: #02a58d; font-weight: bold; }
      .header-box { padding: 10px; background-color: #fafafa; border: 1px solid #ccc; font-size: 9pt; }
      .period-badge { color: #02a58d; font-weight: bold; }
    </style>
    </head>
    <body>
      <h1>REPORTE DE PRODUCTIVIDAD RADIOLÓGICA</h1>
      
      <div class="header-box">
        <p><strong>PERIODO ANALIZADO:</strong> <span class="period-badge">${dateRange.min} — ${dateRange.max}</span></p>
        <p><strong>FILTRO ESPECIALISTA:</strong> ${filterSpecialist === 'All' ? 'GLOBAL' : filterSpecialist}</p>
        <p><strong>FECHA GENERACIÓN:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>TOTAL ESTUDIOS:</strong> ${filtered.length}</p>
      </div>

      <h2>1. CUADRO RESUMEN DE PRODUCTIVIDAD POR MODALIDAD</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 25%;">Especialista</th>
            <th style="width: 8%;">Total</th>
            <th style="width: 8%;">CT Std</th>
            <th style="width: 8%;">CT Cont</th>
            <th style="width: 8%;">CR Std</th>
            <th style="width: 8%;">CR Esp</th>
            <th style="width: 8%;">MG</th>
            <th style="width: 8%;">US</th>
            <th style="width: 8%;">Otros</th>
          </tr>
        </thead>
        <tbody>
          ${Object.values(specStats).map(s => `
            <tr>
              <td class="text-left"><strong>${s.name}</strong></td>
              <td><strong>${s.total}</strong></td>
              <td>${s.ct_std}</td>
              <td class="highlight-contrast">${s.ct_cont}</td>
              <td>${s.cr_std}</td>
              <td class="highlight-special">${s.cr_esp}</td>
              <td>${s.mg}</td>
              <td>${s.us}</td>
              <td>${s.otros}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>2. RELACIÓN DETALLADA DE PACIENTES</h2>
      <table>
        <thead>
          <tr>
            <th style="width: 15%;">REALIZADO POR</th>
            <th style="width: 10%;">ESTADO REPORTE</th>
            <th style="width: 10%;">FECHA REPORTE</th>
            <th style="width: 10%;">ID PACIENTE</th>
            <th style="width: 18%;">NOMBRE PACIENTE</th>
            <th style="width: 27%;">DESCRIPCIÓN</th>
            <th style="width: 10%;">MODALIDAD</th>
          </tr>
        </thead>
        <tbody>
          ${sortedPatients.map(p => `
            <tr>
              <td class="text-left">${p.realizado_por || 'N/A'}</td>
              <td>${p.estado_reporte || 'N/A'}</td>
              <td>${p.fecha_reporte || 'N/A'}</td>
              <td>${p.id_paciente || 'N/A'}</td>
              <td class="text-left"><strong>${p.nombre_paciente || 'N/A'}</strong></td>
              <td class="text-left">${p.descripcion || 'N/A'}</td>
              <td class="${p.subcategory === 'CONTRASTADOS' ? 'highlight-contrast' : p.subcategory === 'ESPECIALES' ? 'highlight-special' : ''}">
                ${p.modalidad || 'N/A'} ${p.subcategory === 'CONTRASTADOS' ? '(CONTRASTE)' : p.subcategory === 'ESPECIALES' ? '(ESPECIAL)' : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="footer">
        © ${new Date().getFullYear()} MedStats Pro Intelligence — Generado por FortBA®
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Reporte_MedStats_${filterSpecialist.replace(/\s/g, '_')}_${new Date().getTime()}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
