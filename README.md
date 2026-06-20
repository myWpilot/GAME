# King — Arkadaşlarla Online

4 kişilik, gerçek zamanlı, mail/şifre + Google girişli King kart oyunu.
Frontend: React + Vite, barındırma: **Netlify**. Auth + gerçek zamanlı durum: **Supabase** (ücretsiz plan yeterli).

## 1) Supabase projesi aç (5 dk)

1. https://supabase.com → ücretsiz hesap aç → **New Project**.
2. Proje açılınca sol menüden **SQL Editor** → `supabase/schema.sql` dosyasının tüm içeriğini yapıştır → **Run**.
   Bu, `profiles` ve `games` tablolarını, güvenlik kurallarını (RLS) ve realtime yayınını kurar.
3. Sol menü **Project Settings → API**: `Project URL` ve `anon public` anahtarını not al — bunlar `.env` dosyasına gidecek.

### Google ile giriş için (opsiyonel ama istendi)
1. Supabase → **Authentication → Providers → Google** → Enable.
2. Google Cloud Console'da (https://console.cloud.google.com) bir OAuth Client ID oluştur (Web application).
   - Authorized redirect URI: Supabase'in sana verdiği `https://<proje-ref>.supabase.co/auth/v1/callback` adresini ekle.
3. Client ID / Secret'ı Supabase'deki Google provider alanına yapıştır, kaydet.
4. **Authentication → URL Configuration**: Netlify'a deploy ettikten sonra oraya gelecek domaini (`https://senin-siten.netlify.app`) "Site URL" ve "Redirect URLs" kısmına ekle.

## 2) Yerelde dene

```bash
cp .env.example .env
# .env içine Supabase URL ve anon key'i yapıştır
npm install
npm run dev
```

## 3) Netlify'a deploy et

**En kolay yol — GitHub üzerinden:**
1. Bu klasörü bir GitHub reposuna push et.
2. https://app.netlify.com → **Add new site → Import an existing project** → reposunu seç.
3. Build ayarları otomatik gelecek (`netlify.toml` zaten içinde): build command `npm run build`, publish `dist`.
4. **Site settings → Environment variables** kısmına ekle:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy'u tetikle. Birkaç dakika sonra `https://senin-siten.netlify.app` adresin hazır.
6. Bu adresi Supabase'deki Google OAuth redirect/Site URL ayarlarına eklemeyi unutma (yukarıdaki adım 1).

**Alternatif — Netlify CLI ile:**
```bash
npm install -g netlify-cli
netlify deploy --prod
```

## Nasıl oynanır

1. Herkes siteye girip mail/şifre ile (veya Google ile) hesap açar — kayıt sırasında görünen adını (nick) kendisi belirler, istediği zaman lobide "değiştir" linkinden güncelleyebilir.
2. Bir kişi "Yeni Oda Kur" der, çıkan 5 haneli kodu ya da "Davet linkini kopyala" ile aldığı linki arkadaşlarına yollar.
3. Link `https://siten.netlify.app/?code=AB3X9` formatındadır — biri bu linke tıkladığında: önce giriş ekranını görür (hesabı yoksa orada saniyeler içinde açar), giriş yapar yapmaz otomatik olarak o odaya katılır, ayrıca kod yazmasına gerek kalmaz.
4. Lobide, soldaki **"Çevrimiçi"** panelinde o an siteye giriş yapmış ama henüz bir masaya oturmamış kullanıcılar görünür. Sen bir oda açtıysan (4 kişi dolmadan), onların yanındaki **"Davet et"** butonuyla tek tıkla davet gönderebilirsin — karşı taraf ekranının üstünde bir davet bildirimi görür, "Katıl" derse direkt odana düşer.
5. 4/4 olunca "Oyunu Başlat" — sırasıyla herkes 5 kez (2 koz + 3 ceza) oyun beyan eder, 20 el sonunda toplamı negatif olanlar kaybeder.

## Kurallarla ilgili not

Koz oyununda elinde koz olsa bile üstüne çıkma (overtrump) **zorunlu değil**, serbest bırakıldı — bu en yaygın King kuralı. Koz çakılmadan koz açılamaz. Rıfkı'da kupa papazı alınınca el hemen biter. İlk eli karo 2'si elinde olan oyuncu açar.

## Bilinen sınırlamalar (arkadaş arası kullanım için kabul edilebilir, ama bilinmeli)

- **El gizliliği**: Oyun durumu tek bir paylaşılan satırda tutulduğu için, teknik olarak tarayıcı geliştirici araçlarına bakan biri diğer oyuncuların elini görebilir.
- **Süre**: Süresi dolan oyuncunun kendi cihazı otomatik rastgele bir kart oynuyor. Oyuncu sekmeyi tamamen kapatırsa otomatik oynama tetiklenmez.
