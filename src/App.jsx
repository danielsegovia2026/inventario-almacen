import { useState, useMemo, useEffect, useRef } from "react";
import {
  Plus, Search, AlertTriangle, ArrowDownCircle, ArrowUpCircle,
  Trash2, Pencil, X, Boxes, Tag, ClipboardList, LayoutGrid, Camera, Loader2,
  ShoppingCart, TrendingUp, Minus, Receipt
} from "lucide-react";
import { supabase, supabaseConfigured } from "./supabaseClient";

const PALETTE = {
  bg: "#15171B",
  panel: "#1D2025",
  panelAlt: "#22262C",
  border: "#2B2F36",
  borderStrong: "#3A3F47",
  text: "#ECEBE6",
  textMuted: "#8B8F94",
  accent: "#F2B705",
  accentText: "#15171B",
  danger: "#E4572E",
  success: "#4C9A6A",
};

function money(n) {
  return Number(n || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export default function App() {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [tab, setTab] = useState("inventario");
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [movementTarget, setMovementTarget] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  const [cart, setCart] = useState([]);
  const [saleSearch, setSaleSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [customerName, setCustomerName] = useState("");
  const [savingSale, setSavingSale] = useState(false);

  async function fetchAll() {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [catsRes, prodsRes, movsRes, salesRes] = await Promise.all([
        supabase.from("categories").select("*").order("name"),
        supabase.from("products").select("*").order("name"),
        supabase.from("movements").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("sales").select("*, sale_items(*)").order("created_at", { ascending: false }).limit(300),
      ]);
      const firstError = catsRes.error || prodsRes.error || movsRes.error || salesRes.error;
      if (firstError) {
        setErrorMsg(firstError.message || "No se pudo conectar con la base de datos. Revisa tus variables de entorno.");
      } else {
        setErrorMsg("");
        setCategories(catsRes.data || []);
        setProducts(prodsRes.data || []);
        setMovements(movsRes.data || []);
        setSales(salesRes.data || []);
      }
    } catch (e) {
      setErrorMsg(e?.message || "Ocurrio un error inesperado al conectar con la base de datos.");
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = activeCategory === "all" || p.category_id === activeCategory;
      const q = search.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || "").includes(search) ||
        (p.supplier || "").toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, search]);

  const saleProductResults = useMemo(() => {
    const q = saleSearch.toLowerCase();
    if (!q) return products.slice(0, 8);
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode || "").includes(saleSearch))
      .slice(0, 8);
  }, [products, saleSearch]);

  const stats = useMemo(() => {
    const totalUnits = products.reduce((sum, p) => sum + Number(p.qty), 0);
    const totalValue = products.reduce((sum, p) => sum + Number(p.qty) * Number(p.price), 0);
    const lowStock = products.filter((p) => Number(p.qty) <= Number(p.min)).length;
    return { totalProducts: products.length, totalUnits, totalValue, lowStock };
  }, [products]);

  const cartTotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
  const cartCost = cart.reduce((s, i) => s + i.qty * i.cost, 0);

  const reportStats = useMemo(() => {
    const now = new Date();
    let todayTotal = 0, todayProfit = 0, monthTotal = 0, monthProfit = 0;
    const productTotals = {};

    for (const s of sales) {
      const d = new Date(s.created_at);
      const total = Number(s.total);
      const profit = Number(s.total) - Number(s.cost_total);
      if (isSameDay(d, now)) {
        todayTotal += total;
        todayProfit += profit;
      }
      if (isSameMonth(d, now)) {
        monthTotal += total;
        monthProfit += profit;
      }
      for (const item of s.sale_items || []) {
        const key = item.product_name;
        productTotals[key] = (productTotals[key] || 0) + item.qty;
      }
    }

    const topProducts = Object.entries(productTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { todayTotal, todayProfit, monthTotal, monthProfit, topProducts };
  }, [sales]);

  function categoryName(id) {
    return categories.find((c) => c.id === id)?.name || "Sin categoria";
  }

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const { data, error } = await supabase.from("categories").insert({ name }).select().single();
    if (!error && data) {
      setCategories([...categories, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewCategoryName("");
    }
  }

  async function deleteCategory(id) {
    await supabase.from("categories").delete().eq("id", id);
    setCategories(categories.filter((c) => c.id !== id));
    if (activeCategory === id) setActiveCategory("all");
  }

  async function saveProduct(product) {
    const payload = {
      sku: product.sku,
      name: product.name,
      category_id: product.category_id || null,
      qty: Number(product.qty),
      min: Number(product.min),
      price: Number(product.price),
      cost: Number(product.cost || 0),
      supplier: product.supplier || null,
      barcode: product.barcode || null,
    };
    if (product.id) {
      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", product.id)
        .select()
        .single();
      if (!error && data) setProducts(products.map((p) => (p.id === data.id ? data : p)));
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select().single();
      if (!error && data) setProducts([...products, data]);
    }
    setShowProductModal(false);
    setEditingProduct(null);
  }

  async function deleteProduct(id) {
    await supabase.from("products").delete().eq("id", id);
    setProducts(products.filter((p) => p.id !== id));
  }

  async function registerMovement(productId, type, qty, note) {
    const amount = Number(qty);
    if (!amount || amount <= 0) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const newQty = type === "in" ? product.qty + amount : Math.max(0, product.qty - amount);

    const { data: updated, error: updateError } = await supabase
      .from("products")
      .update({ qty: newQty })
      .eq("id", productId)
      .select()
      .single();

    const { data: movement, error: moveError } = await supabase
      .from("movements")
      .insert({ product_id: productId, type, qty: amount, note: note || null })
      .select()
      .single();

    if (!updateError && updated) setProducts(products.map((p) => (p.id === productId ? updated : p)));
    if (!moveError && movement) setMovements([movement, ...movements]);
    setMovementTarget(null);
  }

  function handleScanResult(code) {
    setShowScanner(false);
    const found = products.find((p) => p.barcode === code);
    if (found) {
      setSearch(code);
      setActiveCategory("all");
    } else {
      setEditingProduct({ sku: "", name: "", category_id: categories[0]?.id || "", qty: 0, min: 0, price: 0, cost: 0, supplier: "", barcode: code });
      setShowProductModal(true);
    }
  }

  function addToCart(product) {
    if (product.qty <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        if (existing.qty >= product.qty) return prev;
        return prev.map((i) => (i.productId === product.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { productId: product.id, name: product.name, price: Number(product.price), cost: Number(product.cost || 0), qty: 1, maxQty: product.qty }];
    });
  }

  function changeCartQty(productId, delta) {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Math.min(i.maxQty, i.qty + delta)) } : i))
        .filter((i) => i.qty > 0)
    );
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  async function confirmSale() {
    if (cart.length === 0 || savingSale) return;
    setSavingSale(true);
    try {
      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({ total: cartTotal, cost_total: cartCost, payment_method: paymentMethod, customer_name: customerName || null })
        .select()
        .single();
      if (saleError || !sale) throw saleError;

      const itemsPayload = cart.map((i) => ({
        sale_id: sale.id,
        product_id: i.productId,
        product_name: i.name,
        qty: i.qty,
        unit_price: i.price,
        unit_cost: i.cost,
      }));
      const { data: items, error: itemsError } = await supabase.from("sale_items").insert(itemsPayload).select();
      if (itemsError) throw itemsError;

      const updatedProducts = [...products];
      for (const item of cart) {
        const idx = updatedProducts.findIndex((p) => p.id === item.productId);
        if (idx >= 0) {
          const newQty = Math.max(0, updatedProducts[idx].qty - item.qty);
          await supabase.from("products").update({ qty: newQty }).eq("id", item.productId);
          updatedProducts[idx] = { ...updatedProducts[idx], qty: newQty };
        }
      }

      setProducts(updatedProducts);
      setSales([{ ...sale, sale_items: items || [] }, ...sales]);
      setCart([]);
      setCustomerName("");
      setPaymentMethod("efectivo");
    } catch (e) {
      setErrorMsg(e?.message || "No se pudo registrar la venta.");
    }
    setSavingSale(false);
  }

  if (!supabaseConfigured) {
    return (
      <div style={{ background: PALETTE.bg, color: PALETTE.text, minHeight: "100vh" }} className="flex items-center justify-center p-6">
        <div className="max-w-sm rounded-lg p-5" style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}>
          <h2 className="display-font text-base font-semibold mb-2">Falta configurar Supabase</h2>
          <p className="text-sm mb-2" style={{ color: PALETTE.textMuted }}>
            No se encontraron las variables <code className="mono-font">VITE_SUPABASE_URL</code> y{" "}
            <code className="mono-font">VITE_SUPABASE_ANON_KEY</code>.
          </p>
          <p className="text-sm" style={{ color: PALETTE.textMuted }}>
            Si estas en local: revisa tu archivo <code className="mono-font">.env</code>. Si estas en Netlify: agregalas en
            Site configuration → Environment variables y vuelve a hacer deploy.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ background: PALETTE.bg, color: PALETTE.text, minHeight: "100vh" }} className="flex items-center justify-center">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }

  const tabs = [
    { id: "inventario", label: "Inventario", icon: LayoutGrid },
    { id: "movimientos", label: "Movimientos", icon: ClipboardList },
    { id: "ventas", label: "Ventas", icon: ShoppingCart },
    { id: "reportes", label: "Reportes", icon: TrendingUp },
  ];

  return (
    <div style={{ background: PALETTE.bg, color: PALETTE.text, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }} className="w-full p-4">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
        .display-font { font-family: 'Oswald', sans-serif; letter-spacing: 0.03em; text-transform: uppercase; }
        .mono-font { font-family: 'IBM Plex Mono', monospace; }
      `}</style>

      {errorMsg && (
        <div className="mb-4 p-3 rounded text-sm" style={{ background: "#3A1F1A", border: `1px solid ${PALETTE.danger}`, color: PALETTE.text }}>
          {errorMsg}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-4" style={{ borderBottom: `1px solid ${PALETTE.border}` }}>
        <div className="flex items-center gap-2">
          <Boxes size={22} color={PALETTE.accent} />
          <h1 className="display-font text-lg font-semibold">Control de almacen</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium"
                style={{
                  background: tab === t.id ? PALETTE.accent : "transparent",
                  color: tab === t.id ? PALETTE.accentText : PALETTE.textMuted,
                  border: `1px solid ${tab === t.id ? PALETTE.accent : PALETTE.border}`,
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {(tab === "inventario") && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: "Productos", value: stats.totalProducts },
            { label: "Unidades totales", value: stats.totalUnits },
            { label: "Valor de inventario", value: money(stats.totalValue) },
            { label: "Stock bajo", value: stats.lowStock, alert: stats.lowStock > 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-lg p-3" style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}>
              <p className="text-xs mb-1" style={{ color: PALETTE.textMuted }}>{s.label}</p>
              <p className="text-lg font-semibold" style={{ color: s.alert ? PALETTE.danger : PALETTE.text }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "inventario" && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-48 shrink-0">
            <div className="flex items-center gap-1 mb-2">
              <Tag size={13} color={PALETTE.textMuted} />
              <span className="text-xs font-medium" style={{ color: PALETTE.textMuted }}>Categorias</span>
            </div>
            <button
              onClick={() => setActiveCategory("all")}
              className="w-full text-left px-2 py-1.5 rounded text-sm mb-1"
              style={{ background: activeCategory === "all" ? PALETTE.panelAlt : "transparent", color: PALETTE.text }}
            >
              Todas ({products.length})
            </button>
            {categories.map((c) => (
              <div key={c.id} className="flex items-center mb-1">
                <button
                  onClick={() => setActiveCategory(c.id)}
                  className="flex-1 text-left px-2 py-1.5 rounded text-sm truncate"
                  style={{ background: activeCategory === c.id ? PALETTE.panelAlt : "transparent", color: PALETTE.text }}
                >
                  {c.name} ({products.filter((p) => p.category_id === c.id).length})
                </button>
                <button onClick={() => deleteCategory(c.id)} className="px-1 opacity-60 hover:opacity-100">
                  <X size={12} color={PALETTE.textMuted} />
                </button>
              </div>
            ))}
            <div className="flex gap-1 mt-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCategory()}
                placeholder="Nueva categoria"
                className="flex-1 text-sm px-2 py-1 rounded"
                style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, color: PALETTE.text }}
              />
              <button onClick={addCategory} className="px-2 rounded" style={{ background: PALETTE.panelAlt, border: `1px solid ${PALETTE.border}` }}>
                <Plus size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-3">
              <div className="flex items-center flex-1 min-w-[160px] rounded px-2" style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}>
                <Search size={14} color={PALETTE.textMuted} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, SKU, proveedor o codigo"
                  className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none"
                  style={{ color: PALETTE.text }}
                />
              </div>
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium"
                style={{ border: `1px solid ${PALETTE.border}`, color: PALETTE.text }}
              >
                <Camera size={14} /> Escanear
              </button>
              <button
                onClick={() => { setEditingProduct(null); setShowProductModal(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium"
                style={{ background: PALETTE.accent, color: PALETTE.accentText }}
              >
                <Plus size={14} /> Producto
              </button>
            </div>

            <div className="space-y-2">
              {filteredProducts.length === 0 && (
                <p className="text-sm py-8 text-center" style={{ color: PALETTE.textMuted }}>
                  No hay productos que coincidan.
                </p>
              )}
              {filteredProducts.map((p) => {
                const low = Number(p.qty) <= Number(p.min);
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-lg p-3"
                    style={{
                      background: PALETTE.panel,
                      border: `1px solid ${PALETTE.border}`,
                      borderLeft: `3px solid ${low ? PALETTE.danger : PALETTE.border}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="mono-font text-xs px-1.5 py-0.5 rounded" style={{ background: PALETTE.panelAlt, color: PALETTE.textMuted }}>
                          {p.sku}
                        </span>
                        {low && <AlertTriangle size={13} color={PALETTE.danger} />}
                      </div>
                      <p className="text-sm font-medium truncate mt-1">{p.name}</p>
                      <p className="text-xs" style={{ color: PALETTE.textMuted }}>
                        {categoryName(p.category_id)} · {money(p.price)} c/u
                        {p.supplier ? ` · ${p.supplier}` : ""}
                      </p>
                      {p.barcode && (
                        <p className="mono-font text-xs mt-0.5" style={{ color: PALETTE.textMuted }}>{p.barcode}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold" style={{ color: low ? PALETTE.danger : PALETTE.text }}>{p.qty}</p>
                      <p className="text-xs" style={{ color: PALETTE.textMuted }}>min {p.min}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setMovementTarget({ product: p, type: "in" })} title="Registrar entrada">
                        <ArrowDownCircle size={20} color={PALETTE.success} />
                      </button>
                      <button onClick={() => setMovementTarget({ product: p, type: "out" })} title="Registrar salida">
                        <ArrowUpCircle size={20} color={PALETTE.danger} />
                      </button>
                      <button onClick={() => { setEditingProduct(p); setShowProductModal(true); }} title="Editar">
                        <Pencil size={16} color={PALETTE.textMuted} />
                      </button>
                      <button onClick={() => deleteProduct(p.id)} title="Eliminar">
                        <Trash2 size={16} color={PALETTE.textMuted} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "movimientos" && (
        <div>
          {movements.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: PALETTE.textMuted }}>
              Aun no hay movimientos registrados.
            </p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => {
                const p = products.find((pr) => pr.id === m.product_id);
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg p-3" style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}>
                    {m.type === "in" ? <ArrowDownCircle size={18} color={PALETTE.success} /> : <ArrowUpCircle size={18} color={PALETTE.danger} />}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{p ? p.name : "Producto eliminado"}</p>
                      <p className="text-xs" style={{ color: PALETTE.textMuted }}>
                        {new Date(m.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                        {m.note ? ` · ${m.note}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: m.type === "in" ? PALETTE.success : PALETTE.danger }}>
                      {m.type === "in" ? "+" : "-"}{m.qty}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "ventas" && (
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="flex items-center flex-1 rounded px-2 mb-3" style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}>
              <Search size={14} color={PALETTE.textMuted} />
              <input
                value={saleSearch}
                onChange={(e) => setSaleSearch(e.target.value)}
                placeholder="Buscar producto para agregar a la venta"
                className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none"
                style={{ color: PALETTE.text }}
              />
            </div>
            <div className="space-y-2">
              {saleProductResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={p.qty <= 0}
                  className="w-full flex items-center gap-3 rounded-lg p-3 text-left"
                  style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}`, opacity: p.qty <= 0 ? 0.5 : 1 }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs" style={{ color: PALETTE.textMuted }}>{money(p.price)} · stock {p.qty}</p>
                  </div>
                  <Plus size={16} color={PALETTE.accent} />
                </button>
              ))}
              {saleProductResults.length === 0 && (
                <p className="text-sm py-6 text-center" style={{ color: PALETTE.textMuted }}>No se encontraron productos.</p>
              )}
            </div>
          </div>

          <div className="w-full md:w-80 shrink-0">
            <div className="rounded-lg p-3" style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <Receipt size={16} color={PALETTE.accent} />
                <h3 className="display-font text-sm font-semibold">Ticket actual</h3>
              </div>
              {cart.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: PALETTE.textMuted }}>Agrega productos a la venta.</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {cart.map((i) => (
                    <div key={i.productId} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{i.name}</p>
                        <p className="text-xs" style={{ color: PALETTE.textMuted }}>{money(i.price)} c/u</p>
                      </div>
                      <button onClick={() => changeCartQty(i.productId, -1)}><Minus size={14} color={PALETTE.textMuted} /></button>
                      <span className="text-sm w-5 text-center">{i.qty}</span>
                      <button onClick={() => changeCartQty(i.productId, 1)}><Plus size={14} color={PALETTE.textMuted} /></button>
                      <button onClick={() => removeFromCart(i.productId)}><X size={14} color={PALETTE.danger} /></button>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 mb-3" style={{ borderTop: `1px solid ${PALETTE.border}` }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: PALETTE.textMuted }}>Total</span>
                  <span className="font-semibold">{money(cartTotal)}</span>
                </div>
              </div>

              <div className="mb-2">
                <label className="text-xs" style={{ color: PALETTE.textMuted }}>Metodo de pago</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded mt-1"
                  style={{ background: PALETTE.panelAlt, border: `1px solid ${PALETTE.border}`, color: PALETTE.text }}
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
              <div className="mb-3">
                <label className="text-xs" style={{ color: PALETTE.textMuted }}>Cliente (opcional)</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-sm px-2 py-1.5 rounded mt-1"
                  style={{ background: PALETTE.panelAlt, border: `1px solid ${PALETTE.border}`, color: PALETTE.text }}
                />
              </div>

              <button
                onClick={confirmSale}
                disabled={cart.length === 0 || savingSale}
                className="w-full py-2 rounded text-sm font-medium"
                style={{ background: PALETTE.accent, color: PALETTE.accentText, opacity: cart.length === 0 || savingSale ? 0.6 : 1 }}
              >
                {savingSale ? "Guardando..." : "Confirmar venta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "reportes" && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Vendido hoy", value: money(reportStats.todayTotal) },
              { label: "Ganancia hoy", value: money(reportStats.todayProfit) },
              { label: "Vendido este mes", value: money(reportStats.monthTotal) },
              { label: "Ganancia este mes", value: money(reportStats.monthProfit) },
            ].map((s) => (
              <div key={s.label} className="rounded-lg p-3" style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}>
                <p className="text-xs mb-1" style={{ color: PALETTE.textMuted }}>{s.label}</p>
                <p className="text-lg font-semibold">{s.value}</p>
              </div>
            ))}
          </div>

          <h3 className="display-font text-sm font-semibold mb-2">Productos mas vendidos</h3>
          {reportStats.topProducts.length === 0 ? (
            <p className="text-sm py-4" style={{ color: PALETTE.textMuted }}>Aun no hay ventas registradas.</p>
          ) : (
            <div className="space-y-2 mb-6">
              {reportStats.topProducts.map(([name, qty]) => (
                <div key={name} className="flex items-center justify-between rounded-lg p-3" style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}>
                  <span className="text-sm">{name}</span>
                  <span className="text-sm font-semibold" style={{ color: PALETTE.accent }}>{qty} vendidos</span>
                </div>
              ))}
            </div>
          )}

          <h3 className="display-font text-sm font-semibold mb-2">Ultimas ventas</h3>
          {sales.length === 0 ? (
            <p className="text-sm py-4" style={{ color: PALETTE.textMuted }}>Aun no hay ventas registradas.</p>
          ) : (
            <div className="space-y-2">
              {sales.slice(0, 20).map((s) => (
                <div key={s.id} className="rounded-lg p-3" style={{ background: PALETTE.panel, border: `1px solid ${PALETTE.border}` }}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs" style={{ color: PALETTE.textMuted }}>
                      {new Date(s.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                      {s.customer_name ? ` · ${s.customer_name}` : ""} · {s.payment_method}
                    </span>
                    <span className="text-sm font-semibold">{money(s.total)}</span>
                  </div>
                  <p className="text-xs" style={{ color: PALETTE.textMuted }}>
                    {(s.sale_items || []).map((it) => `${it.qty}x ${it.product_name}`).join(", ")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showProductModal && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          palette={PALETTE}
          onCancel={() => { setShowProductModal(false); setEditingProduct(null); }}
          onSave={saveProduct}
        />
      )}

      {movementTarget && (
        <MovementModal
          target={movementTarget}
          palette={PALETTE}
          onCancel={() => setMovementTarget(null)}
          onConfirm={(qty, note) => registerMovement(movementTarget.product.id, movementTarget.type, qty, note)}
        />
      )}

      {showScanner && (
        <ScannerModal palette={PALETTE} onCancel={() => setShowScanner(false)} onDetected={handleScanResult} />
      )}
    </div>
  );
}

function ProductModal({ product, categories, palette, onCancel, onSave }) {
  const [form, setForm] = useState(
    product || { sku: "", name: "", category_id: categories[0]?.id || "", qty: 0, min: 0, price: 0, cost: 0, supplier: "", barcode: "" }
  );

  function handleSave() {
    if (!form.name.trim() || !form.sku.trim()) return;
    onSave({ ...form, qty: Number(form.qty), min: Number(form.min), price: Number(form.price), cost: Number(form.cost || 0) });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", zIndex: 50 }}>
      <div className="w-full max-w-sm rounded-lg p-4 max-h-[90vh] overflow-y-auto" style={{ background: palette.panel, border: `1px solid ${palette.borderStrong}` }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="display-font text-sm font-semibold">{product?.id ? "Editar producto" : "Nuevo producto"}</h3>
          <button onClick={onCancel}><X size={16} color={palette.textMuted} /></button>
        </div>
        <div className="space-y-2">
          <Field label="SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} palette={palette} />
          <Field label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} palette={palette} />
          <div>
            <label className="text-xs" style={{ color: palette.textMuted }}>Categoria</label>
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full text-sm px-2 py-1.5 rounded mt-1"
              style={{ background: palette.panelAlt, border: `1px solid ${palette.border}`, color: palette.text }}
            >
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Cantidad" type="number" value={form.qty} onChange={(v) => setForm({ ...form, qty: v })} palette={palette} />
            <Field label="Minimo" type="number" value={form.min} onChange={(v) => setForm({ ...form, min: v })} palette={palette} />
            <Field label="Precio venta" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} palette={palette} />
          </div>
          <Field label="Precio costo" type="number" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} palette={palette} />
          <Field label="Proveedor" value={form.supplier} onChange={(v) => setForm({ ...form, supplier: v })} palette={palette} />
          <Field label="Codigo de barras" value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} palette={palette} />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 py-1.5 rounded text-sm" style={{ border: `1px solid ${palette.border}`, color: palette.textMuted }}>
            Cancelar
          </button>
          <button onClick={handleSave} className="flex-1 py-1.5 rounded text-sm font-medium" style={{ background: palette.accent, color: palette.accentText }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, palette, type = "text" }) {
  return (
    <div>
      <label className="text-xs" style={{ color: palette.textMuted }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-2 py-1.5 rounded mt-1"
        style={{ background: palette.panelAlt, border: `1px solid ${palette.border}`, color: palette.text }}
      />
    </div>
  );
}

function MovementModal({ target, palette, onCancel, onConfirm }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const isIn = target.type === "in";

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", zIndex: 50 }}>
      <div className="w-full max-w-xs rounded-lg p-4" style={{ background: palette.panel, border: `1px solid ${palette.borderStrong}` }}>
        <div className="flex items-center gap-2 mb-3">
          {isIn ? <ArrowDownCircle size={18} color={palette.success} /> : <ArrowUpCircle size={18} color={palette.danger} />}
          <h3 className="display-font text-sm font-semibold">{isIn ? "Registrar entrada" : "Registrar salida"}</h3>
        </div>
        <p className="text-sm mb-3" style={{ color: palette.textMuted }}>{target.product.name}</p>
        <Field label="Cantidad" type="number" value={qty} onChange={setQty} palette={palette} />
        <div className="mt-2">
          <Field label="Nota (opcional)" value={note} onChange={setNote} palette={palette} />
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 py-1.5 rounded text-sm" style={{ border: `1px solid ${palette.border}`, color: palette.textMuted }}>
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(qty, note)}
            className="flex-1 py-1.5 rounded text-sm font-medium"
            style={{ background: isIn ? palette.success : palette.danger, color: "#fff" }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function ScannerModal({ palette, onCancel, onDetected }) {
  const videoRef = useRef(null);
  const [error, setError] = useState("");
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    let stream;
    let stop = false;
    let rafId;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stop) return;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        if ("BarcodeDetector" in window) {
          const detector = new window.BarcodeDetector();
          const scan = async () => {
            if (stop) return;
            try {
              const codes = await detector.detect(videoRef.current);
              if (codes.length > 0) {
                onDetected(codes[0].rawValue);
                return;
              }
            } catch {
              // el frame aun no esta listo, seguimos intentando
            }
            rafId = requestAnimationFrame(scan);
          };
          scan();
        } else {
          setError("Este navegador no soporta lectura automatica. Escribe el codigo manualmente.");
        }
      } catch {
        setError("No se pudo acceder a la camara. Verifica los permisos del navegador.");
      }
    }
    start();

    return () => {
      stop = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)", zIndex: 50 }}>
      <div className="w-full max-w-xs rounded-lg p-4" style={{ background: palette.panel, border: `1px solid ${palette.borderStrong}` }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="display-font text-sm font-semibold">Escanear codigo</h3>
          <button onClick={onCancel}><X size={16} color={palette.textMuted} /></button>
        </div>
        <div className="w-full rounded-lg overflow-hidden mb-3" style={{ background: "#000", aspectRatio: "4 / 3", border: `1px solid ${palette.border}` }}>
          <video ref={videoRef} muted playsInline className="w-full h-full object-cover" />
        </div>
        {error && <p className="text-xs mb-2" style={{ color: palette.danger }}>{error}</p>}
        <p className="text-xs mb-2" style={{ color: palette.textMuted }}>
          O escribe el codigo si el escaneo automatico no funciona:
        </p>
        <div className="flex gap-2">
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && manualCode.trim() && onDetected(manualCode.trim())}
            placeholder="Codigo de barras"
            className="flex-1 text-sm px-2 py-1.5 rounded"
            style={{ background: palette.panelAlt, border: `1px solid ${palette.border}`, color: palette.text }}
          />
          <button
            onClick={() => manualCode.trim() && onDetected(manualCode.trim())}
            className="px-3 rounded text-sm font-medium"
            style={{ background: palette.accent, color: palette.accentText }}
          >
            Usar
          </button>
        </div>
      </div>
    </div>
  );
}
