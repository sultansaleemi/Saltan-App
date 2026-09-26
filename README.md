# Sale Tracker — Mobile + Desktop React PWA

## Cloudflare Pages production build

Build command:
`npm run build`

Build output directory:
`dist`

The project is Vite-based and the production build must be deployed from `dist`, not from the project root/source files.

## Main features
- Mobile-first installable PWA (Android, iPhone, tablet, PC)
- Dashboard
- General Expenses
- Products / stock
- Orders with add, edit and delete
- Order status and payment status
- Profit calculation
- Company / seller information and logo
- Printable receipt / Save as PDF
- IndexedDB local storage
- JSON backup
- Previous React localStorage migration

## Local development
`npm install`
`npm run dev`

## Production
`npm run build`
`npm run preview`

For Cloudflare Pages, use `npm run build` and publish `dist`.
