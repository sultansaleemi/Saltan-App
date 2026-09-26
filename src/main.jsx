import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import "./styles.css";

const DB_NAME="SaleTrackerDB", DB_VERSION=1, STORE="app";
const OLD_KEY="saleTrackerReact_v1";
const empty={products:[],orders:[],purchases:[],orderCounter:0,settings:{companyName:"",phone:"",whatsapp:"",address:"",email:"",logo:"",currency:"AED"}};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const today=()=>new Date().toISOString().slice(0,10);
const money=n=>"AED "+(Math.round((Number(n)||0)*100)/100).toLocaleString(undefined,{maximumFractionDigits:2});
const merge=(d)=>({...empty,...d,products:d?.products||[],orders:d?.orders||[],purchases:d?.purchases||[],settings:{...empty.settings,...(d?.settings||{})}});

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function dbGet(){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).get("data");r.onsuccess=()=>res(r.result||null);r.onerror=()=>rej(r.error)})}
async function dbPut(data){const db=await openDB();return new Promise((res,rej)=>{const r=db.transaction(STORE,"readwrite").objectStore(STORE).put(data,"data");r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function revenue(o){return o.status==="Cancelled"?0:Number(o.price)||0}
function expense(o){return (Number(o.delivery)||0)+(Number(o.other)||0)+(!o.productId?Number(o.cost)||0:0)}
function profit(o){return revenue(o)-expense(o)}

function App(){
 const [data,setData]=useState(null),[page,setPage]=useState("dashboard"),[sale,setSale]=useState(false),[receipt,setReceipt]=useState(null),[editOrder,setEditOrder]=useState(null),[period,setPeriod]=useState("month");
 useEffect(()=>{(async()=>{let d=await dbGet();if(!d){try{const old=JSON.parse(localStorage.getItem(OLD_KEY)||"null");d=old?merge(old):empty}catch{d=empty}await dbPut(d)}setData(merge(d))})()},[]);
 const update=async d=>{d=merge(d);setData(d);await dbPut(d)};
 if(!data)return <div className="loading">Loading Sale Tracker…</div>;
 const orders=period==="all"?data.orders:data.orders.filter(o=>{const d=new Date(o.date),n=new Date();return d.getFullYear()===n.getFullYear()&&d.getMonth()===n.getMonth()});
 const sales=orders.reduce((s,o)=>s+revenue(o),0), ex=orders.reduce((s,o)=>s+expense(o),0);
 const stockEx=data.purchases.filter(p=>period==="all"||p.date.slice(0,7)===today().slice(0,7)).reduce((s,p)=>s+Number(p.total||0),0);
 const stock=data.products.reduce((s,p)=>s+Math.max(0,p.stock-data.orders.filter(o=>o.productId===p.id&&["Dispatched","Delivered"].includes(o.status)).length),0);
 const stats={sales,expenses:ex+stockEx,profit:sales-ex-stockEx,orders:orders.length,pending:orders.filter(o=>o.status==="Pending").length,stock};
 return <div className="app">
  <header className="top"><div className="brand">Sale <span>Tracker</span></div><nav>{[["dashboard","⌂ Dashboard"],["products","◫ Products"],["orders","▤ Orders"],["settings","⚙ Settings"]].map(([id,l])=><button className={page===id?"active":""} onClick={()=>setPage(id)}>{l}</button>)}</nav><button className="add" onClick={()=>setSale(true)}>＋ Sale</button></header>
  <main>
   {page==="dashboard"&&<Dashboard data={data} stats={stats} period={period} setPeriod={setPeriod} openReceipt={setReceipt} edit={setEditOrder}/>}
   {page==="products"&&<Products data={data} update={update}/>}
   {page==="orders"&&<Orders data={data} update={update} receipt={setReceipt} edit={setEditOrder}/>}
   {page==="settings"&&<Settings data={data} update={update}/>}
  </main>
  <div className="mobilebar">{[["dashboard","⌂"],["products","◫"],["orders","▤"],["settings","⚙"]].map(([id,i])=><button className={page===id?"sel":""} onClick={()=>setPage(id)}><b>{i}</b><span>{id}</span></button>)}<button className="mobile-sale" onClick={()=>setSale(true)}>＋</button></div>
  {sale&&<SaleModal data={data} update={update} close={()=>setSale(false)} receipt={setReceipt}/>}
  {editOrder&&<SaleModal data={data} update={update} initial={editOrder} close={()=>setEditOrder(null)} receipt={setReceipt}/>}
  {receipt&&<Receipt order={receipt} data={data} close={()=>setReceipt(null)}/>}
 </div>
}

function Dashboard({data,stats,period,setPeriod,openReceipt,edit}){
 const recent=[...data.orders].sort((a,b)=>b.orderNo-a.orderNo).slice(0,8);
 return <section><div className="head"><div><h1>Dashboard</h1><p>Everything important, at a glance.</p></div><div className="seg"><button className={period==="month"?"on":""} onClick={()=>setPeriod("month")}>This month</button><button className={period==="all"?"on":""} onClick={()=>setPeriod("all")}>All time</button></div></div>
 <div className="kpis"><K label="Profit" v={money(stats.profit)} a/><K label="Sales" v={money(stats.sales)}/><K label="Expenses" v={money(stats.expenses)}/><K label="Orders" v={stats.orders}/><K label="In stock" v={stats.stock}/><K label="Pending" v={stats.pending} d/></div>
 <div className="dashboard-grid"><div className="panel"><div className="panel-head"><h2>Recent orders</h2><span>{data.orders.length} total</span></div>{recent.length?recent.map(o=><OrderRow key={o.id} o={o} edit={edit} receipt={openReceipt}/>):<Empty text="No orders yet."/ >}</div>
 <div className="panel"><div className="panel-head"><h2>Stock</h2><span>{data.products.length} products</span></div>{data.products.map(p=><div className="stockline" key={p.id}><div><b>{p.name}</b><small>Cost {money(p.cost)}</small></div><strong>{p.stock}</strong></div>)}{!data.products.length&&<Empty text="Add your first product."/>}</div></div></section>
}
function K({label,v,a,d}){return <div className={"k "+(a?"gold ":"")+(d?"red":"")}><b>{v}</b><span>{label}</span></div>}
function Empty({text}){return <div className="empty">{text}</div>}

function Products({data,update}){
 const [form,setForm]=useState(null);
 const save=p=>{let n={...data};if(p.id)n.products=n.products.map(x=>x.id===p.id?p:x);else{p={...p,id:uid()};n.products=[...n.products,p];if(p.stock)n.purchases=[...n.purchases,{id:uid(),productId:p.id,name:p.name,qty:p.stock,costEach:p.cost,total:p.stock*p.cost,date:today()}]}update(n);setForm(null)};
 return <section><div className="head"><div><h1>Products</h1><p>Simple inventory and cost tracking.</p></div><button className="primary" onClick={()=>setForm({name:"",cost:0,stock:0})}>＋ Add product</button></div><div className="cards">{data.products.map(p=><div className="product" key={p.id}><h3>{p.name}</h3><div><span>Cost</span><b>{money(p.cost)}</b></div><div><span>Stock</span><b>{p.stock}</b></div><div className="actions"><button onClick={()=>setForm(p)}>Edit</button><button onClick={()=>confirm("Remove product? Past orders stay saved.")&&update({...data,products:data.products.filter(x=>x.id!==p.id),purchases:data.purchases.filter(x=>x.productId!==p.id)})}>Remove</button></div></div>)}</div>{!data.products.length&&<div className="panel"><Empty text="No products yet."/></div>}{form&&<ProductForm p={form} save={save} close={()=>setForm(null)}/>}</section>
}

function ProductForm({p,save,close}){const [f,setF]=useState(p);return <Modal title={p.id?"Edit product":"Add product"} close={close}><Field l="Product name"><input value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field><div className="grid2"><Field l="Cost price"><input type="number" value={f.cost} onChange={e=>setF({...f,cost:Number(e.target.value)})}/></Field><Field l="Stock"><input type="number" value={f.stock} onChange={e=>setF({...f,stock:Number(e.target.value)})}/></Field></div><button className="primary wide" onClick={()=>f.name.trim()?save(f):alert("Enter product name.")}>Save</button></Modal>}

function Orders({data,update,receipt,edit}){
 const [q,setQ]=useState(""),[st,setSt]=useState("All");
 const rows=[...data.orders].sort((a,b)=>b.orderNo-a.orderNo).filter(o=>(`${o.customerName} ${o.phone} ${o.location} ${o.productName}`).toLowerCase().includes(q.toLowerCase())&&(st==="All"||o.status===st));
 const change=(id,v)=>update({...data,orders:data.orders.map(o=>o.id===id?{...o,status:v}:o)});
 return <section><div className="head"><div><h1>Orders</h1><p>Edit mistakes, update status and print receipts.</p></div></div><div className="toolbar"><input placeholder="Search customer, phone, location or product…" value={q} onChange={e=>setQ(e.target.value)}/><select value={st} onChange={e=>setSt(e.target.value)}><option>All</option><option>Pending</option><option>Dispatched</option><option>Delivered</option><option>Cancelled</option></select></div><div className="panel">{rows.length?rows.map(o=><OrderRow key={o.id} o={o} edit={edit} receipt={receipt} onStatus={change} onDelete={id=>confirm("Delete this order?")&&update({...data,orders:data.orders.filter(x=>x.id!==id)})}/>):<Empty text="No matching orders."/>}</div></section>
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
  <div className="grid2"><Field l="Delivery expense"><input type="number" value={f.delivery} onChange={e=>setF({...f,delivery:e.target.value})}/></Field><Field l="Other expense"><input type="number" value={f.other} onChange={e=>setF({...f,other:e.target.value})}/></Field></div>
  <div className="grid2"><Field l="Order date"><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field><Field l="Order status"><select value={f.status} onChange={e=>setF({...f,status:e.target.value})}><option>Pending</option><option>Dispatched</option><option>Delivered</option><option>Cancelled</option></select></Field></div>
  <Field l="Payment status"><select value={f.payment||"Unpaid"} onChange={e=>setF({...f,payment:e.target.value})}><option>Unpaid</option><option>Partial</option><option>Paid</option></select></Field>
  <h3>Customer</h3><Field l="Name"><input value={f.customerName} onChange={e=>setF({...f,customerName:e.target.value})}/></Field><div className="grid2"><Field l="Phone"><input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})}/></Field><Field l="Location"><input value={f.location} onChange={e=>setF({...f,location:e.target.value})}/></Field></div>
  <div className="estimate"><span>Profit</span><b>{money((+f.price||0)-(+f.cost||0)-(+f.delivery||0)-(+f.other||0))}</b></div><button className="primary wide" onClick={save}>{editing?"Save Changes & Receipt":"Save Order & Receipt"}</button>
 </Modal>
}

function Settings({data,update}){
 const [s,setS]=useState(data.settings),[saved,setSaved]=useState(false);
 const save=async()=>{await update({...data,settings:s});setSaved(true);setTimeout(()=>setSaved(false),1600)};
 const logo=e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>setS({...s,logo:r.result});r.readAsDataURL(f)};
 return <section><div className="head"><div><h1>Seller settings</h1><p>This information appears on your receipts.</p></div><button className="primary" onClick={save}>{saved?"Saved ✓":"Save settings"}</button></div><div className="settings-grid"><div className="panel"><h2>Company information</h2><Field l="Company / shop name"><input value={s.companyName} onChange={e=>setS({...s,companyName:e.target.value})} placeholder="Your Store Name"/></Field><div className="grid2"><Field l="Phone"><input value={s.phone} onChange={e=>setS({...s,phone:e.target.value})}/></Field><Field l="WhatsApp"><input value={s.whatsapp} onChange={e=>setS({...s,whatsapp:e.target.value})}/></Field></div><Field l="Address / location"><input value={s.address} onChange={e=>setS({...s,address:e.target.value})}/></Field><Field l="Email"><input value={s.email} onChange={e=>setS({...s,email:e.target.value})}/></Field></div><div className="panel"><h2>Company logo</h2>{s.logo?<img className="logo-preview" src={s.logo}/>:<div className="logo-placeholder">No logo</div>}<label className="upload">Choose logo<input type="file" accept="image/*" onChange={logo}/></label><p className="hint">PNG/JPG works well. It will be stored with your app data and printed on receipts.</p></div></div><div className="panel danger-panel"><h2>Data safety</h2><p>Your records are stored in this app's IndexedDB on the device. Use Backup regularly. For use across multiple phones/computers, the next step would be secure cloud sync.</p><button className="ghost" onClick={()=>downloadBackup(data)}>Download full backup</button></div></section>
}

function Modal({title,close,children}){return <div className="overlay" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className="modal"><button className="close" onClick={close}>×</button><h2>{title}</h2>{children}</div></div>}
function Field({l,children}){return <label className="field"><span>{l}</span>{children}</label>}

function Receipt({order,data,close}){
 const s=data.settings||{};return <div className="overlay receipt-overlay"><div className="receipt-shell"><div className="receipt-actions"><button className="ghost" onClick={close}>Close</button><button className="primary" onClick={()=>window.print()}>Print / Save PDF</button></div><article className="receipt">{(s.logo||s.companyName)&&<div className="seller">{s.logo&&<img src={s.logo}/>}<div><h1>{s.companyName||"Seller"}</h1>{s.phone&&<span>{s.phone}</span>}{s.whatsapp&&<span>WhatsApp: {s.whatsapp}</span>}{s.address&&<span>{s.address}</span>}{s.email&&<span>{s.email}</span>}</div></div>}<div className="receipt-title"><div><h2>ORDER RECEIPT</h2><span>ORD-{String(order.orderNo).padStart(3,"0")}</span></div><b>{order.date}</b></div><hr/><div className="customer"><div><small>CUSTOMER</small><b>{order.customerName||"Walk-in customer"}</b><span>{order.phone}</span><span>{order.location}</span></div><div><small>ORDER STATUS</small><b>{order.status}</b><span>Payment: {order.payment||"Unpaid"}</span></div></div><table><thead><tr><th>Item</th><th>Qty</th><th>Amount</th></tr></thead><tbody><tr><td>{order.productName}</td><td>1</td><td>{money(order.price)}</td></tr></tbody></table><div className="totals"><div><span>Subtotal</span><b>{money(order.price)}</b></div><div><span>Delivery</span><b>{money(order.delivery)}</b></div><div className="total"><span>Total</span><b>{money(order.price)}</b></div></div><p className="thanks">Thank you for your order.</p></article></div></div>
}
function downloadBackup(data){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.href=url;a.download=`sale-tracker-backup-${today()}.json`;a.click();URL.revokeObjectURL(url)}
createRoot(document.getElementById("root")).render(<App/>);