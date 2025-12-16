const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const path = require("path");
require("dotenv").config(); // perbaikan penulisan dotenv

// Impor file route
const authRoutes = require("./routes/auth.routes");
const lhkCetakRoutes = require("./routes/lhkCetak.routes");
const lhkFinishingRoutes = require("./routes/lhkFinishing.routes");
const stbjMmtRoutes = require("./routes/stbjMmt.routes");
const lapLsBahanUtamaRoutes = require("./routes/lapLsBahanUtama.routes");
const lapLsBahanPenolongRoutes = require("./routes/lapLsBahanPenolong.routes");
const lapMonCetakRoutes = require("./routes/lapMonCetak.routes");
const permintaanBahanRoutes = require("./routes/permintaanBahan.routes");
const penerimaanBahanRoutes = require("./routes/penerimaanBahan.routes");
const supplierRoutes = require("./routes/supplier.routes");
const permintaanProduksiRoutes = require("./routes/permintaanProduksi.routes");
const masterBahanRoutes = require("./routes/masterBahan.routes");
const koreksiStokMmtRoutes = require("./routes/koreksiStokMmt.routes");
const poPaperprintRoutes = require("./routes/poPaperprint.routes");
const operatorRoutes =require("./routes/operator.routes");
const spkRoutes = require("./routes/spk.routes");
const poBahanMmtRoutes = require("./routes/poBahanMmt.routes");
const lookupGdgMesinRoutes = require("./routes/lookupGdgMesin.routes");






const app = express();
const port = process.env.PORT || 8000;

// Daftar origin yang diizinkan
const allowedOrigins = [
  "http://localhost:5173",       // Vite dev server
  "http://103.94.238.252",
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
      // Izinkan request tanpa origin (misalnya dari Postman atau mobile app)
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
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use("/images", express.static(imageFolderPath));
app.disable("etag");

// Pastikan folder yang diperlukan sudah ada
requiredDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log("📁 Created directory:", dir);
  }
});

// Gunakan route
app.use("/api/auth", authRoutes);
app.use("/api/mmt/lhk-cetak", lhkCetakRoutes);
app.use("/api/mmt/lhk-finishing", lhkFinishingRoutes);
app.use("/api/mmt/laporan-stbj", stbjMmtRoutes);
app.use("/api/mmt/laporan-ls-bahan-utama", lapLsBahanUtamaRoutes);
app.use("/api/mmt/laporan-ls-bahan-penolong", lapLsBahanPenolongRoutes);
app.use("/api/mmt/monitoring-cetak", lapMonCetakRoutes);
app.use("/api/mmt/permintaan-bahan", permintaanBahanRoutes);
app.use("/api/mmt/penerimaan-bahan", penerimaanBahanRoutes);
app.use("/api/mmt/permintaan-produksi", permintaanProduksiRoutes);
app.use("/api/supplier", supplierRoutes);
app.use("/api/master/bahan", masterBahanRoutes);
app.use("/api/mmt/koreksi-stok", koreksiStokMmtRoutes);
app.use("/api/mmt/po-paperprint", poPaperprintRoutes);
app.use("/api/mmt/operator", operatorRoutes);
app.use("/api/mmt/spk", spkRoutes);
app.use("/api/mmt/po-bahan-mmt", poBahanMmtRoutes);
app.use("/api/mmt/lookup", lookupGdgMesinRoutes)



// Jalankan server
app.listen(port, () => {
  console.log(`⚡️[server]: Server berjalan di http://localhost:${port}`);
});
