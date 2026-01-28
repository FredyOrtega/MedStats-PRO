
import { RadiologyRecord, SummaryBySpecialist } from '../types';
import { ESPECIALES_PROCEDURES, CONTRASTADOS_PROCEDURES } from '../constants';

// Helper to normalize strings for comparison (removes accents, punctuation, collapses spaces)
export const normalize = (str: string) => {
  return (str || '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .toUpperCase()
    .replace(/[().,;:-]/g, ' ')     // Replace punctuation with space
    .replace(/\s+/g, ' ')           // Collapse multiple spaces
    .trim();
};

export const classifyRecord = (record: RadiologyRecord): RadiologyRecord => {
  const rawDesc = record.descripcion || '';
  const descNormalized = normalize(rawDesc);
  const mod = (record.modalidad || '').toUpperCase().trim();
  
  let subcategory: 'CONTRASTADOS' | 'ESPECIALES' | 'STANDARD' = 'STANDARD';

  // Check for Contrast keywords first (Priority for any modality)
  const hasContrastKeywords = descNormalized.includes('CONTRASTE') || descNormalized.includes('CONTRASTADO');

  if (hasContrastKeywords) {
    subcategory = 'CONTRASTADOS';
  } else if (mod === 'CT') {
    // Check strict list for CT
    const isContrastInList = CONTRASTADOS_PROCEDURES.some(p => descNormalized.includes(normalize(p)));
    if (isContrastInList) {
      subcategory = 'CONTRASTADOS';
    }
  } else if (mod === 'CR') {
    // Check strict list for CR Specials
    const isEspecial = ESPECIALES_PROCEDURES.some(p => descNormalized.includes(normalize(p)));
    if (isEspecial) {
      subcategory = 'ESPECIALES';
    }
  }

  return { ...record, subcategory };
};

export const getSummaryBySpecialist = (data: RadiologyRecord[]): SummaryBySpecialist[] => {
  const grouped = data.reduce((acc, curr) => {
    const spec = (curr.realizado_por || 'SIN ASIGNAR').trim();
    if (!acc[spec]) {
      acc[spec] = {
        specialist: spec,
        totalStudies: 0,
        modalities: {},
        subcategories: {
          'CONTRASTADOS': 0,
          'ESPECIALES': 0,
          'STANDARD': 0
        }
      };
    }
    
    acc[spec].totalStudies++;
    const mod = (curr.modalidad || 'N/A').trim().toUpperCase();
    acc[spec].modalities[mod] = (acc[spec].modalities[mod] || 0) + 1;
    acc[spec].subcategories[curr.subcategory]++;
    
    return acc;
  }, {} as Record<string, SummaryBySpecialist>);

  return Object.values(grouped).sort((a, b) => b.totalStudies - a.totalStudies);
};

export const getModalityStats = (data: RadiologyRecord[]) => {
  const stats = data.reduce((acc, curr) => {
    const mod = (curr.modalidad || 'N/A').trim().toUpperCase();
    acc[mod] = (acc[mod] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(stats).map(([name, value]) => ({ name, value }));
};
