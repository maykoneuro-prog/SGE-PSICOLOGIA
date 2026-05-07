import { api } from "../lib/api";
import { format, startOfMonth } from "date-fns";

export interface Plan {
  id: string;
  name: string;
  limit: number;
  price: number;
  allowOverage: boolean;
  autoBlock: boolean;
}

export interface UsageStatus {
  current: number;
  limit: number;
  percentage: number;
  isSoftLimit: boolean; // 80%
  isHardLimit: boolean; // 100%
  isExceeded: boolean; // > 100%
  shouldBlock: boolean;
  message: string | null;
}

export const usageService = {
  getMonthlyUsage: async (unitId: string, professionalId?: string): Promise<number> => {
    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      // Use YYYY-MM-DD to avoid time-of-day filtering issues in string comparison
      const monthStartStr = format(monthStart, 'yyyy-MM-01');

      const savedUser = localStorage.getItem("user");
      const currentUser = savedUser ? JSON.parse(savedUser) : null;
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super-admin';
      const isTrial = currentUser?.planId === 'trial' || currentUser?.isTrial;

      const filters: any = { startDate: monthStartStr, isAdmin };
      if (professionalId && (!isAdmin || isTrial)) {
        filters.professionalId = professionalId;
      }

      const [appointments, documents] = await Promise.all([
        api.appointments.list(filters),
        api.documents.list(filters)
      ]);

      const isCentral = unitId === 'Sede' || unitId === 'Administração Central';
      const cleanSelected = unitId.trim().toLowerCase().replace(/^(sesi|unidade|escola|centro|departamento)\s+/g, "").trim();

      const matchesUnit = (item: any) => {
        if (isCentral) return true;
        
        const val = (item.unit || item.schoolUnit || "").trim().toLowerCase();
        const cleanVal = val.replace(/^(sesi|unidade|escola|centro|departamento)\s+/g, "").trim();
        
        // Match exact or contains (symmetric)
        if (val === unitId.trim().toLowerCase() || cleanVal === cleanSelected) return true;
        if (cleanSelected !== "" && cleanVal.includes(cleanSelected)) return true;
        if (cleanVal !== "" && cleanSelected.includes(cleanVal)) return true;
        
        return false;
      };

      const filteredAppointments = (appointments || []).filter(matchesUnit);

      // Count ALL clinical/pedagogical documents as usage
      const relevantDocumentTypes = [
        'group_attendance', 
        'pedagogical_participation', 
        'psychological_listening', 
        'school_diagnosis',
        'classroom_evolution',
        'referral',
        'attendance_declaration',
        'authorization_term'
      ];
      
      const filteredDocuments = (documents || []).filter((doc: any) => {
        const docMatchesUnit = matchesUnit(doc);
        const isRelevantType = relevantDocumentTypes.includes(doc.type);
        return docMatchesUnit && isRelevantType;
      });

      return filteredAppointments.length + filteredDocuments.length;
    } catch (error) {
      console.error("Error calculating usage:", error);
      return 0;
    }
  },

  getSubscriptionStatus: async (unitId: string, professionalId?: string): Promise<UsageStatus | null> => {
    try {
      const savedUser = localStorage.getItem("user");
      const currentUser = savedUser ? JSON.parse(savedUser) : null;
      
      const currentUsage = await usageService.getMonthlyUsage(unitId, professionalId);
      const subscription = await api.subscriptions.getByUnit(unitId);
      const plans = await api.plans.list();
      
      let limit = 40; // Default fallback to Basic Plan limit
      let plan = null;

      // Check if it's a trial user
      if (currentUser?.planId === 'trial' || currentUser?.isTrial) {
        // Use limits from user object or default to 10
        limit = currentUser?.trialLimits?.appointments || 10;
        const percentage = (currentUsage / limit) * 100;
        const isExceeded = currentUsage >= limit;
        
        // Check time expiration
        const now = new Date();
        const expiresAt = currentUser.expiresAt ? new Date(currentUser.expiresAt) : null;
        const isTimedOut = expiresAt && now > expiresAt;

        // Force percentage to 0 if usage is 0, to avoid weird floating point or stale issues
        const safePercentage = currentUsage <= 0 ? 0 : percentage;

        return {
          current: currentUsage,
          limit,
          percentage: safePercentage,
          isSoftLimit: safePercentage >= 80 && safePercentage < 100,
          isHardLimit: isExceeded || isTimedOut,
          isExceeded: isExceeded || isTimedOut,
          shouldBlock: isExceeded || isTimedOut,
          message: isTimedOut 
            ? "Seu período de teste grátis expirou (7 dias). Faça um upgrade para continuar." 
            : isExceeded 
              ? `Você atingiu o limite de ${limit} atendimentos do seu teste grátis. Faça um upgrade para continuar.`
              : null
        };
      }

      if (subscription) {
        plan = plans?.find((p: any) => p.id === (subscription as any).planId) as Plan;
        if (plan) {
          limit = plan.limit;
        }
      } else {
        // Find basic plan for default limits if subscription is missing
        const basicPlan = plans?.find((p: any) => p.id === 'basic' || p.name?.toLowerCase().includes('básico')) as any;
        if (basicPlan) limit = basicPlan.limit;
      }

      const percentage = (currentUsage / limit) * 100;
      const isSoftLimit = percentage >= 80 && percentage < 100;
      const isHardLimit = percentage >= 100;
      const isExceeded = currentUsage > limit;
      
      let shouldBlock = false;
      let message = null;

      if (isExceeded) {
        if (plan?.autoBlock && !plan?.allowOverage) {
          shouldBlock = true;
          message = "Seu plano atingiu o limite máximo e o serviço foi temporariamente pausado. Entre em contato para reativação ou upgrade.";
        } else {
          message = "Você atingiu o limite mensal de atendimentos do seu plano. Novos atendimentos poderão ser limitados ou tarifados como excedente.";
        }
      } else if (isSoftLimit) {
        message = "Você está próximo do limite do seu plano. Para evitar interrupções, considere fazer um upgrade.";
      }

      return {
        current: currentUsage,
        limit,
        percentage,
        isSoftLimit,
        isHardLimit,
        isExceeded,
        shouldBlock,
        message
      };
    } catch (error) {
      console.error("Error fetching subscription status:", error);
      return null;
    }
  },

  logUsage: async (unitId: string, action: string, details: string) => {
    await api.usageLogs.create({
      unitId,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  },

  checkAndExecuteAction: async (unitId: string, action: () => Promise<any>, actionName: string): Promise<any> => {
    const status = await usageService.getSubscriptionStatus(unitId);
    
    if (status?.shouldBlock) {
      throw new Error(status.message || "Uso excedido.");
    }

    const result = await action();
    
    // Log success
    await usageService.logUsage(unitId, actionName, "Sucesso");
    
    return result;
  }
};
