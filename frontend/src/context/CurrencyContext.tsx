import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type Currency = "NGN" | "USD";

const NGN_TO_USD = 1600;

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggleCurrency: () => void;
  formatAmount: (amountNGN: number | string) => string;
  convertAmount: (amountNGN: number | string) => number;
  symbol: string;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "NGN",
  setCurrency: () => {},
  toggleCurrency: () => {},
  formatAmount: () => "",
  convertAmount: () => 0,
  symbol: "₦",
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(() => {
    return (localStorage.getItem("currency") as Currency) || "NGN";
  });

  const updateCurrency = useCallback((c: Currency) => {
    setCurrency(c);
    localStorage.setItem("currency", c);
  }, []);

  const toggleCurrency = useCallback(() => {
    updateCurrency(currency === "NGN" ? "USD" : "NGN");
  }, [currency, updateCurrency]);

  const symbol = currency === "NGN" ? "₦" : "$";

  const convertAmount = useCallback(
    (amountNGN: number | string): number => {
      const num = typeof amountNGN === "string" ? parseFloat(amountNGN) : amountNGN;
      if (isNaN(num)) return 0;
      return currency === "NGN" ? num : num / NGN_TO_USD;
    },
    [currency]
  );

  const formatAmount = useCallback(
    (amountNGN: number | string): string => {
      const converted = convertAmount(amountNGN);
      return `${symbol}${converted.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    },
    [convertAmount, symbol]
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency: updateCurrency, toggleCurrency, formatAmount, convertAmount, symbol }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
