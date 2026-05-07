import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

interface UnitContextType {
  activeUnit: string;
  setActiveUnit: (unit: string) => void;
  availableUnits: string[];
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export function UnitProvider({ children, user }: { children: React.ReactNode, user: any }) {
  const [dynamicUnits, setDynamicUnits] = useState<string[]>([]);
  const [activeUnit, setActiveUnit] = useState<string>(() => {
    const saved = localStorage.getItem('activeUnit');
    if (saved === 'Sede') return 'Administração Central';
    return saved || (user?.units?.[0] || 'Administração Central');
  });

  // Fetch schools owned by user to populate available units if they are not global admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      const loadUserSchools = async () => {
        try {
          const schools = await api.schools.list({ isAdmin: false });
          if (schools) {
            const units = schools.map((s: any) => s.unit || s.name).filter(Boolean);
            setDynamicUnits(units);
          }
        } catch (err) {
          console.error("Error loading user schools for units:", err);
        }
      };
      loadUserSchools();
    }
  }, [user]);

  const userUnits = user?.role === 'admin' ? ['Administração Central', ...(user?.units || [])] : [...(user?.units || []), ...dynamicUnits];
  const availableUnits = Array.from(new Set(userUnits)).filter(Boolean) as string[];

  useEffect(() => {
    localStorage.setItem('activeUnit', activeUnit);
  }, [activeUnit]);

  // Handle unit switching if user loses access to current unit or logs in
  useEffect(() => {
    if (user && availableUnits.length > 0 && !availableUnits.includes(activeUnit)) {
      setActiveUnit(availableUnits[0]);
    }
  }, [user, availableUnits]);

  return (
    <UnitContext.Provider value={{ activeUnit, setActiveUnit, availableUnits }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnit() {
  const context = useContext(UnitContext);
  if (context === undefined) {
    throw new Error('useUnit must be used within a UnitProvider');
  }
  return context;
}
