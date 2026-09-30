// ====== ioo: logika utama ======
'use strict'; // mode ketat: kesalahan kecil langsung ketahuan, tidak lolos diam-diam

// ---------- 1. Referensi elemen ----------
const $ = (id) => document.getElementById(id);                 // singkatan untuk mengambil elemen lewat id
const kanvas = $('kanvas');                                    // canvas tempat bola digambar
const ctx = kanvas.getContext('2d');                           // konteks gambar 2D
const gaya = document.documentElement.style;                   // akses variabel CSS di :root
const kurangGerak = window.matchMedia('(prefers-reduced-motion: reduce)').matches; // hormati preferensi pengguna

// ---------- 2. Data tema warna ----------
const TEMA = [
  { nama: 'Ultramarin',  latar: '#2415D6', warna: ['#FF7AC8', '#FFF04D', '#6BFFD1', '#FFFFFF'] }, // tema awal
  { nama: 'Jeruk asam',  latar: '#D6440F', warna: ['#FFE94D', '#7CFFB2', '#FFFFFF', '#2A0F5C'] }, // oranye pekat
  { nama: 'Hijau botol', latar: '#0B6B4B', warna: ['#FF9BD2', '#FFF04D', '#C9B8FF', '#FFFFFF'] }, // hijau tua
  { nama: 'Ungu anggur', latar: '#6A1BB5', warna: ['#7CFFB2', '#FFD23F', '#FF7AC8', '#FFFFFF'] }, // ungu pekat
];

// ---------- 3. State: semua data yang berubah selama permainan ----------
const state = {
  bola: [],            // daftar semua bola di panggung
  gravitasi: 0.35,     // besar gaya tarik ke bawah per frame
  arah: 1,             // 1 berarti jatuh ke bawah, -1 berarti jatuh ke atas
  kacau: false,        // apakah mode kacau menyala
  beku: false,         // apakah gerak dihentikan
  tabrakan: 0,         // total tabrakan antar bola
  tema: 0,             // indeks tema yang sedang dipakai
  bingkai: 0,          // penghitung frame untuk tugas berkala
  lebar: 0,            // lebar panggung dalam piksel CSS
  tinggi: 0,           // tinggi panggung dalam piksel CSS
  dpr: 1,              // rasio piksel layar (layar tajam bernilai 2)
  pointer: { x: 0, y: 0, aktif: false, turun: false }, // posisi dan status kursor di canvas
  pengaturan: { jumlah: 8, pantul: 0.8, tarik: 50, kecepatan: 1 }, // nilai slider
};

const MAKS_BOLA = 140; // batas jumlah bola supaya browser tidak berat

// ---------- 4. Fungsi bantu ----------
const acak = (min, maks) => min + Math.random() * (maks - min);           // angka acak di antara dua batas
const pilih = (daftar) => daftar[Math.floor(Math.random() * daftar.length)]; // ambil satu elemen acak dari array
const batasi = (n, min, maks) => Math.min(maks, Math.max(min, n));         // paksa angka tetap dalam rentang

// ---------- 5. Ukuran canvas ----------
function ukur() {
  const kotak = kanvas.getBoundingClientRect();                  // ukuran canvas seperti tampil di layar
  state.dpr = Math.min(window.devicePixelRatio || 1, 2);         // batasi 2 supaya tetap ringan
  state.lebar = kotak.width;                                     // simpan lebar untuk perhitungan fisika
  state.tinggi = kotak.height;                                   // simpan tinggi untuk perhitungan fisika
  kanvas.width = Math.round(kotak.width * state.dpr);            // resolusi internal canvas horizontal
  kanvas.height = Math.round(kotak.height * state.dpr);          // resolusi internal canvas vertikal
  ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);            // skala gambar agar koordinat tetap piksel CSS
  ctx.fillStyle = '#160A3A';                                     // warna dasar panggung
  ctx.fillRect(0, 0, state.lebar, state.tinggi);                 // cat ulang seluruh panggung setelah ukuran berubah
}

// ---------- 6. Membuat bola ----------
function buatBola(x, y, vx, vy) {
  const warna = pilih(TEMA[state.tema].warna);                   // warna sesuai tema aktif
  return { x, y, vx, vy, r: acak(10, 30), warna };               // bola dengan radius acak
}

function lempar(jumlah, x, y) {
  for (let i = 0; i < jumlah; i++) {                             // ulangi sebanyak bola yang diminta
    const sudut = acak(0, Math.PI * 2);                          // arah lemparan acak
    const laju = acak(2, 9);                                     // kecepatan awal acak
    const bx = x ?? acak(40, state.lebar - 40);                  // posisi x: titik klik, atau acak bila tidak ada
    const by = y ?? acak(40, state.tinggi / 2);                  // posisi y: titik klik, atau acak di separuh atas
    state.bola.push(buatBola(bx, by, Math.cos(sudut) * laju, Math.sin(sudut) * laju)); // tambahkan bola baru
  }
  if (state.bola.length > MAKS_BOLA) {                           // jika melewati batas
    state.bola.splice(0, state.bola.length - MAKS_BOLA);         // buang bola paling lama
  }
  catat(`Melempar ${jumlah} bola.`);                             // tulis ke catatan
  sembunyikanPetunjuk();                                         // pengguna sudah paham cara main
}

// ---------- 7. Fisika ----------
function tarikTolak(b) {
  const p = state.pointer;                                       // singkatan posisi kursor
  if (!p.aktif) return;                                          // kursor di luar panggung, abaikan
  const dx = p.x - b.x;                                          // selisih horizontal bola ke kursor
  const dy = p.y - b.y;                                          // selisih vertikal bola ke kursor
  const jarak = Math.hypot(dx, dy) || 1;                         // jarak sebenarnya, hindari nol
  const jangkauan = 220;                                         // batas pengaruh kursor
  if (jarak > jangkauan) return;                                 // bola terlalu jauh, tidak terpengaruh
  const kekuatan = (1 - jarak / jangkauan) * (state.pengaturan.tarik / 100); // makin dekat makin kuat
  const tanda = p.turun ? 1.4 : -0.35;                           // menyeret menarik kuat, melayang menolak pelan
  b.vx += (dx / jarak) * kekuatan * tanda;                       // ubah kecepatan horizontal
  b.vy += (dy / jarak) * kekuatan * tanda;                       // ubah kecepatan vertikal
}

function geser(b) {
  const g = state.gravitasi * state.arah;                        // gravitasi dengan arah saat ini
  const k = state.pengaturan.kecepatan;                          // pengali kecepatan waktu
  b.vy += g * k;                                                 // gravitasi mengubah kecepatan vertikal
  tarikTolak(b);                                                 // pengaruh kursor
  b.vx *= 0.9992;                                                // hambatan udara sangat kecil
  b.vy *= 0.9992;                                                // hambatan udara sangat kecil
  b.x += b.vx * k;                                               // pindahkan posisi horizontal
  b.y += b.vy * k;                                               // pindahkan posisi vertikal
  const p = state.pengaturan.pantul;                             // kelenturan pantulan dari slider
  if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx) * p; }               // pantul di dinding kiri
  if (b.x + b.r > state.lebar) { b.x = state.lebar - b.r; b.vx = -Math.abs(b.vx) * p; } // dinding kanan
  if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy) * p; }               // pantul di langit-langit
  if (b.y + b.r > state.tinggi) { b.y = state.tinggi - b.r; b.vy = -Math.abs(b.vy) * p; } // pantul di lantai
}

function benturan() {
  const semua = state.bola;                                      // singkatan daftar bola
  for (let i = 0; i < semua.length; i++) {                       // pilih bola pertama
    for (let j = i + 1; j < semua.length; j++) {                 // pasangkan dengan bola sesudahnya
      const a = semua[i];                                        // bola A
      const c = semua[j];                                        // bola B
      const dx = c.x - a.x;                                      // selisih horizontal
      const dy = c.y - a.y;                                      // selisih vertikal
      const jarak = Math.hypot(dx, dy) || 0.001;                 // jarak pusat, hindari pembagian nol
      const minimal = a.r + c.r;                                 // jarak minimal agar tidak bertumpuk
      if (jarak >= minimal) continue;                            // belum bersentuhan, lanjut
      const nx = dx / jarak;                                     // arah normal tabrakan sumbu x
      const ny = dy / jarak;                                     // arah normal tabrakan sumbu y
      const tumpang = (minimal - jarak) / 2;                     // separuh tumpang tindih untuk tiap bola
      a.x -= nx * tumpang; a.y -= ny * tumpang;                  // dorong A menjauh
      c.x += nx * tumpang; c.y += ny * tumpang;                  // dorong B menjauh
      const relatif = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;   // kecepatan saling mendekat sepanjang normal
      if (relatif > 0) continue;                                 // sudah saling menjauh, tidak perlu memantul
      const impuls = -relatif * state.pengaturan.pantul;         // kekuatan dorongan tukar momentum
      a.vx -= impuls * nx; a.vy -= impuls * ny;                  // A terpental berlawanan arah
      c.vx += impuls * nx; c.vy += impuls * ny;                  // B terpental searah normal
      if (Math.abs(relatif) > 1.2) state.tabrakan++;             // hitung hanya tabrakan yang cukup keras
    }
  }
}

function suntikKacau() {
  if (state.bingkai % 20 !== 0 || state.bola.length === 0) return; // beraksi tiap 20 frame saja
  const korban = pilih(state.bola);                              // pilih satu bola sial
  korban.vx += acak(-14, 14);                                    // dorongan acak horizontal
  korban.vy += acak(-14, 14);                                    // dorongan acak vertikal
  if (Math.random() < 0.04) {                                    // peluang kecil tiap suntikan
    state.arah *= -1;                                            // gravitasi tiba-tiba terbalik
    catat('Gravitasi berbalik sendiri.');                        // beri tahu pengguna
  }
}

// ---------- 8. Menggambar ----------
function gambar() {
  ctx.fillStyle = kurangGerak ? '#160A3A' : 'rgba(22, 10, 58, 0.28)'; // jejak samar, atau bersih jika kurangi gerak
  ctx.fillRect(0, 0, state.lebar, state.tinggi);                 // timpa frame lama dengan lapisan gelap tipis
  for (const b of state.bola) {                                  // gambar setiap bola
    ctx.beginPath();                                             // mulai bentuk baru
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);                      // lingkaran sesuai posisi dan radius
    ctx.fillStyle = b.warna;                                     // warna bola
    ctx.fill();                                                  // isi lingkaran
    ctx.lineWidth = 3;                                           // tebal garis tepi
    ctx.strokeStyle = '#160A3A';                                 // garis tepi gelap senada kotak
    ctx.stroke();                                                // gambar garis tepi
    ctx.beginPath();                                             // bentuk baru untuk kilau
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.22, 0, Math.PI * 2); // titik kilau di kiri atas
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';                 // putih agak transparan
    ctx.fill();                                                  // isi kilau
  }
  if (state.pointer.turun) {                                     // saat menyeret
    ctx.beginPath();                                             // mulai lingkaran penanda
    ctx.arc(state.pointer.x, state.pointer.y, 22, 0, Math.PI * 2); // penanda tarikan di posisi kursor
    ctx.strokeStyle = '#FFF04D';                                 // kuning agar terlihat jelas
    ctx.lineWidth = 3;                                           // garis penanda
    ctx.stroke();                                                // gambar penanda
  }
}

// ---------- 9. Antarmuka: statistik, catatan, meter ----------
function perbaruiUI() {
  $('stat-bola').textContent = state.bola.length;                // jumlah bola
  $('stat-tabrak').textContent = state.tabrakan;                 // jumlah tabrakan
  $('stat-gravitasi').textContent = state.arah === 1 ? 'turun' : 'naik'; // arah gravitasi
  let total = 0;                                                 // penampung jumlah kecepatan
  for (const b of state.bola) total += Math.hypot(b.vx, b.vy);   // tambahkan kecepatan tiap bola
  const rata = state.bola.length ? total / state.bola.length : 0; // kecepatan rata-rata
  const persen = Math.round(batasi(rata / 12, 0, 1) * 100);      // ubah ke skala 0 sampai 100
  $('meter-isi').style.width = persen + '%';                     // lebarkan batang meter
  $('meter').setAttribute('aria-valuenow', persen);              // kabari pembaca layar
}

function catat(pesan) {
  const daftar = $('log');                                       // elemen daftar catatan
  const item = document.createElement('li');                     // buat entri baru
  item.textContent = pesan;                                      // isi teks entri
  daftar.prepend(item);                                          // taruh di paling atas
  while (daftar.children.length > 6) daftar.lastElementChild.remove(); // simpan hanya 6 entri terbaru
}

function sembunyikanPetunjuk() {
  $('petunjuk').classList.add('hilang');                         // pudarkan petunjuk awal
}

// ---------- 10. Aksi tombol ----------
function balikGravitasi() {
  state.arah *= -1;                                              // balik arah
  $('btn-gravitasi').setAttribute('aria-pressed', String(state.arah === -1)); // sinkronkan status tombol
  catat(state.arah === 1 ? 'Gravitasi turun.' : 'Gravitasi naik.'); // catat kejadian
}

function toggleKacau() {
  state.kacau = !state.kacau;                                    // nyalakan atau matikan
  $('btn-kacau').setAttribute('aria-pressed', String(state.kacau)); // sinkronkan status tombol
  catat(state.kacau ? 'Mode kacau menyala.' : 'Mode kacau mati.'); // catat kejadian
}

function toggleBeku() {
  state.beku = !state.beku;                                      // bekukan atau lanjutkan
  $('btn-bekukan').setAttribute('aria-pressed', String(state.beku)); // sinkronkan status tombol
  catat(state.beku ? 'Semua bola dibekukan.' : 'Waktu berjalan lagi.'); // catat kejadian
}

function gantiWarna() {
  state.tema = (state.tema + 1 + Math.floor(Math.random() * (TEMA.length - 1))) % TEMA.length; // tema baru yang pasti berbeda
  const tema = TEMA[state.tema];                                 // ambil data tema
  gaya.setProperty('--latar', tema.latar);                       // ubah warna latar halaman lewat CSS
  for (const b of state.bola) b.warna = pilih(tema.warna);       // cat ulang semua bola
  catat(`Tema: ${tema.nama}.`);                                  // catat nama tema
}

function bersihkan() {
  state.bola.length = 0;                                         // kosongkan daftar bola
  state.tabrakan = 0;                                            // reset hitungan tabrakan
  ctx.fillStyle = '#160A3A';                                     // warna dasar panggung
  ctx.fillRect(0, 0, state.lebar, state.tinggi);                 // hapus sisa jejak
  catat('Panggung dibersihkan.');                                // catat kejadian
}

// ---------- 11. Ramalan acak ----------
const RAMALAN = {
  awal: ['Hari ini', 'Besok pagi', 'Sebentar lagi', 'Tepat tengah malam', 'Saat hujan turun'], // penanda waktu
  tokoh: ['bola kuning', 'gravitasi', 'kursormu', 'huruf i', 'kedua mata'],                    // pelaku
  aksi: ['akan memantul ke', 'diam-diam menuju', 'memutuskan untuk melompati', 'bertukar tempat dengan'], // kegiatan
  tujuan: ['langit-langit', 'sudut kiri bawah', 'bola merah muda', 'tombol bekukan', 'dunia sebelah'],   // sasaran
};
let pengetik = null;                                             // menyimpan timer efek mengetik

function ramal() {
  const kalimat = `${pilih(RAMALAN.awal)}, ${pilih(RAMALAN.tokoh)} ${pilih(RAMALAN.aksi)} ${pilih(RAMALAN.tujuan)}.`; // susun kalimat acak
  const teks = $('oracle-teks');                                 // elemen tempat ramalan tampil
  clearInterval(pengetik);                                       // hentikan ketikan sebelumnya
  if (kurangGerak) { teks.textContent = kalimat; return; }       // tanpa efek jika pengguna minta gerak dikurangi
  teks.textContent = '';                                         // kosongkan sebelum mengetik
  let n = 0;                                                     // jumlah huruf yang sudah tampil
  pengetik = setInterval(() => {                                 // ulangi tiap 28 milidetik
    n++;                                                         // tambah satu huruf
    teks.textContent = kalimat.slice(0, n);                      // tampilkan potongan kalimat
    if (n >= kalimat.length) clearInterval(pengetik);            // berhenti saat kalimat lengkap
  }, 28);                                                        // kecepatan mengetik
}

// ---------- 12. Mata pada judul ----------
const mataAll = document.querySelectorAll('.mata');              // dua mata pada judul

function ikutiKursor(e) {
  mataAll.forEach((mata) => {                                    // proses tiap mata
    const kotak = mata.getBoundingClientRect();                  // posisi mata di layar
    const pusatX = kotak.left + kotak.width / 2;                 // titik tengah horizontal
    const pusatY = kotak.top + kotak.height / 2;                 // titik tengah vertikal
    const sudut = Math.atan2(e.clientY - pusatY, e.clientX - pusatX); // arah dari mata ke kursor
    const jarak = Math.min(kotak.width * 0.22, Math.hypot(e.clientX - pusatX, e.clientY - pusatY) / 8); // geser pupil tidak melewati tepi
    const pupil = mata.firstElementChild;                        // elemen pupil
    pupil.style.setProperty('--px', Math.cos(sudut) * jarak + 'px'); // geser horizontal lewat variabel CSS
    pupil.style.setProperty('--py', Math.sin(sudut) * jarak + 'px'); // geser vertikal lewat variabel CSS
  });
}

function kedip() {
  mataAll.forEach((m) => m.classList.add('kedip'));              // pejamkan kedua mata
  setTimeout(() => mataAll.forEach((m) => m.classList.remove('kedip')), 140); // buka lagi setelah sesaat
  setTimeout(kedip, acak(2500, 6000));                           // jadwalkan kedipan berikutnya secara acak
}

// ---------- 13. Rahasia: ketik "ioo" ----------
let buffer = '';                                                 // menyimpan tiga tuts terakhir

function periksaRahasia(tombol) {
  buffer = (buffer + tombol.toLowerCase()).slice(-3);            // simpan hanya tiga karakter terakhir
  if (buffer !== 'ioo') return;                                  // bukan kata rahasia, lanjut
  lempar(28, state.lebar / 2, state.tinggi / 2);                 // ledakan bola dari tengah panggung
  $('judul').classList.add('terkejut');                          // judul ikut terkejut
  setTimeout(() => $('judul').classList.remove('terkejut'), 700); // kembalikan judul ke ukuran normal
  catat('Rahasia ditemukan. ioo terkejut.');                     // catat penemuan
  buffer = '';                                                   // reset agar bisa diulang
}

// ---------- 14. Pendengar peristiwa ----------
function posisiCanvas(e) {
  const kotak = kanvas.getBoundingClientRect();                  // posisi canvas di layar
  state.pointer.x = e.clientX - kotak.left;                      // koordinat x relatif ke canvas
  state.pointer.y = e.clientY - kotak.top;                       // koordinat y relatif ke canvas
}

kanvas.addEventListener('pointerdown', (e) => {                  // saat kursor atau jari menekan
  posisiCanvas(e);                                               // catat posisi
  state.pointer.turun = true;                                    // mulai mode menarik
  state.pointer.aktif = true;                                    // kursor aktif di panggung
  kanvas.setPointerCapture(e.pointerId);                         // tetap terima gerakan walau keluar canvas
  lempar(1, state.pointer.x, state.pointer.y);                   // lempar satu bola di titik sentuh
});
kanvas.addEventListener('pointermove', (e) => {                  // saat kursor bergerak di canvas
  posisiCanvas(e);                                               // perbarui posisi
  state.pointer.aktif = true;                                    // tandai aktif
});
kanvas.addEventListener('pointerup', () => { state.pointer.turun = false; }); // lepas: berhenti menarik
kanvas.addEventListener('pointerleave', () => {                  // kursor meninggalkan panggung
  state.pointer.aktif = false;                                   // matikan pengaruh kursor
  state.pointer.turun = false;                                   // pastikan tidak ikut menarik
});

$('btn-lempar').addEventListener('click', () => lempar(state.pengaturan.jumlah)); // tombol lempar
$('btn-gravitasi').addEventListener('click', balikGravitasi);    // tombol balik gravitasi
$('btn-kacau').addEventListener('click', toggleKacau);           // tombol mode kacau
$('btn-warna').addEventListener('click', gantiWarna);            // tombol ganti warna
$('btn-bekukan').addEventListener('click', toggleBeku);          // tombol bekukan
$('btn-bersih').addEventListener('click', bersihkan);            // tombol bersihkan
$('btn-oracle').addEventListener('click', ramal);                // tombol ramalan

function hubungkanSlider(id, kunci, format, ubah) {
  const slider = $(id);                                          // ambil slider
  const keluaran = $('nilai-' + id.replace('range-', ''));       // elemen angka yang menemaninya
  slider.addEventListener('input', () => {                       // tiap slider digeser
    const nilai = ubah(slider.value);                            // ubah teks menjadi angka
    state.pengaturan[kunci] = nilai;                             // simpan ke state
    keluaran.textContent = format(nilai);                        // tampilkan angka baru
  });
}
hubungkanSlider('range-jumlah', 'jumlah', (n) => String(n), (v) => parseInt(v, 10));       // slider jumlah
hubungkanSlider('range-pantul', 'pantul', (n) => n.toFixed(2), (v) => parseFloat(v));      // slider pantulan
hubungkanSlider('range-tarik', 'tarik', (n) => String(n), (v) => parseInt(v, 10));         // slider tarikan
hubungkanSlider('range-kecepatan', 'kecepatan', (n) => n.toFixed(1), (v) => parseFloat(v)); // slider kecepatan

window.addEventListener('pointermove', ikutiKursor);             // mata mengikuti kursor di seluruh halaman
window.addEventListener('resize', ukur);                         // sesuaikan canvas saat jendela berubah ukuran

window.addEventListener('keydown', (e) => {                      // pintasan keyboard
  if (e.target.matches('input, textarea')) return;               // jangan ganggu saat mengetik atau menggeser slider
  if (e.code === 'Space') { e.preventDefault(); lempar(state.pengaturan.jumlah); } // spasi: lempar, cegah gulir halaman
  else if (e.key === 'g') balikGravitasi();                      // G: balik gravitasi
  else if (e.key === 'k') toggleKacau();                         // K: mode kacau
  else if (e.key === 'w') gantiWarna();                          // W: ganti warna
  else if (e.key === 'b') bersihkan();                           // B: bersihkan
  periksaRahasia(e.key);                                         // cek apakah pengguna mengetik kata rahasia
});

// ---------- 15. Putaran animasi ----------
function putar() {
  state.bingkai++;                                               // hitung frame
  if (!state.beku) {                                             // hanya bergerak bila tidak dibekukan
    state.bola.forEach(geser);                                   // gerakkan semua bola
    benturan();                                                  // tangani tabrakan
    if (state.kacau) suntikKacau();                              // tambahkan gangguan bila mode kacau
  }
  gambar();                                                      // gambar hasil akhir frame
  if (state.bingkai % 6 === 0) perbaruiUI();                     // perbarui angka tiap 6 frame agar hemat
  requestAnimationFrame(putar);                                  // minta frame berikutnya ke browser
}

// ---------- 16. Mulai ----------
ukur();                                                          // atur ukuran canvas pertama kali
lempar(6);                                                       // beri beberapa bola awal supaya tidak sepi
$('petunjuk').classList.remove('hilang');                        // tampilkan lagi petunjuk karena pengguna belum berinteraksi
setTimeout(kedip, 1800);                                         // mulai rangkaian kedipan mata
requestAnimationFrame(putar);                                    // jalankan animasi
