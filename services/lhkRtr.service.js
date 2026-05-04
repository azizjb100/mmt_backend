const pool = require('../config/db.config');
const { format } = require('date-fns');

const NOMERATOR = 'MMT-LHK-R';

/**
 * Browse: Mengambil daftar master LHK RTR (Header)
 * Logika Delphi: Filter by lr_tanggal
 */
const getAllHeaders = async (startDate, endDate) => {
    const sql = `
        SELECT 
            lr_nomor AS nomor, 
            DATE_FORMAT(lr_tanggal, '%d-%m-%Y') AS Tanggal, 
            lr_gdg_kode AS Gudang, 
            gdg_nama AS Nama_Gudang,
            (SELECT SUM(lrd_panjang * lrd_lebar * lrd_jumlah) 
             FROM tlhk_rtr_dtl 
             WHERE lrd_lr_nomor = lr_nomor) AS total_meter
        FROM tlhk_rtr_hdr 
        LEFT JOIN tGUDANG ON gdg_kode = lr_gdg_kode
        WHERE lr_tanggal BETWEEN ? AND ?
        ORDER BY lr_tanggal DESC, lr_nomor DESC
    `;

    const [rows] = await pool.query(sql, [startDate, endDate]);
    return rows;
};

/**
 * Mengambil detail LHK RTR berdasarkan nomor
 * Logika Delphi: Gabungan tspk dan tmemospk
 */
const getDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            lrd_lr_nomor AS Nomor, 
            lrd_spk_nomor AS Nomor_SPK, 
            lrd_spk_nama AS Nama_SPK, 
            lrd_panjang AS Panjang, 
            lrd_lebar AS Lebar, 
            lrd_order AS J_Order,
            lrd_jumlah AS Jumlah, 
            (lrd_panjang * lrd_lebar * lrd_jumlah) AS Jumlah_meter, 
            lrd_no_urut AS No_Urut, 
            lrd_poi_nomor AS No_PO_Internal, 
            lrd_poid_size AS Size,
            lrd_lokasi AS Lokasi,
            lrd_bahan AS Jenis_Bahan
        FROM tlhk_rtr_dtl 
        WHERE lrd_lr_nomor = ?
        ORDER BY lrd_no_urut
    `;

    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
};

/**
 * Generate Nomor LHK RTR Otomatis
 * Format Delphi: NOMERATOR.YYMM.0001
 */
const generateNewNomor = async (date, connection = null) => {
    const db = connection || pool;
    const yymm = format(new Date(date), 'yyMM');
    const prefixMatch = `${NOMERATOR}.${yymm}.%`;

    const sqlMax = `
        SELECT MAX(CAST(SUBSTRING_INDEX(lr_nomor, '.', -1) AS UNSIGNED)) AS max_num
        FROM tlhk_rtr_hdr
        WHERE lr_nomor LIKE ?
    `;

    const [rows] = await db.query(sqlMax, [prefixMatch]);
    const maxNum = (rows && rows[0].max_num) ? rows[0].max_num : 0;
    const nextSequence = maxNum + 1;
    return `${NOMERATOR}.${yymm}.${String(nextSequence).padStart(4, '0')}`;
};

/**
 * Simpan LHK RTR (Create / Update)
 * Logika Delphi: Simpan Header & Detail
 */
const saveLhk = async (data) => {
    const { header, details } = data;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();
        let nomorLhk = header.nomor;
        let isNew = false;

        if (!nomorLhk || nomorLhk === 'AUTO') {
            nomorLhk = await generateNewNomor(header.tanggal, conn);
            isNew = true;
        }

        if (isNew) {
            const sqlInsHeader = `
                INSERT INTO tlhk_rtr_hdr (
                    lr_nomor, lr_tanggal, lr_gdg_kode, lr_date_create, lr_user_create
                ) VALUES (?, ?, ?, NOW(), ?)
            `;
            await conn.query(sqlInsHeader, [nomorLhk, header.tanggal, header.gdgKode, header.user || 'SYSTEM']);
        } else {
            const sqlUpdHeader = `
                UPDATE tlhk_rtr_hdr SET 
                    lr_tanggal = ?, lr_gdg_kode = ?, lr_date_modified = NOW(), lr_user_modified = ?
                WHERE lr_nomor = ?
            `;
            await conn.query(sqlUpdHeader, [header.tanggal, header.gdgKode, header.user || 'SYSTEM', nomorLhk]);
            // Hapus detail lama sebelum insert ulang (pola Delphi)
            await conn.query('DELETE FROM tlhk_rtr_dtl WHERE lrd_lr_nomor = ?', [nomorLhk]);
        }

        if (details && details.length > 0) {
            const sqlDetail = `
                INSERT INTO tlhk_rtr_dtl (
                    lrd_lr_nomor, lrd_no_urut, lrd_spk_nomor, lrd_spk_nama, 
                    lrd_panjang, lrd_lebar, lrd_order, lrd_jumlah, 
                    lrd_lokasi, lrd_bahan, lrd_poi_nomor, lrd_poid_size
                ) VALUES ?
            `;
            const values = details.map((d, i) => [
                nomorLhk, i + 1, d.nomor_spk, d.nama_spk, 
                d.panjang, d.lebar, d.j_order, d.jumlah_rtr, 
                d.lokasi, d.jenis_bahan, d.poi_nomor, d.poi_size
            ]);
            await conn.query(sqlDetail, [values]);
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

/**
 * Menghapus LHK RTR
 */
const deleteLhk = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM tlhk_rtr_dtl WHERE lrd_lr_nomor = ?', [nomor]);
        await conn.query('DELETE FROM tlhk_rtr_hdr WHERE lr_nomor = ?', [nomor]);
        await conn.commit();
        return { success: true };
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
    saveLhk,
    deleteLhk,
    generateNewNomor
};