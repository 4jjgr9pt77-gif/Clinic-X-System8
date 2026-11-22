# Clinic X – Desktop App

## Way 1 – Easiest (Windows): double-click

1. Install Node.js from https://nodejs.org (if not installed)
2. Double-click **Start-ClinicX-Windows.bat**
3. Clinic X opens in its own app window (Chrome/Edge app mode)

## Way 2 – Mac / Linux

```bash
cd ClinicX-App
chmod +x Start-ClinicX-Mac-Linux.sh
./Start-ClinicX-Mac-Linux.sh
```

## Way 3 – Full Electron desktop app

```bash
cd ClinicX-App
npm install
npm start
```

This opens a real desktop application window named **Clinic X**.

## Login

| Username | Password   |
|----------|------------|
| admin    | admin123   |
| doctor   | doctor123  |
| nurse    | nurse123   |
| cashier  | cashier123 |

## Notes

- Way 1 & 2 need Node.js installed
- Way 3 needs Node.js + first-time `npm install` (downloads Electron)
- Data is saved in the `data` folder next to the app
