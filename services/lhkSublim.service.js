const pool = require('../config/db.config');
const { format } = require('date-fns');

const NOMERATOR = 'MMT-LHK-S'; // Sesuai konstanta di Delphi

/**
 * Mengambil daftar master LHK Sublim (Browse)
 */
const getAllHeaders = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            lsb_nomor AS nomor, 
            DATE_FORMAT(lsb_tanggal, '%d-%m-%Y') AS Tanggal, 
            lsb_gdg_kode AS Gudang, 
            gdg_nama AS Nama_Gudang, 
            IF(lsb_jenis="M","MMT",IF(lsb_jenis="S","SUBLIM",IF(lsb_jenis="T","TEKSTIL",""))) AS Jenis,
            lsb_shift AS Shift,
            (SELECT IF(COUNT(*) > COUNT(IF(LENGTH(lsbd_bahan)>0, 1, NULL)), 'N', 'Y') 
             FROM tlhk_sublim_dtl 
             WHERE lsbd_lsb_nomor = lsb_nomor) AS Lengkap
        FROM tlhk_sublim_hdr 
        LEFT JOIN tGUDANG ON gdg_kode = lsb_gdg_kode
        WHERE lsb_tanggal BETWEEN ? AND ?
        ORDER BY lsb_tanggal DESC, lsb_nomor DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};

/**
 * Mengambil detail LHK Sublim berdasarkan nomor
 */
const getDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            lsbd_lsb_nomor AS Nomor, 
            lsbd_spk_nomor AS Nomor_SPK, 
            IF(LENGTH(lsbd_spk_nama)>0, lsbd_spk_nama, x.spk_nama) AS Nama_SPK, 
            lsbd_panjang AS Panjang, 
            lsbd_lebar AS Lebar, 
            lsbd_jumlah_order AS J_Order,
            (lsbd_panjang * lsbd_lebar * lsbd_jumlah_order) AS Jumlah_Meter, 
            lsbd_jumlah AS Jumlah, 
            lsbd_lokasi AS Lokasi, 
            lsbd_bahan AS Bahan, 
            lsbd_no_urut AS No_Urut,
            lsbd_toleransi AS Toleransi,
            lsbd_waste AS Waste
        FROM tlhk_sublim_dtl 
        LEFT JOIN (
            SELECT spk_nomor, spk_nama FROM tspk 
            UNION ALL 
            SELECT mspk_nomor, mspk_nama FROM tmemospk 
        ) x ON x.spk_nomor = lsbd_spk_nomor 
        WHERE lsbd_lsb_nomor = ?
        ORDER BY lsbd_no_urut
    `;

    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
};

/**
 * Menghapus LHK Sublim (Header, Detail, & Stok)
 */
const deleteLhk = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM tlhk_sublim_dtl WHERE lsbd_lsb_nomor = ?', [nomor]);
        await conn.query('DELETE FROM tlhk_sublim_hdr WHERE lsb_nomor = ?', [nomor]);
        // Hapus stok jika referensinya adalah nomor LHK ini
        await conn.query('DELETE FROM tmasterstok_mmt WHERE mst_noreferensi = ?', [nomor]);
        await conn.commit();
        return { success: true };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Generate Nomor LHK Sublim Otomatis (Format: MMT-LHK-S.YYMM.0001)
 */
const generateNewNomor = async (date, connection = null) => {
    const db = connection || pool;
    const dateToUse = date instanceof Date ? date : new Date(date);
    const yymm = format(dateToUse, 'yyMM');
    const prefixMatch = `${NOMERATOR}.${yymm}.%`;

    const sqlMax = `
        SELECT MAX(CAST(SUBSTRING_INDEX(lsb_nomor, '.', -1) AS UNSIGNED)) AS max_num
        FROM tlhk_sublim_hdr
        WHERE lsb_nomor LIKE ?
    `;

    const [rows] = await db.query(sqlMax, [prefixMatch]);
    const maxNum = (rows && rows[0].max_num) ? rows[0].max_num : 0;
    return `${NOMERATOR}.${yymm}.${String(maxNum + 1).padStart(4, '0')}`;
};

/**
 * Simpan LHK Sublim (Logika simpandata Delphi)
 */
const saveLhk = async (data) => {
    const { header, details, isPosted } = data; // isPosted menentukan apakah stok diproses
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        let nomorLhk = header.nomor;

        // 1. Logika Penentuan Nomor (Baru vs Edit)
        if (!nomorLhk || nomorLhk === 'AUTO') {
            nomorLhk = await generateNewNomor(header.tanggal, conn);
            const sqlInsHeader = `
                INSERT INTO tlhk_sublim_hdr (
                    lsb_nomor, lsb_tanggal, lsb_gdg_kode, lsb_shift, 
                    lsb_date_create, lsb_user_create, lsb_jenis
                ) VALUES (?, ?, ?, ?, NOW(), ?, ?)
            `;
            await conn.query(sqlInsHeader, [
                nomorLhk, header.tanggal, header.gdgKode, header.shift || 1, 
                header.user || 'SYSTEM', header.jenis || 'S'
            ]);
        } else {
            const sqlUpdHeader = `
                UPDATE tlhk_sublim_hdr SET 
                    lsb_tanggal = ?, lsb_gdg_kode = ?, lsb_shift = ?,
                    lsb_date_modified = NOW(), lsb_user_modified = ?
                WHERE lsb_nomor = ?
            `;
            await conn.query(sqlUpdHeader, [
                header.tanggal, header.gdgKode, header.shift || 1, 
                header.user || 'SYSTEM', nomorLhk
            ]);
            // Bersihkan detail lama untuk ditimpa (sama seperti logic Delphi)
            await conn.query('DELETE FROM tlhk_sublim_dtl WHERE lsbd_lsb_nomor = ?', [nomorLhk]);
        }

        // 2. Simpan Detail (tlhk_sublim_dtl)
        if (details && details.length > 0) {
            const sqlDetail = `
                INSERT INTO tlhk_sublim_dtl (
                    lsbd_lsb_nomor, lsbd_spk_nomor, lsbd_spk_nama, lsbd_spk_tanggal,
                    lsbd_dateline, lsbd_panjang, lsbd_lebar, lsbd_jumlah_order,
                    lsbd_jumlah, lsbd_lokasi, lsbd_bahan, lsbd_no_urut,
                    lsbd_toleransi, lsbd_waste
                ) VALUES ?
            `;
            const values = details.map((d, i) => [
                nomorLhk, d.spk_nomor, d.spk_nama, d.spk_tanggal,
                d.spk_deadline, d.spk_panjang, d.spk_lebar, d.spk_jmlorder,
                d.jumlah_sublim, d.lokasi, d.jenis_bahan, i + 1,
                d.toleransi || 0, d.waste || 0
            ]);
            await conn.query(sqlDetail, [values]);
        }

        // 3. Logika Stok (Jika Status POSTED/Selesai)
        // Note: Implementasi ini opsional tergantung kebutuhan aplikasi Vue Anda
        if (isPosted) {
            // Logic pengurangan stok bahan baku bisa ditambahkan di sini
            // Mirip dengan logic tmasterstok_mmt di LHK Tekstil
        }

        await conn.commit();
        return { success: true, nomor: nomorLhk };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

module.exports = {
    getAllHeaders,
    getDetailsByNomor,
    deleteLhk,
    generateNewNomor,
    saveLhk
};