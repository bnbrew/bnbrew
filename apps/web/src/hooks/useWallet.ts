'use client';

import { useState, useEffect, useCallback } from 'react';

const OPBNB_TESTNET = {
  chainId: '0x15EB',
  chainName: 'opBNB Testnet',
  nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
  rpcUrls: ['https://opbnb-testnet-rpc.bnbchain.org'],
  blockExplorerUrls: ['https://opbnb-testnet.bscscan.com'],
};

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chainId: number | null;
  isCorrectChain: boolean;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chainId: null,
    isCorrectChain: false,
  });

  const checkConnection = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as unknown as string;
        const chainId = parseInt(chainIdHex, 16);

        setState({
          isConnected: true,
          address: accounts[0],
          chainId,
          isCorrectChain: chainId === 5611,
        });
      }
    } catch {
      // Silently fail on check
    }
  }, []);

  useEffect(() => {
    checkConnection();

    if (typeof window.ethereum === 'undefined') return;

    const handleAccountsChanged = (accounts: unknown) => {
      const accts = accounts as string[];
      if (accts.length === 0) {
        setState({ isConnected: false, address: null, chainId: null, isCorrectChain: false });
      } else {
        setState((prev) => ({ ...prev, isConnected: true, address: accts[0] }));
      }
    };

    const handleChainChanged = (chainIdHex: unknown) => {
      const chainId = parseInt(chainIdHex as string, 16);
      setState((prev) => ({ ...prev, chainId, isCorrectChain: chainId === 5611 }));
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [checkConnection]);

  const connect = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('No wallet detected');
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as unknown as string;
    const chainId = parseInt(chainIdHex, 16);

    setState({
      isConnected: true,
      address: accounts[0],
      chainId,
      isCorrectChain: chainId === 5611,
    });

    return accounts[0];
  }, []);

  const switchToOpBNB = useCallback(async () => {
    if (typeof window.ethereum === 'undefined') return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: OPBNB_TESTNET.chainId }],
      });
    } catch (error: unknown) {
      const switchError = error as { code: number };
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [OPBNB_TESTNET],
        });
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ isConnected: false, address: null, chainId: null, isCorrectChain: false });
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    switchToOpBNB,
  };
}
