# ApiZero

ApiZero, Electron + TypeScript ile gelistirilmis masaustu API istemcisidir.  
Postman benzeri bir deneyim sunar: request hazirlama, collection/folder yonetimi, environment/globals, response goruntuleme ve import/export akislari tek uygulamada toplanir.

## Neler Sunar?

- **Collection/Folder/Request agaci**
  - Collection olusturma, yeniden adlandirma, silme
  - Folder olusturma (tree uzerinden), yeniden adlandirma, silme
  - Request olusturma, kaydetme, yeniden adlandirma, silme
  - Surukle-birak ile request/folder tasima
- **Sekmeli request calisma alani**
  - Birden fazla request'i ayni anda tab olarak acma
  - Tab kapatma
  - Tab sirasini surukle-birak ile degistirme
- **Request editor**
  - HTTP method secimi
  - URL, headers, body ve post-response script alanlari
  - Save / Save as akisi
- **Environment ve Global degiskenler**
  - Ortam olusturma/silme/yeniden adlandirma
  - Ortam ve global variable tablolari
  - `{{VariableName}}` kullanimi
  - Degisken oneri ve inline ekleme (autocomplete)
- **Response ve history**
  - Status/preview goruntuleme
  - Son istek gecmisi
- **Import/Export**
  - ApiZero backup import/export
  - Postman Collection v2.1 import
  - OpenAPI/Swagger (JSON dosya veya URL) import

## Teknoloji Yigini

- **Electron**: masaustu uygulama kabugu
- **TypeScript**: main/preload ve cekirdek mantik
- **Vanilla HTML/CSS/JS**: renderer tarafi
- **electron-builder**: Windows paketleme (setup + portable)

## Proje Yapisı

- `src/main/`  
  Electron main process ve API cekirdek servisleri
- `src/preload.ts`  
  Renderer ile main arasindaki guvenli kopru
- `src/renderer/`  
  UI (`index.html`, `renderer.js`)
- `scripts/`  
  build yardimci scriptleri (`copy-renderer.cjs`, `gen-icon.cjs`)
- `assets/`  
  ikon dosyalari (`icon.png`, `icon.ico`)
- `release/`  
  `npm run dist` sonrasi olusan ciktilar

## Gereksinimler

- Node.js 18+ (onerilen LTS)
- npm
- Windows 10/11 (paketleme testleri bu ortamda yapilmistir)

## Gelistirme Komutlari

```bash
npm install
npm run dev
```

- `npm run dev`: build alir ve Electron ile uygulamayi açar
- `npm start`: mevcut build ile uygulamayi baslatir
- `npm run build`: TypeScript derler ve renderer dosyalarini `dist/` altina kopyalar

## Paketleme / Export

```bash
npm run dist
```

Bu komut sonunda `release/` altinda su dosyalar olusur:

- `ApiZero Setup 0.1.0.exe` (kurulumlu NSIS)
- `ApiZero 0.1.0.exe` (portable, kurulum gerektirmez)

### Hazir Indirme Linki

- Portable EXE: [ApiZero 0.1.0.exe](https://github.com/ersntrzi/ApiZeroUI/blob/main/release/ApiZero%200.1.0.exe?raw=1)

Notlar:

- `release/win-unpacked/` klasoru cok buyuk oldugu icin git'te tutulmaz.
- Uygulama imzasizsa ilk calistirmada Windows SmartScreen uyari verebilir.

## macOS Build (DMG/ZIP)

macOS build **Windows'ta uretilmez**. Bunun yerine repo icindeki GitHub Actions workflow'u ile otomatik macOS build alabilirsiniz:

- GitHub → **Actions** → `build-mac` → **Run workflow**
- Bittiginde **Artifacts** altindan `ApiZero-mac` (DMG/ZIP) indirilebilir.

## Veri Saklama

Uygulama verileri Electron `userData` dizininde `store.json` olarak saklanir.  
Portable exe tasinsa bile her bilgisayar kendi local verisini olusturur.

## Yol Haritasi (Kisa)

- Daha gelismis request body tipleri
- Test/assertion yapisi
- Daha gelismis performans optimizasyonlari
- Kod imzalama ile sorunsuz dagitim

