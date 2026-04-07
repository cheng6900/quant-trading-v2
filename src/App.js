import React, { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell, 
  Legend
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
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider,
  signInWithPopup, 
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";

// ========================================================
// 1. Firebase 配置 (請在此處貼上你從 Firebase Console 取得的代碼)
// ========================================================
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_KEY,
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
    /* 修正後的輸入框樣式 */
    .input-style {
      width: 100% !important;
      background-color: #1a1d24 !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 12px !important;
      padding: 0 16px !important; /* 移除上下 padding，改由 height 撐開 */
      color: #e2e8f0 !important;
      font-family: 'JetBrains Mono', monospace !important;
      outline: none !important;
      transition: all 0.2s ease !important;
      height: 48px !important; /* 略微增加高度更顯大氣 */
      display: block !important; /* 回歸區塊元素 */
      line-height: 48px !important; /* 讓文字垂直置中 */
    }

    /* 專門修復日期輸入框的文字偏移 */
    input[type="date"] {
      display: flex !important;
      align-items: center !important;
    }

    /* 修復 Chrome/Safari 日期文字跑到底部的問題 */
    input[type="date"]::-webkit-datetime-edit {
      padding: 0 !important;
      height: 100% !important;
      display: flex !important;
      align-items: center !important;
      line-height: 1 !important;
    }

    /* 讓日曆圖示亮一點 */
    input[type="date"]::-webkit-calendar-picker-indicator {
      filter: invert(1);
      opacity: 0.5;
      cursor: pointer;
    }

    .input-style:focus {
      border-color: #3b82f6 !important;
      box-shadow: 0 0 0 1px #3b82f6 !important;
    }
  `;
  document.head.appendChild(style);
}
export default function App() {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // 新增：手續費折數狀態 (預設 28 折)
  const [feeDiscount, setFeeDiscount] = useState(0.28);

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
    tag: "未分類" // 預設值
  });
  //分頁每頁筆數
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // 預設一頁 10 筆
  //新增搜尋狀態
  const [searchTerm, setSearchTerm] = useState("");
  //股票名稱
  const [stockMap, setStockMap] = useState({});
  // 'line' 或 'pie'
  const [chartView, setChartView] = useState('line'); 
  const updateTradeTag = (id, newTag) => {
  const updatedTrades = trades.map(t => 
    t.id === id ? { ...t, tag: newTag } : t
  );
  setTrades(updatedTrades); // 這會觸發畫面重新渲染，圓餅圖也會跟著跳動
};
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
useEffect(() => {
  const loadAllStockNames = async () => {
    try {
      // 同時讀取三個本地檔案
      const files = ['/etf.json', '/tpex.json', '/twse.json'];
      const responses = await Promise.all(files.map(f => fetch(f)));
      const jsons = await Promise.all(responses.map(r => r.json()));
      
      const map = {};
      jsons.forEach(json => {
        const list = json.data || json;
        if (Array.isArray(list)) {
          list.forEach(item => {
            const code = (item["基金代號"] || item["SecuritiesCompanyCode"] ||item["公司代號"] || "")?.toString().trim();
            const name = (item["公司簡稱"] || item["CompanyAbbreviation"] || item["基金簡稱"] || "")?.toString().trim();
            if (code && name) map[code] = name;
          });
        }
      });
      setStockMap(map);
    } catch (err) {
      console.error("載入完整股名檔失敗:", err);
    }
  };
  loadAllStockNames();
}, []);
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

    const unsubscribe = onSnapshot(tradesCollection, (snapshot) => {
      const data = snapshot.docs.map((doc) => {
        const d = doc.data();
        const entry = Number(d.entryPrice) || 0;
        const exit = Number(d.exitPrice) || 0;
        const qty = Number(d.quantity) || 0;

        // 如果資料庫沒存 costs，就在前端即時算一個大概的（0.1425%*折數 + 0.3%稅）
        const recordedCosts = Number(d.costs);
        const fallbackCosts =
          entry * qty * 0.001425 * 0.28 +
          exit * qty * 0.001425 * 0.28 +
          exit * qty * 0.003;
        const finalCosts = !isNaN(recordedCosts)
          ? recordedCosts
          : fallbackCosts;

        return {
          id: doc.id,
          ...d,
          profit: (exit - entry) * qty - finalCosts, // 確保減去成本
          costs: finalCosts,
        };
      });
      setTrades(data.sort((a, b) => new Date(a.date) - new Date(b.date)));
      setDataLoading(false);
    });
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

  // --- 編輯功能狀態 ---
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // 點擊編輯按鈕：啟動編輯模式並帶入舊資料
 const startEdit = (t) => {
  setEditingId(t.id);
  setEditFormData({ 
    ...t, 
    tag: t.tag || "未分類" 
  });
};

  // 儲存修改：重新計算損益並更新資料庫
  const saveTrade = async (e) => {
    e.preventDefault();
    try {
      const symbolText = (formData.symbol || "").toUpperCase();
      const entry = parseFloat(formData.entryPrice);
      const exit = parseFloat(formData.exitPrice);
      const qty = parseFloat(formData.quantity);

      // 計算台股成本 (手續費 + 證交稅)
      const buyFee = Math.max(
        1,
        Math.floor(entry * qty * 0.001425 * feeDiscount)
      );
      const sellFee = Math.max(
        1,
        Math.floor(exit * qty * 0.001425 * feeDiscount)
      );
      const tax = Math.floor(exit * qty * 0.003);
      const totalCost = buyFee + sellFee + tax;

      const tradesCollection = collection(
        db,
        "artifacts",
        APP_ID_PATH,
        "users",
        user.uid,
        "trades"
      );

      await addDoc(tradesCollection, {
        ...formData,
        entryPrice: entry,
        exitPrice: exit,
        quantity: qty,
        symbol: formData.symbol.toUpperCase(),
        costs: totalCost,
        createdAt: new Date().toISOString(),
      });

      setShowModal(false);
      setFormData({
        symbol: "",
        entryPrice: "",
        exitPrice: "",
        quantity: "",
        date: new Date().toISOString().split("T")[0],
        tag: FormData.tag || '未分類'
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
// 更新現有交易資料
  const handleUpdate = async (id) => {
  try {
    // 1. 取得數值並確保型別正確
    const entry = parseFloat(editFormData.entryPrice) || 0;
    const exit = parseFloat(editFormData.exitPrice) || 0;
    const qty = parseFloat(editFormData.quantity) || 0;
    const currentTag = editFormData.tag || "未分類";

    // 2. 重新計算台股成本 (手續費與稅金)
    // 註：請確保 feeDiscount 變數已在上方定義 (例如 0.28)
    const discount = typeof feeDiscount !== 'undefined' ? feeDiscount : 1; 
    const buyFee = Math.max(1, Math.floor(entry * qty * 0.001425 * discount));
    const sellFee = Math.max(1, Math.floor(exit * qty * 0.001425 * discount));
    const tax = Math.floor(exit * qty * 0.003);
    const totalCost = buyFee + sellFee + tax;

    // 3. 重新計算損益
    const profit = (exit - entry) * qty - totalCost;

    // 4. 定義 Firebase 路徑
    // 註：請確保 APP_ID_PATH 已定義
    const tradeRef = doc(
      db,
      "artifacts",
      APP_ID_PATH,
      "users",
      user.uid,
      "trades",
      id
    );

    // 5. 寫入資料庫 (包含標籤)
    await updateDoc(tradeRef, {
      symbol: (editFormData.symbol || "").toUpperCase(),
      entryPrice: entry,
      exitPrice: exit,
      quantity: qty,
      date: editFormData.date || "",
      costs: totalCost,
      profit: profit,
      tag: currentTag, // 💡 關鍵修正：必須寫入這個欄位，重新整理才不會消失
    });

    // 6. 成功後關閉編輯模式
    setEditingId(null);
    
  } catch (err) {
    console.error("Update error:", err);
    alert("更新失敗: " + err.message);
  }
};

// 1. 根據搜尋過濾資料 (支援代碼 + 名稱)
const filteredTrades = useMemo(() => {
  const s = searchTerm.toUpperCase().trim();
  if (!s) return trades;
  return trades.filter(t => {
    const code = t.symbol.toString().toUpperCase();
    const name = (stockMap[t.symbol] || "").toUpperCase();
    return code.includes(s) || name.includes(s);
  });
}, [trades, searchTerm, stockMap]);

// 2. 處理排序與分頁 (給表格用的資料)
const paginatedTrades = useMemo(() => {
  const sorted = [...filteredTrades].sort((a, b) => b.date.localeCompare(a.date));
  const startIndex = (currentPage - 1) * 10;
  return sorted.slice(startIndex, startIndex + 10);
}, [filteredTrades, currentPage]);

// 3. 重新計算總頁數 (避免搜尋後頁碼錯誤)
const totalPages = Math.ceil(filteredTrades.length / 10);
  // --- 修改統計邏輯 (stats) ---
const stats = useMemo(() => {
  // 1. 注意：這裡改用 filteredTrades，如果過濾後沒資料，回傳初始值
  if (!filteredTrades.length)
    return {
      totalProfit: 0,
      dayProfit: 0,
      monthProfit: 0,
      yearProfit: 0,
      winRate: 0,
      pf: 0,
      avgWin: 0,
      avgLoss: 0,
      count: 0,
      chartData: [],
      maxDrawdown: 0,
      expectancy: 0,
    };

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const thisMonthStr = todayStr.substring(0, 7); 
  const thisYearStr = todayStr.substring(0, 4); 

  // 🕵️ 核心修改：以下所有 trades 全部改為 filteredTrades
  const wins = filteredTrades.filter((t) => t.profit > 0);
  const losses = filteredTrades.filter((t) => t.profit < 0);

  const dayProfit = filteredTrades
    .filter((t) => t.date === todayStr)
    .reduce((s, t) => s + t.profit, 0);
  const monthProfit = filteredTrades
    .filter((t) => t.date.startsWith(thisMonthStr))
    .reduce((s, t) => s + t.profit, 0);
  const yearProfit = filteredTrades
    .filter((t) => t.date.startsWith(thisYearStr))
    .reduce((s, t) => s + t.profit, 0);
  const totalProfit = filteredTrades.reduce((sum, t) => sum + t.profit, 0);

  const grossProfit = wins.reduce((sum, t) => sum + t.profit, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));

  const winRateDec = wins.length / filteredTrades.length; // 勝率 (小數)
  const lossRateDec = losses.length / filteredTrades.length; // 敗率 (小數)
  const avgWin = wins.length ? grossProfit / wins.length : 0; 
  const avgLoss = losses.length ? (losses.reduce((sum, t) => sum + t.profit, 0) / losses.length) : 0;

  // 計算期望值：每筆交易預計能帶來的平均損益
  const expectancy = (winRateDec * avgWin) + (lossRateDec * avgLoss);
  
  let cumulative = 0;
  let peak = 0;   
  let maxDD = 0;  

  const chartData = filteredTrades.map((t) => {
    const p = Number(t.profit);
    cumulative += p;
    
    if (cumulative > peak) peak = cumulative;
    const currentDD = peak - cumulative;
    if (currentDD > maxDD) maxDD = currentDD;

    return {
      date: t.date,
      balance: cumulative,
    };
  });

  return {
    totalProfit,
    dayProfit,
    monthProfit,
    yearProfit,
    winRate: (wins.length / filteredTrades.length) * 100,
    pf: grossLoss === 0 ? (grossProfit > 0 ? 99 : 0) : grossProfit / grossLoss,
    count: filteredTrades.length,
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    chartData,
    maxDrawdown: maxDD,
    avgWin,
    avgLoss: Math.abs(avgLoss), // 顯示用保持正值 [cite: 294]
    expectancy,
  };
}, [filteredTrades]);
const strategyData = useMemo(() => {
  const groups = {};
  
  // 只計算目前過濾後的資料
  filteredTrades.forEach(t => {
    const tag = t.tag || '未分類';
    if (!groups[tag]) {
      groups[tag] = { name: tag, value: 0, wins: 0 };
    }
    groups[tag].value += 1; // 交易次數
    if (t.profit > 0) groups[tag].wins += 1; // 勝場
  });

  return Object.values(groups).map(g => ({
    ...g,
    winRate: (g.wins / g.value) * 100
  }));
}, [filteredTrades]);
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
            量化績效系統
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
  // --- 這裡是主儀表板的開始 ---
  return (
    
    <div className="min-h-screen bg-[#0f1115] text-slate-200">
      <header className="border-b border-white/5 bg-[#161920]/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
            <BarChart3 className="text-white w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold">Performance Quant 量化績效系統</h1>
          <span className="text-[10px] text-blue-400 font-mono hidden sm:block">
            CONNECTED TO FIREBASE
          </span>
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
            title="本日盈虧"
            value={`$${Math.round(stats.dayProfit).toLocaleString()}`}
            trend={stats.dayProfit >= 0 ? 1 : -1}
          />
          <KPIBox
            title="本月盈虧"
            value={`$${Math.round(stats.monthProfit).toLocaleString()}`}
            trend={stats.monthProfit >= 0 ? 1 : -1}
          />
          <KPIBox
            title="今年盈虧"
            value={`$${Math.round(stats.yearProfit).toLocaleString()}`}
            trend={stats.yearProfit >= 0 ? 1 : -1}
          />
          <KPIBox
            title="累積總損益"
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
          <KPIBox
            title="最大回撤 (MDD)"
             value={`$${Math.round(stats.maxDrawdown).toLocaleString()}`}
              trend={-1} 
              />
        </div>
        
        {/* 圖表與按鈕 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
     <div className="lg:col-span-2 bg-[#161920] rounded-3xl p-6 border border-white/5 h-[400px] flex flex-col">
  {/* 1. 標題與按鈕 (放在最上方) */}
  <div className="flex justify-between items-center mb-6">
    <h3 className="text-lg font-bold text-white">績效分析</h3>
    <div className="flex bg-slate-800 rounded-lg p-1">
      <button 
        onClick={() => setChartView('line')}
        className={`px-3 py-1 text-xs rounded-md transition-all ${chartView === 'line' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
      >
        損益曲線
      </button>
      <button 
        onClick={() => setChartView('pie')}
        className={`px-3 py-1 text-xs rounded-md transition-all ${chartView === 'pie' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
      >
        策略勝率
      </button>
    </div>
  </div>

  {/* 2. 圖表顯示區 (佔滿剩餘空間) */}
  <div className="flex-1 min-h-0"> 
    <ResponsiveContainer width="100%" height="100%">
      {chartView === 'line' ? (
        <LineChart data={stats.chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2e37" vertical={false} />
          <XAxis dataKey="date" stroke="#4a5568" fontSize={11} />
          <YAxis stroke="#4a5568" fontSize={11} />
          <Tooltip
            contentStyle={{ backgroundColor: "#1a1d24", border: "none", borderRadius: "12px" }}
          />
          <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      ) : (
        <PieChart>
          <Pie
              data={strategyData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              // 💡 保持你原本的函式邏輯，但在外層強制指定顏色
              label={({ name, winRate }) => `${name} (${winRate.toFixed(0)}%)`}
              
              // 🔥 重點：加這兩行就好，不要包在大括號裡面
              fill="#cbd5e1"      // 這會讓預設文字顏色變淺灰色
              stroke="none"       // 去掉文字邊框
              
              // 💡 讓連接線也變亮一點，才不會黑漆漆
              labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }} 
            >
              {strategyData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444'][index % 4]} />
              ))}
            </Pie>

            <Tooltip 
              // 💡 這裡改鼠標指上去的字
              contentStyle={{ backgroundColor: "#1a1d24", border: "none", borderRadius: "12px" }}
              itemStyle={{ color: "#ffffff" }} // 強制提示框文字為白色
            />
        </PieChart>
      )}
    </ResponsiveContainer>
  </div>
</div>
          <div className="space-y-4">
            <button
              onClick={() => setShowModal(true)}
              className="w-full h-32 bg-blue-600 rounded-3xl flex flex-col items-center justify-center gap-2 shadow-xl shadow-blue-600/20"
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
              <DetailRow
                label="每筆期望值"
                value={`$${Math.round(stats.expectancy).toLocaleString()}`}
                color="text-blue-400"
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
        {/* 表格：確保標題區與表格內容都包在這個 bg-[#161920] 裡面 */}                                              
        <div className="bg-[#161920] rounded-3xl border border-white/5 overflow-hidden shadow-2xl mt-8">
          {/* 1. 標題區 */}
          <div className="px-8 py-5 border-b border-white/5 flex justify-between items-center bg-black/10">
            <h3 className="font-bold text-s tracking-wider uppercase text-slate-400">
              歷史交易明細
            </h3>
            <input
              type="text"
              placeholder="搜尋代碼或股名..."
              value={searchTerm}
              onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // 重要：搜尋時強制回第一頁
              }}
             className="bg-[#1a1d24] border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
          </div>
          {/* 2. 表格內容區 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-slate-500 text-[10px] uppercase tracking-widest bg-white/[0.02]">
                  <th className="px-8 py-4">日期</th>
                  <th className="px-8 py-4">代碼</th>
                  <th className="px-8 py-4 text-right">進場</th>
                  <th className="px-8 py-4 text-right">出場</th>
                  <th className="px-8 py-4 text-right text-blue-400">股數</th>
                  <th className="px-8 py-4 text-right">淨損益</th>
                  <th className="px-8 py-4 text-center">刪除</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {paginatedTrades.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-white/[0.03] transition group h-[76px]"
                  >
                    {editingId === t.id ? (
                      // --- 編輯狀態：共 7 個 <td> ---
                      //日期編輯欄位
                      <>
                  
                        <td className="px-8 py-4">
                          <input
                            type="date"
                            className="input-style !py-1 !px-2 text-[11px]"
                            value={editFormData.date}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                date: e.target.value,
                              })
                            }
                          />
                        </td>
                        {/* --- 編輯狀態中的「代碼」欄位 --- */}
                        <td className="px-8 py-4">
                          <div className="flex flex-col gap-2">
                            <input
                              className="input-style !py-1 !px-2 font-bold uppercase"
                              value={editFormData.symbol}
                              onChange={(e) => setEditFormData({ ...editFormData, symbol: e.target.value })}
                            />
                            {/* 💡 新增：編輯時的標籤選擇 */}
                            <select
                              className="bg-slate-800 text-[10px] text-white rounded border border-white/10 px-1 py-0.5 focus:outline-none"
                              value={editFormData.tag || "未分類"}
                              onChange={(e) => setEditFormData({ ...editFormData, tag: e.target.value })}
                            >
                            <option value="動能突破">動能突破</option>
                            <option value="回後買">回後買</option>
                            <option value="價值投資">價值投資</option>
                            <option value="未分類">未分類</option>
                            </select>
                          </div>
                        </td>
                        
                        <td className="px-8 py-4">
                          <input
                            type="number"
                            className="input-style !py-1 !px-2 text-right"
                            value={editFormData.entryPrice}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                entryPrice: e.target.value,
                              })
                            }
                          />
                        </td>
                        
                        <td className="px-8 py-4">
                          <input
                            type="number"
                            className="input-style !py-1 !px-2 text-right"
                            value={editFormData.exitPrice}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                exitPrice: e.target.value,
                              })
                            }
                          />
                        </td>
                        {/* 修正：股數編輯欄位放在這裡，對應標題順序 */}
                        <td className="px-8 py-4">
                          <input
                            type="number"
                            className="input-style !py-1 !px-2 text-right text-blue-400"
                            value={editFormData.quantity}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                quantity: e.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="px-8 py-4 text-right text-slate-500 italic text-xs">
                          計算中...
                        </td>
                        <td className="px-8 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleUpdate(t.id)}
                              className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-md text-xs font-bold        hover:bg-emerald-500 hover:text-white transition"
                            >
                              儲存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 bg-white/5 text-slate-400 rounded-md text-xs hover:bg-white/10 transition"
                            >
                              取消
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // --- 正常顯示狀態：共 7 個 <td> ---
                      <>
                        <td className="px-4 py-2 text-xs font-mono text-slate-500">
                          {t.date}
                        </td>
                        <td className="px-8 py-2 font-bold text-white text-lg">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span>{t.symbol}</span>
                              {/* 💡 新增：彩色 Label 顯示 */}
                              {t.tag && t.tag !== "未分類" && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 font-medium">
                                  {t.tag}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 font-normal">
                              {stockMap[t.symbol] || "搜尋中..."}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-400">
                          {t.entryPrice}
                        </td>
                        <td className="px-4 py-2 text-right font-mono text-slate-400">
                          {t.exitPrice}
                        </td>
                        {/* 新增：顯示股數 (補足第 5 欄) */}
                        <td className="px-4 py-2 text-right font-mono text-blue-400">
                          {Number(t.quantity).toLocaleString()}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-mono font-bold text-s ${
                            t.profit >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {t.profit >= 0 ? "+" : ""}
                          {Math.round(t.profit).toLocaleString()}
                        </td>
                        <td className="px-8 py-2text-center">
                          <div className="flex justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEdit(t)}
                              className="p-2 text-slate-400 hover:text-blue-400 transition-colors"
                            >
                              編輯
                            </button>
                            <button
                              onClick={() => deleteTrade(t.id)}
                              className="p-2 text-slate-700 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
  <div className="flex items-center justify-between p-4 border-t border-white/5 text-slate-400 text-sm">
  <div className="flex items-center gap-4">
    {/* 選擇每頁筆數 */}
    <select 
      value={pageSize}
      onChange={(e) => {
        setPageSize(Number(e.target.value));
        setCurrentPage(1); // 切換筆數時回到第一頁
      }}
      className="bg-[#1a1d24] border border-white/10 rounded px-2 py-1 outline-none"
    >
      <option value={5}>5 筆 / 頁</option>
      <option value={10}>10 筆 / 頁</option>
      <option value={20}>20 筆 / 頁</option>
      <option value={50}>50 筆 / 頁</option>
    </select>
    <span>共 {trades.length} 筆資料</span>
  </div>

  <div className="flex items-center gap-2">
    <button
      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
      disabled={currentPage === 1}
      className="p-2 hover:bg-white/5 rounded disabled:opacity-30"
    >
      上一頁
    </button>
    
    <span className="px-4">第 {currentPage} / {totalPages} 頁</span>

    <button
      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
      disabled={currentPage === totalPages}
      className="p-2 hover:bg-white/5 rounded disabled:opacity-30"
    >
      下一頁
    </button>
  </div>
</div>
          </div>
        </div>{" "}
        {/* <--- 修正點：確保這一個 div 關閉的是最外層的 bg-[#161920] 容器 */}
      </main>

      {/* 新增視窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-[#1a1d24] border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xl font-bold mb-8 text-white text-center tracking-tight">
              手動新增紀錄
            </h3>

            <form onSubmit={saveTrade} className="space-y-5">
              {/* 強調顯示手續費折數 */}
              <div className="bg-blue-600/5 p-4 rounded-2xl border border-blue-600/10">
                <InputGroup label="手續費折數 (例如 0.28)">
                  <input
                    type="number"
                    step="0.01"
                    className="input-style mt-1"
                    value={feeDiscount}
                    onChange={(e) => setFeeDiscount(e.target.value)}
                  />
                </InputGroup>
              </div>

              <InputGroup label="標的代碼">
                <input
                  required
                  placeholder="2330"
                  className="input-style mt-1 uppercase"
                  value={formData.symbol}
                  onChange={(e) =>
                    setFormData({ ...formData, symbol: e.target.value })
                  }
                />
              </InputGroup>

              <div className="grid grid-cols-2 gap-4">
                <InputGroup label="進場價格">
                  <input
                    required
                    type="number"
                    step="any"
                    className="input-style mt-1"
                    value={formData.entryPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, entryPrice: e.target.value })
                    }
                  />
                </InputGroup>
                <InputGroup label="出場價格">
                  <input
                    required
                    type="number"
                    step="any"
                    className="input-style mt-1"
                    value={formData.exitPrice}
                    onChange={(e) =>
                      setFormData({ ...formData, exitPrice: e.target.value })
                    }
                  />
                </InputGroup>
              </div>

              <div className="grid grid-cols-2 gap-4 items-start">
                <InputGroup label="數量(股)">
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
                <InputGroup label="交易日期">
                  <input
                    required
                    type="date"
                    className="input-style"
                    style={{ colorScheme: "dark" }} // 強制瀏覽器使用深色日曆面板
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </InputGroup>
              </div>
              <div className="flex flex-col gap-2">
              <label className="text-sm text-slate-400">交易策略標籤</label>
              < select 
                value={FormData.tag} 
                onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                className="w-full bg-[#1a1d24] border border-white/10 rounded-xl px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                <option value="動能突破">動能突破</option>
                <option value="回後買">回後買</option>
                <option value="價值投資">價值投資</option>
                <option value="未分類">未分類</option>
              </select>
              </div>
              <div className="pt-4 space-y-2">
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold text-white shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                >
                  確認儲存
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full text-slate-500 text-sm font-medium py-2 hover:text-slate-300 transition-colors"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// 這些輔助函式要放在最外面 (App 的括號外面)
function KPIBox({ title, value, trend }) {
  const color =
    trend > 0 ? "text-emerald-400" : trend < 0 ? "text-rose-400" : "text-white";
  return (
    <div className="bg-[#161920] border border-white/5 rounded-3xl p-5">
      {/* 修改這裡：text-base 是正常字體大小，text-sm 是稍微小一點點 */}
      <div className="text-slate-400 text-sm font-bold uppercase mb-2">
        {title}
      </div>
      {/* 這裡同步放大數值 */}
      <div className={`text-3xl font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}
function DetailRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}
// 請將 App 括號外的這個函式替換掉
function InputGroup({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">
        {label}
      </label>
      <div className="w-full relative">{children}</div>
    </div>
  );
}

