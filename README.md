# Sale Tracker — Mobile + Desktop React PWA

This version is intentionally small and practical.

## Main features
- Mobile-first installable PWA (Android, iPhone, tablet, PC)
- Dashboard
- Separate General Expenses page with categories, filters, summaries, edit and delete
- Products / stock
- Orders
- Add, **Edit and Delete** orders
- Search orders by customer, phone, location, product
- Order status: Pending / Dispatched / Delivered / Cancelled
- Payment status: Unpaid / Partial / Paid
- Selling price, cost, delivery and other expenses
- Profit calculation
- Company / seller information
- Company logo
- Seller information automatically appears on receipts
- Printable receipt / Save as PDF
- IndexedDB for persistent local storage
- JSON backup / restore
- Migrates the previous React localStorage data on first run

## Run on Windows
npm.cmd install
npm.cmd run dev

Open the Vite address, normally http://localhost:5173

## Build
npm.cmd run build

## Install on phone
For local testing, your phone must be able to reach the computer's development server on the same Wi-Fi and you can use the browser's Add to Home Screen option. For a real installable app, deploy the `dist` folder to HTTPS hosting. Chrome/Android and Safari/iPhone can then install the PWA.

## Long-term data
IndexedDB is much more appropriate than localStorage for the growing local dataset. Still keep regular backup files. If you want the same live data on multiple phones and PCs, the next upgrade should be a secure cloud database/login/sync layer.
