const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const clientCertAuth = require("./middleware/clientCertAuth");
const imageFolderPath = "/mnt/image";

require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const lhkMesinCetakRoutes = require("./routes/lhkMesinCetak.routes");
const lhkFinishingRoutes = require("./routes/lhkFinishing.routes");
const stbjMmtRoutes = require("./routes/stbjMmt.routes");
const lapLsBahanUtamaRoutes = require("./routes/lapLsBahanUtama.routes");
const lapLsBahanPenolongRoutes = require("./routes/lapLsBahanPenolong.routes");
const lapMonCetakRoutes = require("./routes/lapMonCetak.routes");
const lapSpkMmtRoutes = require("./routes/lapSpkMmt.routes");
const lapPlanVsLhkRoutes = require("./routes/lapPlanVsLhk.routes");
const permintaanBahanRoutes = require("./routes/permintaanBahan.routes");
const penerimaanBahanRoutes = require("./routes/penerimaanBahan.routes");
const supplierRoutes = require("./routes/supplier.routes");
const permintaanProduksiRoutes = require("./routes/permintaanProduksi.routes");
const masterBahanRoutes = require("./routes/masterBahan.routes");
const koreksiStokMmtRoutes = require("./routes/koreksiStokMmt.routes");
const poPaperprintRoutes = require("./routes/poPaperprint.routes");
const operatorRoutes = require("./routes/operator.routes");
const spkRoutes = require("./routes/spk.routes");
const poBahanMmtRoutes = require("./routes/poBahanMmt.routes");
const lookupGdgMesinRoutes = require("./routes/lookupGdgMesin.routes");
const stokGudangMmtRoutes = require("./routes/stokGudangMmt.routes");
const recreateBarcodeRoutes = require("./routes/recreateBarcode.routes");
const mmtPinjamRoutes = require("./routes/mmt_pinjam.routes");
const lookupPabrikRoutes = require("./routes/lookupPabrik.routes");
const lapLmkpMmtRoutes = require("./routes/lapLmkpMmt.routes");
const invoicePembelianRoutes = require("./routes/invoicePembelian.routes");
const customerRoutes = require("./routes/customer.routes");
const pengajuanPermintaanRoutes = require("./routes/pengajuanPermintaan.routes");
const permintaanProduksiBahanRoutes = require("./routes/permintaanProduksiBahan.routes");
const planningProduksiRoutes = require("./routes/planningProduksi.routes");
const lhkTekstilMmtRoutes = require("./routes/lhkTekstilMmt.routes");
const lhkCetakMmtRoutes = require("./routes/lhkCetakMmt.routes");
const lhkProofRoutes = require("./routes/lhkProof.routes");
const stokOpnameRoutes = require("./routes/stokOpnameGudang.routes");
const pelunasanPembelianRoutes = require("./routes/pelunasanPembelian.routes");
const mesinMmtRoutes = require("./routes/mesinMmt.routes");
const masterObatRoutes = require("./routes/masterObat.routes");
const lapLsTintaRoutes = require("./routes/lapLsTinta.routes");
const returProduksiRoutes = require("./routes/returProduksi.routes");
const penerimaanPoExtMmtRoutes = require("./routes/penerimaanPoExtMmt.routes");
const returBeliRoutes = require("./routes/returBeli.routes");
const poExtMmtRoutes = require("./routes/poExtMmt.routes");
const stbjRoutes = require("./routes/stbj.routes");
const lapPemakaianBahanRoutes = require("./routes/lapPemakaianBahan.routes");
const mutasiGudangRoutes = require("./routes/mutasiGudang.routes");
const searchBarcodeRoutes = require("./routes/searchBarcode.routes");
const jadwalKirimRoutes = require("./routes/jadwalKirim.routes");
const lapMonFinishingRoutes = require("./routes/lapMonFinishing.routes");
const lapMonTekstilRoutes = require("./routes/lapMonTekstil.route");
const lapMonPaperprintRoutes = require("./routes/lapMonPaperprint.routes");
const lapMonProofRoutes = require("./routes/lapMonProof.routes");
const lapBarangJadiRoutes = require("./routes/lapBarangJadi.routes");
const voucherPelunasanRoutes = require("./routes/voucherPelunasan.routes");
const poInternalRoutes = require("./routes/poInternal.routes");
const lhkSublimRoutes = require("./routes/lhkSublim.routes");
const lhkPaperprintRoutes = require("./routes/lhkPaperprint.routes");
const lapMonSublimRoutes = require("./routes/lapMonSublim.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const mppbRoutes = require("./routes/mppb.routes");
const lhkPolaRoutes = require("./routes/lhkPola.routes");
const lhkLayoutRoutes = require("./routes/lhkLayout.routes");
const suratJalanRoutes = require("./routes/suratJalan.routes"); // <- Ditambahkan di sini
const mutasiInternalRoutes = require("./routes/mutasiInternal.routes");
const lapMonBSRoutes = require("./routes/lapMonBS.route"); // <- Ditambahkan di sini
const mutasiBahanRoutes = require("./routes/spanduk/mutasiBahan.routes"); // <- Ditambahkan di sini
const permintaanBahanSpandukRoutes = require("./routes/spanduk/permintaanBahan.routes"); // <- Ditambahkan di sini
const masterBahanSpandukRoutes = require("./routes/spanduk/masterBahanSpanduk.routes");
const penerimaanBahanPenolongRoutes = require("./routes/spanduk/penerimaanBahanPenolong.routes");
const lapKartuStokMmtRoutes = require("./routes/lapKartuStokMmt.routes");
const lapMonJadwalKirimRoutes = require("./routes/lapMonJadwalKirim.routes");
const soToSpkRoutes = require("./routes/soToSpk.routes");
const mapRoutes = require("./routes/map.routes"); // <- Ditambahkan di sini
const salesOrderRoutes = require("./routes/salesOrder.routes");
const lapLhkRoutes = require("./routes/lapLhk.routes");
const lapKirimanRoutes = require("./routes/lapKiriman.routes"); // <- Ditambahkan di sini

// Konfigurasi

const app = express();
const allowedOrigins = [
  "http://localhost:5173",
  "http://103.94.238.252",
  "http://103.94.238.252:88",
  "http://192.168.1.191:5173",
  "https://103.94.238.252",
];

// Folder dan direktori yang dibutuhkan
app.use("/images", express.static(imageFolderPath));
const requiredDirs = [
  path.join(process.cwd(), "temp"),
  path.join(process.cwd(), "public"),
  path.join(process.cwd(), "public", "images"),
];
// Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.warn("❌ CORS Blocked:", origin);
        return callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition"],
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.disable("etag");

requiredDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(" Created directory:", dir);
  }
});

app.use("/api/auth", clientCertAuth, authRoutes);
app.use("/api/mmt/lhk-cetak", clientCertAuth, lhkMesinCetakRoutes);
app.use("/api/mmt/lhk-finishing", clientCertAuth, lhkFinishingRoutes);
app.use("/api/mmt/laporan-stbj", clientCertAuth, stbjMmtRoutes);
app.use(
  "/api/mmt/laporan-ls-bahan-utama",
  clientCertAuth,
  lapLsBahanUtamaRoutes,
);
app.use(
  "/api/mmt/laporan-ls-bahan-penolong",
  clientCertAuth,
  lapLsBahanPenolongRoutes,
);
app.use("/api/mmt/laporan-spk-mmt", clientCertAuth, lapSpkMmtRoutes);
app.use("/api/mmt/monitoring/laporan-lmkp", clientCertAuth, lapLmkpMmtRoutes);
app.use("/api/mmt/monitoring-finishing", clientCertAuth, lapMonFinishingRoutes);
app.use("/api/mmt/monitoring-cetak", clientCertAuth, lapMonCetakRoutes);
app.use("/api/mmt/monitoring-tekstil", clientCertAuth, lapMonTekstilRoutes);
app.use("/api/mmt/permintaan-bahan", clientCertAuth, permintaanBahanRoutes);
app.use("/api/mmt/penerimaan-bahan", clientCertAuth, penerimaanBahanRoutes);
app.use(
  "/api/mmt/permintaan-produksi",
  clientCertAuth,
  permintaanProduksiRoutes,
);
app.use("/api/supplier", clientCertAuth, supplierRoutes);
app.use("/api/mmt/map", clientCertAuth, mapRoutes); // <- Ditambahkan di sini

app.use("/api/mmt/koreksi-stok", clientCertAuth, koreksiStokMmtRoutes);
app.use("/api/mmt/po-paperprint", clientCertAuth, poPaperprintRoutes);
app.use("/api/mmt/operator", clientCertAuth, operatorRoutes);
app.use("/api/mmt/spk", clientCertAuth, spkRoutes);
app.use("/api/mmt/po-bahan-mmt", clientCertAuth, poBahanMmtRoutes);
app.use("/api/mmt/lookup", clientCertAuth, lookupGdgMesinRoutes);
app.use("/api/mmt/stok-gudang", clientCertAuth, stokGudangMmtRoutes);
app.use("/api/mmt/recreate-barcode", clientCertAuth, recreateBarcodeRoutes);
app.use("/api/mmt/request-pinjam", clientCertAuth, mmtPinjamRoutes);
app.use("/api/mmt/lookup-pabrik", clientCertAuth, lookupPabrikRoutes);
app.use("/api/mmt/invoice", clientCertAuth, invoicePembelianRoutes);
app.use("/api/mmt/customer", clientCertAuth, customerRoutes);
app.use(
  "/api/mmt/pengajuan-permintaan",
  clientCertAuth,
  pengajuanPermintaanRoutes,
);
app.use(
  "/api/mmt/permintaan-produksi-bahan",
  clientCertAuth,
  permintaanProduksiBahanRoutes,
);
app.use("/api/mmt/planning-produksi", clientCertAuth, planningProduksiRoutes);
app.use("/api/mmt/lhk-tekstil-mmt", clientCertAuth, lhkTekstilMmtRoutes);
app.use("/api/mmt/lhk-proof", clientCertAuth, lhkProofRoutes);
app.use("/api/mmt/lhk-cetak-mmt", clientCertAuth, lhkCetakMmtRoutes);
app.use("/api/mmt/stok-opname", clientCertAuth, stokOpnameRoutes);
app.use(
  "/api/mmt/pelunasan-pembelian",
  clientCertAuth,
  pelunasanPembelianRoutes,
);
app.use("/api/mmt/mesin", clientCertAuth, mesinMmtRoutes);
app.use("/api/master/bahan/obat", clientCertAuth, masterObatRoutes);
app.use("/api/master/bahan", clientCertAuth, masterBahanRoutes);
app.use("/api/mmt/master-obatt", clientCertAuth, masterObatRoutes);
app.use("/api/mmt/laporan-ls-tinta", clientCertAuth, lapLsTintaRoutes);
app.use("/api/mmt/retur-produksi", clientCertAuth, returProduksiRoutes);
app.use(
  "/api/mmt/penerimaan-po-ext-mmt",
  clientCertAuth,
  penerimaanPoExtMmtRoutes,
);
app.use("/api/mmt/retur-beli", clientCertAuth, returBeliRoutes);
app.use("/api/mmt/po-external-mmt", clientCertAuth, poExtMmtRoutes);
app.use("/api/mmt/stbj", clientCertAuth, stbjRoutes);
app.use(
  "/api/mmt/lap-pemakaian-bahan",
  clientCertAuth,
  lapPemakaianBahanRoutes,
);
app.use("/api/mmt/mutasi-gudang", clientCertAuth, mutasiGudangRoutes);
app.use("/api/mmt/search-barcode", clientCertAuth, searchBarcodeRoutes);
app.use("/api/mmt/jadwal-kirim", clientCertAuth, jadwalKirimRoutes);
app.use("/api/mmt/laporan-barang-jadi", clientCertAuth, lapBarangJadiRoutes);
app.use("/api/mmt/voucher-pelunasan", clientCertAuth, voucherPelunasanRoutes);
app.use("/api/mmt/monitoring-proof", clientCertAuth, lapMonProofRoutes);
app.use("/api/mmt/po-internal", clientCertAuth, poInternalRoutes);
app.use("/api/mmt/lhk-sublim", clientCertAuth, lhkSublimRoutes);
app.use("/api/mmt/lhk-paperprint", clientCertAuth, lhkPaperprintRoutes);
app.use(
  "/api/mmt/monitoring-paperprint",
  clientCertAuth,
  lapMonPaperprintRoutes,
);
app.use("/api/mmt/monitoring-sublim", clientCertAuth, lapMonSublimRoutes);
app.use("/api/mmt/dashboard", clientCertAuth, dashboardRoutes);
app.use("/api/mmt/mppb", clientCertAuth, mppbRoutes);
app.use("/api/mmt/laporan-plan-vs-lhk", clientCertAuth, lapPlanVsLhkRoutes);
app.use("/api/mmt/lhk-pola", clientCertAuth, lhkPolaRoutes);
app.use("/api/mmt/lhk-layout", clientCertAuth, lhkLayoutRoutes);
app.use("/api/mmt/surat-jalan", clientCertAuth, suratJalanRoutes);
app.use("/api/mmt/mutasi-internal", clientCertAuth, mutasiInternalRoutes);
app.use("/api/mmt/laporan-bs", clientCertAuth, lapMonBSRoutes);
app.use("/api/spanduk/mutasi-bahan", clientCertAuth, mutasiBahanRoutes);
app.use(
  "/api/spanduk/permintaan-bahan",
  clientCertAuth,
  permintaanBahanSpandukRoutes,
);
app.use("/api/spanduk/master-bahan", clientCertAuth, masterBahanSpandukRoutes);
app.use(
  "/api/spanduk/penerimaan-bahan",
  clientCertAuth,
  penerimaanBahanPenolongRoutes,
);
app.use("/api/mmt/lap-kartu-stok", clientCertAuth, lapKartuStokMmtRoutes);
app.use(
  "/api/mmt/lap-mon-jadwalkirim",
  clientCertAuth,
  lapMonJadwalKirimRoutes,
);
app.use("/api/mmt/so-spk", clientCertAuth, soToSpkRoutes);
app.use("/api/mmt/sales-order", clientCertAuth, salesOrderRoutes);
app.use("/api/mmt/laporan-lhk", clientCertAuth, lapLhkRoutes);
app.use("/api/mmt/laporan-kirim", clientCertAuth, lapKirimanRoutes);

const port = process.env.PORT || 8003;

// Jalankan server
app.listen(port, () => {
  console.log(`⚡️[server]: Server berjalan di http://localhost:${port}`);
});
