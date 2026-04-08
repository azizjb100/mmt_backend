const pool = require('../config/db.config');
const { format } = require('date-fns');

const NOMERATOR = 'MMT-LHK-T';

/**
 * Mengambil daftar master LHK (Logika btnRefreshClick di Delphi)
 */
const getAllHeaders = async (startDate, endDate) => {
    const tglMulai = format(new Date(startDate), 'yyyy-MM-dd');
    const tglSelesai = format(new Date(endDate), 'yyyy-MM-dd');

    const sql = `
        SELECT 
            lth_nomor AS Nomor, 
            DATE_FORMAT(lth_tanggal, '%d-%m-%Y') AS Tanggal, 
            lth_gdg_prod AS Gudang, 
            gdg_nama AS Nama_Gudang, 
            lth_shift AS Shift,
            /* Logika pengecekan Lengkap dari Delphi */
            (SELECT IF(COUNT(*) > COUNT(IF(LENGTH(ltd_brg_kode) > 0, 1, NULL)), 'N', 'Y') 
             FROM tlhk_tekstilmmt_dtl 
             WHERE ltd_lth_nomor = lth_nomor) AS Lengkap,
            /* Hitung Total Cetak Meter */
            (SELECT SUM(ltd_qty_Cetak * spk_panjang) 
             FROM tlhk_tekstilmmt_dtl 
             LEFT JOIN tspk ON spk_nomor = ltd_spk_nomor
             WHERE ltd_lth_nomor = lth_nomor) AS cetak_meter
        FROM tlhk_tekstilmmt_hdr 
        LEFT JOIN tGUDANG ON gdg_kode = lth_gdg_prod
        WHERE lth_tanggal BETWEEN ? AND ?
        ORDER BY lth_tanggal DESC, lth_nomor DESC
    `;

    const [rows] = await pool.query(sql, [tglMulai, tglSelesai]);
    return rows;
};

/**
 * Mengambil detail LHK (Logika SQLDetail di Delphi)
 */
const getDetailsByNomor = async (nomor) => {
    const sqlDetail = `
        SELECT 
            ltd_lth_nomor AS Nomor,
            ltd_jns_mesin AS Mesin, 
            ltd_spk_nomor AS Nomor_SPK, 
            x.spk_nama AS Nama_SPK, 
            x.spk_panjang AS Panjang, 
            x.spk_lebar AS Lebar, 
            x.spk_jumlah AS jml_order, 
            ltd_qty_Cetak AS Jml_Cetak, 
            ltd_brg_kode AS Kode_Bahan, 
            brg_nama AS Nama, 
            ltd_ambil_bahan AS Ambil, 
            ltd_ret_bahan_ok AS Sisa_OK, 
            ltd_ret_bahan_nok AS Sisa_NOK, 
            ltd_cq AS Cyan, 
            ltd_mq AS Magenta, 
            ltd_yq AS Yellow, 
            ltd_kq AS Black, 
            ltd_toleransi AS Toleransi, 
            ltd_waste AS Waste 
        FROM tlhk_tekstilmmt_dtl 
        LEFT JOIN (
            SELECT spk_nomor, spk_nama, spk_jumlah, 
                   IFNULL(spk_panjang,0) AS spk_panjang, 
                   IFNULL(spk_lebar,0) AS spk_lebar 
            FROM tspk 
            UNION ALL 
            SELECT mspk_nomor, mspk_nama, mspk_jumlah, 
                   IFNULL(mspk_panjang,0) AS mspk_panjang, 
                   IFNULL(mspk_lebar,0) AS mspk_lebar 
            FROM tmemospk 
        ) x ON x.spk_nomor = ltd_spk_nomor 
        LEFT JOIN tbarang_mmt ON brg_kode = ltd_brg_kode 
        WHERE ltd_lth_nomor = ?
        ORDER BY ltd_no_urut
    `;

    const [rows] = await pool.query(sqlDetail, [nomor]);
    return rows;
};

/**
 * Menghapus LHK (Logika cxButton4Click di Delphi)
 */
const deleteLhk = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Detail dihapus duluan (Foreign Key constraint safety)
        await conn.query('DELETE FROM tlhk_tekstilmmt_dtl WHERE ltd_lth_nomor = ?', [nomor]);
        // Header dihapus
        await conn.query('DELETE FROM tlhk_tekstilmmt_hdr WHERE lth_nomor = ?', [nomor]);

        await conn.commit();
        return { success: true };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

// =========================================================================
// 1. FUNGSI GENERATE NOMOR
// =========================================================================

/**
 * Mengambil nomor urut maksimum dari bulan dan tahun saat ini
 * Format: MMT-LHK-T.YYMM.0001
 * @param {Date|string} date - Tanggal untuk menentukan YYMM
 * @returns {Promise<string>} - Nomor LHK yang baru
 */
const generateNewNomor = async (date, connection = null) => {
    const db = connection || pool; // Bisa menerima connection dari transaction
    const dateToUse = date instanceof Date ? date : new Date(date);
    const yymm = format(dateToUse, 'yyMM');
    const prefixMatch = `${NOMERATOR}.${yymm}.%`;

    // PERBAIKAN: Nama tabel harus tlhk_tekstilmmt_hdr dan kolom lth_nomor
    const sqlMax = `
        SELECT MAX(CAST(SUBSTRING_INDEX(lth_nomor, '.', -1) AS UNSIGNED)) AS max_num
        FROM tlhk_tekstilmmt_hdr
        WHERE lth_nomor LIKE ?
    `;

    try {
        const [rows] = await db.query(sqlMax, [prefixMatch]);
        const maxNum = (rows && rows[0].max_num) ? rows[0].max_num : 0;
        const nextSequence = maxNum + 1;
        const formattedSequence = String(nextSequence).padStart(4, '0');

        return `${NOMERATOR}.${yymm}.${formattedSequence}`;
    } catch (error) {
        console.error("Error generating new nomor:", error);
        throw new Error("Gagal generate nomor otomatis.");
    }
};

const saveLhk = async (data) => {
    const { header, details } = data;
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        let nomorLhk = header.nomor;
        let isActuallyNew = false;

        // Cek apakah nomor baru atau edit
        if (!nomorLhk || nomorLhk === 'AUTO') {
            nomorLhk = await generateNewNomor(header.tanggal, conn); // Kirim conn agar konsisten dalam transaksi
            isActuallyNew = true;
        } else {
            const [rows] = await conn.query('SELECT lth_nomor FROM tlhk_tekstilmmt_hdr WHERE lth_nomor = ?', [nomorLhk]);
            isActuallyNew = (rows.length === 0);
        }

        if (isActuallyNew) {
            const sqlInsHeader = `
                INSERT INTO tlhk_tekstilmmt_hdr (
                    lth_nomor, lth_tanggal, lth_shift, lth_gdg_prod, 
                    lth_user_create, lth_date_create, lth_brg_kode
                ) VALUES (?, ?, ?, ?, ?, NOW(), ?)
            `;
            await conn.query(sqlInsHeader, [
                nomorLhk, 
                header.tanggal, 
                header.shift || 1, 
                header.gdgKode, 
                header.user || 'SYSTEM', 
                header.brg_kode,
                header.lstatus || 'DRAFT'
            ]);
        } else {
            const sqlUpdHeader = `
                UPDATE tlhk_tekstilmmt_hdr SET 
                    lth_tanggal = ?, lth_shift = ?, lth_gdg_prod = ?, 
                    lth_status = ?, lth_brg_kode = ?
                WHERE lth_nomor = ?
            `;
            await conn.query(sqlUpdHeader, [
                header.tanggal, 
                header.shift || 1, 
                header.gdgKode, 
                header.lstatus || 'DRAFT', 
                header.brg_kode, 
                nomorLhk
            ]);

            // Hapus detail lama
            await conn.query('DELETE FROM tlhk_tekstilmmt_dtl WHERE ltd_lth_nomor = ?', [nomorLhk]);
        }

        // Simpan Detail menggunakan Bulk Insert
        if (details && details.length > 0) {
            const sqlDetail = `
                INSERT INTO tlhk_tekstilmmt_dtl (
                    ltd_lth_nomor, ltd_no_urut, ltd_jns_mesin, ltd_spk_nomor, 
                    ltd_qty_Cetak, ltd_brg_kode, ltd_panjang_pakai, ltd_lebar_pakai
                ) VALUES ?
            `;
            
            const values = details.map((d, i) => [
                nomorLhk,
                i + 1,
                d.mesin,
                d.nomor_spk,
                d.jumlah_cetak,
                header.brg_kode,
                // Pastikan perhitungan angka aman (handle null/undefined)
                (Number(d.panjang_per_pcs) || 0) * (Number(d.jumlah_cetak) || 0),
                d.lebar_spk || 0
            ]);

            await conn.query(sqlDetail, [values]);
        }

        await conn.commit();
        return { success: true, nomor: nomorLhk, message: isActuallyNew ? 'Data dibuat' : 'Data diperbarui' };

    } catch (error) {
        await conn.rollback();
        console.error("Error pada saveLhk:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            throw new Error(`Gagal Simpan: Nomor ${nomorLhk} sudah ada. Silakan coba lagi.`);
        }
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