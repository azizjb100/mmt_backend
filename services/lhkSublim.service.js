const pool = require('../config/db.config');
const { format } = require('date-fns');

// Konstanta Nomor Bukti
const NOMERATOR_MESIN = 'MMT-LHK-S';  // Untuk tabel mesinsublim
const NOMERATOR_APP = 'MMT-LHK-SA';   // Untuk tabel sublim (Approval)

/**
 * =============================================================================
 * 1. BAGIAN MESIN SUBLIM (Input Operator)
 * =============================================================================
 */

const getAllHeaders = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            h.lsb_nomor AS Nomor, 
            DATE_FORMAT(h.lsb_tanggal, '%d-%m-%Y') AS Tanggal, 
            h.lsb_gdg_kode AS Gudang, 
            g.gdg_nama AS Nama_Gudang, 
            h.lsb_shift AS Shift,
            h.lsb_status AS Status,
            (
                SELECT IF(COUNT(*) > COUNT(IF(LENGTH(lsbd_bahan) > 0, 1, NULL)), 'N', 'Y') 
                FROM tlhk_mesinsublim_dtl 
                WHERE lsbd_lsb_nomor = h.lsb_nomor
            ) AS Lengkap,
            (
                SELECT SUM(lsbd_panjang * lsbd_lebar * lsbd_jumlah) 
                FROM tlhk_mesinsublim_dtl 
                WHERE lsbd_lsb_nomor = h.lsb_nomor
            ) AS total_meter
        FROM tlhk_mesinsublim_hdr h
        LEFT JOIN tGUDANG g ON g.gdg_kode = h.lsb_gdg_kode
        WHERE h.lsb_tanggal BETWEEN ? AND ?
        ORDER BY h.lsb_tanggal DESC, h.lsb_nomor DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};

const getDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            d.lsbd_lsb_nomor AS Nomor,
            d.lsbd_lokasi AS Lokasi, 
            d.lsbd_spk_nomor AS Nomor_SPK, 
            IF(LENGTH(d.lsbd_spk_nama) > 0, d.lsbd_spk_nama, x.spk_nama) AS Nama_SPK, 
            d.lsbd_panjang AS Panjang, 
            d.lsbd_lebar AS Lebar, 
            d.lsbd_jumlah AS J_Order, 
            d.lsbd_bahan AS Bahan, 
            d.lsbd_jumlah AS Jumlah,
            (d.lsbd_panjang * d.lsbd_lebar * d.lsbd_jumlah) AS Jumlah_Meter
        FROM tlhk_mesinsublim_dtl d
        LEFT JOIN (
            SELECT spk_nomor, spk_nama FROM tspk 
            UNION ALL 
            SELECT mspk_nomor, mspk_nama FROM tmemospk 
        ) x ON x.spk_nomor = d.lsbd_spk_nomor 
        WHERE d.lsbd_lsb_nomor = ?
        ORDER BY d.lsbd_no_urut
    `;

    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
};

const saveLhkMesin = async (data) => {
    const { header, details } = data;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        
        let nomorLhk = header.lsb_nomor;
        const currentStatus = header.lstatus || 'DRAFT';
        const tanggalForm = header.lsb_tanggal;
        const gdgKode = header.lsb_gdg_kode || 'GPM';
        const shiftForm = header.lsb_shift || 1;
        const userAction = header.user || 'SYSTEM';

        // 1. PROSES HEADER (Sesuai gambar tlhk_mesinsublim_hdr)
        if (!nomorLhk || nomorLhk === 'AUTO') {
            const yymm = format(new Date(tanggalForm), 'yyMM');
            
            // Menggunakan kolom lsb_nomor sesuai gambar database Anda
            const [maxRows] = await conn.query(
                `SELECT MAX(CAST(SUBSTRING_INDEX(lsb_nomor, '.', -1) AS UNSIGNED)) AS max_num 
                 FROM tlhk_mesinsublim_hdr 
                 WHERE lsb_nomor LIKE ?`, 
                [`${NOMERATOR_MESIN}.${yymm}.%`]
            );
            
            const nextNum = (maxRows[0].max_num || 0) + 1;
            nomorLhk = `${NOMERATOR_MESIN}.${yymm}.${String(nextNum).padStart(4, '0')}`;

            // Kolom diubah ke: lsb_nomor, lsb_tanggal, lsb_jenis, lsb_shift, lsb_date_Create, lsb_user_create, lsb_gdg_kode, lsb_status
            await conn.query(
                `INSERT INTO tlhk_mesinsublim_hdr 
                (lsb_nomor, lsb_tanggal, lsb_jenis, lsb_shift, lsb_date_Create, lsb_user_create, lsb_gdg_kode, lsb_status) 
                VALUES (?, ?, 'S', ?, NOW(), ?, ?, ?)`, 
                [nomorLhk, tanggalForm, shiftForm, userAction, gdgKode, currentStatus]
            );
        } else {
            // MODE UPDATE HEADER
            await conn.query(
                `UPDATE tlhk_mesinsublim_hdr 
                 SET lsb_tanggal=?, lsb_shift=?, lsb_user_modified=?, lsb_gdg_kode=?, lsb_status=?, lsb_date_modified=NOW() 
                 WHERE lsb_nomor=?`, 
                [tanggalForm, shiftForm, userAction, gdgKode, currentStatus, nomorLhk]
            );
            
            // Hapus detail lama sebelum insert ulang
            await conn.query(`DELETE FROM tlhk_mesinsublim_dtl WHERE lsbd_lsb_nomor = ?`, [nomorLhk]);
        }

        // 2. PROSES DETAIL (Sesuai struktur contoh INSERT tlhk_mesinsublim_dtl Anda)
        if (details && details.length > 0) {
            const values = details.map((d, i) => {
                const p = parseFloat(d.spk_panjang || 0);
                const l = parseFloat(d.spk_lebar || 0);
                const qty = parseFloat(d.jumlah_sublim || 0);
                const jMeter = p * l * qty; // Hitung total meter persegi per item detail

                return [
                    nomorLhk,                           // lsbd_lsb_nomor
                    d.spk_nomor,                        // lsbd_spk_nomor
                    d.spk_nama || '',                   // lsbd_spk_nama
                    tanggalForm,                        // lsbd_spk_tanggal (default tanggal hari ini)
                    tanggalForm,                        // lsbd_dateline (default)
                    parseFloat(d.spk_jmlorder || 0),    // lsbd_jumlah_order
                    p,                                  // lsbd_panjang
                    l,                                  // lsbd_lebar
                    '-',                                // lsbd_mesin
                    qty,                                // lsbd_jumlah
                    jMeter,                             // lsbd_j_meter
                    d.lokasi || 'SB01',                 // lsbd_lokasi
                    d.jenis_bahan || header.brg_kode,   // lsbd_bahan
                    i + 1,                              // lsbd_no_urut
                    0,                                  // lsbd_toleransi
                    0,                                  // lsbd_waste
                    '',                                 // lsbd_poi_nomor
                    ''                                  // lsbd_poid_size
                ];
            });

            const sqlInsertDtl = `
                INSERT INTO tlhk_mesinsublim_dtl (
                    lsbd_lsb_nomor, lsbd_spk_nomor, lsbd_spk_nama, lsbd_spk_tanggal, lsbd_dateline, 
                    lsbd_jumlah_order, lsbd_panjang, lsbd_lebar, lsbd_mesin, lsbd_jumlah, 
                    lsbd_j_meter, lsbd_lokasi, lsbd_bahan, lsbd_no_urut, lsbd_toleransi, 
                    lsbd_waste, lsbd_poi_nomor, lsbd_poid_size
                ) VALUES ?`;

            await conn.query(sqlInsertDtl, [values]);
        }

        await conn.commit();
        return { success: true, nomor: nomorLhk };
    } catch (error) { 
        await conn.rollback(); 
        console.error("CRITICAL SQL ERROR:", error.message);
        return { success: false, message: `Database Error: ${error.message}` };
    } finally { 
        conn.release(); 
    }
};
/**
 * =============================================================================
 * 2. BAGIAN APPROVAL (Rekap ke tlhk_sublim)
 * =============================================================================
 */

const getLookupForApproval = async (tanggal, shift) => {
    let params = [tanggal];
    let sql = `
        SELECT 
            h.lms_nomor AS Nomor, 
            DATE_FORMAT(h.lms_tanggal, '%d-%m-%Y') AS Tanggal, 
            h.lms_shift AS Shift,
            (SELECT lmsd_lokasi FROM tlhk_mesinsublim_dtl WHERE lmsd_lms_nomor = h.lms_nomor LIMIT 1) AS Mesin,
            (SELECT SUM(lmsd_panjang * lmsd_lebar * lmsd_jumlah) FROM tlhk_mesinsublim_dtl WHERE lmsd_lms_nomor = h.lms_nomor) AS Total_Meter
        FROM tlhk_mesinsublim_hdr h
        WHERE h.lms_status = 'POSTED' AND h.lms_tanggal = ?
    `;
    if (shift && shift !== 'Semua') { sql += ` AND h.lms_shift = ?`; params.push(shift); }
    const [rows] = await pool.query(sql, params);
    return rows;
};

const saveApproval = async (data) => {
    const { header, details } = data;
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        // Generate nomor approval (MMT-LHK-SA...)
        const yymm = format(new Date(header.tanggal), 'yyMM');
        const [maxRows] = await conn.query(`SELECT MAX(CAST(SUBSTRING_INDEX(lsb_nomor, '.', -1) AS UNSIGNED)) AS max_num FROM tlhk_sublim_hdr WHERE lsb_nomor LIKE ?`, [`${NOMERATOR_APP}.${yymm}.%`]);
        const nomorApp = `${NOMERATOR_APP}.${yymm}.${String((maxRows[0].max_num || 0) + 1).padStart(4, '0')}`;

        // 1. Insert ke tlhk_sublim_hdr
        await conn.query(`INSERT INTO tlhk_sublim_hdr (lsb_nomor, lsb_tanggal, lsb_gdg_kode, lsb_shift, lsb_user_create, lsb_date_create, lsb_jenis) VALUES (?, ?, ?, ?, ?, NOW(), 'S')`, 
        [nomorApp, header.tanggal, header.gdgKode, header.shift, header.admin]);

        // 2. Insert ke tlhk_sublim_dtl
        if (details.length > 0) {
            const values = details.map((d, i) => [nomorApp, i + 1, d.nomor_spk, d.nama_spk, d.panjang, d.lebar, d.jumlah, d.lokasi, d.bahan, d.jml_order]);
            await conn.query(`INSERT INTO tlhk_sublim_dtl (lsbd_lsb_nomor, lsbd_no_urut, lsbd_spk_nomor, lsbd_spk_nama, lsbd_panjang, lsbd_lebar, lsbd_jumlah, lsbd_lokasi, lsbd_bahan, lsbd_jumlah_order) VALUES ?`, [values]);

            // 3. Update status di tabel asal (mesinsublim)
            const idsAsal = details.map(d => d.lhk_nomor);
            await conn.query(`UPDATE tlhk_mesinsublim_hdr SET lms_status = 'APPROVED' WHERE lms_nomor IN (?)`, [idsAsal]);
        }

        await conn.commit();
        return { success: true, nomor: nomorApp };
    } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
};

/**
 * Mengambil daftar history Approval (tlhk_sublim_hdr)
 */
const getAllApprovalHeaders = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            h.lsb_nomor AS Nomor, 
            DATE_FORMAT(h.lsb_tanggal, '%d-%m-%Y') AS Tanggal, 
            h.lsb_shift AS Shift,
            h.lsb_user_create AS Admin,
            h.lsb_jenis AS Jenis,
            (SELECT SUM(lsbd_panjang * lsbd_lebar * lsbd_jumlah) 
             FROM tlhk_sublim_dtl 
             WHERE lsbd_lsb_nomor = h.lsb_nomor) AS Total_Meter,
            (SELECT COUNT(*) 
             FROM tlhk_sublim_dtl 
             WHERE lsbd_lsb_nomor = h.lsb_nomor) AS Jumlah_Item
        FROM tlhk_sublim_hdr h
        WHERE h.lsb_tanggal BETWEEN ? AND ?
        ORDER BY h.lsb_tanggal DESC, h.lsb_nomor DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};

/**
 * Mengambil detail Approval berdasarkan nomor (untuk expand row di Browse Approval)
 */
const getApprovalDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            d.lsbd_lsb_nomor AS Nomor_App,
            d.lsbd_no_urut AS No_Urut,
            d.lsbd_lokasi AS Lokasi, 
            d.lsbd_spk_nomor AS Nomor_SPK, 
            d.lsbd_spk_nama AS Nama_SPK,
            d.lsbd_jumlah AS Jumlah, 
            d.lsbd_bahan AS Bahan, 
            d.lsbd_panjang AS Panjang,
            d.lsbd_lebar AS Lebar,
            (d.lsbd_panjang * d.lsbd_lebar * d.lsbd_jumlah) AS Total_M2
        FROM tlhk_sublim_dtl d
        WHERE d.lsbd_lsb_nomor = ?
        ORDER BY d.lsbd_no_urut
    `;

    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
};

module.exports = {
    getAllHeaders,
    getDetailsByNomor,
    saveLhkMesin,
    getLookupForApproval,
    saveApproval,
    getAllApprovalHeaders,
    getApprovalDetailsByNomor

};