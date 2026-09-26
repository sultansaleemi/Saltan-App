import React, {
  useEffect,
  useRef,
  useState
} from "react";

import { createRoot } from "react-dom/client";

import "./styles.css";


// ============================================================
// CONFIGURATION
// ============================================================

const API = "/api";

const DB_NAME = "SaleTrackerDB";
const DB_VERSION = 2;
const STORE = "app";

const OLD_KEY = "saleTrackerReact_v1";


// ============================================================
// DEFAULT DATA
// ============================================================

const empty = {
  products: [],
  orders: [],
  purchases: [],
  expenses: [],
  activities: [],
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


// ============================================================
// BASIC HELPERS
// ============================================================

const uid = () =>
  Date.now().toString(36) +
  Math.random().toString(36).slice(2, 8);


const today = () =>
  new Date().toISOString().slice(0, 10);


const money = (n) =>
  "AED " +
  (
    Math.round((Number(n) || 0) * 100) / 100
  ).toLocaleString(undefined, {
    maximumFractionDigits: 2
  });


const merge = (d) => ({
  ...empty,
  ...(d || {}),

  products: d?.products || [],
  orders: d?.orders || [],
  purchases: d?.purchases || [],
  expenses: d?.expenses || [],
  activities: d?.activities || [],

  settings: {
    ...empty.settings,
    ...(d?.settings || {})
  }
});


const number = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};


const monthMatch = (d) => {
  if (!d) return false;

  const x = new Date(d);
  const n = new Date();

  return (
    x.getFullYear() === n.getFullYear() &&
    x.getMonth() === n.getMonth()
  );
};


// ============================================================
// INDEXEDDB
// ============================================================

function openDB() {
  return new Promise((resolve, reject) => {

    const request =
      indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {

      if (
        !request.result.objectStoreNames.contains(STORE)
      ) {
        request.result.createObjectStore(STORE);
      }
    };

    request.onsuccess = () =>
      resolve(request.result);

    request.onerror = () =>
      reject(request.error);
  });
}


async function dbGet() {

  const db = await openDB();

  return new Promise((resolve, reject) => {

    const request =
      db
        .transaction(STORE)
        .objectStore(STORE)
        .get("data");

    request.onsuccess = () =>
      resolve(request.result || null);

    request.onerror = () =>
      reject(request.error);
  });
}


async function dbPut(data) {

  const db = await openDB();

  return new Promise((resolve, reject) => {

    const request =
      db
        .transaction(STORE, "readwrite")
        .objectStore(STORE)
        .put(data, "data");

    request.onsuccess = () =>
      resolve();

    request.onerror = () =>
      reject(request.error);
  });
}


// ============================================================
// API
// ============================================================

async function apiRequest(path, options = {}) {

  const response = await fetch(
    `${API}${path}`,
    {
      ...options,

      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      },

      cache: "no-store"
    }
  );


  const json =
    await response
      .json()
      .catch(() => ({}));


  if (
    !response.ok ||
    json.ok === false
  ) {

    throw new Error(
      json.error ||
      `API error ${response.status}`
    );
  }


  return json;
}


// ============================================================
// LOCAL → API MAPPERS
// ============================================================

function productToApi(p) {

  return {
    id: p.id,

    name: p.name || "",

    cost: number(p.cost),

    stock: Math.max(
      0,
      Math.trunc(number(p.stock))
    )
  };
}


function orderToApi(o) {

  return {
    id: o.id,

    orderNo: Math.trunc(
      number(o.orderNo)
    ),

    productId:
      o.productId || null,

    productName:
      o.productName || "",

    price:
      number(o.price),

    cost:
      number(o.cost),

    deliveryCost:
      number(o.delivery),

    otherExpense:
      number(o.other),

    status:
      o.status || "Pending",

    orderDate:
      o.date || today(),

    customerName:
      o.customerName || "",

    customerPhone:
      o.phone || "",

    customerLocation:
      o.location || "",

    paymentStatus:
      o.payment || "Unpaid"
  };
}


function purchaseToApi(p) {

  return {
    id: p.id,

    productId:
      p.productId || null,

    productName:
      p.productName ||
      p.name ||
      "",

    quantity:
      Math.trunc(
        number(
          p.quantity ??
          p.qty
        )
      ),

    costEach:
      number(p.costEach),

    total:
      number(p.total),

    purchaseDate:
      p.purchaseDate ||
      p.date ||
      today()
  };
}


function expenseToApi(e) {

  return {
    id: e.id,

    title:
      e.description ||
      e.title ||
      "",

    description:
      e.description ||
      e.title ||
      "",

    amount:
      number(e.amount),

    category:
      e.category ||
      "Other",

    expenseDate:
      e.date ||
      today(),

    notes:
      e.notes ||
      "",

    paymentMethod:
      e.paymentMethod ||
      "Cash"
  };
}


function settingsToApi(s) {

  return {
    companyName:
      s.companyName || "",

    phone:
      s.phone || "",

    whatsapp:
      s.whatsapp || "",

    address:
      s.address || "",

    email:
      s.email || "",

    logo:
      s.logo || "",

    currency:
      s.currency || "AED"
  };
}


// ============================================================
// API → LOCAL MAPPERS
// ============================================================

function productFromApi(p) {

  return {
    id: p.id,

    name:
      p.name || "",

    cost:
      number(p.cost),

    stock:
      number(p.stock)
  };
}


function orderFromApi(o) {

  return {
    id: o.id,

    orderNo:
      number(o.order_no),

    productId:
      o.product_id || "",

    productName:
      o.product_name || "",

    price:
      number(o.price),

    cost:
      number(o.cost),

    delivery:
      number(o.delivery_cost),

    other:
      number(o.other_expense),

    status:
      o.status || "Pending",

    date:
      o.order_date || today(),

    payment:
      o.payment_status ||
      "Unpaid",

    customerName:
      o.customer_name || "",

    phone:
      o.customer_phone || "",

    location:
      o.customer_location || ""
  };
}


function purchaseFromApi(p) {

  return {
    id: p.id,

    productId:
      p.product_id || "",

    productName:
      p.product_name || "",

    name:
      p.product_name || "",

    quantity:
      number(p.quantity),

    qty:
      number(p.quantity),

    costEach:
      number(p.cost_each),

    total:
      number(p.total),

    purchaseDate:
      p.purchase_date || today(),

    date:
      p.purchase_date || today()
  };
}


function expenseFromApi(e) {

  return {
    id: e.id,

    date:
      e.expense_date || today(),

    category:
      e.category || "Other",

    description:
      e.description ||
      e.title ||
      "",

    amount:
      number(e.amount),

    paymentMethod:
      e.payment_method ||
      "Cash",

    notes:
      e.notes || "",

    createdAt:
      e.created_at || ""
  };
}


function settingsFromApi(s) {

  if (!s) {
    return null;
  }

  return {
    companyName:
      s.company_name || "",

    phone:
      s.phone || "",

    whatsapp:
      s.whatsapp || "",

    address:
      s.address || "",

    email:
      s.email || "",

    logo:
      s.logo || "",

    currency:
      s.currency || "AED"
  };
}


// ============================================================
// CLOUD DOWNLOAD
// ============================================================

async function downloadCloudData() {

  const [
    productsResponse,
    ordersResponse,
    purchasesResponse,
    expensesResponse,
    settingsResponse
  ] = await Promise.all([

    apiRequest("/products"),

    apiRequest("/orders"),

    apiRequest("/purchases"),

    apiRequest("/expenses"),

    apiRequest("/settings")
  ]);


  const products =
    (productsResponse.data || [])
      .map(productFromApi);


  const orders =
    (ordersResponse.data || [])
      .map(orderFromApi);


  const purchases =
    (purchasesResponse.data || [])
      .map(purchaseFromApi);


  const expenses =
    (expensesResponse.data || [])
      .map(expenseFromApi);


  const cloudSettings =
    settingsFromApi(
      settingsResponse.data
    );


  const maxOrderNo =
    orders.reduce(
      (max, o) =>
        Math.max(
          max,
          number(o.orderNo)
        ),
      0
    );


  return {
    products,
    orders,
    purchases,
    expenses,

    orderCounter:
      maxOrderNo,

    settings:
      cloudSettings
  };
}


// ============================================================
// COLLECTION HELPERS
// ============================================================

function hasRecords(data) {

  return Boolean(
    data?.products?.length ||
    data?.orders?.length ||
    data?.purchases?.length ||
    data?.expenses?.length
  );
}


function mapById(list) {

  return new Map(
    (list || [])
      .filter(x => x?.id)
      .map(x => [x.id, x])
  );
}


// ============================================================
// UPLOAD ALL LOCAL DATA
// ============================================================

async function uploadAllData(data) {

  for (const p of data.products || []) {

    await apiRequest(
      "/products",
      {
        method: "POST",
        body: JSON.stringify(
          productToApi(p)
        )
      }
    );
  }


  for (const o of data.orders || []) {

    await apiRequest(
      "/orders",
      {
        method: "POST",
        body: JSON.stringify(
          orderToApi(o)
        )
      }
    );
  }


  for (const p of data.purchases || []) {

    await apiRequest(
      "/purchases",
      {
        method: "POST",
        body: JSON.stringify(
          purchaseToApi(p)
        )
      }
    );
  }


  for (const e of data.expenses || []) {

    await apiRequest(
      "/expenses",
      {
        method: "POST",
        body: JSON.stringify(
          expenseToApi(e)
        )
      }
    );
  }


  await apiRequest(
    "/settings",
    {
      method: "POST",
      body: JSON.stringify(
        settingsToApi(
          data.settings
        )
      )
    }
  );
}


// ============================================================
// INITIAL CLOUD SYNC
// ============================================================

async function initialSync(localData) {

  const cloud =
    await downloadCloudData();


  const cloudHasRecords =
    hasRecords(cloud);


  const localHasRecords =
    hasRecords(localData);


  // ----------------------------------------------------------
  // CASE 1
  // Local is empty, cloud has data
  // ----------------------------------------------------------

  if (
    !localHasRecords &&
    cloudHasRecords
  ) {

    return merge({
      ...localData,

      products:
        cloud.products,

      orders:
        cloud.orders,

      purchases:
        cloud.purchases,

      expenses:
        cloud.expenses,

      orderCounter:
        Math.max(
          localData.orderCounter || 0,
          cloud.orderCounter || 0
        ),

      settings:
        cloud.settings ||
        localData.settings
    });
  }


  // ----------------------------------------------------------
  // CASE 2
  // Local has data, cloud is empty
  // ----------------------------------------------------------

  if (
    localHasRecords &&
    !cloudHasRecords
  ) {

    await uploadAllData(
      localData
    );

    return localData;
  }


  // ----------------------------------------------------------
  // CASE 3
  // Both have data
  //
  // Cloud is preferred for an existing ID.
  // Local-only records are preserved and uploaded.
  // ----------------------------------------------------------

  const mergeCollection =
    (localList, cloudList) => {

      const cloudMap =
        mapById(cloudList);

      const localMap =
        mapById(localList);

      const result = [];

      // Cloud records first
      for (const item of cloudList || []) {

        result.push(item);
      }

      // Add local-only records
      for (const item of localList || []) {

        if (
          item?.id &&
          !cloudMap.has(item.id)
        ) {
          result.push(item);
        }
      }

      return result;
    };


  const merged = merge({

    ...localData,

    products:
      mergeCollection(
        localData.products,
        cloud.products
      ),

    orders:
      mergeCollection(
        localData.orders,
        cloud.orders
      ),

    purchases:
      mergeCollection(
        localData.purchases,
        cloud.purchases
      ),

    expenses:
      mergeCollection(
        localData.expenses,
        cloud.expenses
      ),

    orderCounter:
      Math.max(
        localData.orderCounter || 0,
        cloud.orderCounter || 0
      ),

    settings:
      cloud.settings ||
      localData.settings
  });


  // Upload local-only records
  const cloudProducts =
    mapById(cloud.products);

  const cloudOrders =
    mapById(cloud.orders);

  const cloudPurchases =
    mapById(cloud.purchases);

  const cloudExpenses =
    mapById(cloud.expenses);


  for (const p of localData.products || []) {

    if (
      p.id &&
      !cloudProducts.has(p.id)
    ) {

      await apiRequest(
        "/products",
        {
          method: "POST",
          body: JSON.stringify(
            productToApi(p)
          )
        }
      );
    }
  }


  for (const o of localData.orders || []) {

    if (
      o.id &&
      !cloudOrders.has(o.id)
    ) {

      await apiRequest(
        "/orders",
        {
          method: "POST",
          body: JSON.stringify(
            orderToApi(o)
          )
        }
      );
    }
  }


  for (const p of localData.purchases || []) {

    if (
      p.id &&
      !cloudPurchases.has(p.id)
    ) {

      await apiRequest(
        "/purchases",
        {
          method: "POST",
          body: JSON.stringify(
            purchaseToApi(p)
          )
        }
      );
    }
  }


  for (const e of localData.expenses || []) {

    if (
      e.id &&
      !cloudExpenses.has(e.id)
    ) {

      await apiRequest(
        "/expenses",
        {
          method: "POST",
          body: JSON.stringify(
            expenseToApi(e)
          )
        }
      );
    }
  }


  // Settings: cloud is authoritative when it exists.
  if (!cloud.settings) {

    await apiRequest(
      "/settings",
      {
        method: "POST",
        body: JSON.stringify(
          settingsToApi(
            localData.settings
          )
        )
      }
    );
  }


  return merged;
}


// ============================================================
// SINGLE RECORD SYNC
// ============================================================

async function syncChangedCollection(
  previous,
  next,
  resource,
  mapper,
  allowDelete = true
) {

  const previousMap =
    mapById(previous);

  const nextMap =
    mapById(next);


  // Add/update
  for (const item of next || []) {

    if (!item?.id) {
      continue;
    }

    const old =
      previousMap.get(item.id);


    const changed =
      !old ||
      JSON.stringify(old) !==
      JSON.stringify(item);


    if (!changed) {
      continue;
    }


    await apiRequest(
      `/${resource}`,
      {
        method: "POST",

        body: JSON.stringify(
          mapper(item)
        )
      }
    );
  }


  // Delete
  if (allowDelete) {

    for (
      const old of previous || []
    ) {

      if (
        old?.id &&
        !nextMap.has(old.id)
      ) {

        await apiRequest(
          `/${resource}/${encodeURIComponent(old.id)}`,
          {
            method: "DELETE"
          }
        );
      }
    }
  }
}


// ============================================================
// FULL CHANGE SYNC
// ============================================================

async function syncChanges(
  previous,
  next
) {

  await syncChangedCollection(
    previous.products,
    next.products,
    "products",
    productToApi,
    true
  );


  await syncChangedCollection(
    previous.orders,
    next.orders,
    "orders",
    orderToApi,
    true
  );


  await syncChangedCollection(
    previous.purchases,
    next.purchases,
    "purchases",
    purchaseToApi,
    true
  );


  await syncChangedCollection(
    previous.expenses,
    next.expenses,
    "expenses",
    expenseToApi,
    true
  );


  // Settings are a single D1 record.
  if (
    JSON.stringify(
      previous.settings
    ) !==
    JSON.stringify(
      next.settings
    )
  ) {

    await apiRequest(
      "/settings",
      {
        method: "POST",

        body: JSON.stringify(
          settingsToApi(
            next.settings
          )
        )
      }
    );
  }
}


// ============================================================
// ACCOUNTING
// ============================================================

// Revenue from an order.
function revenue(order) {

  if (
    order.status === "Cancelled"
  ) {
    return 0;
  }

  return number(order.price);
}


// IMPORTANT:
//
// Order expenses include:
//
// 1. Product cost
// 2. Delivery expense
// 3. Other order expense
//
// General business expenses are NOT included here.

function orderExpense(order) {

  return (
    number(order.cost) +
    number(order.delivery) +
    number(order.other)
  );
}


// Profit for one individual order.

function profit(order) {

  return (
    revenue(order) -
    orderExpense(order)
  );
}


// ============================================================
// MAIN APP
// ============================================================

function App() {

  const [
    data,
    setData
  ] = useState(null);


  const [
    page,
    setPage
  ] = useState("dashboard");


  const [
    sale,
    setSale
  ] = useState(false);


  const [
    receipt,
    setReceipt
  ] = useState(null);


  const [
    editOrder,
    setEditOrder
  ] = useState(null);


  const [
    period,
    setPeriod
  ] = useState("month");


  const [
    syncState,
    setSyncState
  ] = useState("syncing");


  const [
    installPrompt,
    setInstallPrompt
  ] = useState(null);


  const [
    toast,
    setToast
  ] = useState(null);


  const showToast = (message) => {
    if (!message) return;

    setToast({
      id: Date.now() + Math.random(),
      message
    });
  };


  const addActivity = async (
    type,
    text,
    extra = null
  ) => {
    const entry = {
      id: uid(),
      type,
      text,
      extra,
      createdAt:
        new Date().toISOString()
    };

    await update({
      ...data,
      activities: [
        entry,
        ...(data.activities || [])
      ].slice(0, 25)
    });
  };


  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      setToast(null);
    }, 2200);

    return () => clearTimeout(timer);
  }, [toast]);


  useEffect(() => {
    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    const onAppInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener(
      "beforeinstallprompt",
      onBeforeInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      onAppInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        onBeforeInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        onAppInstalled
      );
    };
  }, []);


  const installApp = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();

    await installPrompt.userChoice;

    setInstallPrompt(null);
  };


  const refreshApp = async () => {
    showToast("Refreshing latest data…");

    try {
      const registration =
        await navigator.serviceWorker?.getRegistration();

      await registration?.update();
    } catch (error) {
      console.warn("App refresh update failed:", error);
    } finally {
      window.location.reload();
    }
  };


  const dataRef =
    useRef(null);


  // ----------------------------------------------------------
  // INITIAL LOAD
  // ----------------------------------------------------------

  useEffect(() => {

    let mounted = true;


    (async () => {

      try {

        let localData =
          await dbGet();


        if (!localData) {

          try {

            const old =
              JSON.parse(
                localStorage.getItem(
                  OLD_KEY
                ) || "null"
              );


            localData =
              old
                ? merge(old)
                : merge(empty);


          } catch {

            localData =
              merge(empty);
          }


          await dbPut(
            localData
          );
        }


        localData =
          merge(localData);


        // Display local data immediately.
        if (mounted) {

          dataRef.current =
            localData;

          setData(localData);

          setSyncState(
            "syncing"
          );
        }


        // Synchronize with D1.
        const synced =
          await initialSync(
            localData
          );


        if (!mounted) {
          return;
        }


        const finalData =
          merge(synced);


        await dbPut(
          finalData
        );


        dataRef.current =
          finalData;

        setData(
          finalData
        );


        setSyncState(
          "connected"
        );


      } catch (error) {

        console.error(
          "Initial cloud sync failed:",
          error
        );


        if (mounted) {

          setSyncState(
            "offline"
          );
        }
      }

    })();


    return () => {
      mounted = false;
    };

  }, []);


  // ----------------------------------------------------------
  // UPDATE LOCAL + CLOUD
  // ----------------------------------------------------------

  const update = async (
    nextData
  ) => {

    const next =
      merge(nextData);


    const previous =
      dataRef.current ||
      merge(empty);


    // Update UI immediately.
    dataRef.current =
      next;

    setData(next);


    // Save local cache immediately.
    await dbPut(next);


    // Synchronize with D1.
    try {

      setSyncState(
        "syncing"
      );


      await syncChanges(
        previous,
        next
      );


      setSyncState(
        "connected"
      );


    } catch (error) {

      console.error(
        "Cloud sync failed:",
        error
      );


      // Local changes remain saved.
      setSyncState(
        "offline"
      );
    }
  };


  if (!data) {

    return (
      <div className="loading">
        Loading SALTAN FASHION…
      </div>
    );
  }


  // ==========================================================
  // DASHBOARD FILTERS
  // ==========================================================

  const orders =
    period === "all"
      ? data.orders
      : data.orders.filter(
          o => monthMatch(o.date)
        );


  const purchases =
    period === "all"
      ? data.purchases
      : data.purchases.filter(
          p =>
            monthMatch(
              p.purchaseDate ||
              p.date
            )
        );


  const expenses =
    period === "all"
      ? data.expenses
      : data.expenses.filter(
          e =>
            monthMatch(e.date)
        );


  // ==========================================================
  // DASHBOARD ACCOUNTING
  // ==========================================================

  const sales =
    orders.reduce(
      (sum, order) =>
        sum + revenue(order),
      0
    );


  const orderEx =
    orders.reduce(
      (sum, order) =>
        sum + orderExpense(order),
      0
    );


  // Stock purchases are tracked separately.
  // They are NOT deducted from net profit again.

  const activeProductIds =
    new Set(
      data.products.map(
        product =>
          product.id
      )
    );


  const stockEx =
    purchases
      .filter(
        purchase =>
          purchase.productId &&
          activeProductIds.has(
            purchase.productId
          )
      )
      .reduce(
        (sum, purchase) =>
          sum +
          number(
            purchase.total
          ),
        0
      );


  // General expenses are separate from orders.

  const generalEx =
    expenses.reduce(
      (sum, expense) =>
        sum +
        number(
          expense.amount
        ),
      0
    );


  // Correct net profit:
  //
  // Sales
  // - product costs
  // - delivery
  // - other order expenses
  // - general business expenses

  const netProfit =
    sales -
    orderEx -
    generalEx;


  // ----------------------------------------------------------
  // BALANCE AFTER STOCK PURCHASES
  //
  // This is the remaining balance after taking the stock
  // purchases out of the calculated net profit.
  //
  // Example:
  // Sales = 99
  // Order costs = 68
  // General expenses = 0
  // Net profit = 31
  // Stock purchases = 330
  // Balance after stock purchases = -299
  // ----------------------------------------------------------

  const cashAfterStockPurchases =
    netProfit -
    stockEx;


  // Stock calculation.

  const stock =
    data.products.reduce(
      (sum, product) => {

        const sold =
          data.orders.filter(
            order =>
              order.productId ===
                product.id &&

              ![
                "Cancelled"
              ].includes(
                order.status
              ) &&

              [
                "Dispatched",
                "Delivered"
              ].includes(
                order.status
              )
          ).length;


        return (
          sum +
          Math.max(
            0,
            number(product.stock) -
            sold
          )
        );
      },
      0
    );


  const stats = {

    sales,

    orderEx,

    stockEx,

    generalEx,

    // This is the actual expense affecting profit.
    expenses:
      orderEx +
      generalEx,

    expenseCount:
      expenses.length,

    profit:
      netProfit,

    // Balance remaining after stock purchases.
    cashAfterStockPurchases,

    orders:
      orders.length,

    pending:
      orders.filter(
        o =>
          o.status ===
          "Pending"
      ).length,

    stock
  };


  const nav = [

    [
      "dashboard",
      "⌂ Dashboard"
    ],

    [
      "products",
      "◫ Products"
    ],

    [
      "orders",
      "▤ Orders"
    ],

    [
      "expenses",
      "▣ Expenses"
    ],

    [
      "settings",
      "⚙ Settings"
    ]
  ];


  return (

    <div className="app">

      <header className="top">

        <div className="brand">
          Sale <span>Tracker</span>
        </div>


        {installPrompt && (
          <button
            className="ghost install-btn"
            onClick={installApp}
            type="button"
          >
            Install app
          </button>
        )}


        <button
          className="ghost refresh-btn"
          onClick={refreshApp}
          type="button"
          aria-label="Refresh app and data"
        >
          ↻ Refresh
        </button>


        <div
          style={{
            fontSize: "12px",
            marginLeft: "8px",
            marginRight: "8px",
            whiteSpace: "nowrap"
          }}
        >

          <span
            style={{
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              marginRight: "5px",

              background:
                syncState === "connected"
                  ? "#22c55e"
                  : syncState === "syncing"
                  ? "#f59e0b"
                  : "#ef4444"
            }}
          />

          {syncState === "connected"
            ? "Cloud connected"
            : syncState === "syncing"
            ? "Syncing…"
            : "Offline"}
        </div>


        <nav>

          {nav.map(
            ([id, label]) => (

              <button
                key={id}
                className={
                  page === id
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setPage(id)
                }
              >
                {label}
              </button>
            )
          )}

        </nav>


        <button
          className="add"
          onClick={() =>
            setSale(true)
          }
        >
          ＋ Sale
        </button>

      </header>


      {toast && (
        <div className="toast-stack">
          <div className="toast">
            {toast.message}
          </div>
        </div>
      )}


      <main>

        {page === "dashboard" && (

          <Dashboard
            data={data}
            stats={stats}
            period={period}
            setPeriod={setPeriod}
            openReceipt={setReceipt}
            edit={setEditOrder}
            addActivity={addActivity}
          />

        )}


        {page === "products" && (

          <Products
            data={data}
            update={update}
            toast={showToast}
            addActivity={addActivity}
          />

        )}


        {page === "orders" && (

          <Orders
            data={data}
            update={update}
            receipt={setReceipt}
            edit={setEditOrder}
            add={() =>
              setSale(true)
            }
            toast={showToast}
            addActivity={addActivity}
          />

        )}


        {page === "expenses" && (

          <Expenses
            data={data}
            update={update}
            toast={showToast}
            addActivity={addActivity}
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

        {nav.map(
          ([id, label]) => (

            <button
              key={id}
              className={
                page === id
                  ? "sel"
                  : ""
              }
              onClick={() =>
                setPage(id)
              }
            >
              <b>
                {label[0]}
              </b>

              <span>
                {id}
              </span>
            </button>
          )
        )}


        <button
          className="mobile-sale"
          onClick={() =>
            setSale(true)
          }
        >
          ＋
        </button>

      </div>


      {sale && (

        <SaleModal
          data={data}
          update={update}
          close={() =>
            setSale(false)
          }
          receipt={setReceipt}
          toast={showToast}
          addActivity={addActivity}
        />

      )}


      {editOrder && (

        <SaleModal
          data={data}
          update={update}
          initial={editOrder}
          close={() =>
            setEditOrder(null)
          }
          receipt={setReceipt}
          toast={showToast}
          addActivity={addActivity}
        />

      )}


      {receipt && (

        <Receipt
          order={receipt}
          data={data}
          close={() =>
            setReceipt(null)
          }
        />

      )}

    </div>
  );
}


// ============================================================
// DASHBOARD
// ============================================================

function Dashboard({
  data,
  stats,
  period,
  setPeriod,
  openReceipt,
  edit,
  addActivity
}) {

  const recent =
    [...data.orders]
      .sort(
        (a, b) =>
          number(b.orderNo) -
          number(a.orderNo)
      )
      .slice(0, 8);


  return (

    <section>

      <div className="head">

        <div>

          <h1>
            Dashboard
          </h1>

          <p>
            Sales, stock and expenses at a glance.
          </p>

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
          label="Order costs"
          v={money(stats.orderEx)}
        />

        <K
          label="General expenses"
          v={money(stats.generalEx)}
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

          <span>
            General expenses
          </span>

          <b>
            {money(
              stats.generalEx
            )}
          </b>

          <small>
            {stats.expenseCount} expense records this period
          </small>

        </div>


        <button
          onClick={() =>
            document
              .querySelectorAll(
                ".mobilebar button"
              )[3]
              ?.click()
          }
        >
          View expenses →
        </button>

      </div>


      <div className="dashboard-grid">

        <div className="panel">

          <div className="panel-head">

            <h2>
              Recent orders
            </h2>

            <span>
              {data.orders.length} total
            </span>

          </div>


          {recent.length
            ? recent.map(
                order => (

                  <OrderRow
                    key={order.id}
                    o={order}
                    edit={edit}
                    receipt={openReceipt}
                  />

                )
              )

            : (

              <Empty
                text="No orders yet."
              />

            )}

        </div>


        <div className="panel">

          <div className="panel-head">

            <h2>
              General expenses
            </h2>

            <span>
              {data.expenses.length} general
            </span>

          </div>


          <ExpenseSummary
            expenses={
              data.expenses.filter(
                e =>
                  period === "all" ||
                  monthMatch(e.date)
              )
            }
          />

        </div>

      </div>


      <div
        className="panel"
        style={{
          marginTop: "20px"
        }}
      >

        <div className="panel-head">

          <h2>
            Financial breakdown
          </h2>

          <span>
            {period === "month"
              ? "This month"
              : "All time"}
          </span>

        </div>


        <div className="stockline">

          <div>
            <b>
              Sales
            </b>

            <small>
              Revenue from non-cancelled orders
            </small>
          </div>

          <strong>
            {money(stats.sales)}
          </strong>

        </div>


        <div className="stockline">

          <div>
            <b>
              Order costs
            </b>

            <small>
              Product cost + delivery + other order expenses
            </small>
          </div>

          <strong>
            {money(stats.orderEx)}
          </strong>

        </div>


        <div className="stockline">

          <div>
            <b>
              General expenses
            </b>

            <small>
              Shop/business expenses outside individual orders
            </small>
          </div>

          <strong>
            {money(stats.generalEx)}
          </strong>

        </div>


        <div className="stockline">

          <div>
            <b>
              Stock purchases
            </b>

            <small>
              Inventory cash spending — tracked separately
            </small>
          </div>

          <strong>
            {money(stats.stockEx)}
          </strong>

        </div>


        <div className="stockline">

          <div>
            <b>
              Net profit
            </b>

            <small>
              Sales − order costs − general expenses
            </small>
          </div>

          <strong>
            {money(stats.profit)}
          </strong>

        </div>


        {/* NEW: BALANCE AFTER STOCK PURCHASES */}

        <div className="stockline">

          <div>
            <b>
              Balance after stock purchases
            </b>

            <small>
              Net profit − stock purchases
            </small>
          </div>

          <strong
            className={
              stats.cashAfterStockPurchases < 0
                ? "negative"
                : ""
            }
          >
            {money(
              stats.cashAfterStockPurchases
            )}
          </strong>

        </div>

      </div>

    </section>
  );
}


// ============================================================
// KPI
// ============================================================

function K({
  label,
  v,
  a,
  d
}) {

  return (

    <div
      className={
        "k " +
        (a ? "gold " : "") +
        (d ? "red" : "")
      }
    >

      <b>
        {v}
      </b>

      <span>
        {label}
      </span>

    </div>
  );
}


// ============================================================
// EMPTY
// ============================================================

function Empty({
  text
}) {

  return (
    <div className="empty">
      {text}
    </div>
  );
}


// ============================================================
// PRODUCTS
// ============================================================

function Products({
  data,
  update,
  toast,
  addActivity
}) {

  const [
    form,
    setForm
  ] = useState(null);


  const save = async p => {

    let next = {
      ...data
    };


    if (p.id) {

      next.products =
        next.products.map(
          x =>
            x.id === p.id
              ? {
                  ...p,
                  cost: number(p.cost),
                  stock: number(p.stock)
                }
              : x
        );

    } else {

      const product = {
        ...p,

        id: uid(),

        cost:
          number(p.cost),

        stock:
          number(p.stock)
      };


      next.products = [
        ...next.products,
        product
      ];


      // Initial stock becomes a purchase record.
      if (
        number(product.stock) > 0
      ) {

        next.purchases = [

          ...next.purchases,

          {
            id: uid(),

            productId:
              product.id,

            productName:
              product.name,

            name:
              product.name,

            quantity:
              number(product.stock),

            qty:
              number(product.stock),

            costEach:
              number(product.cost),

            total:
              number(product.stock) *
              number(product.cost),

            purchaseDate:
              today(),

            date:
              today()
          }
        ];
      }
    }


    await update(next);

    addActivity(
      "product",
      p.id
        ? `Product updated: ${p.name || "Untitled product"}`
        : `Product added: ${p.name || "Untitled product"}`
    );

    toast(
      p.id
        ? "Product updated."
        : "Product added."
    );

    setForm(null);
  };


  const remove = async p => {

    if (
      !confirm(
        "Remove product? This will also permanently remove all stock purchase records for this product. Past orders will stay saved. Continue?"
      )
    ) {
      return;
    }


    // Remove the product itself and any stock purchase records
    // tied to that product so its cost drops out of total expenses.

    await update({

      ...data,

      products:
        data.products.filter(
          x =>
            x.id !== p.id
        ),

      purchases:
        data.purchases.filter(
          x =>
            x.productId !== p.id
        )
    });

    addActivity(
      "product",
      `Product removed: ${p.name || "Untitled product"}`
    );

    toast("Product deleted.");
  };


  return (

    <section>

      <div className="head">

        <div>

          <h1>
            Products
          </h1>

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

        {data.products.map(
          p => (

            <div
              className="product"
              key={p.id}
            >

              <h3>
                {p.name}
              </h3>


              <div>

                <span>
                  Cost
                </span>

                <b>
                  {money(p.cost)}
                </b>

              </div>


              <div>

                <span>
                  Stock
                </span>

                <b>
                  {p.stock}
                </b>

              </div>


              <div className="actions">

                <button
                  onClick={() =>
                    setForm({
                      ...p
                    })
                  }
                >
                  Edit
                </button>


                <button
                  className="danger"
                  onClick={() =>
                    remove(p)
                  }
                >
                  Remove
                </button>

              </div>

            </div>

          )
        )}

      </div>


      {!data.products.length && (

        <div className="panel">

          <Empty
            text="No products yet."
          />

        </div>

      )}


      {form && (

        <ProductForm
          p={form}
          save={save}
          close={() =>
            setForm(null)
          }
        />

      )}

    </section>
  );
}


// ============================================================
// PRODUCT FORM
// ============================================================

function ProductForm({
  p,
  save,
  close
}) {

  const [
    f,
    setF
  ] = useState(p);


  return (

    <Modal
      title={
        p.id
          ? "Edit product"
          : "Add product"
      }
      close={close}
    >

      <Field l="Product name">

        <input
          value={f.name}
          onChange={e =>
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
            min="0"
            step="0.01"
            value={f.cost}
            onChange={e =>
              setF({
                ...f,
                cost:
                  e.target.value
              })
            }
          />

        </Field>


        <Field l="Stock">

          <input
            type="number"
            min="0"
            step="1"
            value={f.stock}
            onChange={e =>
              setF({
                ...f,
                stock:
                  e.target.value
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
            : alert(
                "Enter product name."
              )
        }
      >
        Save
      </button>

    </Modal>
  );
}


// ============================================================
// ORDERS
// ============================================================

function Orders({
  data,
  update,
  receipt,
  edit,
  add,
  toast,
  addActivity
}) {

  const [
    q,
    setQ
  ] = useState("");


  const [
    st,
    setSt
  ] = useState("All");


  const rows =
    [...data.orders]
      .sort(
        (a, b) =>
          number(b.orderNo) -
          number(a.orderNo)
      )
      .filter(
        o => (

          `${o.customerName || ""} ` +
          `${o.phone || ""} ` +
          `${o.location || ""} ` +
          `${o.productName || ""}`
        )
          .toLowerCase()
          .includes(
            q.toLowerCase()
          ) &&

          (
            st === "All" ||
            o.status === st
          )
      );


  const change =
    async (
      id,
      value
    ) => {

      await update({

        ...data,

        orders:
          data.orders.map(
            o =>
              o.id === id
                ? {
                    ...o,
                    status:
                      value
                  }
                : o
          )
      });
    };


  const remove =
    async id => {

      if (
        !confirm(
          "Delete this order permanently?"
        )
      ) {
        return;
      }


      await update({

        ...data,

        orders:
          data.orders.filter(
            x =>
              x.id !== id
          )
      });

      const deleted =
        data.orders.find(
          x => x.id === id
        );

      addActivity(
        "order",
        `Order deleted: ${deleted?.productName || "Order"}`
      );

      toast("Order deleted.");
    };


  return (

    <section>

      <div className="head">

        <div>

          <h1>
            Orders
          </h1>

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
          onChange={e =>
            setQ(
              e.target.value
            )
          }
        />


        <select
          value={st}
          onChange={e =>
            setSt(
              e.target.value
            )
          }
        >

          <option>
            All
          </option>

          <option>
            Pending
          </option>

          <option>
            Dispatched
          </option>

          <option>
            Delivered
          </option>

          <option>
            Cancelled
          </option>

        </select>

      </div>


      <div className="panel">

        {rows.length

          ? rows.map(
              o => (

                <OrderRow
                  key={o.id}
                  o={o}
                  edit={edit}
                  receipt={receipt}
                  onStatus={change}
                  onDelete={remove}
                />

              )
            )

          : (

            <Empty
              text="No matching orders."
            />

          )}

      </div>

    </section>
  );
}


// ============================================================
// ORDER ROW
// ============================================================

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
          {String(
            o.orderNo
          ).padStart(3, "0")}
        </b>


        <div>

          <strong>
            {o.productName}
          </strong>

          <small>

            {o.customerName ||
              "Walk-in"}

            {o.phone &&
              " · " + o.phone}

            {o.location &&
              " · " + o.location}

          </small>

        </div>

      </div>


      <div className="order-money">

        <span>
          {money(o.price)}
        </span>

        <b
          className={
            profit(o) < 0
              ? "negative"
              : ""
          }
        >
          {money(
            profit(o)
          )}
        </b>

      </div>


      <div className="order-actions">

        <select
          className={o.status}
          value={
            o.status ||
            "Pending"
          }
          onChange={e =>
            onStatus &&
            onStatus(
              o.id,
              e.target.value
            )
          }
        >

          <option>
            Pending
          </option>

          <option>
            Dispatched
          </option>

          <option>
            Delivered
          </option>

          <option>
            Cancelled
          </option>

        </select>


        <button
          onClick={() =>
            edit(o)
          }
        >
          Edit
        </button>


        <button
          onClick={() =>
            receipt(o)
          }
        >
          Receipt
        </button>


        {onDelete && (

          <button
            className="danger"
            onClick={() =>
              onDelete(o.id)
            }
          >
            Delete
          </button>

        )}

      </div>

    </div>
  );
}


// ============================================================
// SALE / ORDER MODAL
// ============================================================

function SaleModal({
  data,
  update,
  close,
  receipt,
  initial,
  toast,
  addActivity
}) {

  const [
    f,
    setF
  ] = useState(

    initial

      ? {
          ...initial
        }

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


  const editing =
    Boolean(initial);


  const choose =
    id => {

      const product =
        data.products.find(
          x =>
            x.id === id
        );


      setF({

        ...f,

        productId:
          id,

        productName:
          product?.name ||
          "",

        cost:
          product?.cost ??
          ""
      });
    };


  const save =
    async () => {

      if (
        !f.productName.trim()
      ) {

        alert(
          "Enter a product."
        );

        return;
      }


      const order = {

        ...f,

        id:
          f.id ||
          uid(),

        orderNo:
          f.orderNo ||
          (
            data.orderCounter +
            1
          ),

        price:
          number(f.price),

        cost:
          number(f.cost),

        delivery:
          number(f.delivery),

        other:
          number(f.other),

        payment:
          f.payment ||
          "Unpaid",

        date:
          f.date ||
          today(),

        status:
          f.status ||
          "Pending"
      };


      const next = {

        ...data,

        orderCounter:
          Math.max(
            number(
              data.orderCounter
            ),
            number(
              order.orderNo
            )
          ),

        orders:
          editing

            ? data.orders.map(
                x =>
                  x.id === order.id
                    ? order
                    : x
              )

            : [
                ...data.orders,
                order
              ]
      };


      await update(next);

      addActivity(
        "order",
        editing
          ? `Order edited: ${order.productName || "Order"}`
          : `Order added: ${order.productName || "Order"}`
      );

      toast(
        editing
          ? "Order edited."
          : "Order added."
      );

      close();

      receipt(order);
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
          value={
            f.productId ||
            ""
          }
          onChange={e =>
            choose(
              e.target.value
            )
          }
        >

          <option value="">
            Choose stocked product
          </option>

          {data.products.map(
            p => (

              <option
                key={p.id}
                value={p.id}
              >
                {p.name}
              </option>

            )
          )}

        </select>


        <input
          className="mt"
          value={
            f.productName
          }
          onChange={e =>
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
            min="0"
            step="0.01"
            value={f.price}
            onChange={e =>
              setF({
                ...f,
                price:
                  e.target.value
              })
            }
          />

        </Field>


        <Field l="Cost price">

          <input
            type="number"
            min="0"
            step="0.01"
            value={f.cost}
            onChange={e =>
              setF({
                ...f,
                cost:
                  e.target.value
              })
            }
          />

        </Field>

      </div>


      <div className="grid2">

        <Field l="Delivery expense">

          <input
            type="number"
            min="0"
            step="0.01"
            value={f.delivery}
            onChange={e =>
              setF({
                ...f,
                delivery:
                  e.target.value
              })
            }
          />

        </Field>


        <Field l="Other order expense">

          <input
            type="number"
            min="0"
            step="0.01"
            value={f.other}
            onChange={e =>
              setF({
                ...f,
                other:
                  e.target.value
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
            onChange={e =>
              setF({
                ...f,
                date:
                  e.target.value
              })
            }
          />

        </Field>


        <Field l="Order status">

          <select
            value={f.status}
            onChange={e =>
              setF({
                ...f,
                status:
                  e.target.value
              })
            }
          >

            <option>
              Pending
            </option>

            <option>
              Dispatched
            </option>

            <option>
              Delivered
            </option>

            <option>
              Cancelled
            </option>

          </select>

        </Field>

      </div>


      <Field l="Payment status">

        <select
          value={
            f.payment ||
            "Unpaid"
          }
          onChange={e =>
            setF({
              ...f,
              payment:
                e.target.value
            })
          }
        >

          <option>
            Unpaid
          </option>

          <option>
            Partial
          </option>

          <option>
            Paid
          </option>

        </select>

      </Field>


      <h3>
        Customer
      </h3>


      <Field l="Name">

        <input
          value={
            f.customerName
          }
          onChange={e =>
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
            value={
              f.phone
            }
            onChange={e =>
              setF({
                ...f,
                phone:
                  e.target.value
              })
            }
          />

        </Field>


        <Field l="Location">

          <input
            value={
              f.location
            }
            onChange={e =>
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

        <span>
          Order profit
        </span>

        <b>
          {money(
            number(f.price) -
            number(f.cost) -
            number(f.delivery) -
            number(f.other)
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


// ============================================================
// EXPENSES
// ============================================================

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


function Expenses({
  data,
  update,
  toast,
  addActivity
}) {

  const [
    form,
    setForm
  ] = useState(null);


  const [
    q,
    setQ
  ] = useState("");


  const [
    cat,
    setCat
  ] = useState("All");


  const [
    period,
    setPeriod
  ] = useState("month");


  const rows =

    [...data.expenses]

      .sort(
        (a, b) =>
          String(
            b.date || ""
          ).localeCompare(
            String(
              a.date || ""
            )
          )
      )

      .filter(
        e => (

          (
            period === "all" ||
            monthMatch(e.date)
          ) &&

          (
            cat === "All" ||
            e.category === cat
          ) &&

          (
            `${e.category || ""} ` +
            `${e.description || ""} ` +
            `${e.paymentMethod || ""}`
          )
            .toLowerCase()
            .includes(
              q.toLowerCase()
            )
        )
      );


  const total =
    rows.reduce(
      (sum, e) =>
        sum +
        number(e.amount),
      0
    );


  const save =
    async e => {

      const expense = {

        ...e,

        amount:
          number(e.amount),

        date:
          e.date ||
          today(),

        paymentMethod:
          e.paymentMethod ||
          "Cash",

        description:
          e.description ||
          ""
      };


      const next = {

        ...data,

        expenses:

          e.id

            ? data.expenses.map(
                x =>
                  x.id === e.id
                    ? expense
                    : x
              )

            : [
                ...data.expenses,

                {
                  ...expense,

                  id: uid(),

                  createdAt:
                    new Date()
                      .toISOString()
                }
              ]
      };


      await update(next);

      addActivity(
        "expense",
        e.id
          ? `Expense edited: ${expense.description || expense.category || "Expense"}`
          : `Expense added: ${expense.description || expense.category || "Expense"}`
      );

      toast(
        e.id
          ? "Expense edited."
          : "Expense added."
      );

      setForm(null);
    };


  const del =
    async id => {

      if (
        !confirm(
          "Delete this expense?"
        )
      ) {
        return;
      }


      const deletedExp =
        data.expenses.find(
          e => e.id === id
        );

      await update({

        ...data,

        expenses:
          data.expenses.filter(
            e =>
              e.id !== id
          )
      });

      addActivity(
        "expense",
        `Expense deleted: ${deletedExp?.description || deletedExp?.category || "Expense"}`
      );

      toast("Expense deleted.");
    };


  return (

    <section>

      <div className="head">

        <div>

          <h1>
            Expenses
          </h1>

          <p>
            General business expenses are separate from individual orders.
          </p>

        </div>


        <button
          className="primary"
          onClick={() =>
            setForm({
              date: today(),
              category:
                "Accommodation",
              description: "",
              amount: "",
              paymentMethod:
                "Cash"
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

          <b>
            {money(total)}
          </b>

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
          onChange={e =>
            setQ(
              e.target.value
            )
          }
        />


        <select
          value={cat}
          onChange={e =>
            setCat(
              e.target.value
            )
          }
        >

          <option>
            All
          </option>

          {expenseCategories.map(
            c => (

              <option
                key={c}
              >
                {c}
              </option>

            )
          )}

        </select>

      </div>


      <div className="panel">

        <div className="expense-table-head">

          <span>
            Date
          </span>

          <span>
            Category
          </span>

          <span>
            Description
          </span>

          <span>
            Payment
          </span>

          <span>
            Amount
          </span>

          <span></span>

        </div>


        {rows.length

          ? rows.map(
              e => (

                <div
                  className="expense-row"
                  key={e.id}
                >

                  <span>
                    {e.date}
                  </span>

                  <strong>
                    {e.category}
                  </strong>

                  <span>
                    {e.description ||
                      "—"}
                  </span>

                  <span>
                    {e.paymentMethod ||
                      "—"}
                  </span>

                  <b>
                    {money(
                      e.amount
                    )}
                  </b>


                  <div className="actions">

                    <button
                      onClick={() =>
                        setForm({
                          ...e
                        })
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

              )
            )

          : (

            <Empty
              text="No expenses found."
            />

          )}

      </div>


      {form && (

        <ExpenseForm
          e={form}
          save={save}
          close={() =>
            setForm(null)
          }
        />

      )}

    </section>
  );
}


// ============================================================
// EXPENSE SUMMARY
// ============================================================

function ExpenseSummary({
  expenses
}) {

  if (
    !expenses.length
  ) {

    return (
      <Empty
        text="No general expenses for this period."
      />
    );
  }


  const totals = {};


  expenses.forEach(
    e => {

      totals[e.category] =
        (
          totals[e.category] ||
          0
        ) +
        number(e.amount);
    }
  );


  return (

    <>

      {Object.entries(
        totals
      )
        .sort(
          (a, b) =>
            b[1] -
            a[1]
        )
        .map(
          ([category, value]) => (

            <div
              className="stockline"
              key={category}
            >

              <div>

                <b>
                  {category}
                </b>

                <small>
                  {
                    expenses.filter(
                      e =>
                        e.category ===
                        category
                    ).length
                  }{" "}
                  entries
                </small>

              </div>


              <strong>
                {money(value)}
              </strong>

            </div>

          )
        )}

    </>
  );
}


// ============================================================
// EXPENSE FORM
// ============================================================

function ExpenseForm({
  e,
  save,
  close
}) {

  const [
    f,
    setF
  ] = useState(e);


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
            onChange={x =>
              setF({
                ...f,
                date:
                  x.target.value
              })
            }
          />

        </Field>


        <Field l="Category">

          <select
            value={f.category}
            onChange={x =>
              setF({
                ...f,
                category:
                  x.target.value
              })
            }
          >

            {expenseCategories.map(
              c => (

                <option
                  key={c}
                >
                  {c}
                </option>

              )
            )}

          </select>

        </Field>

      </div>


      <Field l="Description">

        <input
          value={
            f.description
          }
          onChange={x =>
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
            onChange={x =>
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
            value={
              f.paymentMethod ||
              "Cash"
            }
            onChange={x =>
              setF({
                ...f,
                paymentMethod:
                  x.target.value
              })
            }
          >

            <option>
              Cash
            </option>

            <option>
              Card
            </option>

            <option>
              Bank transfer
            </option>

            <option>
              Other
            </option>

          </select>

        </Field>

      </div>


      <button
        className="primary wide"
        onClick={() =>
          number(f.amount) > 0

            ? save({
                ...f,
                amount:
                  number(f.amount)
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


// ============================================================
// SETTINGS
// ============================================================

function Settings({
  data,
  update
}) {

  const [
    s,
    setS
  ] = useState(
    data.settings
  );


  const [
    saved,
    setSaved
  ] = useState(false);


  // Keep form synchronized if cloud
  // settings arrive after page load.

  useEffect(() => {

    setS(
      data.settings
    );

  }, [data.settings]);


  const save =
    async () => {

      await update({

        ...data,

        settings: {
          ...s
        }
      });


      setSaved(true);


      setTimeout(
        () =>
          setSaved(false),
        1600
      );
    };


  const logo =
    e => {

      const file =
        e.target.files?.[0];


      if (!file) {
        return;
      }


      const reader =
        new FileReader();


      reader.onload =
        () => {

          setS({
            ...s,
            logo:
              reader.result
          });
        };


      reader.readAsDataURL(
        file
      );
    };


  return (

    <section>

      <div className="head">

        <div>

          <h1>
            Seller settings
          </h1>

          <p>
            This information appears on your receipts and is stored in D1.
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
              value={
                s.companyName
              }
              onChange={e =>
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
                value={
                  s.phone
                }
                onChange={e =>
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
                value={
                  s.whatsapp
                }
                onChange={e =>
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
              value={
                s.address
              }
              onChange={e =>
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
              type="email"
              value={
                s.email
              }
              onChange={e =>
                setS({
                  ...s,
                  email:
                    e.target.value
                })
              }
            />

          </Field>


          <Field l="Currency">

            <select
              value={
                s.currency ||
                "AED"
              }
              onChange={e =>
                setS({
                  ...s,
                  currency:
                    e.target.value
                })
              }
            >

              <option>
                AED
              </option>

              <option>
                USD
              </option>

              <option>
                EUR
              </option>

              <option>
                GBP
              </option>

              <option>
                SAR
              </option>

              <option>
                QAR
              </option>

            </select>

          </Field>

        </div>


        <div className="panel">

          <h2>
            Company logo
          </h2>


          {s.logo

            ? (

              <img
                className="logo-preview"
                src={s.logo}
                alt="Company logo"
              />

            )

            : (

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
            PNG/JPG works well. The logo is stored in D1 and can appear on receipts across devices.
          </p>

        </div>

      </div>


      <div className="panel danger-panel">

        <h2>
          Data safety
        </h2>

        <p>
          Your browser keeps a local IndexedDB cache for offline use, while D1 is used for shared cloud data.
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


// ============================================================
// MODAL
// ============================================================

function Modal({
  title,
  close,
  children
}) {

  return (

    <div
      className="overlay"
      onMouseDown={e =>
        e.target ===
          e.currentTarget &&
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


        <h2>
          {title}
        </h2>


        {children}

      </div>

    </div>
  );
}


// ============================================================
// FIELD
// ============================================================

function Field({
  l,
  children
}) {

  return (

    <label className="field">

      <span>
        {l}
      </span>

      {children}

    </label>
  );
}


// ============================================================
// RECEIPT
// ============================================================

function Receipt({
  order,
  data,
  close
}) {

  const s =
    data.settings ||
    empty.settings;


  const subtotal =
    number(order.price);


  const delivery =
    number(order.delivery);


  const total =
    subtotal +
    delivery;


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
                  alt="Logo"
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
                ).padStart(
                  3,
                  "0"
                )}
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

                <th>
                  Item
                </th>

                <th>
                  Qty
                </th>

                <th>
                  Amount
                </th>

              </tr>

            </thead>


            <tbody>

              <tr>

                <td>
                  {order.productName}
                </td>

                <td>
                  1
                </td>

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

              <span>
                Subtotal
              </span>

              <b>
                {money(
                  subtotal
                )}
              </b>

            </div>


            <div>

              <span>
                Delivery
              </span>

              <b>
                {money(
                  delivery
                )}
              </b>

            </div>


            <div className="total">

              <span>
                Total
              </span>

              <b>
                {money(
                  total
                )}
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


// ============================================================
// BACKUP
// ============================================================

function downloadBackup(data) {

  const blob =
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
    );


  const url =
    URL.createObjectURL(
      blob
    );


  const a =
    document.createElement(
      "a"
    );


  a.href = url;

  a.download =
    `sale-tracker-backup-${today()}.json`;


  a.click();


  URL.revokeObjectURL(
    url
  );
}


// ============================================================
// START APP
// ============================================================

createRoot(
  document.getElementById(
    "root"
  )
).render(
  <App />
);

