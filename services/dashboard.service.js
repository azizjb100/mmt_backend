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
            /* --- SECTION 1: SPK REGULER --- */
            SELECT 
                t.spk_nomor AS no_spk, 
                t.spk_nama AS nama_produk, 
                t.spk_jumlah AS qty_order,
                'PCS' AS unit, -- Sesuaikan jika ada kolom unit khusus di tspk
                t.spk_tanggal AS tanggal_spk,
                /* Menggunakan spk_tanggal + INTERVAL toleransi atau kolom deadline jika ada. 
                   Jika tidak ada kolom deadline_waktu, kita gunakan spk_tanggal sebagai basis urutan */
                t.spk_tanggal AS deadline_waktu, 
                TIMESTAMPDIFF(MINUTE, NOW(), t.spk_tanggal) AS menit_sisa,
                CAST(IFNULL(prod.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                CAST(GREATEST(0, t.spk_jumlah - IFNULL(prod.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak,
                'REGULER' as Tipe_SPK
            FROM tspk t
            LEFT JOIN (
                SELECT ld_spk_nomor, SUM(ld_total_qtycetak) as total_pernah_cetak
                FROM tlhk_mesin_dtl
                GROUP BY ld_spk_nomor
            ) prod ON prod.ld_spk_nomor = t.spk_nomor
            WHERE t.spk_close = 0 AND t.spk_aktif = 'Y' -- Hanya ambil yang masih Open & Aktif

            UNION ALL

            /* --- SECTION 2: MEMO SPK --- */
            SELECT 
                m.mspk_nomor AS no_spk, 
                m.mspk_nama AS nama_produk, 
                m.mspk_jumlah AS qty_order,
                'PCS' AS unit,
                m.mspk_tanggal AS tanggal_spk,
                m.mspk_tanggal AS deadline_waktu,
                TIMESTAMPDIFF(MINUTE, NOW(), m.mspk_tanggal) AS menit_sisa,
                CAST(IFNULL(prod_m.total_pernah_cetak, 0) AS UNSIGNED) AS Sudah_Cetak,
                CAST(GREATEST(0, m.mspk_jumlah - IFNULL(prod_m.total_pernah_cetak, 0)) AS UNSIGNED) AS Kurang_Cetak,
                'MEMO' as Tipe_SPK
            FROM tmemospk m
            LEFT JOIN (
                SELECT ld_spk_nomor, SUM(ld_total_qtycetak) as total_pernah_cetak
                FROM tlhk_mesin_dtl
                GROUP BY ld_spk_nomor
            ) prod_m ON prod_m.ld_spk_nomor = m.mspk_nomor
            WHERE m.mspk_divisi = '5'
        ) AS antrean
        WHERE Kurang_Cetak > 0 -- Validasi utama: Hanya yang produksinya belum terpenuhi
        ORDER BY deadline_waktu ASC -- Menampilkan dari yang paling lama/mepet
        LIMIT 10
    `;

    try {
        const [rows] = await pool.query(sql);
        
        // Format sisa waktu agar informatif bagi komponen Vue Anda
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
                qty: item.Kurang_Cetak, // Frontend menerima sisa yang "harus dicetak"
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

module.exports = {
    getTopDeadlineCetak,
    getPermintaanBahanPending,
    getPermintaanBahanTotalFull
};