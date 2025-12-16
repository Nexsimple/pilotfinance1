
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FinancialState, Transaction, TransactionType, Budget, Wallet as WalletType, WalletType as EnumWalletType, Investment, Goal, ViewMode, Notification, FileSystemFileHandle, UserProfile } from './types';
import { Dashboard } from './components/Dashboard';
import { Transactions } from './components/Transactions';
import { Wallets } from './components/Wallets';
import { Investments } from './components/Investments';
import { Budgets } from './components/Budgets';
import { Goals } from './components/Goals';
import { Reports } from './components/Reports';
import { Projections } from './components/Projections';
import { Notifications } from './components/Notifications';
import { AIAssistant } from './components/AIAssistant';
import { UserProfileModal } from './components/UserProfileModal';
import { ParticleBackground } from './components/ParticleBackground';
import { geminiService } from './services/geminiService';
import { storageService } from './services/storageService';
import { marketService, MarketRates } from './services/marketService';
import { bankIntegrationService } from './services/bankIntegrationService';
import { LayoutDashboard, Wallet, CreditCard, PieChart, Sparkles, Menu, Bell, Target, Trophy, FileText, BarChart3, RefreshCw, Briefcase, User, Layers, TrendingUp, Activity, LogOut, Settings, HelpCircle, Building2, Download, ChevronUp, FileJson, Upload, Save, HardDrive, Key, X, Bitcoin, Landmark } from 'lucide-react';

type Tab = 'dashboard' | 'transactions' | 'wallets' | 'investments' | 'projections' | 'budgets' | 'goals' | 'reports';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [data, setData] = useState<FinancialState>(storageService.loadData());
  const [viewMode, setViewMode] = useState<ViewMode>('ALL');
  const [isAIHomeOpen, setIsAIHomeOpen] = useState(false);
  const [quickInsight, setQuickInsight] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [rates, setRates] = useState<MarketRates | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false); // New state for profile modal
  
  // Settings State
  const [userApiKey, setUserApiKey] = useState(localStorage.getItem('user_gemini_api_key') || '');
  const [asaasKey, setAsaasKey] = useState(localStorage.getItem('asaas_api_key') || '');
  const [stripeKey, setStripeKey] = useState(localStorage.getItem('stripe_api_key') || '');
  const [binanceKey, setBinanceKey] = useState(localStorage.getItem('binance_api_key') || '');
  
  // File System Access State
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null);

  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Main Persistence Logic
  useEffect(() => {
    // 1. Always save to LocalStorage (Instant, auto-load on refresh)
    storageService.saveData(data);

    // 2. If a local file is connected, save to it (Debounced inside service)
    if (fileHandle) {
        storageService.saveToFileSystem(fileHandle, data);
    }
  }, [data, fileHandle]);

  // Load quick insight once
  useEffect(() => {
    if (!quickInsight) {
      geminiService.generateQuickInsight(data).then(setQuickInsight);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Market Rates Loop
  useEffect(() => {
    const fetchRates = async () => {
      const newRates = await marketService.getRates();
      setRates(newRates);
    };
    fetchRates();
    const interval = setInterval(fetchRates, 30000);
    return () => clearInterval(interval);
  }, []);

  // =========================================================================
  // MOTOR DE RECORRÊNCIA V2.0 (ROBUST & GAP FILLING)
  // =========================================================================
  useEffect(() => {
    const processRecurring = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today to midnight

      let newTransactions: Transaction[] = [];
      let addedCount = 0;

      // 1. Identify Unique Recurrence Chains
      // A chain is identified by signature: Category + Wallet + Amount + Frequency + Notes
      // We gather ALL existing transaction dates for each chain to check for gaps.
      const chains = new Map<string, { baseTx: Transaction, existingDates: Set<string> }>();

      data.transactions.forEach(t => {
        if (!t.isRecurring) return;
        
        // Create a unique signature for this recurring series
        const signature = `${t.walletId}|${t.category}|${t.amount}|${t.recurrenceFrequency}|${t.notes || ''}`;
        
        if (!chains.has(signature)) {
            chains.set(signature, { baseTx: t, existingDates: new Set() });
        }
        
        // Add this specific transaction's date (YYYY-MM or YYYY for yearly) to the existing set
        const dateObj = new Date(t.date);
        const dateKey = t.recurrenceFrequency === 'YEARLY' 
            ? `${dateObj.getFullYear()}` 
            : `${dateObj.getFullYear()}-${dateObj.getMonth()}`; // e.g. "2023-5" (June)
        
        chains.get(signature)?.existingDates.add(dateKey);
        
        // Keep the oldest transaction as the "Base" to calculate from
        const currentBase = chains.get(signature)!.baseTx;
        if (new Date(t.date) < new Date(currentBase.date)) {
            chains.get(signature)!.baseTx = t;
        }
      });

      // 2. Iterate Chains and Fill Gaps
      chains.forEach(({ baseTx, existingDates }) => {
          const startDate = new Date(baseTx.date);
          const frequency = baseTx.recurrenceFrequency || 'MONTHLY';
          const endDate = baseTx.recurrenceEndDate ? new Date(baseTx.recurrenceEndDate) : null;
          
          // Start checking from the next period after the start date
          let checkDate = new Date(startDate);
          
          // Safety loop limit (5 years)
          let safety = 0;
          while (safety < 60) {
              // Increment date based on frequency
              if (frequency === 'MONTHLY') {
                  checkDate.setMonth(checkDate.getMonth() + 1);
              } else {
                  checkDate.setFullYear(checkDate.getFullYear() + 1);
              }

              // Stop if we are past today (future projections are handled by the Projections component, not real transactions)
              if (checkDate > today) break;

              // Stop if passed end date
              if (endDate && checkDate > endDate) break;

              // Generate Key for this check date
              const checkKey = frequency === 'YEARLY'
                  ? `${checkDate.getFullYear()}`
                  : `${checkDate.getFullYear()}-${checkDate.getMonth()}`;

              // If this slot is empty in the chain, CREATE IT
              if (!existingDates.has(checkKey)) {
                  newTransactions.push({
                      ...baseTx,
                      id: Math.random().toString(36).substr(2, 9),
                      date: checkDate.toISOString(),
                      isRecurring: true, // It propagates the recurrence
                      notes: baseTx.notes // Maintain notes
                  });
                  addedCount++;
                  // Add to set to prevent double adding in same loop if logic is weird
                  existingDates.add(checkKey);
              }

              safety++;
          }
      });

      if (addedCount > 0) {
        setData(prev => {
           // Update Wallet Balances
           const updatedWallets = prev.wallets.map(w => {
             const walletTxs = newTransactions.filter(t => t.walletId === w.id);
             if (walletTxs.length === 0) return w;
             const balanceChange = walletTxs.reduce((acc, t) => {
               return t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount;
             }, 0);
             return { ...w, balance: w.balance + balanceChange };
           });
           
           // Merge and sort
           const mergedTransactions = [...prev.transactions, ...newTransactions].sort((a,b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
           );

           return {
             ...prev,
             transactions: mergedTransactions,
             wallets: updatedWallets
           };
        });
        
        setNotifications(prev => [...prev, {
          id: `recur-${Date.now()}`,
          type: 'INFO',
          message: `${addedCount} recorrências passadas foram geradas.`,
          timestamp: Date.now()
        }]);
      }
    };

    // Run whenever transactions array length changes (to catch new initial creates) or on mount
    // We check length to avoid infinite loop on object reference changes, 
    // but realistically specific transaction updates should trigger this too.
    // Ideally, we debounce this.
    const timer = setTimeout(() => {
        if (data.transactions.length > 0) {
            processRecurring();
        }
    }, 1000); // 1 second debounce to let the user finish typing/adding

    return () => clearTimeout(timer);
  }, [data.transactions]); 

  // Alerts Logic
  useEffect(() => {
    const newNotes: Notification[] = [];
    data.budgets.forEach(b => {
      if (b.spent > b.limit) {
         newNotes.push({ id: `budget-${b.id}`, type: 'WARNING', message: `Alerta: Orçamento ${b.category} excedido!`, timestamp: Date.now() });
      }
    });
    if (newNotes.length > 0 && notifications.length === 0) {
         setNotifications(prev => [...prev, ...newNotes]);
    }
  }, [data.budgets, data.goals]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleGlobalSync = async () => {
    setIsSyncing(true);
    const automatedWallets = data.wallets.filter(w => w.isAutomated);
    for (const wallet of automatedWallets) {
      try {
        const { newBalance, newTransactions } = await bankIntegrationService.syncWallet(wallet);
        setData(prev => {
          const updatedWallets = prev.wallets.map(w => w.id === wallet.id ? { ...w, balance: newBalance, lastSync: new Date().toISOString() } : w);
          const updatedTxs = [...prev.transactions, ...newTransactions].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          return { ...prev, wallets: updatedWallets, transactions: updatedTxs };
        });
      } catch (e) { console.error(e); }
    }
    setIsSyncing(false);
  };

  // Enable File System Sync
  const handleConnectLocalFile = async () => {
      if (!('showSaveFilePicker' in window)) {
          alert('Seu navegador não suporta a API de Acesso ao Sistema de Arquivos (Use Chrome ou Edge).');
          return;
      }
      try {
          // @ts-ignore
          const handle = await window.showSaveFilePicker({
              suggestedName: 'financepilot_data.json',
              types: [{
                  description: 'JSON Files',
                  accept: { 'application/json': ['.json'] },
              }],
          });
          setFileHandle(handle);
          // Initial save to confirm connection
          storageService.saveToFileSystem(handle, data);
          setNotifications(prev => [...prev, { id: 'fs-connect', type: 'SUCCESS', message: 'Sincronização com arquivo local ativa!', timestamp: Date.now() }]);
          setIsExportOpen(false);
      } catch (err) {
          console.error(err);
      }
  };

  // Export Handlers
  const handleExportCSV = () => {
    const headers = ['Data', 'Tipo', 'Categoria', 'Natureza', 'Cliente', 'Valor', 'Moeda', 'Carteira', 'Recorrencia', 'Notas'];
    const rows = data.transactions.map(t => [
      new Date(t.date).toLocaleDateString('pt-BR'),
      t.type,
      t.category,
      t.nature || 'Padrão',
      t.clientName || '-',
      t.amount.toString().replace('.', ','),
      t.currency || 'BRL',
      data.wallets.find(w => w.id === t.walletId)?.name || 'N/A',
      t.isRecurring ? (t.recurrenceFrequency === 'YEARLY' ? 'Anual' : 'Mensal') : 'Não',
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);
    
    // Add BOM for Excel compatibility with UTF-8
    const csvContent = "\uFEFF" + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `financepilot_relatorio_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    setIsExportOpen(false);
  };

  const handleExportJSON = () => {
     const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.href = url;
     link.download = `financepilot_backup_${new Date().toISOString().slice(0,10)}.json`;
     link.click();
     setIsExportOpen(false);
  };

  // Import Handler
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);
            if (storageService.validateImport(json)) {
                setData(json);
                setNotifications(prev => [...prev, {
                    id: `import-${Date.now()}`,
                    type: 'SUCCESS',
                    message: 'Dados importados e restaurados com sucesso!',
                    timestamp: Date.now()
                }]);
            } else {
                alert('Arquivo de backup inválido ou corrompido.');
            }
        } catch (error) {
            console.error(error);
            alert('Erro ao ler arquivo. Certifique-se de que é um JSON válido.');
        }
        setIsExportOpen(false);
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again if needed
    e.target.value = '';
  };

  const saveSettings = () => {
      localStorage.setItem('user_gemini_api_key', userApiKey);
      localStorage.setItem('asaas_api_key', asaasKey);
      localStorage.setItem('stripe_api_key', stripeKey);
      localStorage.setItem('binance_api_key', binanceKey);
      
      geminiService.updateApiKey(userApiKey);
      setIsSettingsOpen(false);
      setNotifications(prev => [...prev, { id: 'settings', type: 'SUCCESS', message: 'Configurações de integração salvas!', timestamp: Date.now() }]);
  };

  const saveUserProfile = (newProfile: UserProfile) => {
    setData(prev => ({ ...prev, userProfile: newProfile }));
    setNotifications(prev => [...prev, { id: `profile-${Date.now()}`, type: 'SUCCESS', message: 'Perfil estratégico atualizado!', timestamp: Date.now() }]);
  };

  // Helper for Theme Colors
  const getThemeClass = () => {
      switch(viewMode) {
          case 'BUSINESS': return 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)]';
          case 'BUSINESS2': return 'border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]';
          case 'BUSINESS3': return 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
          default: return 'border-neon shadow-[0_0_15px_rgba(0,255,157,0.3)]';
      }
  };

  const getThemeText = () => {
      switch(viewMode) {
          case 'BUSINESS': return 'text-pink-500';
          case 'BUSINESS2': return 'text-purple-500';
          case 'BUSINESS3': return 'text-blue-500';
          default: return 'text-neon';
      }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-neon/30 selection:text-neon flex">
      <ParticleBackground />
      <Notifications notifications={notifications} onRemove={removeNotification} />
      
      {/* Sidebar Navigation */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-[#0E0E10] border-r border-zinc-900 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 flex flex-col`}>
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded border bg-[#050505] transition-all duration-500 ${getThemeClass()}`}>
              <Activity className={getThemeText()} size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold font-tech tracking-wider text-white">FINANCE</h1>
              <p className={`text-[10px] font-bold tracking-[0.2em] ${getThemeText()}`}>PILOT</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-zinc-500"><X /></button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'reports', label: 'Relatórios', icon: FileText },
            { id: 'transactions', label: 'Transações', icon: CreditCard },
            { id: 'budgets', label: 'Orçamentos', icon: PieChart },
            { id: 'goals', label: 'Metas', icon: Trophy },
            { id: 'wallets', label: 'Carteiras', icon: Wallet },
            { id: 'investments', label: 'Investimentos', icon: TrendingUp },
            { id: 'projections', label: 'Projeções', icon: BarChart3 },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as Tab); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all duration-200 group ${
                activeTab === item.id 
                  ? `bg-zinc-900 text-white border-l-2 ${viewMode === 'BUSINESS' ? 'border-pink-500' : viewMode === 'BUSINESS2' ? 'border-purple-500' : viewMode === 'BUSINESS3' ? 'border-blue-500' : 'border-neon'}` 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'
              }`}
            >
              <item.icon size={18} className={`transition-colors ${activeTab === item.id ? (viewMode === 'BUSINESS' ? 'text-pink-500' : viewMode === 'BUSINESS2' ? 'text-purple-500' : viewMode === 'BUSINESS3' ? 'text-blue-500' : 'text-neon') : 'text-zinc-600 group-hover:text-zinc-400'}`} />
              <span className="uppercase tracking-wide">{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-zinc-900">
           {/* System Data Actions */}
           <div className="relative">
              <button 
                onClick={() => setIsExportOpen(!isExportOpen)}
                className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-all mb-2"
              >
                 <div className="flex items-center gap-2"><HardDrive size={14} /> Dados do Sistema</div>
                 <ChevronUp size={14} className={`transition-transform ${isExportOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isExportOpen && (
                  <div className="absolute bottom-full left-0 w-full bg-[#0E0E10] border border-zinc-800 rounded-lg shadow-xl p-2 mb-2 space-y-1 animate-in slide-in-from-bottom-2 z-50">
                      <button onClick={handleConnectLocalFile} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-neon hover:bg-zinc-900 rounded text-left">
                          <HardDrive size={14} /> {fileHandle ? 'Sincronizado (Local)' : 'Conectar Arquivo Local'}
                      </button>
                      <button onClick={handleExportJSON} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded text-left">
                          <Download size={14} /> Backup JSON
                      </button>
                      <button onClick={handleExportCSV} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded text-left">
                          <FileText size={14} /> Exportar CSV
                      </button>
                      <label className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded text-left cursor-pointer">
                          <Upload size={14} /> Importar Backup
                          <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" ref={fileInputRef} />
                      </label>
                  </div>
              )}
           </div>

           <div className="text-[10px] text-center text-zinc-600 font-mono">v1.4.0 • {fileHandle ? 'Synced' : 'Local'}</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-20 border-b border-zinc-900 bg-[#050505]/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 relative z-30">
          <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden text-white"><Menu /></button>
          
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-white font-tech uppercase tracking-wide">
               {viewMode === 'ALL' ? 'CENTRO DE COMANDO' : 
                viewMode === 'BUSINESS' ? 'ESTÚDIO ACE' : 
                viewMode === 'BUSINESS2' ? "ATOM'S" : 
                viewMode === 'BUSINESS3' ? 'KETOÉ' : 'PESSOAL'}
            </h2>
            <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
               {viewMode !== 'ALL' && <span className={`w-2 h-2 rounded-full ${viewMode === 'BUSINESS' ? 'bg-pink-500' : viewMode === 'BUSINESS2' ? 'bg-purple-500' : viewMode === 'BUSINESS3' ? 'bg-blue-500' : 'bg-neon'}`}></span>}
               VISÃO TOTAL DO SISTEMA
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Context Switcher */}
            <div className="hidden lg:flex bg-[#0E0E10] border border-zinc-800 rounded p-1">
               <button onClick={() => setViewMode('ALL')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'ALL' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Layers size={14} className="inline mr-1"/> Global</button>
               <button onClick={() => setViewMode('PERSONAL')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'PERSONAL' ? 'bg-neon/10 text-neon' : 'text-zinc-500 hover:text-zinc-300'}`}><User size={14} className="inline mr-1"/> Pessoal</button>
               <button onClick={() => setViewMode('BUSINESS')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'BUSINESS' ? 'bg-pink-500/10 text-pink-500' : 'text-zinc-500 hover:text-zinc-300'}`}><Briefcase size={14} className="inline mr-1"/> Estúdio Ace</button>
               <button onClick={() => setViewMode('BUSINESS2')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'BUSINESS2' ? 'bg-purple-500/10 text-purple-500' : 'text-zinc-500 hover:text-zinc-300'}`}><Building2 size={14} className="inline mr-1"/> Atom's</button>
               <button onClick={() => setViewMode('BUSINESS3')} className={`px-4 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'BUSINESS3' ? 'bg-blue-500/10 text-blue-500' : 'text-zinc-500 hover:text-zinc-300'}`}><Building2 size={14} className="inline mr-1"/> KETOÉ</button>
            </div>

            <button onClick={handleGlobalSync} disabled={isSyncing} className={`p-2 text-zinc-500 hover:text-white transition-colors ${isSyncing ? 'animate-spin text-neon' : ''}`} title="Sincronizar Bancos">
               <RefreshCw size={20} />
            </button>

            {/* Quick Ticker */}
            {rates && (
                <div className="hidden xl:flex items-center gap-4 px-4 py-2 bg-[#0E0E10] border border-zinc-800 rounded-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-500">USD</span>
                        <span className="text-xs font-mono text-white">R$ {rates.USD.toFixed(2)}</span>
                    </div>
                    <div className="w-px h-3 bg-zinc-800"></div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-orange-500">BTC</span>
                        <span className="text-xs font-mono text-white">R$ {rates.BTC.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    </div>
                </div>
            )}
            
            <button className="relative p-2 text-zinc-500 hover:text-white transition-colors">
              <Bell size={20} />
              {notifications.length > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
            </button>

            {/* Profile Dropdown */}
            <div className="relative">
                <button onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} className="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden hover:border-neon/50 transition-colors">
                    <img src="https://i.pravatar.cc/150?img=11" alt="Profile" className="w-full h-full object-cover opacity-80 hover:opacity-100" />
                </button>
                
                {isProfileMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-[#0E0E10] border border-zinc-800 rounded-lg shadow-2xl p-2 animate-in fade-in slide-in-from-top-2 z-50">
                        <div className="px-3 py-3 border-b border-zinc-900 mb-2">
                            <p className="text-sm font-bold text-white">Administrador</p>
                            <p className="text-[10px] text-zinc-500">admin@financepilot.com</p>
                        </div>
                        <button onClick={() => { setIsUserProfileOpen(true); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded text-left transition-colors">
                            <User size={14} /> Meu Perfil
                        </button>
                        <button onClick={() => { setIsSettingsOpen(true); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded text-left transition-colors">
                            <Settings size={14} /> Configurações
                        </button>
                        <button onClick={() => { setIsAIHomeOpen(true); setIsProfileMenuOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-900 rounded text-left transition-colors">
                            <HelpCircle size={14} /> Ajuda & Suporte
                        </button>
                        <div className="h-px bg-zinc-900 my-2"></div>
                        <button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-500/10 rounded text-left transition-colors">
                            <LogOut size={14} /> Sair do Sistema
                        </button>
                    </div>
                )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
           {/* Quick AI Insight Bar */}
           {quickInsight && (
               <div className="px-6 py-2 bg-gradient-to-r from-zinc-900 to-black border-b border-zinc-900 flex items-center justify-between">
                   <div className="flex items-center gap-3">
                       <Sparkles size={14} className="text-neon" />
                       <p className="text-xs text-zinc-300 font-mono typing-effect">{quickInsight}</p>
                   </div>
                   <button onClick={() => setIsAIHomeOpen(true)} className="text-[10px] uppercase font-bold text-neon hover:underline">Consultar IA</button>
               </div>
           )}

           {activeTab === 'dashboard' && <Dashboard data={data} rates={rates} viewMode={viewMode} />}
           {activeTab === 'transactions' && <Transactions data={data} viewMode={viewMode} onAddTransaction={(t) => { setData(prev => ({ ...prev, transactions: [ ...prev.transactions, { ...t, id: Math.random().toString(36).substr(2, 9) } ] })); }} onUpdateTransaction={(t) => { setData(prev => ({ ...prev, transactions: prev.transactions.map(curr => curr.id === t.id ? t : curr) })); }} onDeleteTransaction={(id) => { setData(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) })); }} />}
           {activeTab === 'wallets' && <Wallets data={data} rates={rates} viewMode={viewMode} onAddWallet={(w, txs) => { setData(prev => ({ ...prev, wallets: [...prev.wallets, w], transactions: txs ? [...prev.transactions, ...txs] : prev.transactions })); }} onUpdateWallet={(w) => setData(prev => ({ ...prev, wallets: prev.wallets.map(curr => curr.id === w.id ? w : curr) }))} onDeleteWallet={(id) => setData(prev => ({ ...prev, wallets: prev.wallets.filter(w => w.id !== id), transactions: prev.transactions.filter(t => t.walletId !== id) }))} />}
           {activeTab === 'investments' && <Investments data={data} rates={rates} viewMode={viewMode} onAddInvestment={(i) => setData(prev => ({ ...prev, investments: [...prev.investments, { ...i, id: Math.random().toString(36).substr(2, 9) }] }))} onUpdateInvestment={(i) => setData(prev => ({ ...prev, investments: prev.investments.map(curr => curr.id === i.id ? i : curr) }))} />}
           {activeTab === 'budgets' && <Budgets data={data} viewMode={viewMode} onAddBudget={(b) => setData(prev => ({ ...prev, budgets: [...prev.budgets, { ...b, id: Math.random().toString(36).substr(2, 9), spent: 0 }] }))} onUpdateBudget={(b) => setData(prev => ({ ...prev, budgets: prev.budgets.map(curr => curr.id === b.id ? b : curr) }))} onDeleteBudget={(id) => setData(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.id !== id) }))} />}
           {activeTab === 'goals' && <Goals data={data} viewMode={viewMode} onAddGoal={(g) => setData(prev => ({ ...prev, goals: [...prev.goals, { ...g, id: Math.random().toString(36).substr(2, 9) }] }))} onUpdateGoal={(g) => setData(prev => ({ ...prev, goals: prev.goals.map(curr => curr.id === g.id ? g : curr) }))} onDeleteGoal={(id) => setData(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }))} />}
           {activeTab === 'reports' && <Reports data={data} rates={rates} viewMode={viewMode} />}
           {activeTab === 'projections' && <Projections data={data} />}
        </div>
      </main>

      {/* Floating AI Button */}
      {!isAIHomeOpen && (
        <button 
          onClick={() => setIsAIHomeOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-neon text-black rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(0,255,157,0.4)] hover:scale-110 transition-transform z-50 group"
        >
          <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
        </button>
      )}

      {/* AI Assistant Sidebar */}
      <AIAssistant data={data} isOpen={isAIHomeOpen} onClose={() => setIsAIHomeOpen(false)} />

      {/* User Profile Modal (New) */}
      {isUserProfileOpen && (
        <UserProfileModal 
          profile={data.userProfile} 
          onSave={saveUserProfile} 
          onClose={() => setIsUserProfileOpen(false)} 
        />
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-[#0E0E10] border border-zinc-800 rounded w-full max-w-md p-6 shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-white font-tech uppercase">Configurações e Integrações</h3>
                      <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-500 hover:text-white"><X size={20} /></button>
                  </div>

                  <div className="space-y-6">
                      {/* Gemini API */}
                      <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block flex items-center gap-1"><Sparkles size={10} className="text-neon"/> Gemini API Key</label>
                          <div className="relative">
                              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                              <input 
                                  type="password" 
                                  value={userApiKey} 
                                  onChange={(e) => setUserApiKey(e.target.value)} 
                                  className="w-full p-3 pl-9 bg-[#050505] border border-zinc-800 rounded text-white text-xs outline-none focus:border-neon/50" 
                                  placeholder="Chave do Google AI Studio"
                              />
                          </div>
                      </div>

                      {/* Asaas API */}
                      <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block flex items-center gap-1"><Landmark size={10} className="text-blue-500"/> Asaas API Key</label>
                          <div className="relative">
                              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                              <input 
                                  type="password" 
                                  value={asaasKey} 
                                  onChange={(e) => setAsaasKey(e.target.value)} 
                                  className="w-full p-3 pl-9 bg-[#050505] border border-zinc-800 rounded text-white text-xs outline-none focus:border-blue-500/50" 
                                  placeholder="Chave de API do Asaas (Produção)"
                              />
                          </div>
                      </div>

                      {/* Stripe API */}
                      <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block flex items-center gap-1"><CreditCard size={10} className="text-purple-500"/> Stripe Secret Key</label>
                          <div className="relative">
                              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                              <input 
                                  type="password" 
                                  value={stripeKey} 
                                  onChange={(e) => setStripeKey(e.target.value)} 
                                  className="w-full p-3 pl-9 bg-[#050505] border border-zinc-800 rounded text-white text-xs outline-none focus:border-purple-500/50" 
                                  placeholder="sk_live_..."
                              />
                          </div>
                      </div>

                      {/* Binance API */}
                      <div>
                          <label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block flex items-center gap-1"><Bitcoin size={10} className="text-orange-500"/> Binance API Key</label>
                          <div className="relative">
                              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                              <input 
                                  type="password" 
                                  value={binanceKey} 
                                  onChange={(e) => setBinanceKey(e.target.value)} 
                                  className="w-full p-3 pl-9 bg-[#050505] border border-zinc-800 rounded text-white text-xs outline-none focus:border-orange-500/50" 
                                  placeholder="Chave de Leitura Binance"
                              />
                          </div>
                      </div>

                      <div className="pt-4 border-t border-zinc-800 flex gap-3">
                          <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-3 text-zinc-500 hover:text-white text-xs font-bold uppercase">Cancelar</button>
                          <button onClick={saveSettings} className="flex-1 py-3 bg-neon text-black font-bold uppercase rounded hover:bg-emerald-400">Salvar Tudo</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default App;
