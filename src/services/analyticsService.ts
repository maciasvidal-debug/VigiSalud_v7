import { db } from '../db';

export interface AnalyticsMetrics {
  ipo: number; // Productividad Operativa
  criticalRate: number; // Tasa de Hallazgos Críticos
  localizationEffectiveness: number; // Efectividad de Localización
  totalReports: number;
  favorable: number;
  withReq: number;
  critical: number;
  avgScore: number;
  recent: any[];
}

export const analyticsService = {
  async getMetrics(): Promise<AnalyticsMetrics> {
    // CORRECCIÓN CRÍTICA: Apuntar a 'inspections' y blindar contra undefined
    if (!db.inspections) {
      return { ipo: 0, criticalRate: 0, localizationEffectiveness: 0, totalReports: 0, favorable: 0, withReq: 0, critical: 0, avgScore: 0, recent: [] };
    }

    // Usamos la nueva tabla del Plan Omega
    const reports = await db.inspections.toArray();
    const total = reports.length;

    if (total === 0) {
      return { ipo: 0, criticalRate: 0, localizationEffectiveness: 0, totalReports: 0, favorable: 0, withReq: 0, critical: 0, avgScore: 0, recent: [] };
    }

    // 1. Productividad Operativa (IPO)
    const monthlyGoal = 100;
    const visitsThisMonth = total; 
    const ipo = Math.round((visitsThisMonth / monthlyGoal) * 100);

    // 2. Tasa de Hallazgos Críticos
    const critical = reports.filter(r => r.concept === 'DESFAVORABLE').length;
    const criticalRate = total > 0 ? Math.round((critical / total) * 100) : 0;

    // 3. Efectividad de Localización
    const notFoundOrClosed = reports.filter(r => 
      r.concept.includes('CERRADO') || 
      r.concept.includes('NO ENCONTRADO') || 
      r.concept.includes('CLAUSURADO')
    ).length;
    const localizationEffectiveness = total > 0 ? Math.round((notFoundOrClosed / total) * 100) : 0;

    // Métricas adicionales para el Dashboard
    const favorable = reports.filter(r => r.concept === 'FAVORABLE').length;
    const withReq = reports.filter(r => r.concept.includes('REQUERIMIENTOS')).length;
    
    // Cálculo seguro de promedio
    const avgScore = total > 0 
      ? Math.round(reports.reduce((acc, curr) => acc + (curr.riskScore || 0), 0) / total) 
      : 0;

    // Recientes (Ordenados por fecha/ID)
    const recent = reports.sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 10);

    return {
      ipo,
      criticalRate,
      localizationEffectiveness,
      totalReports: total,
      favorable,
      withReq,
      critical,
      avgScore,
      recent
    };
  }
};