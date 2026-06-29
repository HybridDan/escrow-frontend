"use client";
import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { useToast } from "./ToastContext";

const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const STORAGE_KEY = "milesto_wallet_connected";

interface FreighterSignResult {
  signedTxXdr?: string;
}

interface FreighterApi {
  requestAccess: () => Promise<void>;
  getPublicKey: () => Promise<string>;
  getNetwork: () => Promise<string>;
  signTransaction: (
    xdr: string,
    options: { networkPassphrase: string }
  ) => Promise<FreighterSignResult | string>;
}

interface WalletContextType {
  address: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  isConnecting: boolean;
  networkMismatch: boolean;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  connect: async () => {},
  disconnect: () => {},
  isConnecting: false,
  networkMismatch: false,
  signTransaction: async () => "",
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [networkMismatch, setNetworkMismatch] = useState(false);
  const { showToast } = useToast();

  const checkNetwork = useCallback(async (freighter: FreighterApi) => {
    try {
      const walletNetwork = await freighter.getNetwork();
      setNetworkMismatch(walletNetwork !== NETWORK_PASSPHRASE);
    } catch (e) {
      console.error("Failed to check network", e);
      setNetworkMismatch(false);
    }
  }, []);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    try {
      const freighter = (window as Window & { freighter?: FreighterApi }).freighter;
      if (!freighter) {
        showToast("Please install the Freighter wallet extension.", "error");
        return;
      }
      await freighter.requestAccess();
      const addr = await freighter.getPublicKey();
      await checkNetwork(freighter);
      setAddress(addr);
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (e) {
      console.error("Wallet connection failed", e);
      showToast("Failed to connect wallet.", "error");
    } finally {
      setIsConnecting(false);
    }
  }, [showToast, checkNetwork]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setNetworkMismatch(false);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const signTransaction = useCallback(async (xdr: string): Promise<string> => {
    const freighter = (window as Window & { freighter?: FreighterApi }).freighter;
    if (!freighter) throw new Error("Freighter not found");
    const result = await freighter.signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    return typeof result === "string" ? result : (result.signedTxXdr ?? "");
  }, []);

  useEffect(() => {
    const restoreConnection = async () => {
      const wasConnected = localStorage.getItem(STORAGE_KEY);
      if (wasConnected === "true") {
        const freighter = (window as Window & { freighter?: FreighterApi }).freighter;
        if (freighter) {
          try {
            const addr = await freighter.getPublicKey();
            await checkNetwork(freighter);
            setAddress(addr);
          } catch (e) {
            console.error("Failed to restore wallet connection", e);
            localStorage.removeItem(STORAGE_KEY);
          }
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    };

    restoreConnection();
  }, [checkNetwork]);

  return (
    <WalletContext.Provider value={{ address, connect, disconnect, isConnecting, networkMismatch, signTransaction }}>
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
