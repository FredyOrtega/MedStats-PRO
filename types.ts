
export interface RadiologyRecord {
  id_paciente: string;
  nombre_paciente: string;
  descripcion: string;
  region: string;
  fecha_realizado: string;
  modalidad: string;
  realizado_por: string;
  estado_reporte: string;
  fecha_reporte: string;
  // Computed fields
  subcategory: 'CONTRASTADOS' | 'ESPECIALES' | 'STANDARD';
}

export interface SummaryBySpecialist {
  specialist: string;
  totalStudies: number;
  modalities: Record<string, number>;
  subcategories: Record<string, number>;
}

export interface ChartDataPoint {
  name: string;
  value: number;
}
