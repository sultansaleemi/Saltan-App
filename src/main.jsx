import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";

const DB_NAME="SaleTrackerDB",DB_VERSION=2,STORE="app";
const OLD_KEY="saleTrackerReact_v1";
const empty={
 products:[],orders:[],purchases:[],expenses:[],orderCounter:0,
 settings:{companyName:"",phone:"",whatsapp:"",address:"",email:"",logo:"",currency:"AED"}
};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const today=()=>new Date().toISOString().slice(0,10);
const money=n=>"AED "+(Math.round((Number(n)||0)*100)/100).toLocaleString(undefined,{maximumFractionDigits:2});
const merge=d=>({...empty,...d,products:d?.products||[],orders:d?.orders||[],purchases:d?.purchases||[],expenses:d?.expenses||[],settings:{...empty.settings,...(d?.settings||{})}});

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE);};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function dbGet(){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).get("data");r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
async function dbPut(data){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE,"readwrite").objectStore(STORE).put(data,"data");r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function revenue(o){return o.status==="Cancelled"?0:Number(o.price)||0}
function orderExpense(o){return (Number(o.delivery)||0)+(Number(o.other)||0)+(!o.productId?Number(o.cost)||0:0)}
function profit(o){return revenue(o)-orderExpense(o)}
function monthMatch(d){const x=new Date(d),n=new Date();return x.getFullYear()===n.getFullYear()&&x.getMonth()===n.getMonth()}

function App(){
 const [data,setData]=useState(null),[page,setPage]=useState("dashboard"),[sale,setSale]=useState(false),[receipt,setReceipt]=useState(null),[editOrder,setEditOrder]=useState(null),[period,setPeriod]=useState("month");
 useEffect(()=>{(async()=>{let d=await dbGet();if(!d){try{const old=JSON.parse(localStorage.getItem(OLD_KEY)||"null");d=old?merge(old):empty}catch{d=empty}await dbPut(d)}else if(!d.expenses){d=merge(d);await dbPut(d)}setData(merge(d))})()},[]);
 const update=async d=>{d=merge(d);setData(d);await dbPut(d)};
 if(!data)return <div className="loading">Loading SALTAN FASHION…</div>;

 const orders=period==="all"?data.orders:data.orders.filter(o=>monthMatch(o.date));
 const purchases=period==="all"?data.purchases:data.purchases.filter(p=>monthMatch(p.date));
 const expenses=period==="all"?data.expenses:data.expenses.filter(e=>monthMatch(e.date));
 const sales=orders.reduce((s,o)=>s+revenue(o),0);
 const orderEx=orders.reduce((s,o)=>s+orderExpense(o),0);
 const stockEx=purchases.reduce((s,p)=>s+Number(p.total||0),0);
 const generalEx=expenses.reduce((s,e)=>s+Number(e.amount||0),0);
 const stock=data.products.reduce((s,p)=>s+Math.max(0,p.stock-data.orders.filter(o=>o.productId===p.id&&!["Cancelled"].includes(o.status)&&["Dispatched","Delivered"].includes(o.status)).length),0);
 const stats={sales,orderEx,stockEx,generalEx,expenses:orderEx+stockEx+generalEx,expenseCount:expenses.length,profit:sales-orderEx-stockEx-generalEx,orders:orders.length,pending:orders.filter(o=>o.status==="Pending").length,stock};

 const nav=[["dashboard","⌂ Dashboard"],["products","◫ Products"],["orders","▤ Orders"],["expenses","▣ Expenses"],["settings","⚙ Settings"]];
 return <div className="app">
  <header className="top"><div className="brand">Sale <span>Tracker</span></div><nav>{nav.map(([id,l])=><button key={id} className={page===id?"active":""} onClick={()=>setPage(id)}>{l}</button>)}</nav><button className="add" onClick={()=>setSale(true)}>＋ Sale</button></header>
  <main>
   {page==="dashboard"&&<Dashboard data={data} stats={stats} period={period} setPeriod={setPeriod} openReceipt={setReceipt} edit={setEditOrder}/>}
   {page==="products"&&<Products data={data} update={update}/>}
   {page==="orders"&&<Orders data={data} update={update} receipt={setReceipt} edit={setEditOrder} add={()=>setSale(true)}/>}
   {page==="expenses"&&<Expenses data={data} update={update}/>}
   {page==="settings"&&<Settings data={data} update={update}/>}
  </main>
  <div className="mobilebar">{nav.map(([id,i])=><button key={id} className={page===id?"sel":""} onClick={()=>setPage(id)}><b>{i[0]}</b><span>{id}</span></button>)}<button className="mobile-sale" onClick={()=>setSale(true)}>＋</button></div>
  {sale&&<SaleModal data={data} update={update} close={()=>setSale(false)} receipt={setReceipt}/>}
  {editOrder&&<SaleModal data={data} update={update} initial={editOrder} close={()=>setEditOrder(null)} receipt={setReceipt}/>}
  {receipt&&<Receipt order={receipt} data={data} close={()=>setReceipt(null)}/>}
 </div>
}

function Dashboard({data,stats,period,setPeriod,openReceipt,edit}){
 const recent=[...data.orders].sort((a,b)=>b.orderNo-a.orderNo).slice(0,8);
 return <section><div className="head"><div><h1>Dashboard</h1><p>Sales, stock and expenses at a glance.</p></div><div className="seg"><button className={period==="month"?"on":""} onClick={()=>setPeriod("month")}>This month</button><button className={period==="all"?"on":""} onClick={()=>setPeriod("all")}>All time</button></div></div>
 <div className="kpis"><K label="Net profit" v={money(stats.profit)} a/><K label="Sales" v={money(stats.sales)}/><K label="Expenses" v={stats.expenseCount} icon="💸"/><K label="Orders" v={stats.orders}/><K label="In stock" v={stats.stock}/><K label="Pending" v={stats.pending} d/></div><div className="expense-highlight"><div><span>General expenses</span><b>{money(stats.generalEx)}</b><small>{stats.expenseCount} expense records this period</small></div><button onClick={()=>document.querySelectorAll(".mobilebar button")[3]?.click()}>View expenses →</button></div>
 <div className="dashboard-grid"><div className="panel"><div className="panel-head"><h2>Recent orders</h2><span>{data.orders.length} total</span></div>{recent.length?recent.map(o=><OrderRow key={o.id} o={o} edit={edit} receipt={openReceipt}/>):<Empty text="No orders yet."/>}</div>
 <div className="panel"><div className="panel-head"><h2>Expenses</h2><span>{data.expenses.length} general</span></div><ExpenseSummary expenses={data.expenses.filter(e=>period==="all"||monthMatch(e.date))}/></div></div></section>
}
function K({label,v,a,d}){return <div className={"k "+(a?"gold ":"")+(d?"red":"")}><b>{v}</b><span>{label}</span></div>}
function Empty({text}){return <div className="empty">{text}</div>}

function Products({data,update}){
 const [form,setForm]=useState(null);
 const save=p=>{let n={...data};if(p.id)n.products=n.products.map(x=>x.id===p.id?p:x);else{p={...p,id:uid()};n.products=[...n.products,p];if(p.stock)n.purchases=[...n.purchases,{id:uid(),productId:p.id,name:p.name,qty:p.stock,costEach:p.cost,total:p.stock*p.cost,date:today()}]}update(n);setForm(null)};
 return <section><div className="head"><div><h1>Products</h1><p>Inventory and product cost tracking.</p></div><button className="primary" onClick={()=>setForm({name:"",cost:0,stock:0})}>＋ Add product</button></div><div className="cards">{data.products.map(p=><div className="product" key={p.id}><h3>{p.name}</h3><div><span>Cost</span><b>{money(p.cost)}</b></div><div><span>Stock</span><b>{p.stock}</b></div><div className="actions"><button onClick={()=>setForm(p)}>Edit</button><button className="danger" onClick={()=>confirm("Remove product? Past orders stay saved.")&&update({...data,products:data.products.filter(x=>x.id!==p.id),purchases:data.purchases.filter(x=>x.productId!==p.id)})}>Remove</button></div></div>)}</div>{!data.products.length&&<div className="panel"><Empty text="No products yet."/></div>}{form&&<ProductForm p={form} save={save} close={()=>setForm(null)}/>}</section>
}
function ProductForm({p,save,close}){const [f,setF]=useState(p);return <Modal title={p.id?"Edit product":"Add product"} close={close}><Field l="Product name"><input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field><div className="grid2"><Field l="Cost price"><input type="number" value={f.cost} onChange={e=>setF({...f,cost:Number(e.target.value)})}/></Field><Field l="Stock"><input type="number" value={f.stock} onChange={e=>setF({...f,stock:Number(e.target.value)})}/></Field></div><button className="primary wide" onClick={()=>f.name.trim()?save(f):alert("Enter product name.")}>Save</button></Modal>}

function Orders({data,update,receipt,edit,add}){
 const [q,setQ]=useState(""),[st,setSt]=useState("All");
 const rows=[...data.orders].sort((a,b)=>b.orderNo-a.orderNo).filter(o=>(`${o.customerName} ${o.phone} ${o.location} ${o.productName}`).toLowerCase().includes(q.toLowerCase())&&(st==="All"||o.status===st));
 const change=(id,v)=>update({...data,orders:data.orders.map(o=>o.id===id?{...o,status:v}:o)});
 const remove=id=>{if(!confirm("Delete this order permanently from this device?"))return;update({...data,orders:data.orders.filter(x=>x.id!==id)})};
 return <section><div className="head"><div><h1>Orders</h1><p>Every order can be edited, status-updated or deleted.</p></div><button className="primary" onClick={add}>＋ Add order</button></div><div className="toolbar"><input placeholder="Search customer, phone, location or product…" value={q} onChange={e=>setQ(e.target.value)}/><select value={st} onChange={e=>setSt(e.target.value)}><option>All</option><option>Pending</option><option>Dispatched</option><option>Delivered</option><option>Cancelled</option></select></div><div className="panel">{rows.length?rows.map(o=><OrderRow key={o.id} o={o} edit={edit} receipt={receipt} onStatus={change} onDelete={remove}/>):<Empty text="No matching orders."/>}</div></section>
}
function OrderRow({o,edit,receipt,onStatus,onDelete}){return <div className="order"><div className="order-info"><b>ORD-{String(o.orderNo).padStart(3,"0")}</b><div><strong>{o.productName}</strong><small>{o.customerName||"Walk-in"} {o.phone&&" · "+o.phone} {o.location&&" · "+o.location}</small></div></div><div className="order-money"><span>{money(o.price)}</span><b className={profit(o)<0?"negative":""}>{money(profit(o))}</b></div><div className="order-actions"><select className={o.status} value={o.status} onChange={e=>onStatus&&onStatus(o.id,e.target.value)}><option>Pending</option><option>Dispatched</option><option>Delivered</option><option>Cancelled</option></select><button onClick={()=>edit(o)}>Edit</button><button onClick={()=>receipt(o)}>Receipt</button>{onDelete&&<button className="danger" onClick={()=>onDelete(o.id)}>Delete</button>}</div></div>}

function SaleModal({data,update,close,receipt,initial}){
 const [f,setF]=useState(initial?{...initial}:{productName:"",productId:"",price:"",cost:"",delivery:"",other:"",date:today(),status:"Pending",payment:"Unpaid",customerName:"",phone:"",location:""});
 const editing=!!initial;
 const choose=id=>{const p=data.products.find(x=>x.id===id);setF({...f,productId:id,productName:p?.name||"",cost:p?.cost??""})};
 const save=async()=>{if(!f.productName.trim())return alert("Enter a product.");const o={...f,id:f.id||uid(),orderNo:f.orderNo||(data.orderCounter+1),price:+f.price||0,cost:+f.cost||0,delivery:+f.delivery||0,other:+f.other||0};const n={...data,orderCounter:Math.max(data.orderCounter,o.orderNo),orders:editing?data.orders.map(x=>x.id===o.id?o:x):[...data.orders,o]};await update(n);close();receipt(o)};
 return <Modal title={editing?"Edit order":"Add sale / order"} close={close}>
  <Field l="Product"><select value={f.productId||""} onChange={e=>choose(e.target.value)}><option value="">Choose stocked product</option>{data.products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input className="mt" value={f.productName} onChange={e=>setF({...f,productName:e.target.value})} placeholder="Or type product name"/></Field>
  <div className="grid2"><Field l="Selling price"><input type="number" value={f.price} onChange={e=>setF({...f,price:e.target.value})}/></Field><Field l="Cost price"><input type="number" value={f.cost} onChange={e=>setF({...f,cost:e.target.value})}/></Field></div>
  <div className="grid2"><Field l="Delivery expense"><input type="number" value={f.delivery} onChange={e=>setF({...f,delivery:e.target.value})}/></Field><Field l="Other order expense"><input type="number" value={f.other} onChange={e=>setF({...f,other:e.target.value})}/></Field></div>
  <div className="grid2"><Field l="Order date"><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field><Field l="Order status"><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option>Pending</option><option>Dispatched</option><option>Delivered</option><option>Cancelled</option></select></Field></div>
  <Field l="Payment status"><select value={f.payment||"Unpaid"} onChange={e=>setF({...f,payment:e.target.value})}><option>Unpaid</option><option>Partial</option><option>Paid</option></select></Field>
  <h3>Customer</h3><Field l="Name"><input value={f.customerName} onChange={e=>setF({...f,customerName:e.target.value})}/></Field><div className="grid2"><Field l="Phone"><input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></Field><Field l="Location"><input value={f.location} onChange={e=>setF({...f,location:e.target.value})}/></Field></div>
  <div className="estimate"><span>Order profit</span><b>{money((+f.price||0)-(+f.cost||0)-(+f.delivery||0)-(+f.other||0))}</b></div><button className="primary wide" onClick={save}>{editing?"Save Changes & Receipt":"Save Order & Receipt"}</button>
 </Modal>
}

const expenseCategories=["Accommodation","Food","Transport","Fuel","Packaging","Phone / Internet","Bank / Payment fees","Office / Shop","Repairs","Other"];
function Expenses({data,update}){
 const [form,setForm]=useState(null),[q,setQ]=useState(""),[cat,setCat]=useState("All"),[period,setPeriod]=useState("month");
 const rows=[...data.expenses].sort((a,b)=>b.date.localeCompare(a.date)).filter(e=>(period==="all"||monthMatch(e.date))&&(cat==="All"||e.category===cat)&&(`${e.category} ${e.description} ${e.paymentMethod||""}`).toLowerCase().includes(q.toLowerCase()));
 const total=rows.reduce((s,e)=>s+Number(e.amount||0),0);
 const save=e=>{const n={...data,expenses:e.id?data.expenses.map(x=>x.id===e.id?e:x):[...data.expenses,{...e,id:uid(),createdAt:new Date().toISOString()}]};update(n);setForm(null)};
 const del=id=>{if(confirm("Delete this expense?"))update({...data,expenses:data.expenses.filter(e=>e.id!==id)})};
 return <section><div className="head"><div><h1>Expenses</h1><p>General business expenses are separate from individual orders.</p></div><button className="primary" onClick={()=>setForm({date:today(),category:"Accommodation",description:"",amount:"",paymentMethod:"Cash"})}>＋ Add expense</button></div>
 <div className="expense-total"><div><span>{period==="month"?"This month":"All time"} general expenses</span><b>{money(total)}</b></div><div className="seg"><button className={period==="month"?"on":""} onClick={()=>setPeriod("month")}>This month</button><button className={period==="all"?"on":""} onClick={()=>setPeriod("all")}>All time</button></div></div>
 <div className="toolbar"><input placeholder="Search category or description…" value={q} onChange={e=>setQ(e.target.value)}/><select value={cat} onChange={e=>setCat(e.target.value)}><option>All</option>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select></div>
 <div className="panel"><div className="expense-table-head"><span>Date</span><span>Category</span><span>Description</span><span>Payment</span><span>Amount</span><span></span></div>{rows.length?rows.map(e=><div className="expense-row" key={e.id}><span>{e.date}</span><strong>{e.category}</strong><span>{e.description||"—"}</span><span>{e.paymentMethod||"—"}</span><b>{money(e.amount)}</b><div className="actions"><button onClick={()=>setForm(e)}>Edit</button><button className="danger" onClick={()=>del(e.id)}>Delete</button></div></div>):<Empty text="No expenses found."/>}</div>
 {form&&<ExpenseForm e={form} save={save} close={()=>setForm(null)}/>}
 </section>
}
function ExpenseSummary({expenses}){if(!expenses.length)return <Empty text="No general expenses for this period."/>;const m={};expenses.forEach(e=>m[e.category]=(m[e.category]||0)+Number(e.amount||0));return <>{Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([k,v])=><div className="stockline" key={k}><div><b>{k}</b><small>{expenses.filter(e=>e.category===k).length} entries</small></div><strong>{money(v)}</strong></div>)}</>}
function ExpenseForm({e,save,close}){const [f,setF]=useState(e);return <Modal title={e.id?"Edit expense":"Add expense"} close={close}><div className="grid2"><Field l="Date"><input type="date" value={f.date} onChange={x=>setF({...f,date:x.target.value})}/></Field><Field l="Category"><select value={f.category} onChange={x=>setF({...f,category:x.target.value})}>{expenseCategories.map(c=><option key={c}>{c}</option>)}</select></Field></div><Field l="Description"><input value={f.description} onChange={x=>setF({...f,description:x.target.value})} placeholder="Hotel, lunch, taxi, etc."/></Field><div className="grid2"><Field l="Amount"><input type="number" min="0" step="0.01" value={f.amount} onChange={x=>setF({...f,amount:x.target.value})}/></Field><Field l="Payment method"><select value={f.paymentMethod} onChange={x=>setF({...f,paymentMethod:x.target.value})}><option>Cash</option><option>Card</option><option>Bank transfer</option><option>Other</option></select></Field></div><button className="primary wide" onClick={()=>Number(f.amount)>0?save({...f,amount:Number(f.amount)}):alert("Enter an expense amount.")}>{e.id?"Save Changes":"Save Expense"}</button></Modal>}

function Settings({data,update}){
 const [s,setS]=useState(data.settings),[saved,setSaved]=useState(false);
 const save=async()=>{await update({...data,settings:s});setSaved(true);setTimeout(()=>setSaved(false),1600)};
 const logo=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>setS({...s,logo:r.result});r.readAsDataURL(f)};
 return <section><div className="head"><div><h1>Seller settings</h1><p>This information appears on your receipts.</p></div><button className="primary" onClick={save}>{saved?"Saved ✓":"Save settings"}</button></div><div className="settings-grid"><div className="panel"><h2>Company information</h2><Field l="Company / shop name"><input value={s.companyName} onChange={e=>setS({...s,companyName:e.target.value})} placeholder="Your Store Name"/></Field><div className="grid2"><Field l="Phone"><input value={s.phone} onChange={e=>setS({...s,phone:e.target.value})}/></Field><Field l="WhatsApp"><input value={s.whatsapp} onChange={e=>setS({...s,whatsapp:e.target.value})}/></Field></div><Field l="Address / location"><input value={s.address} onChange={e=>setS({...s,address:e.target.value})}/></Field><Field l="Email"><input value={s.email} onChange={e=>setS({...s,email:e.target.value})}/></Field></div><div className="panel"><h2>Company logo</h2>{s.logo?<img className="logo-preview" src={s.logo}/>:<div className="logo-placeholder">No logo</div>}<label className="upload">Choose logo<input type="file" accept="image/*" onChange={logo}/></label><p className="hint">PNG/JPG works well. It is stored with your app data and printed on receipts.</p></div></div><div className="panel danger-panel"><h2>Data safety</h2><p>Local records are stored in IndexedDB until cloud sync is connected. Keep backups while testing the upgraded version.</p><button className="ghost" onClick={()=>downloadBackup(data)}>Download full backup</button></div></section>
}

function Modal({title,close,children}){return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal"><button className="close" onClick={close}>×</button><h2>{title}</h2>{children}</div></div>}
function Field({l,children}){return <label className="field"><span>{l}</span>{children}</label>}
function Receipt({order,data,close}){const s=data.settings||{};return <div className="overlay receipt-overlay"><div className="receipt-shell"><div className="receipt-actions"><button className="ghost" onClick={close}>Close</button><button className="primary" onClick={()=>window.print()}>Print / Save PDF</button></div><article className="receipt">{(s.logo||s.companyName)&&<div className="seller">{s.logo&&<img src={s.logo}/>}<div><h1>{s.companyName||"Seller"}</h1>{s.phone&&<span>{s.phone}</span>}{s.whatsapp&&<span>WhatsApp: {s.whatsapp}</span>}{s.address&&<span>{s.address}</span>}{s.email&&<span>{s.email}</span>}</div></div>}<div className="receipt-title"><div><h2>ORDER RECEIPT</h2><span>ORD-{String(order.orderNo).padStart(3,"0")}</span></div><b>{order.date}</b></div><hr/><div className="customer"><div><small>CUSTOMER</small><b>{order.customerName||"Walk-in customer"}</b><span>{order.phone}</span><span>{order.location}</span></div><div><small>ORDER STATUS</small><b>{order.status}</b><span>Payment: {order.payment||"Unpaid"}</span></div></div><table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody><tr><td>{order.productName}</td><td>1</td><td>{money(order.price)}</td></tr></tbody></table><div className="totals"><div><span>Subtotal</span><b>{money(order.price)}</b></div><div><span>Delivery</span><b>{money(order.delivery)}</b></div><div className="total"><span>Total</span><b>{money(order.price)}</b></div></div><p className="thanks">Thank you for your order.</p></article></div></div>}
function downloadBackup(data){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.href=url;a.download=`sale-tracker-backup-${today()}.json`;a.click();URL.revokeObjectURL(url)}
createRoot(document.getElementById("root")).render(<App/>);
