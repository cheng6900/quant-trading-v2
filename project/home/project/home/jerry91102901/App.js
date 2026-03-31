import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  PlusCircle,
  Trash2,
  BarChart3,
  LogOut,
  Activity,
  AlertCircle,
} from "lucide-react";

// --- Firebase 核心導入 ---
import { initializeApp } from "firebase/app";
// 尋找原本這段，並把它換成下面這樣
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup, // 確保這行有 GoogleAuthProvider 和 signInWithPopup
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";

// ========================================================
// 1. Firebase 配置 (請在此處貼上你從 Firebase Console 取得的代碼)
// ========================================================
const firebaseConfig = {
  apiKey: "AIzaSyAvnOPdY-Z3ohfbSXmSemR_f2fJUhbONak",
  authDomain: "tradelite-55db5.firebaseapp.com",
  projectId: "tradelite-55db5",
  storageBucket: "tradelite-55db5.firebasestorage.app",
  messagingSenderId: "309789811325",
  appId: "1:309789811325:web:cf4148551154a84bec4714",
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID_PATH = "trading-quant-stable-v1"; // 資料庫根目錄名稱
// 直接在 JS 中定義強制樣式
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.innerHTML = `
    body, #root, .App { 
      background-color: #0f1115 !important; 
    }
    input { 
      background-color: #1a1d24 !important; 
      color: white !important; 
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }
    /* 修正 Chrome 自動填充的黃色/白色底色 */
    input:-webkit-autofill {
      -webkit-box-shadow: 0 0 0px 1000px #1a1d24 inset !important;
      -webkit-text-fill-color: white !important;
    }
  `;
  document.head.appendChild(style);
}
export default function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // UI 狀態
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [trades, setTrades] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    symbol: "",
    entryPrice: "",
    exitPrice: "",
    quantity: "",
    date: new Date().toISOString().split("T")[0],
  });

  // 貼上這段處理 Google 登入的邏輯
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setAuthError("");
      // 這會彈出 Google 登入小視窗
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
      setAuthError("Google 登入失敗：" + err.message);
    }
  };

  // 1. 監聽登入狀態
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsInitializing(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. 監聽資料庫數據 (當用戶登入後)
  useEffect(() => {
    if (!user) {
      setTrades([]);
      return;
    }

    setDataLoading(true);
    // 指向資料庫路徑: artifacts/trading-quant-stable-v1/users/{UID}/trades
    const tradesCollection = collection(
      db,
      "artifacts",
      APP_ID_PATH,
      "users",
      user.uid,
      "trades"
    );

    const unsubscribe = onSnapshot(
      tradesCollection,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          profit:
            (Number(doc.data().exitPrice) - Number(doc.data().entryPrice)) *
            Number(doc.data().quantity),
        }));
        // 按日期排序
        setTrades(data.sort((a, b) => new Date(a.date) - new Date(b.date)));
        setDataLoading(false);
      },
      (error) => {
        console.error("Firestore Error:", error);
        setDataLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- 驗證邏輯 ---
  const handleAuthAction = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (authMode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleQuickLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (err) {
      setAuthError("匿名登入失敗，請確認 Firebase 後台已開啟匿名驗證。");
    }
  };

  // --- 交易操作 ---
  const saveTrade = async (e) => {
    e.preventDefault();
    if (!user) return;
    try {
      const tradesCollection = collection(
        db,
        "artifacts",
        APP_ID_PATH,
        "users",
        user.uid,
        "trades"
      );
      await addDoc(tradesCollection, {
        symbol: formData.symbol.toUpperCase(),
        entryPrice: parseFloat(formData.entryPrice),
        exitPrice: parseFloat(formData.exitPrice),
        quantity: parseFloat(formData.quantity),
        date: formData.date,
        createdAt: Date.now(),
      });
      setShowModal(false);
      setFormData({
        ...formData,
        symbol: "",
        entryPrice: "",
        exitPrice: "",
        quantity: "",
      });
    } catch (err) {
      alert("儲存失敗: " + err.message);
    }
  };

  const deleteTrade = async (id) => {
    if (!window.confirm("確定要刪除此筆交易嗎？")) return;
    try {
      await deleteDoc(
        doc(db, "artifacts", APP_ID_PATH, "users", user.uid, "trades", id)
      );
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // --- 計算統計數據 ---
  const stats = useMemo(() => {
    if (!trades.length)
      return {
        totalProfit: 0,
        winRate: 0,
        pf: 0,
        avgWin: 0,
        avgLoss: 0,
        count: 0,
        chartData: [],
      };
    const wins = trades.filter((t) => t.profit > 0);
    const losses = trades.filter((t) => t.profit < 0);
    const totalProfit = trades.reduce((sum, t) => sum + t.profit, 0);
    const grossProfit = wins.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));

    let cumulative = 0;
    return {
      totalProfit,
      winRate: (wins.length / trades.length) * 100,
      pf:
        grossLoss === 0 ? (grossProfit > 0 ? 99 : 0) : grossProfit / grossLoss,
      count: trades.length,
      avgWin: wins.length ? grossProfit / wins.length : 0,
      avgLoss: losses.length ? grossLoss / losses.length : 0,
      chartData: trades.map((t) => ({
        date: t.date,
        balance: (cumulative += t.profit),
      })),
    };
  }, [trades]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex flex-col items-center justify-center gap-4 text-blue-500">
        <Activity className="animate-spin w-10 h-10" />
        <p className="text-xs tracking-widest uppercase text-slate-500">
          系統初始化中...
        </p>
      </div>
    );
  }

  // 登入介面
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0f1115] flex items-center justify-center p-6">
        <div className="bg-[#161920] border border-white/5 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-500/10 rounded-2xl">
              <BarChart3 className="text-blue-500 w-10 h-10" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-1">
            量化交易系統
          </h2>
          <p className="text-slate-500 text-center text-sm mb-8">
            專為交易者設計的績效分析工具
          </p>

          {authError && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle size={14} /> {authError}
            </div>
          )}

          <div className="flex p-1 bg-black/30 rounded-xl mb-6 border border-white/5">
            <button
              onClick={() => setAuthMode("login")}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                authMode === "login"
                  ? "bg-white/10 text-white"
                  : "text-slate-500"
              }`}
            >
              登入
            </button>
            <button
              onClick={() => setAuthMode("register")}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                authMode === "register"
                  ? "bg-white/10 text-white"
                  : "text-slate-500"
              }`}
            >
              註冊
            </button>
          </div>

          <form onSubmit={handleAuthAction} className="space-y-4 mb-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">
                Email
              </label>
              <input
                required
                type="email"
                className="input-style"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">
                Password
              </label>
              <input
                required
                type="password"
                className="input-style"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl transition"
            >
              進入系統
            </button>
          </form>

          <div className="text-center">
            {/* 尋找原本的匿名登入按鈕，替換成下方代碼 */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-100 transition-all mb-4 shadow-lg"
            >
              <img
                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                className="w-5 h-5"
                alt="Google Logo"
              />
              使用 Google 帳號登入
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 主儀表板
  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-200">
      <header className="border-b border-white/5 bg-[#161920]/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
            <BarChart3 className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">
              Performance Quant 量化交易系統
            </h1>
            <span className="text-[10px] text-blue-400 font-mono hidden sm:block">
              CONNECTED TO FIREBASE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* 新增：Google 使用者名稱與頭像 */}
          <div className="flex items-center gap-3 pr-2 border-r border-white/10 hidden md:flex">
            <div className="text-right">
              <p className="text-xs font-bold text-white leading-none">
                {user.displayName || "交易員"}
              </p>
              <p className="text-[10px] text-slate-500 leading-none mt-1">
                {user.email}
              </p>
            </div>
            <img
              src={user.photoURL || "https://via.placeholder.com/32"}
              className="w-8 h-8 rounded-full border border-white/10"
              alt="Avatar"
            />
          </div>

          <button
            onClick={() => signOut(auth)}
            className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all"
            title="登出"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {/* KPI 卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPIBox
            title="總損益"
            value={`$${Math.round(stats.totalProfit).toLocaleString()}`}
            trend={stats.totalProfit >= 0 ? 1 : -1}
          />
          <KPIBox
            title="勝率"
            value={`${stats.winRate.toFixed(1)}%`}
            trend={stats.winRate >= 50 ? 1 : 0}
          />
          <KPIBox
            title="獲利因子"
            value={stats.pf.toFixed(2)}
            trend={stats.pf >= 1.5 ? 1 : -1}
          />
          <KPIBox title="總筆數" value={stats.count} trend={0} />
        </div>

        {/* 圖表與操作 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#161920] rounded-3xl p-6 border border-white/5 h-[400px]">
            <h3 className="text-xs font-bold text-slate-500 mb-8 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-400" /> 資產曲線
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#2a2e37"
                    vertical={false}
                  />
                  <XAxis dataKey="date" stroke="#4a5568" fontSize={11} />
                  <YAxis stroke="#4a5568" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1d24",
                      border: "none",
                      borderRadius: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: "#3b82f6", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setShowModal(true)}
              className="w-full h-32 bg-blue-600 hover:bg-blue-500 rounded-3xl flex flex-col items-center justify-center gap-2 transition shadow-xl shadow-blue-600/20 active:scale-95"
            >
              <PlusCircle size={32} className="text-white" />
              <span className="font-bold text-white">新增交易紀錄</span>
            </button>
            <div className="bg-[#161920] rounded-3xl p-6 border border-white/5 space-y-4">
              <DetailRow
                label="平均獲利"
                value={`+$${Math.round(stats.avgWin)}`}
                color="text-emerald-400"
              />
              <DetailRow
                label="平均虧損"
                value={`-$${Math.round(stats.avgLoss)}`}
                color="text-rose-400"
              />
              <div className="h-px bg-white/5"></div>
              <DetailRow
                label="賺賠比"
                value={(stats.avgLoss
                  ? stats.avgWin / stats.avgLoss
                  : 0
                ).toFixed(2)}
                color="text-blue-400"
              />
            </div>
          </div>
        </div>

        {/* 表格 */}
        <div className="bg-[#161920] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-black/10">
            <h3 className="font-bold text-xs tracking-wider uppercase text-slate-400">
              歷史交易明細
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase tracking-widest bg-white/[0.02]">
                  <th className="px-8 py-4">日期</th>
                  <th className="px-8 py-4">代碼</th>
                  <th className="px-8 py-4 text-right">損益</th>
                  <th className="px-8 py-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {trades.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.03] transition">
                    <td className="px-8 py-4 text-xs font-mono text-slate-500">
                      {t.date}
                    </td>
                    <td className="px-8 py-4 font-bold text-white">
                      {t.symbol}
                    </td>
                    <td
                      className={`px-8 py-4 text-right font-mono font-bold ${
                        t.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {t.profit >= 0 ? "+" : ""}
                      {Math.round(t.profit).toLocaleString()}
                    </td>
                    <td className="px-8 py-4 text-center">
                      <button
                        onClick={() => deleteTrade(t.id)}
                        className="text-slate-700 hover:text-rose-500 transition p-2"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* 新增視窗 (Modal) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-[#1a1d24] border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-6 text-white text-center">
              新增交易紀錄
            </h3>
            <form onSubmit={saveTrade} className="space-y-4">
              <InputGroup label="標的代碼">
                <input
                  required
                  className="input-style uppercase"
                  value={formData.symbol}
                  onChange={(e) =>
                    setFormData({ ...formData, symbol: e.target.value })
                  }
                  placeholder="例如: 2330"
                />
              </InputGroup>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="進場價">
                  <input
                    required
                    type="number"
                    step="any"
                    className="input-style"
                    value={formData.entryPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, entryPrice: e.target.value })
                    }
                  />
                </InputGroup>
                <InputGroup label="出場價">
                  <input
                    required
                    type="number"
                    step="any"
                    className="input-style"
                    value={formData.exitPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, exitPrice: e.target.value })
                    }
                  />
                </InputGroup>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="數量">
                  <input
                    required
                    type="number"
                    className="input-style"
                    value={formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: e.target.value })
                    }
                  />
                </InputGroup>
                <InputGroup label="日期">
                  <input
                    required
                    type="date"
                    className="input-style"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </InputGroup>
              </div>
              <div className="flex gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 font-bold text-slate-500"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-[2] bg-blue-600 py-4 rounded-2xl font-bold text-white shadow-lg active:scale-95 transition"
                >
                  確認新增
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 內嵌樣式 */}
      <style>{`
       .input-style {
        width: 100%; 
        background-color: #1a1d24 !important; /* 強制深色背景 */
        border: 1px solid rgba(255, 255, 255, 0.1); 
        border-radius: 1rem; 
        padding: 0.8rem 1rem; 
        color: white !important; /* 強制文字白色 */
        font-size: 16px;
      }
      
      /* 解決瀏覽器自動填充時變白的問題 */
      input:-webkit-autofill,
      input:-webkit-autofill:hover, 
      input:-webkit-autofill:focus {
        -webkit-text-fill-color: white !important;
        -webkit-box-shadow: 0 0 0px 1000px #1a1d24 inset !important;
        transition: background-color 5000s ease-in-out 0s;
      }
      `}</style>
    </div>
  );
}

// 輔助組件
function KPIBox({ title, value, trend }) {
  const colorClass =
    trend > 0 ? "text-emerald-400" : trend < 0 ? "text-rose-400" : "text-white";
  return (
    <div className="bg-[#161920] border border-white/5 rounded-3xl p-5 shadow-lg">
      <div className="text-slate-500 text-[10px] font-bold uppercase mb-1 tracking-widest">
        {title}
      </div>
      <div className={`text-xl font-mono font-bold ${colorClass}`}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-500 font-medium">{label}</span>
      <span className={`font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function InputGroup({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1 tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}
