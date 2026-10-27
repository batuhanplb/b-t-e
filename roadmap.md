# Tasarım düzenlemesi
- [x] İşlem formunu sadeleştir: tek alanda kategori araması, kaydırılabilir liste ve yazarken binlik ayırıcı; gerçek test hesabında doğrula.
- [x] Ortak yazı, renk, boşluk ve kontrol düzenini sadeleştir.
- [x] Tabloları ve küçük modülleri taşmadan okunabilir yap.
- [x] Test hesabında telefon ve bilgisayar görünümünü doğrula.

# Mobil modül düzenleme
- [x] Mobilde elle boyutlandırma, taşıma, ekleme ve çıkarmayı aç.
- [x] Telefon yerleşimini kayıtlı masaüstü düzenini bozmadan sakla ve doğrula.

# Nakit akışı bölümü
- [x] "Kalan nakit" adını "Nakit akışı" olarak değiştir (menü, başlık, modül, paylaşım).
- [x] Bölümü ileriye dönük 12 ay takibi olarak anlatan kısa bir açıklama satırı ekle.
- [x] Telefon görünümünde ay grafik rakamlarının üst üste binmesini gider.

- [x] Modül düzenleme: boy seçenekleri + oklar (web), liste görünümü (telefon)
- [x] Capacitor kabuğu + GitHub ile otomatik APK
- [x] APK/Android katmanını tamamen kaldır (1.3.0.0): kullanıcı PWA kullanıyor, APK ile iş yok
- [ ] Uygulama içinde Google girişi (uygulamaya geri dönüş bağlantısı gerekiyor)
- [x] Web değişikliklerinin kurulum gerektirmeden gelmesi (PWA: her açılışta sunucudan)
- [x] Alt kategori ayracı ":" (geçmiş lehdarlar dahil)
- [x] Lehdar boşsa, alan terk edilince kategori adını yaz (2. seçenek)
- [x] Mobil alt menü: Yatırımlar menüden çıktı; Gider ve Dağılım üst sekmeye taşındı (7 sekme tek sıra, 1.3.1.0)


# Daha sonra yapılacaklar
- [x] Dağılım sayfasının tasarımını yenile: dilime dokununca merkezde tutar/pay, altında detay kartı (işlem adedi, ortalama, en yüksek, son işlem), listede eşleşen satır vurgusu ve "işlemleri gör / alt kategoriler" kısayolları (1.2.47.0).
- [ ] Eksik veya yanlış çalışan tıklamaları kontrol edip düzelt (kullanıcının isteğiyle sıraya alındı; henüz uygulanmayacak).

# Tasarım birliği (1.3.2.0)
- [x] Dağılım sayfasının dilini (sunk hücre, eyebrow etiket, tabular sayı) İşlemler, Nakit, Borç, Abonelikler, tablolar ve tanım listelerine taşı (mantık ve yerleşim aynı).
- [x] İşlemler'deki 5 ayrı filtre satırını tek yatay kaydırmalı şeride indir; filtre durumu ve davranışı değişmedi.
- [x] 399px altındaki ekranlarda özet hücrelerini satıra çevirerek tutarın kesilmesini önle.

# Liste satırlarında tutar sığdırma (1.3.2.1)
- [x] Anasayfa modül listelerinde (Dağılım, En büyük harcamalar, Hesaplar) tutar artık hiç kırılmıyor: "₺27.067" tek satırda kalıyor, ad ve "%22,44 pay" etiketi tek satırda üç nokta ile kısalıyor.
- [x] Kırılma viewport'a değil modülün kendi genişliğine göre yönetiliyor (`@container`): dar modülde tutar/yüzde bir tık küçülür, 220px altında ad için yer açılır.

# Mobilde ay farkı (1.3.3.0)
- [x] Dağılım satırlarındaki "geçen aya göre değişim" (↑/↓ %) mobilde gizlenmiyor: 230px altındaki modüllerde tutarın altında 9-9,5px'lik sağa yaslı satır olarak görünüyor.
- [x] Önceki ay verisi olmayan satırlarda gelen "—" işareti dar modülde gizli kalır (kalabalık yapmasın); satır yüksekliği artmadı, liste yoğunluğu aynı.

