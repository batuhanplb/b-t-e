# Bütçe

Kişisel finans ve bütçe takip uygulaması. Türkçe arayüz, TRY para birimi, mobil öncelikli.

**Canlı:** https://butceapp.lovable.app

## Özellikler

- Gelir, gider ve transfer kaydı; taksit ve abonelikler
- Hesaplar, kredi kartları (kesim/ödeme günü), krediler ve borç takvimi
- Kategoriler, alt kategoriler ve lehdarlar
- Nakit akışı: ileriye dönük 12 aylık takip
- Düzenlenebilir ana sayfa modülleri (günlük harcama, dağılım, abonelikler vb.)
- Çoklu gider tabloları (özet, toplam ve ortalama)
- Kredi kartı ekstresi (PDF) ile kayıt eşleştirme — cihazda, yapay zekasız
- Aylık rapor, Öneri & Dikkat uyarıları
- Expense IQ, Money Manager, Excel/CSV içe aktarma; JSON yedek
- Koyu / yumuşak açık tema, tabloları seçerek paylaşma
- Telefona "Ana ekrana ekle" ile uygulama gibi kurulum (PWA)

## Teknik

- Arayüz: vanilla JS (`public/app.js`, `public/core.js`), `src/original-index.html`
- Veri: Lovable Cloud (Google ile giriş, kullanıcıya özel erişim)
- Veri katmanı: `src/cloud-store/entry.ts` → değişince `bun run build:cloud-store`
- Sunucu: TanStack Start (sadece statik dosyaları sunar)

## Geliştirme

```sh
bun install
bun run dev
```

Çalışma kuralları için `AGENTS.md` dosyasına bakın.
