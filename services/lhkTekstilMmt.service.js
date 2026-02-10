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

/**
 * Generate Nomor Otomatis (Opsional untuk Form Input)
 */
const generateNewNomor = async (date) => {
    const yymm = format(new Date(date), 'yyMM');
    const prefix = `${NOMERATOR}.${yymm}.`;
    
    const [rows] = await pool.query(
        `SELECT MAX(CAST(SUBSTRING(lth_nomor, -4) AS UNSIGNED)) AS max_num 
         FROM tlhk_tekstilmmt_hdr WHERE lth_nomor LIKE ?`, 
        [`${prefix}%`]
    );

    const nextNum = (rows[0]?.max_num || 0) + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
};

module.exports = {
    getAllHeaders,
    getDetailsByNomor,
    deleteLhk,
    generateNewNomor
};