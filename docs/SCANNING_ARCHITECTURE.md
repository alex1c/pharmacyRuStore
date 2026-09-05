# Scanning architecture (Phase 6)

## Goal

Scanning accelerates pack entry. It is never required:

- works offline
- works without a product catalogue API
- falls back to manual entry when camera/permission/parsing fails

## Stack

- `expo-camera` (~57.0.4) `CameraView` + `onBarcodeScanned`
- Permission requested only when the user opens the scanner
- Torch toggle when available

## Supported barcode types

Android / Expo `BarcodeType` values used:

- `ean13`, `ean8`
- `upc_a`, `upc_e`
- `code128`
- `qr`
- `datamatrix`

## Domain flow

1. Capture raw payload → `ScannedCode` (`rawData`, `barcodeType`, `scannedAt`)
2. Best-effort GS1 parse (`parseGs1DataMatrix`) for AI `(01)` GTIN, `(17)` expiry, `(10)` lot, `(21)` serial
3. Normalize lookup string as **string** (preserve leading zeros)
4. Local match via `medicine_codes`
5. Result screen: existing medicine → add pack; unknown → create / select-and-attach
6. User always reviews quantity/expiry before save

Pending scan state is kept in memory (`scanSession`) so raw codes are not placed in analytics or fragile URL params longer than needed.

## Local code model

Table `medicine_codes`:

- one Medicine may have several codes (pack variants)
- unique on normalized `code_value`
- conflict if the same code is attached to another medicine

A scan creates a **new MedicineBatch**, never a duplicate Medicine identity.

## External lookup

`medicineLookupProvider.lookupByGtin()` exists as an abstraction.

Default implementation: **local / unavailable** (no network).

No Честный знак production client, no API keys in the app.

## Privacy

- Camera used only for explicit scan actions
- Raw codes / GTIN / serial are **local only**
- Analytics may emit `scan_success` / `scan_failed` **without** raw payload, GTIN, serial, or medicine names

## Known limitations

- No remote product enrichment
- Package size cannot be inferred from barcode alone
- Emulators often need **manual code entry**
- Full physical-device barcode QA deferred to release testing
