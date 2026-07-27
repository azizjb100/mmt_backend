const pool = require('../config/db.config');
const { format } = require('date-fns');

/**
 * Mengambil 10 antrean cetak (Reguler & Memo) yang belum selesai (Kurang_Cetak > 0)
 * Diurutkan berdasarkan deadline terdekat (Mepet)
 * Sesuai dengan skema database riil (tspk, tmemospk, tlhk_mesin_dtl)
 */
const getTopDeadlineCetak = async () => {
    const sql = `
        SELECT * FROM (
            /* --- ONLY SECTION 1: SPK REGULER --- */
            SELECT 
                t.spk_nomor AS no_spk, 
                t.spk_nama AS nama_produk, 
                t.spk_jumlah AS qty_order,
                'PCS' AS unit, 
                t.spk_dateline AS tanggal_spk,
                t.spk_tanggal AS deadline_waktu, 
                TIMESTAMPDIFF(MINUTE, NOW(), t.spk_tanggal) AS menit_sisa,
                CAST(IFNULL(prod.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                CAST(GREATEST(0, t.spk_jumlah - IFNULL(prod.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak,
                'REGULER' as Tipe_SPK
            FROM tspk t
            LEFT JOIN (
                SELECT lcd_spk_nomor, SUM(lcd_qty_cetak) as total_pernah_cetak
                FROM tlhk_cetakmmt_dtl
                GROUP BY lcd_spk_nomor
            ) prod ON prod.lcd_spk_nomor = t.spk_nomor
            WHERE t.spk_close = 0 
              AND t.spk_aktif = 'Y'
              AND t.spk_tanggal >= '2026-04-01'
              AND t.spk_jo_kode = 'MT'
        ) AS antrean
        WHERE Kurang_Cetak > 0 -- Hanya ambil yang produksinya belum terpenuhi
        ORDER BY deadline_waktu ASC -- Menampilkan dari yang paling mendesak
        LIMIT 10
    `;

    try {
        const [rows] = await pool.query(sql);

        return rows.map(item => {
            let sisaWaktuText = '';
            const menit = item.menit_sisa;

            if (menit < 0) {
                const positifMenit = Math.abs(menit);
                if (positifMenit < 60) sisaWaktuText = `Lewat ${positifMenit} m`;
                else if (positifMenit < 1440) sisaWaktuText = `Lewat ${(positifMenit / 60).toFixed(1)} Jam`;
                else sisaWaktuText = `Lewat ${Math.floor(positifMenit / 1440)} Hari`;
            } else if (menit < 60) {
                sisaWaktuText = `${menit} Menit`;
            } else if (menit < 1440) {
                sisaWaktuText = `${(menit / 60).toFixed(1)} Jam`;
            } else {
                sisaWaktuText = `${Math.floor(menit / 1440)} Hari`;
            }

            return {
                no_spk: item.no_spk,
                nama_produk: item.nama_produk,
                qty: item.Kurang_Cetak,
                qty_order: item.qty_order,
                sudah_cetak: item.Sudah_Cetak,
                unit: item.unit,
                sisa_waktu: sisaWaktuText,
                menit_sisa: menit,
                tipe_spk: item.Tipe_SPK
            };
        });
    } catch (error) {
        throw new Error('Gagal memuat Top Deadline Cetak sesuai tabel SPK: ' + error.message);
    }
};

/**
 * Mengambil daftar bon/permintaan bahan baku produksi yang masih pending di gudang
 * Catatan: Jika Anda mempunya tabel tpermintaan_bahan, sesuaikan nama kolomnya di sini.
 */
const getPermintaanBahanPending = async () => {
    const sql = `
        SELECT * FROM (
            /* --- SECTION 1: PERMINTAAN PEMBELIAN MMT --- */
            SELECT 
                d.mbd_mb_nomor AS nomor_bon,
                TRIM(b.brg_nama) AS nama_bahan,
                'DIVISI MMT' AS divisi,
                d.mbd_qty AS qty_minta,
                d.mbd_brg_satuan AS unit,
                'PENDING' AS status_permintaan, -- Tetap PENDING untuk kebutuhan binding Vue
                h.mb_tanggal AS created_at
            FROM tmintabahan_mmt_dtl d
            INNER JOIN tmintabahan_mmt_hdr h ON d.mbd_mb_nomor = h.mb_nomor
            LEFT JOIN tbarang_mmt b ON d.mbd_brg_kode = b.brg_kode
            WHERE h.mb_acc = 'Y'                  -- Sudah di-ACC Manager (Siap diproses Finance)
              AND IFNULL(d.mbd_qty_po, 0) = 0     -- Tapi realisasi PO dari Finance masih kosong (0)

            UNION ALL

            /* --- SECTION 2: PERMINTAAN PEMBELIAN OBAT (WH-20) --- */
            SELECT 
                d.mbd_nomor AS nomor_bon,
                TRIM(t.brg_nama) AS nama_bahan,
                'GUDANG OBAT' AS divisi,
                d.mbd_jumlah AS qty_minta,
                'PCS' AS unit,
                'PENDING' AS status_permintaan, -- Tetap PENDING
                h.mb_tanggal AS created_at
            FROM tobatmintabeli_dtl d
            INNER JOIN tobatmintabeli_hdr h ON d.mbd_nomor = h.mb_nomor
            LEFT JOIN tgarmen_brg t ON d.mbd_o_kode = t.brg_kode
            WHERE h.mb_status = 'OPEN'            -- Masih antrean open di pembelian/finance
        ) AS combined_pending
        ORDER BY created_at ASC
        LIMIT 15
    `;

    try {
        const [rows] = await pool.query(sql);
        return rows;
    } catch (error) {
        throw new Error('Gagal memuat Dashboard (Permintaan Bahan Belum Terealisasi): ' + error.message);
    }
};

// Di Service / Controller Backend Anda
const getPermintaanBahanTotalFull = async () => {
    const sql = `
        SELECT * FROM (
            /* --- SECTION 1: PERMINTAAN PEMBELIAN MMT --- */
            SELECT 
                d.mbd_mb_nomor AS nomor_bon,
                TRIM(b.brg_nama) AS nama_bahan,
                'DIVISI MMT' AS divisi,
                d.mbd_qty AS qty_minta,
                d.mbd_brg_satuan AS unit,
                'PENDING' AS status_permintaan,
                h.mb_tanggal AS created_at
            FROM tmintabahan_mmt_dtl d
            INNER JOIN tmintabahan_mmt_hdr h ON d.mbd_mb_nomor = h.mb_nomor
            LEFT JOIN tbarang_mmt b ON d.mbd_brg_kode = b.brg_kode
            WHERE h.mb_acc = 'Y' AND IFNULL(d.mbd_qty_po, 0) = 0

            UNION ALL

            /* --- SECTION 2: PERMINTAAN PEMBELIAN OBAT (WH-20) --- */
            SELECT 
                d.mbd_nomor AS nomor_bon,
                TRIM(t.brg_nama) AS nama_bahan,
                'GUDANG OBAT' AS divisi,
                d.mbd_jumlah AS qty_minta,
                'PCS' AS unit,
                'PENDING' AS status_permintaan,
                h.mb_tanggal AS created_at
            FROM tobatmintabeli_dtl d
            INNER JOIN tobatmintabeli_hdr h ON d.mbd_nomor = h.mb_nomor
            LEFT JOIN tgarmen_brg t ON d.mbd_o_kode = t.brg_kode
            WHERE h.mb_status = 'OPEN'
        ) AS combined_pending
        ORDER BY created_at ASC 
        /* LIMIT 15 DIHAPUS SUPAYA MENAMPILKAN SEMUANYA */
    `;
    const [rows] = await pool.query(sql);
    return rows;
};

const getTopDeadlineCetakTotalFull = async () => {
    const sql = `
        SELECT * FROM (
            /* --- ONLY SECTION 1: SPK REGULER --- */
            SELECT 
                t.spk_nomor AS no_spk, 
                t.spk_nama AS nama_produk, 
                t.spk_jumlah AS qty_order,
                'PCS' AS unit, 
                t.spk_dateline AS tanggal_spk,
                t.spk_tanggal AS deadline_waktu, 
                TIMESTAMPDIFF(MINUTE, NOW(), t.spk_tanggal) AS menit_sisa,
                CAST(IFNULL(prod.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                CAST(GREATEST(0, t.spk_jumlah - IFNULL(prod.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak,
                'REGULER' as Tipe_SPK
            FROM tspk t
            LEFT JOIN (
                SELECT lcd_spk_nomor, SUM(lcd_qty_cetak) as total_pernah_cetak
                FROM tlhk_cetakmmt_dtl
                GROUP BY lcd_spk_nomor
            ) prod ON prod.lcd_spk_nomor = t.spk_nomor
            WHERE t.spk_close = 0 
              AND t.spk_aktif = 'Y'
              AND t.spk_tanggal >= '2026-04-01'
              AND t.spk_jo_kode = 'MT'
        ) AS antrean
        WHERE Kurang_Cetak > 0 -- Hanya ambil yang produksinya belum terpenuhi
        ORDER BY deadline_waktu ASC -- Menampilkan dari yang paling mendesak
        /* LIMIT 10 DIHAPUS SUPAYA MENAMPILKAN SEMUANYA DI MODAL */
    `;

    try {
        const [rows] = await pool.query(sql);

        return rows.map(item => {
            let sisaWaktuText = '';
            const menit = item.menit_sisa;

            if (menit < 0) {
                const positifMenit = Math.abs(menit);
                if (positifMenit < 60) sisaWaktuText = `Lewat ${positifMenit} m`;
                else if (positifMenit < 1440) sisaWaktuText = `Lewat ${(positifMenit / 60).toFixed(1)} Jam`;
                else sisaWaktuText = `Lewat ${Math.floor(positifMenit / 1440)} Hari`;
            } else if (menit < 60) {
                sisaWaktuText = `${menit} Menit`;
            } else if (menit < 1440) {
                sisaWaktuText = `${(menit / 60).toFixed(1)} Jam`;
            } else {
                sisaWaktuText = `${Math.floor(menit / 1440)} Hari`;
            }

            return {
                no_spk: item.no_spk,
                nama_produk: item.nama_produk,
                qty: item.Kurang_Cetak,
                qty_order: item.qty_order,
                sudah_cetak: item.Sudah_Cetak,
                unit: item.unit,
                sisa_waktu: sisaWaktuText,
                menit_sisa: menit,
                tipe_spk: item.tipe_spk,
                tanggal_spk: item.tanggal_spk
            };
        });
    } catch (error) {
        throw new Error('Gagal memuat Seluruh Data Antrean Cetak: ' + error.message);
    }
};

const getGrafikBsBulanan = async () => {
    const sql = `
        SELECT 
            bulan_label AS bulan,
            sort_key,
            jenis_lhk,
            SUM(total_luas_m2) AS total_luas_m2
        FROM (
            /* 1. BS MMT (Digital) */
            SELECT 
                DATE_FORMAT(ltanggal, '%b %Y') AS bulan_label,
                DATE_FORMAT(ltanggal, '%Y-%m') AS sort_key,
                'MMT' AS jenis_lhk,
                SUM(COALESCE(lpanjang_bs, 0) * COALESCE(llebar_bs, 0)) AS total_luas_m2
            FROM tlhk_mesin_hdr
            WHERE ltanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) 
              AND lpanjang_bs > 0
            GROUP BY DATE_FORMAT(ltanggal, '%b %Y'), DATE_FORMAT(ltanggal, '%Y-%m')

            UNION ALL

            /* 2. BS Mesin Tekstil */
            SELECT 
                DATE_FORMAT(lth_tanggal, '%b %Y') AS bulan_label,
                DATE_FORMAT(lth_tanggal, '%Y-%m') AS sort_key,
                'TEKSTIL' AS jenis_lhk,
                SUM(COALESCE(lth_panjang_bs, 0) * COALESCE(lth_lebar_bs, 0)) AS total_luas_m2
            FROM tlhk_mesintekstil_hdr
            WHERE lth_tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) 
              AND lth_panjang_bs > 0
            GROUP BY DATE_FORMAT(lth_tanggal, '%b %Y'), DATE_FORMAT(lth_tanggal, '%Y-%m')

            UNION ALL

            /* 3. BS Finishing MMT */
            SELECT 
                DATE_FORMAT(h.lfh_tanggal, '%b %Y') AS bulan_label,
                DATE_FORMAT(h.lfh_tanggal, '%Y-%m') AS sort_key,
                'FINISHING' AS jenis_lhk,
                SUM(COALESCE(d.lfd_j_bs, 0) * 1) AS total_luas_m2
            FROM tlhk_finishingmmt_dtl d
            INNER JOIN tlhk_finishingmmt_hdr h ON d.lfd_lfh_nomor = h.lfh_nomor
            WHERE h.lfh_tanggal >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH) 
              AND d.lfd_j_bs > 0
            GROUP BY DATE_FORMAT(h.lfh_tanggal, '%b %Y'), DATE_FORMAT(h.lfh_tanggal, '%Y-%m')
        ) AS combined_bs
        GROUP BY bulan_label, sort_key, jenis_lhk
        ORDER BY sort_key ASC
    `;

    try {
        const [rows] = await pool.query(sql);

        // Extract daftar bulan unik
        const monthsMap = new Map();
        rows.forEach(r => {
            if (!monthsMap.has(r.sort_key)) {
                monthsMap.set(r.sort_key, r.bulan);
            }
        });

        const months = Array.from(monthsMap.values());
        const sortKeys = Array.from(monthsMap.keys());

        // Inisialisasi dataset hanya untuk 3 divisi
        const categories = ['MMT', 'FINISHING', 'TEKSTIL'];
        const datasets = {};
        
        categories.forEach(cat => {
            datasets[cat] = new Array(months.length).fill(0);
        });

        // Mapping nilai Luas BS M2 ke masing-masing posisi bulan & divisi
        rows.forEach(r => {
            const monthIndex = sortKeys.indexOf(r.sort_key);
            if (monthIndex !== -1 && datasets[r.jenis_lhk]) {
                datasets[r.jenis_lhk][monthIndex] = Number(Number(r.total_luas_m2 || 0).toFixed(2));
            }
        });

        return {
            labels: months,
            datasets: datasets
        };
    } catch (error) {
        throw new Error('Gagal memuat Grafik BS Bulanan 3 Divisi: ' + error.message);
    }
};


module.exports = {
    getTopDeadlineCetak,
    getPermintaanBahanPending,
    getPermintaanBahanTotalFull,
    getTopDeadlineCetakTotalFull,
    getGrafikBsBulanan
};