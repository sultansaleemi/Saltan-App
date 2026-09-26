import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const DB_NAME = "SaleTrackerDB";
const DB_VERSION = 2;
const STORE = "app";
const OLD_KEY = "saleTrackerReact_v1";

const API_BASE = "/api";

const empty = {
  products: [],
  orders: [],
  purchases: [],
  expenses: [],
  orderCounter: 0,
  settings: {
    companyName: "",
    phone: "",
    whatsapp: "",
    address: "",
    email: "",
    logo: "",
    currency: "AED"
  }
};

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const today = () => new Date().toISOString().slice(0, 10);

const money = (n) =>
  "AED " +
  (Math.round((Number(n) || 0) * 100) / 100).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });

const merge = (d) => ({
  ...empty,
  ...d,
  products: d?.products || [],
  orders: d?.orders || [],
  purchases: d?.purchases || [],
  expenses: d?.expenses || [],
  settings: {
    ...empty.settings,
    ...(d?.settings || {})
  }
});

/* =====================================================
   INDEXEDDB
===================================================== */

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);

    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(STORE)) {
        r.result.createObjectStore(STORE);
      }
    };

    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function dbGet() {
  const db = await openDB();

  return new Promise((res, rej) => {
    const r = db
      .transaction(STORE)
      .objectStore(STORE)
      .get("data");

    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error);
  });
}

async function dbPut(data) {
  const db = await openDB();

  return new Promise((res, rej) => {
    const r = db
      .transaction(STORE, "readwrite")
      .objectStore(STORE)
      .put(data, "data");

    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
  });
}

/* =====================================================
   BUSINESS CALCULATIONS
===================================================== */

function revenue(o) {
  return o.status === "Cancelled" ? 0 : Number(o.price) || 0;
}

function orderExpense(o) {
  return (
    (Number(o.delivery) || 0) +
    (Number(o.other) || 0) +
    (!o.productId ? Number(o.cost) || 0 : 0)
  );
}

function profit(o) {
  return revenue(o) - orderExpense(o);
}

function monthMatch(d) {
  const x = new Date(d);
  const n = new Date();

  return (
    x.getFullYear() === n.getFullYear() &&
    x.getMonth() === n.getMonth()
  );
}

/* =====================================================
   CLOUDFLARE API
===================================================== */

async function apiGet(resource) {
  const response = await fetch(`${API_BASE}/${resource}`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Cloud GET failed: ${response.status}`);
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || "Cloud GET failed");
  }

  return result.data || [];
}

async function apiSave(resource, item) {
  const response = await fetch(`${API_BASE}/${resource}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(item)
  });

  if (!response.ok) {
    throw new Error(`Cloud save failed: ${response.status}`);
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || "Cloud save failed");
  }

  return result;
}

async function apiDelete(resource, id) {
  const response = await fetch(
    `${API_BASE}/${resource}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Cloud delete failed: ${response.status}`);
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(result.error || "Cloud delete failed");
  }

  return result;
}

/* =====================================================
   REACT → CLOUDFLARE
===================================================== */

function productToCloud(p) {
  return {
    id: p.id,
    name: p.name || "",
    cost: Number(p.cost) || 0,
    stock: Math.max(0, Math.trunc(Number(p.stock) || 0))
  };
}

function orderToCloud(o) {
  return {
    id: o.id,
    orderNo: Number(o.orderNo) || 0,
    productId: o.productId || null,
    productName: o.productName || "",
    price: Number(o.price) || 0,
    cost: Number(o.cost) || 0,
    deliveryCost: Number(o.delivery) || 0,
    otherExpense: Number(o.other) || 0,
    status: o.status || "Pending",
    orderDate: o.date || today(),
    customerName: o.customerName || null,
    customerPhone: o.phone || null,
    customerLocation: o.location || null
  };
}

function purchaseToCloud(p) {
  return {
    id: p.id,
    productId: p.productId || null,
    productName: p.name || p.productName || "",
    quantity: Math.trunc(Number(p.qty ?? p.quantity) || 0),
    costEach: Number(p.costEach) || 0,
    total: Number(p.total) || 0,
    purchaseDate: p.date || p.purchaseDate || today()
  };
}

function expenseToCloud(e) {
  return {
    id: e.id,
    title: e.description || e.title || "",
    amount: Number(e.amount) || 0,
    category: e.category || null,
    expenseDate: e.date || e.expenseDate || today(),
    notes: e.paymentMethod || e.notes || null
  };
}

/* =====================================================
   CLOUDFLARE → REACT
===================================================== */

function productFromCloud(p) {
  return {
    id: p.id,
    name: p.name || "",
    cost: Number(p.cost) || 0,
    stock: Number(p.stock) || 0
  };
}

function orderFromCloud(o) {
  return {
    id: o.id,
    orderNo: Number(o.order_no) || 0,
    productId: o.product_id || "",
    productName: o.product_name || "",
    price: Number(o.price) || 0,
    cost: Number(o.cost) || 0,
    delivery: Number(o.delivery_cost) || 0,
    other: Number(o.other_expense) || 0,
    status: o.status || "Pending",
    date: o.order_date || today(),
    customerName: o.customer_name || "",
    phone: o.customer_phone || "",
    location: o.customer_location || "",
    payment: o.payment || "Unpaid"
  };
}

function purchaseFromCloud(p) {
  return {
    id: p.id,
    productId: p.product_id || "",
    name: p.product_name || "",
    qty: Number(p.quantity) || 0,
    costEach: Number(p.cost_each) || 0,
    total: Number(p.total) || 0,
    date: p.purchase_date || today()
  };
}

function expenseFromCloud(e) {
  return {
    id: e.id,
    date: e.expense_date || today(),
    category: e.category || "Other",
    description: e.title || "",
    amount: Number(e.amount) || 0,
    paymentMethod: e.notes || "Cash"
  };
}

/* =====================================================
   MERGE
===================================================== */

function mergeRecords(localItems, cloudItems, fromCloud) {
  const map = new Map();

  for (const item of localItems || []) {
    if (item?.id) {
      map.set(item.id, item);
    }
  }

  for (const item of cloudItems || []) {
    const converted = fromCloud(item);

    if (!converted?.id) continue;

    /*
      Local data is kept when the same ID exists.
      Cloud-only records are added.
    */
    if (!map.has(converted.id)) {
      map.set(converted.id, converted);
    }
  }

  return [...map.values()];
}

/* =====================================================
   FIRST / STARTUP CLOUD SYNC
===================================================== */

async function syncCloud(localData) {
  try {
    console.log("☁️ Connecting to Cloudflare D1...");

    const [
      cloudProducts,
      cloudOrders,
      cloudPurchases,
      cloudExpenses
    ] = await Promise.all([
      apiGet("products"),
      apiGet("orders"),
      apiGet("purchases"),
      apiGet("expenses")
    ]);

    const merged = merge({
      ...localData,

      products: mergeRecords(
        localData.products,
        cloudProducts,
        productFromCloud
      ),

      orders: mergeRecords(
        localData.orders,
        cloudOrders,
        orderFromCloud
      ),

      purchases: mergeRecords(
        localData.purchases,
        cloudPurchases,
        purchaseFromCloud
      ),

      expenses: mergeRecords(
        localData.expenses,
        cloudExpenses,
        expenseFromCloud
      )
    });

    /*
      Upload records that exist locally but not in D1.
    */

    const cloudIds = {
      products: new Set(cloudProducts.map((x) => x.id)),
      orders: new Set(cloudOrders.map((x) => x.id)),
      purchases: new Set(cloudPurchases.map((x) => x.id)),
      expenses: new Set(cloudExpenses.map((x) => x.id))
    };

    await Promise.all([
      ...merged.products
        .filter((x) => !cloudIds.products.has(x.id))
        .map((x) => apiSave("products", productToCloud(x))),

      ...merged.orders
        .filter((x) => !cloudIds.orders.has(x.id))
        .map((x) => apiSave("orders", orderToCloud(x))),

      ...merged.purchases
        .filter((x) => !cloudIds.purchases.has(x.id))
        .map((x) => apiSave("purchases", purchaseToCloud(x))),

      ...merged.expenses
        .filter((x) => !cloudIds.expenses.has(x.id))
        .map((x) => apiSave("expenses", expenseToCloud(x)))
    ]);

    await dbPut(merged);

    console.log("☁️ Initial cloud sync complete");

    return merged;
  } catch (error) {
    console.warn(
      "☁️ Cloud sync unavailable. Continuing with local data.",
      error
    );

    return localData;
  }
}

/* =====================================================
   SAVE ONLY CHANGED RECORDS
===================================================== */

async function syncChangedRecords(previous, next) {
  try {
    const jobs = [];

    /*
      PRODUCTS
    */

    const previousProducts = new Map(
      (previous.products || []).map((x) => [x.id, x])
    );

    const nextProducts = new Map(
      (next.products || []).map((x) => [x.id, x])
    );

    for (const item of next.products || []) {
      const old = previousProducts.get(item.id);

      if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
        jobs.push(apiSave("products", productToCloud(item)));
      }
    }

    for (const old of previous.products || []) {
      if (!nextProducts.has(old.id)) {
        jobs.push(apiDelete("products", old.id));
      }
    }

    /*
      ORDERS
    */

    const previousOrders = new Map(
      (previous.orders || []).map((x) => [x.id, x])
    );

    const nextOrders = new Map(
      (next.orders || []).map((x) => [x.id, x])
    );

    for (const item of next.orders || []) {
      const old = previousOrders.get(item.id);

      if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
        jobs.push(apiSave("orders", orderToCloud(item)));
      }
    }

    for (const old of previous.orders || []) {
      if (!nextOrders.has(old.id)) {
        jobs.push(apiDelete("orders", old.id));
      }
    }

    /*
      EXPENSES
    */

    const previousExpenses = new Map(
      (previous.expenses || []).map((x) => [x.id, x])
    );

    const nextExpenses = new Map(
      (next.expenses || []).map((x) => [x.id, x])
    );

    for (const item of next.expenses || []) {
      const old = previousExpenses.get(item.id);

      if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
        jobs.push(apiSave("expenses", expenseToCloud(item)));
      }
    }

    for (const old of previous.expenses || []) {
      if (!nextExpenses.has(old.id)) {
        jobs.push(apiDelete("expenses", old.id));
      }
    }

    /*
      PURCHASES

      The current Worker supports GET/POST for purchases
      but does not currently provide DELETE.

      Therefore new/changed purchases are uploaded,
      but an existing purchase is not deleted from D1 here.
    */

    const previousPurchases = new Map(
      (previous.purchases || []).map((x) => [x.id, x])
    );

    for (const item of next.purchases || []) {
      const old = previousPurchases.get(item.id);

      if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
        jobs.push(apiSave("purchases", purchaseToCloud(item)));
      }
    }

    await Promise.all(jobs);

    console.log("☁️ Changes synchronized");

  } catch (error) {
    console.warn(
      "☁️ Could not synchronize changes. Local data is safe.",
      error
    );
  }
}

/* =====================================================
   APP
===================================================== */

function App() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [sale, setSale] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [editOrder, setEditOrder] = useState(null);
  const [period, setPeriod] = useState("month");

  const dataRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        let d = await dbGet();

        /*
          First installation:
          load legacy localStorage data if available.
        */

        if (!d) {
          try {
            const old = JSON.parse(
              localStorage.getItem(OLD_KEY) || "null"
            );

            d = old ? merge(old) : empty;
          } catch {
            d = empty;
          }

          await dbPut(d);
        } else if (!d.expenses) {
          d = merge(d);
          await dbPut(d);
        }

        d = merge(d);

        /*
          Display local data immediately.
        */
        dataRef.current = d;
        setData(d);

        /*
          Then connect to D1.
        */
        const synced = await syncCloud(d);

        dataRef.current = synced;
        setData(synced);

      } catch (error) {
        console.error("Startup error:", error);

        const fallback = merge(empty);

        dataRef.current = fallback;
        setData(fallback);
      }
    })();
  }, []);

  /*
    Every local update:
    1. Updates screen immediately.
    2. Saves to IndexedDB.
    3. Sends only changed records to D1.
  */

  const update = async (nextData) => {
    const previous = dataRef.current || empty;
    const next = merge(nextData);

    dataRef.current = next;
    setData(next);

    /*
      Local save always happens first.
      This means the app can continue working offline.
    */
    await dbPut(next);

    /*
      Cloud sync happens after local save.
    */
    await syncChangedRecords(previous, next);
  };

  if (!data) {
    return (
      <div className="loading">
        Loading SALTAN FASHION…
      </div>
    );
  }

  const orders =
    period === "all"
      ? data.orders
      : data.orders.filter((o) => monthMatch(o.date));

  const purchases =
    period === "all"
      ? data.purchases
      : data.purchases.filter((p) => monthMatch(p.date));

  const expenses =
    period === "all"
      ? data.expenses
      : data.expenses.filter((e) => monthMatch(e.date));

  const sales = orders.reduce(
    (s, o) => s + revenue(o),
    0
  );

  const orderEx = orders.reduce(
    (s, o) => s + orderExpense(o),
    0
  );

  const stockEx = purchases.reduce(
    (s, p) => s + Number(p.total || 0),
    0
  );

  const generalEx = expenses.reduce(
    (s, e) => s + Number(e.amount || 0),
    0
  );

  const stock = data.products.reduce(
    (s, p) =>
      s +
      Math.max(
        0,
        p.stock -
          data.orders.filter(
            (o) =>
              o.productId === p.id &&
              !["Cancelled"].includes(o.status) &&
              ["Dispatched", "Delivered"].includes(o.status)
          ).length
      ),
    0
  );

  const stats = {
    sales,
    orderEx,
    stockEx,
    generalEx,
    expenses: orderEx + stockEx + generalEx,
    expenseCount: expenses.length,
    profit: sales - orderEx - stockEx - generalEx,
    orders: orders.length,
    pending: orders.filter(
      (o) => o.status === "Pending"
    ).length,
    stock
  };

  const nav = [
    ["dashboard", "⌂ Dashboard"],
    ["products", "◫ Products"],
    ["orders", "▤ Orders"],
    ["expenses", "▣ Expenses"],
    ["settings", "⚙ Settings"]
  ];

  return (
    <div className="app">

      <header className="top">

        <div className="brand">
          Sale <span>Tracker</span>
        </div>

        <nav>
          {nav.map(([id, label]) => (
            <button
              key={id}
              className={page === id ? "active" : ""}
              onClick={() => setPage(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <button
          className="add"
          onClick={() => setSale(true)}
        >
          ＋ Sale
        </button>

      </header>

      <main>

        {page === "dashboard" && (
          <Dashboard
            data={data}
            stats={stats}
            period={period}
            setPeriod={setPeriod}
            openReceipt={setReceipt}
            edit={setEditOrder}
          />
        )}

        {page === "products" && (
          <Products
            data={data}
            update={update}
          />
        )}

        {page === "orders" && (
          <Orders
            data={data}
            update={update}
            receipt={setReceipt}
            edit={setEditOrder}
            add={() => setSale(true)}
          />
        )}

        {page === "expenses" && (
          <Expenses
            data={data}
            update={update}
          />
        )}

        {page === "settings" && (
          <Settings
            data={data}
            update={update}
          />
        )}

      </main>

      <div className="mobilebar">

        {nav.map(([id, i]) => (
          <button
            key={id}
            className={page === id ? "sel" : ""}
            onClick={() => setPage(id)}
          >
            <b>{i[0]}</b>
            <span>{id}</span>
          </button>
        ))}

        <button
          className="mobile-sale"
          onClick={() => setSale(true)}
        >
          ＋
        </button>

      </div>

      {sale && (
        <SaleModal
          data={data}
          update={update}
          close={() => setSale(false)}
          receipt={setReceipt}
        />
      )}

      {editOrder && (
        <SaleModal
          data={data}
          update={update}
          initial={editOrder}
          close={() => setEditOrder(null)}
          receipt={setReceipt}
        />
      )}

      {receipt && (
        <Receipt
          order={receipt}
          data={data}
          close={() => setReceipt(null)}
        />
      )}

    </div>
  );
}

/* =====================================================
   DASHBOARD
===================================================== */

function Dashboard({
  data,
  stats,
  period,
  setPeriod,
  openReceipt,
  edit
}) {
  const recent = [...data.orders]
    .sort((a, b) => b.orderNo - a.orderNo)
    .slice(0, 8);

  return (
    <section>

      <div className="head">

        <div>
          <h1>Dashboard</h1>
          <p>
            Sales, stock and expenses at a glance.
          </p>
        </div>

        <div className="seg">

          <button
            className={period === "month" ? "on" : ""}
            onClick={() => setPeriod("month")}
          >
            This month
          </button>

          <button
            className={period === "all" ? "on" : ""}
            onClick={() => setPeriod("all")}
          >
            All time
          </button>

        </div>

      </div>

      <div className="kpis">

        <K
          label="Net profit"
          v={money(stats.profit)}
          a
        />

        <K
          label="Sales"
          v={money(stats.sales)}
        />

        <K
  label="Expenses"
  v={money(stats.expenses)}
  icon="💸"
/>

        <K
          label="Orders"
          v={stats.orders}
        />

        <K
          label="In stock"
          v={stats.stock}
        />

        <K
          label="Pending"
          v={stats.pending}
          d
        />

      </div>

      <div className="expense-highlight">

        <div>
          <span>General expenses</span>
          <b>{money(stats.generalEx)}</b>
          <small>
            {stats.expenseCount} expense records this period
          </small>
        </div>

        <button
          onClick={() =>
            document
              .querySelectorAll(".mobilebar button")[3]
              ?.click()
          }
        >
          View expenses →
        </button>

      </div>

      <div className="dashboard-grid">

        <div className="panel">

          <div className="panel-head">
            <h2>Recent orders</h2>
            <span>{data.orders.length} total</span>
          </div>

          {recent.length ? (
            recent.map((o) => (
              <OrderRow
                key={o.id}
                o={o}
                edit={edit}
                receipt={openReceipt}
              />
            ))
          ) : (
            <Empty text="No orders yet." />
          )}

        </div>

        <div className="panel">

          <div className="panel-head">
            <h2>Expenses</h2>
            <span>{data.expenses.length} general</span>
          </div>

          <ExpenseSummary
            expenses={data.expenses.filter(
              (e) =>
                period === "all" ||
                monthMatch(e.date)
            )}
          />

        </div>

      </div>

    </section>
  );
}

function K({ label, v, a, d }) {
  return (
    <div
      className={
        "k " +
        (a ? "gold " : "") +
        (d ? "red" : "")
      }
    >
      <b>{v}</b>
      <span>{label}</span>
    </div>
  );
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

/* =====================================================
   PRODUCTS
===================================================== */

function Products({ data, update }) {
  const [form, setForm] = useState(null);

  const save = (p) => {
    let n = { ...data };

    if (p.id) {
      n.products = n.products.map(
        (x) => (x.id === p.id ? p : x)
      );
    } else {
      p = {
        ...p,
        id: uid()
      };

      n.products = [
        ...n.products,
        p
      ];

      if (p.stock) {
        n.purchases = [
          ...n.purchases,
          {
            id: uid(),
            productId: p.id,
            name: p.name,
            qty: p.stock,
            costEach: p.cost,
            total: p.stock * p.cost,
            date: today()
          }
        ];
      }
    }

    update(n);
    setForm(null);
  };

  return (
    <section>

      <div className="head">

        <div>
          <h1>Products</h1>
          <p>
            Inventory and product cost tracking.
          </p>
        </div>

        <button
          className="primary"
          onClick={() =>
            setForm({
              name: "",
              cost: 0,
              stock: 0
            })
          }
        >
          ＋ Add product
        </button>

      </div>

      <div className="cards">

        {data.products.map((p) => (
          <div
            className="product"
            key={p.id}
          >

            <h3>{p.name}</h3>

            <div>
              <span>Cost</span>
              <b>{money(p.cost)}</b>
            </div>

            <div>
              <span>Stock</span>
              <b>{p.stock}</b>
            </div>

            <div className="actions">

              <button
                onClick={() => setForm(p)}
              >
                Edit
              </button>

              <button
                className="danger"
                onClick={() =>
                  confirm(
                    "Remove product? Past orders stay saved."
                  ) &&
                  update({
                    ...data,
                    products:
                      data.products.filter(
                        (x) => x.id !== p.id
                      ),
                    purchases:
                      data.purchases.filter(
                        (x) => x.productId !== p.id
                      )
                  })
                }
              >
                Remove
              </button>

            </div>

          </div>
        ))}

      </div>

      {!data.products.length && (
        <div className="panel">
          <Empty text="No products yet." />
        </div>
      )}

      {form && (
        <ProductForm
          p={form}
          save={save}
          close={() => setForm(null)}
        />
      )}

    </section>
  );
}

function ProductForm({ p, save, close }) {
  const [f, setF] = useState(p);

  return (
    <Modal
      title={p.id ? "Edit product" : "Add product"}
      close={close}
    >

      <Field l="Product name">
        <input
          value={f.name}
          onChange={(e) =>
            setF({
              ...f,
              name: e.target.value
            })
          }
        />
      </Field>

      <div className="grid2">

        <Field l="Cost price">
          <input
            type="number"
            value={f.cost}
            onChange={(e) =>
              setF({
                ...f,
                cost: Number(e.target.value)
              })
            }
          />
        </Field>

        <Field l="Stock">
          <input
            type="number"
            value={f.stock}
            onChange={(e) =>
              setF({
                ...f,
                stock: Number(e.target.value)
              })
            }
          />
        </Field>

      </div>

      <button
        className="primary wide"
        onClick={() =>
          f.name.trim()
            ? save(f)
            : alert("Enter product name.")
        }
      >
        Save
      </button>

    </Modal>
  );
}

/* =====================================================
   ORDERS
===================================================== */

function Orders({
  data,
  update,
  receipt,
  edit,
  add
}) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState("All");

  const rows = [...data.orders]
    .sort((a, b) => b.orderNo - a.orderNo)
    .filter(
      (o) =>
        (
          `${o.customerName} ${o.phone} ${o.location} ${o.productName}`
        )
          .toLowerCase()
          .includes(q.toLowerCase()) &&
        (st === "All" || o.status === st)
    );

  const change = (id, v) =>
    update({
      ...data,
      orders: data.orders.map(
        (o) =>
          o.id === id
            ? {
                ...o,
                status: v
              }
            : o
      )
    });

  const remove = (id) => {
    if (
      !confirm(
        "Delete this order permanently from this device?"
      )
    ) {
      return;
    }

    update({
      ...data,
      orders: data.orders.filter(
        (x) => x.id !== id
      )
    });
  };

  return (
    <section>

      <div className="head">

        <div>
          <h1>Orders</h1>
          <p>
            Every order can be edited, status-updated or deleted.
          </p>
        </div>

        <button
          className="primary"
          onClick={add}
        >
          ＋ Add order
        </button>

      </div>

      <div className="toolbar">

        <input
          placeholder="Search customer, phone, location or product…"
          value={q}
          onChange={(e) =>
            setQ(e.target.value)
          }
        />

        <select
          value={st}
          onChange={(e) =>
            setSt(e.target.value)
          }
        >
          <option>All</option>
          <option>Pending</option>
          <option>Dispatched</option>
          <option>Delivered</option>
          <option>Cancelled</option>
        </select>

      </div>

      <div className="panel">

        {rows.length ? (
          rows.map((o) => (
            <OrderRow
              key={o.id}
              o={o}
              edit={edit}
              receipt={receipt}
              onStatus={change}
              onDelete={remove}
            />
          ))
        ) : (
          <Empty text="No matching orders." />
        )}

      </div>

    </section>
  );
}

function OrderRow({
  o,
  edit,
  receipt,
  onStatus,
  onDelete
}) {
  return (
    <div className="order">

      <div className="order-info">

        <b>
          ORD-
          {String(o.orderNo).padStart(3, "0")}
        </b>

        <div>
          <strong>{o.productName}</strong>

          <small>
            {o.customerName || "Walk-in"}

            {o.phone && " · " + o.phone}

            {o.location && " · " + o.location}
          </small>
        </div>

      </div>

      <div className="order-money">

        <span>{money(o.price)}</span>

        <b
          className={
            profit(o) < 0
              ? "negative"
              : ""
          }
        >
          {money(profit(o))}
        </b>

      </div>

      <div className="order-actions">

        <select
          className={o.status}
          value={o.status}
          onChange={(e) =>
            onStatus &&
            onStatus(
              o.id,
              e.target.value
            )
          }
        >
          <option>Pending</option>
          <option>Dispatched</option>
          <option>Delivered</option>
          <option>Cancelled</option>
        </select>

        <button onClick={() => edit(o)}>
          Edit
        </button>

        <button onClick={() => receipt(o)}>
          Receipt
        </button>

        {onDelete && (
          <button
            className="danger"
            onClick={() => onDelete(o.id)}
          >
            Delete
          </button>
        )}

      </div>

    </div>
  );
}

/* =====================================================
   SALE MODAL
===================================================== */

function SaleModal({
  data,
  update,
  close,
  receipt,
  initial
}) {
  const [f, setF] = useState(
    initial
      ? { ...initial }
      : {
          productName: "",
          productId: "",
          price: "",
          cost: "",
          delivery: "",
          other: "",
          date: today(),
          status: "Pending",
          payment: "Unpaid",
          customerName: "",
          phone: "",
          location: ""
        }
  );

  const editing = !!initial;

  const choose = (id) => {
    const p = data.products.find(
      (x) => x.id === id
    );

    setF({
      ...f,
      productId: id,
      productName: p?.name || "",
      cost: p?.cost ?? ""
    });
  };

  const save = async () => {
    if (!f.productName.trim()) {
      return alert("Enter a product.");
    }

    const o = {
      ...f,
      id: f.id || uid(),
      orderNo:
        f.orderNo ||
        (data.orderCounter + 1),
      price: +f.price || 0,
      cost: +f.cost || 0,
      delivery: +f.delivery || 0,
      other: +f.other || 0
    };

    const n = {
      ...data,
      orderCounter: Math.max(
        data.orderCounter,
        o.orderNo
      ),
      orders: editing
        ? data.orders.map(
            (x) =>
              x.id === o.id
                ? o
                : x
          )
        : [...data.orders, o]
    };

    await update(n);

    close();
    receipt(o);
  };

  return (
    <Modal
      title={
        editing
          ? "Edit order"
          : "Add sale / order"
      }
      close={close}
    >

      <Field l="Product">

        <select
          value={f.productId || ""}
          onChange={(e) =>
            choose(e.target.value)
          }
        >
          <option value="">
            Choose stocked product
          </option>

          {data.products.map((p) => (
            <option
              key={p.id}
              value={p.id}
            >
              {p.name}
            </option>
          ))}
        </select>

        <input
          className="mt"
          value={f.productName}
          onChange={(e) =>
            setF({
              ...f,
              productName:
                e.target.value
            })
          }
          placeholder="Or type product name"
        />

      </Field>

      <div className="grid2">

        <Field l="Selling price">
          <input
            type="number"
            value={f.price}
            onChange={(e) =>
              setF({
                ...f,
                price: e.target.value
              })
            }
          />
        </Field>

        <Field l="Cost price">
          <input
            type="number"
            value={f.cost}
            onChange={(e) =>
              setF({
                ...f,
                cost: e.target.value
              })
            }
          />
        </Field>

      </div>

      <div className="grid2">

        <Field l="Delivery expense">
          <input
            type="number"
            value={f.delivery}
            onChange={(e) =>
              setF({
                ...f,
                delivery: e.target.value
              })
            }
          />
        </Field>

        <Field l="Other order expense">
          <input
            type="number"
            value={f.other}
            onChange={(e) =>
              setF({
                ...f,
                other: e.target.value
              })
            }
          />
        </Field>

      </div>

      <div className="grid2">

        <Field l="Order date">
          <input
            type="date"
            value={f.date}
            onChange={(e) =>
              setF({
                ...f,
                date: e.target.value
              })
            }
          />
        </Field>

        <Field l="Order status">
          <select
            value={f.status}
            onChange={(e) =>
              setF({
                ...f,
                status: e.target.value
              })
            }
          >
            <option>Pending</option>
            <option>Dispatched</option>
            <option>Delivered</option>
            <option>Cancelled</option>
          </select>
        </Field>

      </div>

      <Field l="Payment status">

        <select
          value={f.payment || "Unpaid"}
          onChange={(e) =>
            setF({
              ...f,
              payment: e.target.value
            })
          }
        >
          <option>Unpaid</option>
          <option>Partial</option>
          <option>Paid</option>
        </select>

      </Field>

      <h3>Customer</h3>

      <Field l="Name">
        <input
          value={f.customerName}
          onChange={(e) =>
            setF({
              ...f,
              customerName:
                e.target.value
            })
          }
        />
      </Field>

      <div className="grid2">

        <Field l="Phone">
          <input
            value={f.phone}
            onChange={(e) =>
              setF({
                ...f,
                phone: e.target.value
              })
            }
          />
        </Field>

        <Field l="Location">
          <input
            value={f.location}
            onChange={(e) =>
              setF({
                ...f,
                location:
                  e.target.value
              })
            }
          />
        </Field>

      </div>

      <div className="estimate">

        <span>Order profit</span>

        <b>
          {money(
            (+f.price || 0) -
              (+f.cost || 0) -
              (+f.delivery || 0) -
              (+f.other || 0)
          )}
        </b>

      </div>

      <button
        className="primary wide"
        onClick={save}
      >
        {editing
          ? "Save Changes & Receipt"
          : "Save Order & Receipt"}
      </button>

    </Modal>
  );
}

/* =====================================================
   EXPENSES
===================================================== */

const expenseCategories = [
  "Accommodation",
  "Food",
  "Transport",
  "Fuel",
  "Packaging",
  "Phone / Internet",
  "Bank / Payment fees",
  "Office / Shop",
  "Repairs",
  "Other"
];

function Expenses({ data, update }) {
  const [form, setForm] = useState(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [period, setPeriod] = useState("month");

  const rows = [...data.expenses]
    .sort((a, b) =>
      b.date.localeCompare(a.date)
    )
    .filter(
      (e) =>
        (period === "all" ||
          monthMatch(e.date)) &&
        (cat === "All" ||
          e.category === cat) &&
        (
          `${e.category} ${
            e.description
          } ${e.paymentMethod || ""}`
        )
          .toLowerCase()
          .includes(q.toLowerCase())
    );

  const total = rows.reduce(
    (s, e) =>
      s + Number(e.amount || 0),
    0
  );

  const save = (e) => {
    const n = {
      ...data,
      expenses: e.id
        ? data.expenses.map(
            (x) =>
              x.id === e.id
                ? e
                : x
          )
        : [
            ...data.expenses,
            {
              ...e,
              id: uid(),
              createdAt:
                new Date().toISOString()
            }
          ]
    };

    update(n);
    setForm(null);
  };

  const del = (id) => {
    if (confirm("Delete this expense?")) {
      update({
        ...data,
        expenses:
          data.expenses.filter(
            (e) => e.id !== id
          )
      });
    }
  };

  return (
    <section>

      <div className="head">

        <div>
          <h1>Expenses</h1>
          <p>
            General business expenses are separate from individual orders.
          </p>
        </div>

        <button
          className="primary"
          onClick={() =>
            setForm({
              date: today(),
              category: "Accommodation",
              description: "",
              amount: "",
              paymentMethod: "Cash"
            })
          }
        >
          ＋ Add expense
        </button>

      </div>

      <div className="expense-total">

        <div>
          <span>
            {period === "month"
              ? "This month"
              : "All time"}{" "}
            general expenses
          </span>

          <b>{money(total)}</b>
        </div>

        <div className="seg">

          <button
            className={
              period === "month"
                ? "on"
                : ""
            }
            onClick={() =>
              setPeriod("month")
            }
          >
            This month
          </button>

          <button
            className={
              period === "all"
                ? "on"
                : ""
            }
            onClick={() =>
              setPeriod("all")
            }
          >
            All time
          </button>

        </div>

      </div>

      <div className="toolbar">

        <input
          placeholder="Search category or description…"
          value={q}
          onChange={(e) =>
            setQ(e.target.value)
          }
        />

        <select
          value={cat}
          onChange={(e) =>
            setCat(e.target.value)
          }
        >
          <option>All</option>

          {expenseCategories.map((c) => (
            <option key={c}>
              {c}
            </option>
          ))}

        </select>

      </div>

      <div className="panel">

        <div className="expense-table-head">

          <span>Date</span>
          <span>Category</span>
          <span>Description</span>
          <span>Payment</span>
          <span>Amount</span>
          <span></span>

        </div>

        {rows.length ? (
          rows.map((e) => (
            <div
              className="expense-row"
              key={e.id}
            >

              <span>{e.date}</span>

              <strong>
                {e.category}
              </strong>

              <span>
                {e.description || "—"}
              </span>

              <span>
                {e.paymentMethod || "—"}
              </span>

              <b>{money(e.amount)}</b>

              <div className="actions">

                <button
                  onClick={() =>
                    setForm(e)
                  }
                >
                  Edit
                </button>

                <button
                  className="danger"
                  onClick={() =>
                    del(e.id)
                  }
                >
                  Delete
                </button>

              </div>

            </div>
          ))
        ) : (
          <Empty text="No expenses found." />
        )}

      </div>

      {form && (
        <ExpenseForm
          e={form}
          save={save}
          close={() => setForm(null)}
        />
      )}

    </section>
  );
}

function ExpenseSummary({ expenses }) {
  if (!expenses.length) {
    return (
      <Empty text="No general expenses for this period." />
    );
  }

  const m = {};

  expenses.forEach((e) => {
    m[e.category] =
      (m[e.category] || 0) +
      Number(e.amount || 0);
  });

  return (
    <>
      {Object.entries(m)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => (
          <div
            className="stockline"
            key={k}
          >

            <div>

              <b>{k}</b>

              <small>
                {
                  expenses.filter(
                    (e) =>
                      e.category === k
                  ).length
                }{" "}
                entries
              </small>

            </div>

            <strong>
              {money(v)}
            </strong>

          </div>
        ))}
    </>
  );
}

function ExpenseForm({
  e,
  save,
  close
}) {
  const [f, setF] = useState(e);

  return (
    <Modal
      title={
        e.id
          ? "Edit expense"
          : "Add expense"
      }
      close={close}
    >

      <div className="grid2">

        <Field l="Date">

          <input
            type="date"
            value={f.date}
            onChange={(x) =>
              setF({
                ...f,
                date: x.target.value
              })
            }
          />

        </Field>

        <Field l="Category">

          <select
            value={f.category}
            onChange={(x) =>
              setF({
                ...f,
                category:
                  x.target.value
              })
            }
          >
            {expenseCategories.map(
              (c) => (
                <option key={c}>
                  {c}
                </option>
              )
            )}
          </select>

        </Field>

      </div>

      <Field l="Description">

        <input
          value={f.description}
          onChange={(x) =>
            setF({
              ...f,
              description:
                x.target.value
            })
          }
          placeholder="Hotel, lunch, taxi, etc."
        />

      </Field>

      <div className="grid2">

        <Field l="Amount">

          <input
            type="number"
            min="0"
            step="0.01"
            value={f.amount}
            onChange={(x) =>
              setF({
                ...f,
                amount:
                  x.target.value
              })
            }
          />

        </Field>

        <Field l="Payment method">

          <select
            value={f.paymentMethod}
            onChange={(x) =>
              setF({
                ...f,
                paymentMethod:
                  x.target.value
              })
            }
          >
            <option>Cash</option>
            <option>Card</option>
            <option>Bank transfer</option>
            <option>Other</option>
          </select>

        </Field>

      </div>

      <button
        className="primary wide"
        onClick={() =>
          Number(f.amount) > 0
            ? save({
                ...f,
                amount:
                  Number(f.amount)
              })
            : alert(
                "Enter an expense amount."
              )
        }
      >
        {e.id
          ? "Save Changes"
          : "Save Expense"}
      </button>

    </Modal>
  );
}

/* =====================================================
   SETTINGS
===================================================== */

function Settings({
  data,
  update
}) {
  const [s, setS] = useState(
    data.settings
  );

  const [saved, setSaved] =
    useState(false);

  const save = async () => {
    await update({
      ...data,
      settings: s
    });

    setSaved(true);

    setTimeout(
      () => setSaved(false),
      1600
    );
  };

  const logo = (e) => {
    const f =
      e.target.files?.[0];

    if (!f) return;

    const r =
      new FileReader();

    r.onload = () =>
      setS({
        ...s,
        logo: r.result
      });

    r.readAsDataURL(f);
  };

  return (
    <section>

      <div className="head">

        <div>
          <h1>Seller settings</h1>

          <p>
            This information appears on your receipts.
          </p>
        </div>

        <button
          className="primary"
          onClick={save}
        >
          {saved
            ? "Saved ✓"
            : "Save settings"}
        </button>

      </div>

      <div className="settings-grid">

        <div className="panel">

          <h2>
            Company information
          </h2>

          <Field l="Company / shop name">

            <input
              value={s.companyName}
              onChange={(e) =>
                setS({
                  ...s,
                  companyName:
                    e.target.value
                })
              }
              placeholder="Your Store Name"
            />

          </Field>

          <div className="grid2">

            <Field l="Phone">

              <input
                value={s.phone}
                onChange={(e) =>
                  setS({
                    ...s,
                    phone:
                      e.target.value
                  })
                }
              />

            </Field>

            <Field l="WhatsApp">

              <input
                value={s.whatsapp}
                onChange={(e) =>
                  setS({
                    ...s,
                    whatsapp:
                      e.target.value
                  })
                }
              />

            </Field>

          </div>

          <Field l="Address / location">

            <input
              value={s.address}
              onChange={(e) =>
                setS({
                  ...s,
                  address:
                    e.target.value
                })
              }
            />

          </Field>

          <Field l="Email">

            <input
              value={s.email}
              onChange={(e) =>
                setS({
                  ...s,
                  email:
                    e.target.value
                })
              }
            />

          </Field>

        </div>

        <div className="panel">

          <h2>Company logo</h2>

          {s.logo ? (
            <img
              className="logo-preview"
              src={s.logo}
            />
          ) : (
            <div className="logo-placeholder">
              No logo
            </div>
          )}

          <label className="upload">

            Choose logo

            <input
              type="file"
              accept="image/*"
              onChange={logo}
            />

          </label>

          <p className="hint">
            PNG/JPG works well. It is stored
            with your app data and printed on
            receipts.
          </p>

        </div>

      </div>

      <div className="panel danger-panel">

        <h2>Data safety</h2>

        <p>
          Local records are stored in
          IndexedDB and synchronized with
          Cloudflare D1 when online.
        </p>

        <button
          className="ghost"
          onClick={() =>
            downloadBackup(data)
          }
        >
          Download full backup
        </button>

      </div>

    </section>
  );
}

/* =====================================================
   MODAL
===================================================== */

function Modal({
  title,
  close,
  children
}) {
  return (
    <div
      className="overlay"
      onMouseDown={(e) =>
        e.target === e.currentTarget &&
        close()
      }
    >

      <div className="modal">

        <button
          className="close"
          onClick={close}
        >
          ×
        </button>

        <h2>{title}</h2>

        {children}

      </div>

    </div>
  );
}

function Field({
  l,
  children
}) {
  return (
    <label className="field">
      <span>{l}</span>
      {children}
    </label>
  );
}

/* =====================================================
   RECEIPT
===================================================== */

function Receipt({
  order,
  data,
  close
}) {
  const s =
    data.settings || {};

  return (
    <div className="overlay receipt-overlay">

      <div className="receipt-shell">

        <div className="receipt-actions">

          <button
            className="ghost"
            onClick={close}
          >
            Close
          </button>

          <button
            className="primary"
            onClick={() =>
              window.print()
            }
          >
            Print / Save PDF
          </button>

        </div>

        <article className="receipt">

          {(s.logo ||
            s.companyName) && (

            <div className="seller">

              {s.logo && (
                <img
                  src={s.logo}
                />
              )}

              <div>

                <h1>
                  {s.companyName ||
                    "Seller"}
                </h1>

                {s.phone && (
                  <span>
                    {s.phone}
                  </span>
                )}

                {s.whatsapp && (
                  <span>
                    WhatsApp:{" "}
                    {s.whatsapp}
                  </span>
                )}

                {s.address && (
                  <span>
                    {s.address}
                  </span>
                )}

                {s.email && (
                  <span>
                    {s.email}
                  </span>
                )}

              </div>

            </div>
          )}

          <div className="receipt-title">

            <div>

              <h2>
                ORDER RECEIPT
              </h2>

              <span>
                ORD-
                {String(
                  order.orderNo
                ).padStart(3, "0")}
              </span>

            </div>

            <b>
              {order.date}
            </b>

          </div>

          <hr />

          <div className="customer">

            <div>

              <small>
                CUSTOMER
              </small>

              <b>
                {order.customerName ||
                  "Walk-in customer"}
              </b>

              <span>
                {order.phone}
              </span>

              <span>
                {order.location}
              </span>

            </div>

            <div>

              <small>
                ORDER STATUS
              </small>

              <b>
                {order.status}
              </b>

              <span>
                Payment:{" "}
                {order.payment ||
                  "Unpaid"}
              </span>

            </div>

          </div>

          <table>

            <thead>

              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Amount</th>
              </tr>

            </thead>

            <tbody>

              <tr>

                <td>
                  {order.productName}
                </td>

                <td>1</td>

                <td>
                  {money(
                    order.price
                  )}
                </td>

              </tr>

            </tbody>

          </table>

          <div className="totals">

            <div>
              <span>Subtotal</span>
              <b>
                {money(order.price)}
              </b>
            </div>

            <div>
              <span>Delivery</span>
              <b>
                {money(
                  order.delivery
                )}
              </b>
            </div>

            <div className="total">

              <span>Total</span>

              <b>
                {money(order.price)}
              </b>

            </div>

          </div>

          <p className="thanks">
            Thank you for your order.
          </p>

        </article>

      </div>

    </div>
  );
}

/* =====================================================
   BACKUP
===================================================== */

function downloadBackup(data) {
  const a =
    document.createElement("a");

  const url =
    URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            data,
            null,
            2
          )
        ],
        {
          type:
            "application/json"
        }
      )
    );

  a.href = url;

  a.download =
    `sale-tracker-backup-${today()}.json`;

  a.click();

  URL.revokeObjectURL(url);
}

/* =====================================================
   START REACT
===================================================== */

createRoot(
  document.getElementById("root")
).render(<App />);

