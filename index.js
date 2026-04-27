const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
const clientCertAuth = require("./middleware/clientCertAuth");

require("dotenv").config();

const authRoutes = require("./routes/auth.routes");
const lhkMesinCetakRoutes = require("./routes/lhkMesinCetak.routes");
const lhkFinishingRoutes = require("./routes/lhkFinishing.routes");
const stbjMmtRoutes = require("./routes/stbjMmt.routes");
const lapLsBahanUtamaRoutes = require("./routes/lapLsBahanUtama.routes");
const lapLsBahanPenolongRoutes = require("./routes/lapLsBahanPenolong.routes");
const lapMonCetakRoutes = require("./routes/lapMonCetak.routes");
const lapSpkMmtRoutes = require("./routes/lapSpkMmt.routes");
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
const stokOpnameRoutes = require("./routes/stokOpnameGudang.routes");
const pelunasanPembelianRoutes = require("./routes/pelunasanPembelian.routes");
const mesinMmtRoutes = require("./routes/mesinMmt.routes");
const masterObatRoutes = require("./routes/masterObat.routes");
const lapLsTintaRoutes = require("./routes/lapLsTinta.routes");
const returProduksiRoutes = require("./routes/returProduksi.routes");
const penerimaanPoExtMmtRoutes =require("./routes/penerimaanPoExtMmt.routes");
const returBeliRoutes =require("./routes/returBeli.routes");
const poExtMmtRoutes =require("./routes/poExtMmt.routes");
const stbjRoutes =require("./routes/stbj.routes");
const lapPemakaianBahanRoutes =require("./routes/lapPemakaianBahan.routes");
const mutasiGudangRoutes =require("./routes/mutasiGudang.routes");
const searchBarcodeRoutes =require("./routes/searchBarcode.routes");
const jadwalKirimRoutes = require("./routes/jadwalKirim.routes");
const lapMonFinishingRoutes = require("./routes/lapMonFinishing.routes");
const lapMonTekstilRoutes = require("./routes/lapMonTekstil.route");
const lapBarangJadiRoutes = require("./routes/lapBarangJadi.routes");
const voucherPelunasanRoutes = require("./routes/voucherPelunasan.routes");




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
const imageFolderPath = path.join(process.cwd(), "public", "images");
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
app.use("/images", express.static(imageFolderPath));
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
app.use("/api/mmt/laporan-ls-bahan-utama", clientCertAuth, lapLsBahanUtamaRoutes);
app.use("/api/mmt/laporan-ls-bahan-penolong", clientCertAuth, lapLsBahanPenolongRoutes);
app.use("/api/mmt/laporan-spk-mmt", clientCertAuth, lapSpkMmtRoutes);
app.use("/api/mmt/monitoring/laporan-lmkp", clientCertAuth, lapLmkpMmtRoutes);
app.use("/api/mmt/monitoring-finishing", clientCertAuth, lapMonFinishingRoutes);
app.use("/api/mmt/monitoring-cetak", clientCertAuth, lapMonCetakRoutes);
app.use("/api/mmt/monitoring-tekstil", clientCertAuth, lapMonTekstilRoutes);
app.use("/api/mmt/permintaan-bahan", clientCertAuth, permintaanBahanRoutes);
app.use("/api/mmt/penerimaan-bahan", clientCertAuth, penerimaanBahanRoutes);
app.use("/api/mmt/permintaan-produksi", clientCertAuth, permintaanProduksiRoutes);
app.use("/api/supplier", clientCertAuth, supplierRoutes);

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
app.use("/api/mmt/pengajuan-permintaan", clientCertAuth, pengajuanPermintaanRoutes);
app.use("/api/mmt/permintaan-produksi-bahan", clientCertAuth, permintaanProduksiBahanRoutes);
app.use("/api/mmt/planning-produksi", clientCertAuth, planningProduksiRoutes);
app.use("/api/mmt/lhk-tekstil-mmt", clientCertAuth, lhkTekstilMmtRoutes);
app.use("/api/mmt/lhk-cetak-mmt", clientCertAuth, lhkCetakMmtRoutes);
app.use("/api/mmt/stok-opname", clientCertAuth, stokOpnameRoutes);
app.use("/api/mmt/pelunasan-pembelian", clientCertAuth, pelunasanPembelianRoutes);
app.use("/api/mmt/mesin", clientCertAuth, mesinMmtRoutes);
app.use("/api/master/bahan/obat", clientCertAuth, masterObatRoutes);
app.use("/api/master/bahan", clientCertAuth, masterBahanRoutes);
app.use("/api/mmt/master-obatt", clientCertAuth, masterObatRoutes);
app.use("/api/mmt/laporan-ls-tinta", clientCertAuth, lapLsTintaRoutes);
app.use("/api/mmt/retur-produksi", clientCertAuth, returProduksiRoutes);
app.use("/api/mmt/penerimaan-po-ext-mmt", clientCertAuth, penerimaanPoExtMmtRoutes);
app.use("/api/mmt/retur-beli", clientCertAuth, returBeliRoutes);
app.use("/api/mmt/po-ext-mmt", clientCertAuth, poExtMmtRoutes);
app.use("/api/mmt/stbj", clientCertAuth, stbjRoutes);
app.use("/api/mmt/lap-pemakaian-bahan", clientCertAuth, lapPemakaianBahanRoutes);
app.use("/api/mmt/mutasi-gudang", clientCertAuth, mutasiGudangRoutes);
app.use("/api/mmt/search-barcode", clientCertAuth, searchBarcodeRoutes);
app.use("/api/mmt/jadwal-kirim", clientCertAuth, jadwalKirimRoutes);
app.use("/api/mmt/laporan-barang-jadi", clientCertAuth, lapBarangJadiRoutes);
app.use("/api/mmt/voucher-pelunasan", clientCertAuth, voucherPelunasanRoutes);












const port = process.env.PORT || 8003;

// Jalankan server
app.listen(port, () => {
    console.log(`⚡️[server]: Server berjalan di http://localhost:${port}`);
});
