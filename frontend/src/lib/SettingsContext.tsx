import React, { createContext, useContext, useState, useEffect } from 'react';
import { currencies } from './currencies';
import { translations } from './translations';

interface HubRates {
  masterCapex: number;
  masterOpex: number;
  subCapex: number;
  subOpex: number;
}

interface SettingsContextType {
  language: string;
  setLanguage: (lang: string) => void;
  currency: string;
  setCurrency: (curr: string) => void;
  hubRates: HubRates;
  setHubRates: (rates: HubRates) => void;
  t: (key: string) => string;
  formatCurrency: (amountMyr: number) => string;
  isTranslating: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem('slm_language') || 'en');
  const [currency, setCurrency] = useState(() => localStorage.getItem('slm_currency') || 'MYR');
  const [hubRates, setHubRates] = useState<HubRates>(() => {
    const saved = localStorage.getItem('slm_hub_rates');
    return saved ? JSON.parse(saved) : {
      masterCapex: 2480,
      masterOpex: 200,
      subCapex: 1030,
      subOpex: 100
    };
  });

  useEffect(() => {
    localStorage.setItem('slm_language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('slm_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('slm_hub_rates', JSON.stringify(hubRates));
  }, [hubRates]);

  const t = (key: string) => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  const formatCurrency = (amountMyr: number) => {
    const currData = currencies[currency as keyof typeof currencies] || currencies['MYR'];
    const converted = amountMyr * currData.rate;
    return `${currData.symbol} ${converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <SettingsContext.Provider value={{ language, setLanguage, currency, setCurrency, hubRates, setHubRates, t, formatCurrency, isTranslating: false }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
