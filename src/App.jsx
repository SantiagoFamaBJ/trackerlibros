import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "./supabase.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
const fmtShort = (d) => new Date(d + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
const uid = () => Math.random().toString(36).slice(2, 9);

const unitLabel = (unit) => unit === "pos" ? "pos." : "pág.";
const unitLabelCap = (unit) => unit === "pos" ? "Pos." : "Pág.";
const unitPlaceholder = (unit) => unit === "pos" ? "ej. 1240" : "ej. 120";
const unitTotalLabel = (unit) => unit === "pos" ? "Total de posiciones" : "Total de páginas";
const unitInputLabel = (unit) => unit === "pos" ? "Posición" : "Página";

const normalizeBook = (b) => ({
  id: b.id,
  name: b.name,
  totalPages: b.total_pages,
  cover: b.cover,
  status: b.status,
  unit: b.unit || "page",
  finishedAt: b.finished_at,
  createdAt: b.created_at,
});
const normalizeLog = (l) => ({
  id: l.id,
  bookId: l.book_id,
  date: l.date,
  page: l.page,
});

const calcStreak = (logs) => {
  if (!logs.length) return { current: 0, best: 0 };
  const dates = [...new Set(logs.map((l) => l.date))].sort();
  let best = 1, cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (diff === 1) { cur++; if (cur > best) best = cur; } else cur = 1;
  }
  const last = dates[dates.length - 1];
  if ((new Date(todayStr()) - new Date(last)) / 86400000 > 1) cur = 0;
  return { current: cur, best };
};

const bookStats = (book, logs) => {
  const bl = logs.filter((l) => l.bookId === book.id).sort((a, b) => a.date.localeCompare(b.date));
  const lastLog = bl[bl.length - 1];
  const currentPage = lastLog ? lastLog.page : 0;
  const pct = book.totalPages ? Math.min(100, Math.round((currentPage / book.totalPages) * 100)) : 0;
  const startDate = bl[0]?.date || null;
  const endDate = book.finishedAt || null;
  const days = startDate && endDate
    ? Math.ceil((new Date(endDate) - new Date(startDate)) / 86400000) + 1
    : startDate ? Math.ceil((new Date(todayStr()) - new Date(startDate)) / 86400000) + 1 : 0;
  const totalPagesRead = bl.reduce((acc, l, i) => acc + (i === 0 ? l.page : Math.max(0, l.page - bl[i - 1].page)), 0);
  const avgPerDay = days > 0 ? Math.round(totalPagesRead / days) : 0;
  const bestDay = bl.reduce((best, l, i) => {
    const pages = i === 0 ? l.page : Math.max(0, l.page - bl[i - 1].page);
    return pages > best.pages ? { date: l.date, pages } : best;
  }, { date: null, pages: 0 });
  return { currentPage, pct, startDate, endDate, days, avgPerDay, bestDay, totalLogs: bl.length };
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;0,9..144,700;1,9..144,400&family=DM+Sans:wght@300;400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#F5F2EE;--surface:#FDFCFB;--surface2:#F0EDE8;--border:rgba(60,40,20,.10);
  --text:#1A1512;--text2:#6B5E52;--text3:#A89D94;
  --accent:#C4602A;--accent-light:#F2DDD0;--accent2:#2A6B5E;--accent2-light:#D0EDE8;
  --green:#3B8A5A;--green-light:#D6EFE1;--danger:#B03030;
  --warning:#C4862A;--warning-light:#FBF0D8;
  --kindle:#6B52A8;--kindle-light:#EDE8F8;
  --shadow:0 2px 12px rgba(60,40,20,.08);--shadow-md:0 4px 24px rgba(60,40,20,.12);
  --r:14px;--r-sm:8px;
  --font-display:'Fraunces',Georgia,serif;--font-body:'DM Sans',system-ui,sans-serif;
}
body{background:var(--bg);font-family:var(--font-body);color:var(--text);-webkit-font-smoothing:antialiased}
.app{max-width:480px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}
.nav{background:var(--surface);border-bottom:1px solid var(--border);padding:0 16px;display:flex;align-items:stretch;position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)}
.nav-logo{font-family:var(--font-display);font-size:20px;font-weight:700;color:var(--text);padding:14px 0;flex:1;display:flex;align-items:center;gap:8px}
.nav-logo span{color:var(--accent)}
.nav-actions{display:flex;gap:4px;align-items:center}
.nav-btn{width:36px;height:36px;border-radius:50%;border:none;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text2);transition:background .15s,color .15s;font-size:16px}
.nav-btn:hover{background:var(--surface2);color:var(--text)}
.nav-btn.active{background:var(--accent-light);color:var(--accent)}
.tab-bar{display:flex;background:var(--surface);border-bottom:1px solid var(--border)}
.tab{flex:1;padding:10px 4px;text-align:center;font-size:11px;font-weight:500;color:var(--text3);cursor:pointer;border:none;background:none;border-bottom:2px solid transparent;transition:all .15s;letter-spacing:.5px;text-transform:uppercase}
.tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.content{flex:1;padding:16px;display:flex;flex-direction:column;gap:12px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:16px;box-shadow:var(--shadow)}
.card-sm{padding:12px}
.book-card{display:flex;gap:12px;cursor:pointer;transition:box-shadow .15s,transform .1s;position:relative;overflow:hidden}
.book-card:hover{box-shadow:var(--shadow-md);transform:translateY(-1px)}
.book-cover{width:52px;height:72px;border-radius:6px;overflow:hidden;flex-shrink:0;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:22px}
.book-cover img{width:100%;height:100%;object-fit:cover}
.book-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.book-name{font-family:var(--font-display);font-size:15px;font-weight:500;color:var(--text);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.book-meta{font-size:12px;color:var(--text3)}
.book-status{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:500;padding:2px 8px;border-radius:20px}
.book-status.progress{background:var(--accent-light);color:var(--accent)}
.book-status.done{background:var(--green-light);color:var(--green)}
.kindle-badge{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:500;padding:2px 7px;border-radius:20px;background:var(--kindle-light);color:var(--kindle)}
.progress-row{display:flex;align-items:center;gap:8px;margin-top:4px}
.progress-bar{flex:1;height:4px;background:var(--surface2);border-radius:2px;overflow:hidden}
.progress-fill{height:100%;background:var(--accent);border-radius:2px;transition:width .5s ease}
.progress-fill.kindle{background:var(--kindle)}
.progress-pct{font-size:11px;font-weight:500;color:var(--accent);min-width:32px;text-align:right}
.progress-pct.kindle{color:var(--kindle)}
.log-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)}
.log-item:last-child{border-bottom:none}
.log-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);flex-shrink:0}
.log-dot.kindle{background:var(--kindle)}
.log-main{flex:1;min-width:0}
.log-book{font-size:13px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.log-date{font-size:11px;color:var(--text3);margin-top:1px}
.log-page{font-family:var(--font-display);font-size:15px;font-weight:500;color:var(--accent)}
.log-page.kindle{color:var(--kindle)}
.log-actions{display:flex;gap:4px}
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-sm);padding:14px}
.stat-value{font-family:var(--font-display);font-size:28px;font-weight:500;color:var(--text);line-height:1}
.stat-label{font-size:11px;color:var(--text3);margin-top:4px;letter-spacing:.3px;text-transform:uppercase}
.stat-card.accent{background:var(--accent);border-color:var(--accent)}
.stat-card.accent .stat-value,.stat-card.accent .stat-label{color:white}
.stat-card.accent2{background:var(--accent2);border-color:var(--accent2)}
.stat-card.accent2 .stat-value,.stat-card.accent2 .stat-label{color:white}
.form-group{display:flex;flex-direction:column;gap:6px}
.form-label{font-size:11px;font-weight:500;color:var(--text3);letter-spacing:.5px;text-transform:uppercase}
.form-input{background:var(--surface2);border:1.5px solid transparent;border-radius:var(--r-sm);padding:12px 14px;font-family:var(--font-body);font-size:15px;color:var(--text);outline:none;transition:border-color .15s,background .15s;width:100%}
.form-input:focus{border-color:var(--accent);background:var(--surface)}
.form-input::placeholder{color:var(--text3)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.unit-toggle{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:var(--surface2);border-radius:var(--r-sm);padding:4px}
.unit-option{padding:9px;text-align:center;border-radius:6px;cursor:pointer;font-size:13px;font-weight:500;color:var(--text2);transition:all .15s;border:none;background:transparent}
.unit-option.active{background:var(--surface);color:var(--text);box-shadow:0 1px 4px rgba(60,40,20,.10)}
.unit-option.kindle-active{background:var(--kindle);color:white}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;border-radius:var(--r-sm);padding:13px 20px;font-family:var(--font-body);font-size:14px;font-weight:500;cursor:pointer;transition:all .15s;width:100%}
.btn-primary{background:var(--accent);color:white}
.btn-primary:hover{background:#A8501F}
.btn-primary:disabled{opacity:.4;cursor:not-allowed}
.btn-secondary{background:var(--surface2);color:var(--text)}
.btn-secondary:hover{background:var(--border)}
.btn-ghost{background:transparent;color:var(--text2);font-size:13px;width:auto;padding:8px 12px}
.btn-ghost:hover{background:var(--surface2)}
.btn-danger{background:var(--danger);color:white}
.btn-sm{padding:8px 14px;font-size:13px}
.btn-icon{width:32px;height:32px;padding:0;border-radius:8px;background:var(--surface2);color:var(--text2);font-size:14px;border:none;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s}
.btn-icon:hover{background:var(--accent-light);color:var(--accent)}
.btn-icon.danger:hover{background:#FCDEDE;color:var(--danger)}
.fab{position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:var(--accent);color:white;border:none;font-size:24px;cursor:pointer;box-shadow:0 4px 20px rgba(196,96,42,.4);display:flex;align-items:center;justify-content:center;transition:transform .15s,box-shadow .15s;z-index:50}
.fab:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(196,96,42,.5)}
.fab:active{transform:scale(.95)}
.modal-overlay{position:fixed;inset:0;background:rgba(26,21,18,.45);backdrop-filter:blur(4px);z-index:200;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn .2s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.modal{background:var(--surface);border-radius:20px 20px 0 0;width:100%;max-width:480px;padding:24px 20px 32px;display:flex;flex-direction:column;gap:16px;animation:slideUp .25s cubic-bezier(.34,1.56,.64,1);max-height:90vh;overflow-y:auto}
@keyframes slideUp{from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
.modal-handle{width:36px;height:4px;background:var(--surface2);border-radius:2px;margin:0 auto}
.modal-title{font-family:var(--font-display);font-size:20px;font-weight:500;color:var(--text)}
.detail-header{background:var(--surface);border-bottom:1px solid var(--border);padding:16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:10}
.detail-back{background:none;border:none;color:var(--text2);cursor:pointer;font-size:18px;padding:4px}
.detail-title{font-family:var(--font-display);font-size:17px;font-weight:500;flex:1}
.detail-cover-lg{width:80px;height:110px;border-radius:10px;overflow:hidden;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:36px;flex-shrink:0}
.detail-cover-lg img{width:100%;height:100%;object-fit:cover}
.toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:var(--text);color:white;padding:10px 18px;border-radius:20px;font-size:13px;z-index:300;animation:toastIn .3s;white-space:nowrap}
@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.warning-box{background:var(--warning-light);border:1px solid #E8C070;border-radius:var(--r-sm);padding:12px 14px;display:flex;gap:10px}
.warning-icon{color:var(--warning);font-size:16px;flex-shrink:0;margin-top:1px}
.warning-text{font-size:13px;color:var(--text)}
.warning-text strong{color:var(--warning)}
.cover-upload{width:80px;height:110px;border-radius:10px;border:2px dashed var(--border);background:var(--surface2);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;transition:all .15s;overflow:hidden;position:relative}
.cover-upload:hover{border-color:var(--accent);background:var(--accent-light)}
.cover-upload input{position:absolute;inset:0;opacity:0;cursor:pointer}
.cover-upload span{font-size:22px}
.cover-upload small{font-size:9px;color:var(--text3);text-align:center}
.empty{text-align:center;padding:48px 24px}
.empty-icon{font-size:48px;margin-bottom:12px;opacity:.6}
.empty-title{font-family:var(--font-display);font-size:18px;color:var(--text2);margin-bottom:6px}
.empty-sub{font-size:13px;color:var(--text3)}
.section-header{display:flex;align-items:center;justify-content:space-between;padding:4px 0 8px}
.section-title{font-size:11px;font-weight:500;color:var(--text3);text-transform:uppercase;letter-spacing:.8px}
.streak-banner{background:linear-gradient(135deg,var(--accent) 0%,#A8501F 100%);border-radius:var(--r);padding:16px;color:white;display:flex;align-items:center;gap:12px}
.streak-icon{font-size:32px}
.streak-num{font-family:var(--font-display);font-size:36px;font-weight:700;line-height:1}
.streak-label{font-size:12px;opacity:.85;margin-top:2px}
.streak-best{margin-left:auto;text-align:right;opacity:.85;font-size:12px}
.streak-best strong{font-family:var(--font-display);font-size:20px;display:block;opacity:1}
.loading{display:flex;align-items:center;justify-content:center;flex:1;flex-direction:column;gap:12px;color:var(--text3);font-size:13px}
.spinner{width:28px;height:28px;border:3px solid var(--surface2);border-top-color:var(--accent);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
`;

export default function App() {
  const [books, setBooks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("home");
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [toast, setToast] = useState(null);
  const [adminMode, setAdminMode] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [warnLog, setWarnLog] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [{ data: booksData, error: booksErr }, { data: logsData, error: logsErr }] = await Promise.all([
        supabase.from("books").select("*").order("created_at"),
        supabase.from("logs").select("*").order("date"),
      ]);
      if (booksErr || logsErr) { setError(booksErr?.message || logsErr?.message); }
      else { setBooks((booksData || []).map(normalizeBook)); setLogs((logsData || []).map(normalizeLog)); }
      setLoading(false);
    };
    fetchData();
  }, []);

  const showToast = (msg) => {
    setToast(msg); clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const addBook = async (book) => {
    const newBook = { id: uid(), name: book.name, total_pages: book.totalPages, cover: book.cover || null, status: "progress", unit: book.unit || "page", finished_at: null, created_at: todayStr() };
    const { error } = await supabase.from("books").insert(newBook);
    if (error) { showToast("❌ Error al guardar"); return; }
    setBooks((prev) => [...prev, normalizeBook(newBook)]);
    showToast("📚 Libro agregado"); setModal(null);
  };

  const updateBook = async (id, patch) => {
    const dbPatch = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.totalPages !== undefined) dbPatch.total_pages = patch.totalPages;
    if (patch.cover !== undefined) dbPatch.cover = patch.cover;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.unit !== undefined) dbPatch.unit = patch.unit;
    if (patch.finishedAt !== undefined) dbPatch.finished_at = patch.finishedAt;
    const { error } = await supabase.from("books").update(dbPatch).eq("id", id);
    if (error) { showToast("❌ Error al actualizar"); return; }
    setBooks((prev) => prev.map((b) => b.id === id ? { ...b, ...patch } : b));
    showToast("✏️ Libro actualizado"); setModal(null);
  };

  const deleteBook = async (id) => {
    const { error } = await supabase.from("books").delete().eq("id", id);
    if (error) { showToast("❌ Error al eliminar"); return; }
    setBooks((prev) => prev.filter((b) => b.id !== id));
    setLogs((prev) => prev.filter((l) => l.bookId !== id));
    showToast("🗑️ Libro eliminado"); setDetail(null);
  };

  const finishBook = async (id) => {
    await updateBook(id, { status: "done", finishedAt: todayStr() });
    showToast("🎉 ¡Libro finalizado!");
  };

  const addLog = async (log) => {
    const bookLogs = logs.filter((l) => l.bookId === log.bookId).sort((a, b) => a.date.localeCompare(b.date));
    const lastLog = bookLogs[bookLogs.length - 1];
    if (lastLog && log.page < lastLog.page && !warnLog) { setWarnLog(log); return; }
    const newLog = { id: uid(), book_id: log.bookId, date: log.date, page: log.page };
    const { error } = await supabase.from("logs").insert(newLog);
    if (error) { showToast("❌ Error al guardar"); return; }
    setLogs((prev) => [...prev, normalizeLog(newLog)]);
    showToast("✅ Lectura registrada"); setModal(null); setWarnLog(null); setEditTarget(null);
    const book = books.find((b) => b.id === log.bookId);
    if (book && book.totalPages && log.page >= book.totalPages && book.status !== "done") finishBook(book.id);
  };

  const updateLog = async (id, patch) => {
    const { error } = await supabase.from("logs").update({ date: patch.date, page: patch.page }).eq("id", id);
    if (error) { showToast("❌ Error al actualizar"); return; }
    setLogs((prev) => prev.map((l) => l.id === id ? { ...l, ...patch } : l));
    showToast("✏️ Registro actualizado"); setModal(null);
  };

  const deleteLog = async (id) => {
    const { error } = await supabase.from("logs").delete().eq("id", id);
    if (error) { showToast("❌ Error al eliminar"); return; }
    setLogs((prev) => prev.filter((l) => l.id !== id));
    showToast("🗑️ Registro eliminado");
  };

  const streak = useMemo(() => calcStreak(logs), [logs]);
  const sortedLogs = useMemo(() => [...logs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [logs]);
  const inProgress = books.filter((b) => b.status === "progress");
  const finished = books.filter((b) => b.status === "done");
  const bestDay = useMemo(() => {
    const byDate = {}, byBook = {};
    logs.forEach((l) => { if (!byBook[l.bookId]) byBook[l.bookId] = []; byBook[l.bookId].push(l); });
    Object.values(byBook).forEach((bl) => {
      bl.sort((a, b) => a.date.localeCompare(b.date));
      bl.forEach((l, i) => { const p = i === 0 ? l.page : Math.max(0, l.page - bl[i-1].page); byDate[l.date] = (byDate[l.date]||0)+p; });
    });
    return Math.max(0, ...Object.values(byDate));
  }, [logs]);

  if (loading) return <div className="app"><style>{styles}</style><div className="loading"><div className="spinner"/><span>Cargando tu biblioteca…</span></div></div>;
  if (error) return <div className="app"><style>{styles}</style><div className="loading"><div style={{fontSize:"32px"}}>⚠️</div><div style={{color:"var(--danger)",fontWeight:500}}>Error de conexión</div><div style={{fontSize:"12px",maxWidth:"260px",textAlign:"center"}}>{error}</div></div></div>;

  if (detail) {
    const book = books.find((b) => b.id === detail);
    if (!book) { setDetail(null); return null; }
    const stats = bookStats(book, logs);
    const bookLogs = sortedLogs.filter((l) => l.bookId === book.id);
    const isKindle = book.unit === "pos";
    const ul = unitLabel(book.unit);
    return (
      <div className="app"><style>{styles}</style>
        <div className="detail-header">
          <button className="detail-back" onClick={() => setDetail(null)}>←</button>
          <span className="detail-title">{book.name}</span>
          {adminMode && <button className="btn-icon" style={{marginLeft:"auto"}} onClick={() => { setEditTarget(book); setModal("editBook"); }}>✏️</button>}
        </div>
        <div className="content">
          <div className="card" style={{display:"flex",gap:"16px",alignItems:"flex-start"}}>
            <div className="detail-cover-lg">{book.cover ? <img src={book.cover} alt=""/> : "📖"}</div>
            <div style={{flex:1,display:"flex",flexDirection:"column",gap:"8px"}}>
              <div style={{fontFamily:"var(--font-display)",fontSize:"18px",fontWeight:500,lineHeight:1.3}}>{book.name}</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
                <span className={`book-status ${book.status==="done"?"done":"progress"}`}>{book.status==="done"?"✓ Finalizado":"● En progreso"}</span>
                {isKindle && <span className="kindle-badge">📱 Kindle</span>}
              </div>
              <div style={{fontSize:"12px",color:"var(--text3)"}}>{unitLabelCap(book.unit)} {stats.currentPage} / {book.totalPages||"?"}</div>
              <div className="progress-row">
                <div className="progress-bar" style={{height:"6px"}}><div className={`progress-fill ${isKindle?"kindle":""}`} style={{width:`${stats.pct}%`}}/></div>
                <span className={`progress-pct ${isKindle?"kindle":""}`}>{stats.pct}%</span>
              </div>
              {book.status!=="done" && <button className="btn btn-primary btn-sm" style={{marginTop:"4px"}} onClick={() => finishBook(book.id)}>Marcar como finalizado</button>}
            </div>
          </div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value" style={{fontSize:"14px",fontWeight:500}}>{stats.startDate?fmtShort(stats.startDate):"—"}</div><div className="stat-label">Inicio</div></div>
            <div className="stat-card"><div className="stat-value" style={{fontSize:"14px",fontWeight:500}}>{stats.endDate?fmtShort(stats.endDate):"—"}</div><div className="stat-label">Finalización</div></div>
            <div className="stat-card"><div className="stat-value">{stats.days||"—"}</div><div className="stat-label">Días</div></div>
            <div className="stat-card"><div className="stat-value">{stats.avgPerDay||"—"}</div><div className="stat-label">{ul}/día</div></div>
          </div>
          {stats.bestDay.pages>0 && (
            <div className="card card-sm" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontSize:"11px",color:"var(--text3)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:"2px"}}>Mejor día</div>
              <div style={{fontFamily:"var(--font-display)",fontSize:"22px",fontWeight:500,color:isKindle?"var(--kindle)":"var(--accent)"}}>{stats.bestDay.pages} <span style={{fontSize:"12px",fontWeight:400,color:"var(--text3)"}}>{ul}</span></div></div>
              <div style={{fontSize:"12px",color:"var(--text3)"}}>{fmtShort(stats.bestDay.date)}</div>
            </div>
          )}
          <div>
            <div className="section-header">
              <span className="section-title">Historial del libro</span>
              <button className="btn-ghost btn-sm" onClick={() => { setEditTarget({bookId:book.id}); setModal("addLog"); }}>+ Registro</button>
            </div>
            {bookLogs.length===0
              ? <div style={{textAlign:"center",padding:"24px",color:"var(--text3)",fontSize:"13px"}}>Sin registros aún</div>
              : <div className="card" style={{padding:"8px 16px"}}>
                  {bookLogs.map((l) => (
                    <div key={l.id} className="log-item">
                      <div className={`log-dot ${isKindle?"kindle":""}`}/>
                      <div className="log-main"><div className="log-date">{fmt(l.date)}</div></div>
                      <div className={`log-page ${isKindle?"kindle":""}`}>{ul}{l.page}</div>
                      {adminMode && <div className="log-actions">
                        <button className="btn-icon" onClick={() => { setEditTarget(l); setModal("editLog"); }}>✏️</button>
                        <button className="btn-icon danger" onClick={() => deleteLog(l.id)}>🗑</button>
                      </div>}
                    </div>
                  ))}
                </div>
            }
          </div>
          {adminMode && <button className="btn btn-danger btn-sm" onClick={() => { if(confirm("¿Eliminar este libro y todos sus registros?")) deleteBook(book.id); }}>🗑 Eliminar libro</button>}
          <div style={{height:"80px"}}/>
        </div>
        {modal==="editBook" && <AddBookModal book={editTarget} onSave={(b)=>updateBook(editTarget.id,b)} onClose={()=>setModal(null)} edit/>}
        {modal==="editLog" && <EditLogModal log={editTarget} books={books} onSave={(p)=>updateLog(editTarget.id,p)} onClose={()=>{setModal(null);setEditTarget(null);}}/>}
        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app"><style>{styles}</style>
      <div className="nav">
        <div className="nav-logo">Libros<span>.</span></div>
        <div className="nav-actions">
          <button className={`nav-btn ${adminMode?"active":""}`} onClick={()=>setAdminMode(v=>!v)}>⚙️</button>
        </div>
      </div>
      <div className="tab-bar">
        {[["home","Inicio"],["books","Biblioteca"],["stats","Estadísticas"]].map(([id,label])=>(
          <button key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>
      {adminMode && <div style={{background:"var(--warning-light)",borderBottom:"1px solid #E8C070",padding:"8px 16px",display:"flex",alignItems:"center",gap:"8px",fontSize:"12px",color:"var(--warning)"}}>⚙️ <strong>Modo administración activo</strong></div>}

      {tab==="home" && (
        <div className="content">
          {logs.length>0 && <div className="streak-banner"><div className="streak-icon">🔥</div><div><div className="streak-num">{streak.current}</div><div className="streak-label">días consecutivos</div></div><div className="streak-best"><span>Mejor racha</span><strong>{streak.best}</strong></div></div>}
          {inProgress.length>0 && <div>
            <div className="section-header"><span className="section-title">En progreso</span></div>
            {inProgress.map((book)=>{
              const s=bookStats(book,logs); const isKindle=book.unit==="pos";
              return <div key={book.id} className="card book-card" style={{marginBottom:"10px"}} onClick={()=>setDetail(book.id)}>
                <div className="book-cover">{book.cover?<img src={book.cover} alt=""/>:"📖"}</div>
                <div className="book-info">
                  <div style={{display:"flex",alignItems:"center",gap:"6px"}}><div className="book-name" style={{flex:1}}>{book.name}</div>{isKindle&&<span className="kindle-badge">📱</span>}</div>
                  <div className="book-meta">{unitLabelCap(book.unit)} {s.currentPage} / {book.totalPages||"?"}</div>
                  <div className="progress-row"><div className="progress-bar"><div className={`progress-fill ${isKindle?"kindle":""}`} style={{width:`${s.pct}%`}}/></div><span className={`progress-pct ${isKindle?"kindle":""}`}>{s.pct}%</span></div>
                  {s.startDate&&<div className="book-meta" style={{marginTop:"2px"}}>Desde {fmtShort(s.startDate)}</div>}
                </div>
              </div>;
            })}
          </div>}
          <div>
            <div className="section-header"><span className="section-title">Historial reciente</span></div>
            {sortedLogs.length===0
              ? <div className="empty"><div className="empty-icon">📖</div><div className="empty-title">Sin registros aún</div><div className="empty-sub">Agregá tu primer libro</div></div>
              : <div className="card" style={{padding:"8px 16px"}}>
                  {sortedLogs.slice(0,20).map((l)=>{
                    const book=books.find(b=>b.id===l.bookId); const isKindle=book?.unit==="pos"; const ul=unitLabel(book?.unit);
                    return <div key={l.id} className="log-item">
                      <div className={`log-dot ${isKindle?"kindle":""}`}/>
                      <div className="log-main"><div className="log-book">{book?.name||"Libro eliminado"}</div><div className="log-date">{fmt(l.date)}</div></div>
                      <div className={`log-page ${isKindle?"kindle":""}`}>{ul}{l.page}</div>
                      {adminMode&&<div className="log-actions">
                        <button className="btn-icon" onClick={e=>{e.stopPropagation();setEditTarget(l);setModal("editLog");}}>✏️</button>
                        <button className="btn-icon danger" onClick={e=>{e.stopPropagation();deleteLog(l.id);}}>🗑</button>
                      </div>}
                    </div>;
                  })}
                </div>
            }
          </div>
          <div style={{height:"80px"}}/>
        </div>
      )}

      {tab==="books" && (
        <div className="content">
          {books.length===0
            ? <div className="empty"><div className="empty-icon">📚</div><div className="empty-title">Sin libros</div><div className="empty-sub">Agregá tu primer libro</div></div>
            : <>
              {inProgress.length>0&&<><div className="section-header"><span className="section-title">En progreso ({inProgress.length})</span></div>
                {inProgress.map(book=>{const s=bookStats(book,logs);const isKindle=book.unit==="pos";return <div key={book.id} className="card book-card" style={{marginBottom:"10px"}} onClick={()=>setDetail(book.id)}>
                  <div className="book-cover">{book.cover?<img src={book.cover} alt=""/>:"📖"}</div>
                  <div className="book-info"><div style={{display:"flex",alignItems:"center",gap:"6px"}}><div className="book-name" style={{flex:1}}>{book.name}</div>{isKindle&&<span className="kindle-badge">📱</span>}</div>
                  <div className="book-meta">{book.totalPages} {unitLabel(book.unit)} totales</div>
                  <div className="progress-row"><div className="progress-bar"><div className={`progress-fill ${isKindle?"kindle":""}`} style={{width:`${s.pct}%`}}/></div><span className={`progress-pct ${isKindle?"kindle":""}`}>{s.pct}%</span></div></div>
                </div>;})}
              </>}
              {finished.length>0&&<><div className="section-header" style={{marginTop:"4px"}}><span className="section-title">Finalizados ({finished.length})</span></div>
                {finished.map(book=>{const s=bookStats(book,logs);const isKindle=book.unit==="pos";return <div key={book.id} className="card book-card" style={{marginBottom:"10px"}} onClick={()=>setDetail(book.id)}>
                  <div className="book-cover">{book.cover?<img src={book.cover} alt=""/>:"📖"}</div>
                  <div className="book-info"><div style={{display:"flex",alignItems:"center",gap:"6px"}}><div className="book-name" style={{flex:1}}>{book.name}</div>{isKindle&&<span className="kindle-badge">📱</span>}</div>
                  <span className="book-status done">✓ Finalizado</span>
                  <div className="book-meta">{s.days} días · {s.avgPerDay} {unitLabel(book.unit)}/día</div></div>
                </div>;})}
              </>}
            </>
          }
          <div style={{height:"80px"}}/>
        </div>
      )}

      {tab==="stats" && (
        <div className="content">
          <div className="stats-grid">
            <div className="stat-card accent"><div className="stat-value">{streak.current}</div><div className="stat-label">Racha actual 🔥</div></div>
            <div className="stat-card accent2"><div className="stat-value">{streak.best}</div><div className="stat-label">Mejor racha ⭐</div></div>
            <div className="stat-card"><div className="stat-value">{finished.length}</div><div className="stat-label">Libros terminados</div></div>
            <div className="stat-card"><div className="stat-value">{books.length}</div><div className="stat-label">Total de libros</div></div>
            <div className="stat-card"><div className="stat-value">{logs.length}</div><div className="stat-label">Sesiones</div></div>
            <div className="stat-card"><div className="stat-value">{bestDay||"—"}</div><div className="stat-label">Mejor día</div></div>
          </div>
          {books.length>0&&<><div className="section-header" style={{marginTop:"4px"}}><span className="section-title">Por libro</span></div>
            {books.map(book=>{const s=bookStats(book,logs);if(s.totalLogs===0)return null;const isKindle=book.unit==="pos";return <div key={book.id} className="card card-sm" style={{display:"flex",gap:"10px",alignItems:"center",cursor:"pointer",marginBottom:"8px"}} onClick={()=>setDetail(book.id)}>
              <div className="book-cover" style={{width:40,height:56,fontSize:18}}>{book.cover?<img src={book.cover} alt=""/>:"📖"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"2px"}}><div style={{fontFamily:"var(--font-display)",fontSize:"14px",fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1}}>{book.name}</div>{isKindle&&<span className="kindle-badge">📱</span>}</div>
                <div style={{fontSize:"12px",color:"var(--text3)"}}>{s.avgPerDay} {unitLabel(book.unit)}/día · {s.days} días</div>
                <div className="progress-row" style={{marginTop:"4px"}}><div className="progress-bar"><div className={`progress-fill ${isKindle?"kindle":""}`} style={{width:`${s.pct}%`}}/></div><span className={`progress-pct ${isKindle?"kindle":""}`} style={{fontSize:"11px"}}>{s.pct}%</span></div>
              </div>
            </div>;})}
          </>}
          <div style={{height:"80px"}}/>
        </div>
      )}

      <button className="fab" onClick={()=>{setEditTarget(null);setModal("addLog");}}>+</button>
      <div style={{position:"fixed",bottom:"24px",left:"24px",zIndex:50}}>
        <button className="btn btn-secondary btn-sm" style={{borderRadius:"20px",width:"auto",boxShadow:"var(--shadow-md)"}} onClick={()=>setModal("addBook")}>+ Libro</button>
      </div>

      {modal==="addBook"&&<AddBookModal onSave={addBook} onClose={()=>setModal(null)}/>}
      {modal==="editBook"&&<AddBookModal book={editTarget} onSave={(b)=>updateBook(editTarget.id,b)} onClose={()=>setModal(null)} edit/>}
      {modal==="addLog"&&<AddLogModal books={books} preBookId={editTarget?.bookId} logs={logs} warnLog={warnLog} onConfirmWarn={()=>addLog(warnLog)} onCancelWarn={()=>setWarnLog(null)} onSave={addLog} onClose={()=>{setModal(null);setWarnLog(null);setEditTarget(null);}}/>}
      {modal==="editLog"&&<EditLogModal log={editTarget} books={books} onSave={(p)=>updateLog(editTarget.id,p)} onClose={()=>{setModal(null);setEditTarget(null);}}/>}
      {toast&&<div className="toast">{toast}</div>}
    </div>
  );
}

function AddBookModal({ onSave, onClose, book, edit }) {
  const [name, setName] = useState(book?.name||"");
  const [pages, setPages] = useState(book?.totalPages||"");
  const [cover, setCover] = useState(book?.cover||null);
  const [unit, setUnit] = useState(book?.unit||"page");
  const handleCover = (e) => { const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>setCover(ev.target.result);r.readAsDataURL(f); };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/>
        <div className="modal-title">{edit?"Editar libro":"Nuevo libro"}</div>
        <div className="form-group">
          <label className="form-label">Tipo de seguimiento</label>
          <div className="unit-toggle">
            <button className={`unit-option ${unit==="page"?"active":""}`} onClick={()=>setUnit("page")}>📄 Páginas</button>
            <button className={`unit-option ${unit==="pos"?"kindle-active":""}`} onClick={()=>setUnit("pos")}>📱 Posición Kindle</button>
          </div>
        </div>
        <div style={{display:"flex",gap:"14px",alignItems:"flex-start"}}>
          <label className="cover-upload">
            {cover?<img src={cover} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<><span>📷</span><small>Portada</small></>}
            <input type="file" accept="image/*" onChange={handleCover}/>
          </label>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:"12px"}}>
            <div className="form-group"><label className="form-label">Nombre</label><input className="form-input" value={name} onChange={e=>setName(e.target.value)} placeholder="Título del libro" autoFocus/></div>
            <div className="form-group"><label className="form-label">{unitTotalLabel(unit)}</label><input className="form-input" type="number" value={pages} onChange={e=>setPages(e.target.value)} placeholder={unit==="pos"?"ej. 3500":"ej. 350"}/></div>
          </div>
        </div>
        <button className="btn btn-primary" onClick={()=>{if(!name.trim())return;onSave({name:name.trim(),totalPages:parseInt(pages)||null,cover,unit});}} disabled={!name.trim()}>
          {edit?"Guardar cambios":"Agregar libro"}
        </button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

function AddLogModal({ books, preBookId, logs, warnLog, onConfirmWarn, onCancelWarn, onSave, onClose }) {
  const [bookId, setBookId] = useState(preBookId||(books[0]?.id||""));
  const [date, setDate] = useState(todayStr());
  const [page, setPage] = useState("");
  const [search, setSearch] = useState("");
  const filtered = books.filter(b=>b.name.toLowerCase().includes(search.toLowerCase()));
  const selectedBook = books.find(b=>b.id===bookId);
  const lastLog = logs.filter(l=>l.bookId===bookId).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const ul = unitLabel(selectedBook?.unit);

  if (warnLog) return (
    <div className="modal-overlay"><div className="modal">
      <div className="modal-handle"/>
      <div className="modal-title">⚠️ Valor menor</div>
      <div className="warning-box"><div className="warning-icon">⚠️</div>
      <div className="warning-text">{unitLabelCap(selectedBook?.unit)} <strong>{warnLog.page}</strong> es menor al último registro (<strong>{lastLog?.page}</strong>). ¿Querés continuar?</div></div>
      <button className="btn btn-primary" onClick={onConfirmWarn}>Continuar de todos modos</button>
      <button className="btn btn-ghost" onClick={onCancelWarn}>Cancelar</button>
    </div></div>
  );

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/>
        <div className="modal-title">Registrar lectura</div>
        <div className="form-group">
          <label className="form-label">Libro</label>
          <input className="form-input" placeholder="Buscar libro..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:"6px"}}/>
          <div style={{background:"var(--surface2)",borderRadius:"var(--r-sm)",overflow:"hidden",maxHeight:"140px",overflowY:"auto"}}>
            {filtered.length===0
              ? <div style={{padding:"12px",fontSize:"13px",color:"var(--text3)",textAlign:"center"}}>Sin resultados</div>
              : filtered.map(b=>(
                <div key={b.id} onClick={()=>{setBookId(b.id);setSearch("");setPage("");}}
                  style={{padding:"10px 14px",cursor:"pointer",background:bookId===b.id?"var(--accent-light)":"transparent",color:bookId===b.id?"var(--accent)":"var(--text)",fontSize:"14px",fontWeight:bookId===b.id?500:400,transition:"background .1s",display:"flex",alignItems:"center",gap:"8px"}}>
                  {b.name}{b.unit==="pos"&&<span className="kindle-badge" style={{marginLeft:"auto"}}>📱 pos.</span>}
                </div>
              ))
            }
          </div>
        </div>
        {lastLog&&<div style={{fontSize:"12px",color:"var(--text3)",background:"var(--surface2)",padding:"8px 12px",borderRadius:"var(--r-sm)"}}>Último: <strong style={{color:selectedBook?.unit==="pos"?"var(--kindle)":"var(--accent)"}}>{ul}{lastLog.page}</strong> el {fmtShort(lastLog.date)}</div>}
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div className="form-group"><label className="form-label">{unitInputLabel(selectedBook?.unit)}</label><input className="form-input" type="number" value={page} onChange={e=>setPage(e.target.value)} placeholder={unitPlaceholder(selectedBook?.unit)}/></div>
        </div>
        <button className="btn btn-primary" onClick={()=>onSave({bookId,date,page:parseInt(page)})} disabled={!bookId||!page}>Guardar lectura</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

function EditLogModal({ log, books, onSave, onClose }) {
  const [date, setDate] = useState(log.date);
  const [page, setPage] = useState(log.page);
  const book = books.find(b=>b.id===log.bookId);
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-handle"/>
        <div className="modal-title">Editar registro</div>
        <div style={{fontSize:"13px",color:"var(--text3)",background:"var(--surface2)",padding:"8px 12px",borderRadius:"var(--r-sm)",display:"flex",alignItems:"center",gap:"8px"}}>
          <span>Libro: <strong style={{color:"var(--text)"}}>{book?.name}</strong></span>
          {book?.unit==="pos"&&<span className="kindle-badge">📱 pos.</span>}
        </div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Fecha</label><input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
          <div className="form-group"><label className="form-label">{unitInputLabel(book?.unit)}</label><input className="form-input" type="number" value={page} onChange={e=>setPage(e.target.value)}/></div>
        </div>
        <button className="btn btn-primary" onClick={()=>onSave({date,page:parseInt(page)})}>Guardar</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}
