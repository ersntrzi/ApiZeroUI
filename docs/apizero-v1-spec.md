# ApiZero - V1 Spec (MVP Baseline)

## Hedef
Postman benzeri, offline calisan basit bir istemci.
- Environment / Globals degiskenleri
- Istek gecmisi (silinebilir)
- `post-res` script ile response JSON alanlarindan degisken yazma

## Platform
- Windows + macOS (V1)

## Degisken modeli
- Deger tipleri: `string | number | boolean`
- Export/Import: JSON

## Request degisken yerlestirme
- Syntax (Postman benzeri): `{{VariableName}}`

## Degisken cozume onceligi (V1)
1. `Environment`
2. `Globals`
3. Bulunmazsa istek `failed`

## Istek calisma pipelinesi (V1)
1. `{{...}}` yerlestirmeleri resolve edilir
2. HTTP istek gonderilir
3. Response sadece JSON kabul edilir ve parse edilir
4. `res.body` script sandbox'una verilir
5. Script sirasi: parse sonrasi hemen `post-res` calisir
6. Script sadece su metodlari kullanabilir:
   - `pm.environment.set(name, value)`
   - `pm.globals.set(name, value)`

## `post-res` basarisiz olma kurali (V1)
`post-res` script icinde su cagri yapilir:
`pm.environment.set("SessionKey", res.body.SessionKey)`

Eger okunan alan `undefined` ise:
- Istek `failed`
- Degisken set edilmez
- Hata mesaji formatinda gosterim:
  `post-res: set <VariableName> failed - res.body.<path> is undefined`

## Tip donusumu (V1)
`set(name, value)` icin:
- Degiskenin tipi mevcut degilse, gelen degerin JS tipine gore tipi infere et:
  - string -> `string`
  - number -> `number`
  - boolean -> `boolean`
- Degiskenin tipi belliyse, gelen degeri hedef tipe donusturmeye calis:
  - number: string -> `parseFloat`
  - boolean: string -> `"true"` / `"false"` (case-insensitive)
  - string: diger -> `String(value)`

Donusum basarisiz olursa:
- Degisken set edilmez
- Istek `failed`

## Gecmis davranisi (V1)
`post-res` hatasi nedeniyle istek `failed` olsa bile history’de:
- status code
- response preview (JSON snippet)
- script hata mesajı
gosterilir.

