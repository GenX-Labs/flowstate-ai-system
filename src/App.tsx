import React, { useState, useEffect } from 'react';
import { 
  Home, 
  PlusCircle, 
  MessageSquare, 
  PieChart, 
  Settings,
  CreditCard,
  User as UserIcon,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  LogOut,
  ChevronLeft,
  Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'react-hot-toast';
import { cn, formatCurrency } from './lib/utils';
import { Transaction, Category, PaymentMethod, UserProfile } from './types';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  setDoc,
  doc,
  getDoc,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'chat' | 'analytics'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or Create Profile
        const userRef = doc(db, 'users', u.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (!userSnap.exists()) {
            const newProfile = {
              uid: u.uid,
              email: u.email || '',
              name: u.displayName || 'User',
              balance: 0,
              monthlyBudget: 2000,
            };
            await setDoc(userRef, newProfile);
            setProfile(newProfile);
          } else {
            setProfile(userSnap.data() as UserProfile);
          }
        } catch (err) {
          console.error("Profile Error:", err);
        }
      } else {
        setProfile(null);
        setTransactions([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Transactions Listener
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ts: Transaction[] = [];
      snapshot.forEach(doc => {
        ts.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(ts);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [user]);

  const addTransaction = async (t: Omit<Transaction, 'id' | 'userId'>) => {
    if (!user) return;
    
    const path = 'transactions';
    try {
      await addDoc(collection(db, path), {
        ...t,
        userId: user.uid,
      });

      // Update local balance (Ideally done via Cloud Function or transaction in production)
      const userRef = doc(db, 'users', user.uid);
      const newBalance = (profile?.balance || 0) + t.amount;
      await setDoc(userRef, { balance: newBalance }, { merge: true });
      setProfile(prev => prev ? { ...prev, balance: newBalance } : null);

      setActiveTab('dashboard');
      toast.success('Transaction saved!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-100 p-0 sm:p-4 font-sans">
      <div className="relative w-full max-w-[420px] h-[844px] bg-slate-50 shadow-2xl rounded-[3rem] overflow-hidden border-[8px] border-slate-900">
        {/* Status Bar */}
        <div className="h-8 w-full bg-slate-920 flex justify-between items-center px-8 text-[10px] bg-slate-900 text-white z-50">
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div className="flex gap-1.5 items-center">
            <div className="w-4 h-2 bg-white rounded-full opacity-50" />
            <div className="w-2 h-2 bg-white rounded-full" />
          </div>
        </div>

        {!user ? (
          <Login />
        ) : (
          <>
            <main className="h-[calc(100%-88px)] overflow-y-auto px-5 pt-6 pb-24">
              <AnimatePresence mode="wait">
                {activeTab === 'dashboard' && <Dashboard key="dashboard" profile={profile} transactions={transactions} />}
                {activeTab === 'add' && <AddTransaction key="add" onAdd={addTransaction} onBack={() => setActiveTab('dashboard')} />}
                {activeTab === 'chat' && <ChatBot key="chat" transactions={transactions} />}
                {activeTab === 'analytics' && <Analytics key="analytics" transactions={transactions} />}
              </AnimatePresence>
            </main>

            {/* Bottom Nav */}
            <nav className="absolute bottom-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-200 h-20 flex justify-around items-center px-4 z-40">
              <NavBtn icon={<Home size={22} />} label="Home" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
              <NavBtn icon={<PieChart size={22} />} label="Data" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
              <div className="relative -top-6">
                <button 
                  onClick={() => setActiveTab('add')}
                  className="bg-brand-primary text-white p-4 rounded-full shadow-lg shadow-emerald-200 active:scale-95 transition-transform"
                >
                  <PlusCircle size={28} />
                </button>
              </div>
              <NavBtn icon={<MessageSquare size={22} />} label="AI" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
              <NavBtn icon={<LogOut size={22} />} label="Out" active={false} onClick={() => signOut(auth)} />
            </nav>
          </>
        )}

        <Toaster position="top-center" />
      </div>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("bottom-nav-item", active && "active")}>
      {icon}
      <span className="text-[10px] font-medium mt-1">{label}</span>
    </button>
  );
}

// ---------------------------------------------------------
// LOGIN COMPONENT
// ---------------------------------------------------------
function Login() {
  const handleGoogleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => {
      toast.error('Login Failed: ' + err.message);
    });
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-12 bg-white">
      <div className="flex items-center gap-2 text-brand-primary text-3xl font-extrabold tracking-tighter">
        <span className="text-4xl">◈</span> FlowState
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back</h1>
        <p className="text-slate-500 text-sm">Managing money, simplified for students.</p>
      </div>

      <div className="w-full space-y-3">
        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 border border-slate-200 p-4 rounded-2xl font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Continue with Google
        </button>
        <p className="text-[10px] text-slate-400 font-medium">By continuing, you accept our minimal terms.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// DASHBOARD COMPONENT
// ---------------------------------------------------------
interface DashboardProps {
  transactions: Transaction[];
  profile: UserProfile | null;
  key?: string;
}function Dashboard({ transactions, profile }: DashboardProps) {
  const monthlyExpenses = transactions
    .filter(t => t.amount < 0 && new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);
  
  const monthlyIncome = transactions
    .filter(t => t.amount > 0 && new Date(t.date).getMonth() === new Date().getMonth())
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-slate-400 text-[11px] font-bold uppercase tracking-widest mb-1">May 2024 Period</h2>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Overview</h1>
        </div>
        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
          <Settings size={20} />
        </div>
      </header>

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Balance</p>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(profile?.balance || 0)}</p>
          <p className="text-[10px] text-brand-primary font-bold mt-1">+12% vs last</p>
        </div>
        <div className="stat-card">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Monthly Spend</p>
          <p className="text-lg font-bold text-slate-900">{formatCurrency(monthlyExpenses)}</p>
          <p className="text-[10px] text-red-500 font-bold mt-1">70% of budget</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-sm tracking-tight">Recent Activity</h3>
          <button className="bg-brand-primary text-white text-[11px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform">+ New</button>
        </div>
        <div className="space-y-0 divide-y divide-slate-100">
          {transactions.slice(0, 5).map((t) => (
            <div key={t.id} className="flex items-center justify-between py-4 group cursor-pointer active:bg-slate-50 px-2 -mx-2 rounded-xl transition-colors">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "icon-box",
                  t.amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                )}>
                  {getCategoryEmoji(t.category)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{t.notes || t.category}</p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {new Date(t.date).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' })} • {t.category}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("font-bold text-sm", t.amount > 0 ? "text-emerald-600" : "text-slate-900")}>
                  {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
                </p>
                <div className="pill mt-0.5">{t.method === 'Online Payment' ? 'Online' : t.method}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function getCategoryEmoji(cat: Category) {
  switch(cat) {
    case 'Food': return '🍔';
    case 'Transport': return '🚗';
    case 'Shopping': return '🛍️';
    case 'Entertainment': return '🎬';
    case 'Bills': return '📄';
    case 'Income': return '💰';
    default: return '📦';
  }
}

// ---------------------------------------------------------
// ADD TRANSACTION COMPONENT
// ---------------------------------------------------------
interface AddTransactionProps {
  onAdd: (t: Omit<Transaction, 'id' | 'userId'>) => Promise<void>;
  onBack: () => void;
  key?: string;
}

function AddTransaction({ onAdd, onBack }: AddTransactionProps) {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Food');
  const [method, setMethod] = useState<PaymentMethod>('Online Payment');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount))) return;

    setIsProcessing(true);
    if (method === 'Online Payment') {
      // Simulate Payment Gateway
      await new Promise(r => setTimeout(r, 2000));
    }

    await onAdd({
      amount: -Math.abs(parseFloat(amount)),
      category,
      method,
      notes: notes || category,
      date: new Date().toISOString(),
    });
    setIsProcessing(false);
  };

  if (isProcessing) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full space-y-6 text-center">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-slate-100 rounded-full" />
          <div className="w-16 h-16 border-2 border-brand-primary border-t-transparent rounded-full animate-spin absolute top-0" />
        </div>
        <div>
          <p className="font-bold text-slate-800 text-lg mb-1">Securing Payment</p>
          <p className="text-xs text-slate-400">Please don't close the app...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm text-slate-400">
           <ChevronLeft size={20} />
        </button>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Add Expense</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6 pt-4">
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">How much?</label>
          <div className="relative group">
            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-xl group-focus-within:text-brand-primary transition-colors">RM</span>
            <input 
              type="number" 
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full bg-white border border-slate-200 rounded-2xl p-6 pl-16 text-2xl font-bold text-slate-900 focus:border-brand-primary focus:outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Type</label>
            <select 
              value={category}
              onChange={e => setCategory(e.target.value as Category)}
              className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 appearance-none focus:border-brand-primary focus:outline-none"
            >
              {['Food', 'Transport', 'Shopping', 'Entertainment', 'Bills', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">Via</label>
            <select 
              value={method}
              onChange={e => setMethod(e.target.value as PaymentMethod)}
              className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 appearance-none focus:border-brand-primary focus:outline-none"
            >
              {['Online Payment', 'Cash', 'Card'].map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">What for?</label>
          <input 
            type="text" 
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Lunch, Grab ride..."
            className="w-full bg-white border border-slate-200 rounded-2xl p-4 font-bold text-slate-700 focus:border-brand-primary focus:outline-none transition-all"
          />
        </div>

        <button 
          type="submit"
          className="w-full bg-brand-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-100 hover:bg-emerald-600 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-xs uppercase tracking-widest"
        >
          {method === 'Online Payment' ? <CreditCard size={18} /> : null}
          {method === 'Online Payment' ? 'Process Payment' : 'Save Transaction'}
        </button>
      </form>
    </motion.div>
  );
}

// ---------------------------------------------------------
// CHAT BOT COMPONENT
// ---------------------------------------------------------
interface ChatBotProps {
  transactions: Transaction[];
  key?: string;
}

function ChatBot({ transactions }: ChatBotProps) {
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string}[]>([
    { role: 'ai', text: "👋 Hi! I'm your FlowState AI. Based on your spending, I can help you save more. Ask me anything!" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    
    setIsTyping(true);
    try {
      const context = {
        total_spent: transactions.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0),
        top_categories: transactions.reduce((acc, t) => {
          if (t.amount < 0) acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
          return acc;
        }, {} as any),
        recent_activity: transactions.slice(0, 10).map(t => ({ amount: t.amount, category: t.category, date: t.date }))
      };

      const result = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            role: 'user',
            parts: [{
              text: `
                You are FlowState AI, a smart, friendly financial assistant for students and young adults. 
                Your goal is to help users manage their money, save for goals, and understand their spending habits.
                
                RULES:
                1. Be concise and actionable.
                2. Use a helpful, encouraging tone (use emojis sparingly 💸).
                3. NEVER give formal investment, legal, or high-risk financial advice.
                4. Focus on budgeting, saving tips, and identifying overspending.
                5. Use the user's transaction data (provided in context) to give personalized feedback.

                USER CONTEXT (Last 30 Days):
                ${JSON.stringify(context, null, 2)}

                USER MESSAGE:
                ${userMsg}
              `
            }]
          }
        ]
      });

      const responseText = result.text || "I couldn't generate a response. Please try again.";
      setMessages(prev => [...prev, { role: 'ai', text: responseText }]);
    } catch (err) {
      console.error("AI Skill Error:", err);
      setMessages(prev => [...prev, { role: 'ai', text: "I'm having a small technical glitch. Could you try again? 🛠️" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
      <h2 className="text-xl font-extrabold text-slate-800 mb-6 tracking-tight">AI Assistant</h2>
      
      <div className="flex-1 overflow-y-auto space-y-4 pb-6 px-1 scroll-smooth">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}>
            <div className={cn(
              "chat-bubble transition-all duration-300",
              m.role === 'user' ? "chat-user bg-slate-100 text-slate-800 rounded-br-none" : "chat-bot bg-emerald-50 text-emerald-800 rounded-bl-none"
            )}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-emerald-50 p-3 rounded-2xl rounded-bl-none flex gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>
      
      <div className="flex gap-2 pt-4 bg-slate-50">
        <input 
          value={input}
          onKeyPress={e => e.key === 'Enter' && handleSend()}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask FlowState AI..."
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        />
        <button 
          onClick={handleSend}
          className="bg-brand-primary text-white w-12 h-12 flex items-center justify-center rounded-xl shadow-md disabled:opacity-50"
          disabled={isTyping}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------
// ANALYTICS COMPONENT
// ---------------------------------------------------------
interface AnalyticsProps {
  transactions: Transaction[];
  key?: string;
}

function Analytics({ transactions }: AnalyticsProps) {
  const expenseData = transactions
    .filter(t => t.amount < 0)
    .reduce((acc, t) => {
      const existing = acc.find(item => item.name === t.category);
      if (existing) existing.value += Math.abs(t.amount);
      else acc.push({ name: t.category, value: Math.abs(t.amount) });
      return acc;
    }, [] as {name: string, value: number}[]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Spending Health</h2>
      
      <div className="mobile-card flex flex-col items-center bg-white border-2 border-slate-50 shadow-sm p-6">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Distribution by Category</p>
        <div className="w-full space-y-5">
          {expenseData.length === 0 ? (
            <div className="text-center py-12">
               <PieChart className="mx-auto mb-3 text-slate-200" size={48} />
               <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">Awaiting Data</p>
            </div>
          ) : (
            expenseData.sort((a,b) => b.value - a.value).map((item, idx) => {
              const total = expenseData.reduce((s,i) => s+i.value, 0);
              const percentage = (item.value / total) * 100;
              return (
                <div key={item.name} className="space-y-2">
                  <div className="flex justify-between text-xs font-black uppercase tracking-tight">
                    <span className="text-slate-500">{item.name}</span>
                    <span className="text-slate-900">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8, delay: idx * 0.1 }}
                      className={cn(
                        "h-full rounded-full",
                        "bg-brand-primary"
                      )}
                    />
                  </div>
                  <div className="flex justify-end">
                    <span className="text-[9px] font-black text-slate-400">{Math.round(percentage)}% of total</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="stat-card border-none bg-emerald-50/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 bg-brand-primary rounded-lg flex items-center justify-center text-white">
            <TrendingUp size={16} />
          </div>
          <p className="text-[10px] font-bold text-emerald-900 uppercase tracking-widest">Flow Insight</p>
        </div>
        <p className="text-xs text-emerald-700 font-medium leading-relaxed">
          Your spending in <span className="font-bold">Shopping</span> is lower than usual. You're on track to save RM 50 extra this month!
        </p>
      </div>
    </motion.div>
  );
}


