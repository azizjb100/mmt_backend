const pool = require('../config/db.config');

/**
 * Logika Menampilkan Data Master (Menggantikan btnRefreshClick & btnShowClick)
 * @param {string} startDate - format 'YYYY-MM-DD'
 * @param {string} endDate - format 'YYYY-MM-DD'
 * @param {string} cab - Kode Cabang dari session/user (e.g., 'P01')
 * @param {number} zcus - Flag status customer (1 atau 0)
 * @param {boolean} pendingOnly - Jika true, hanya ambil data yang belum di-apv (sj_approve = 0)
 */
const getMasterSj = async (startDate, endDate, cab, zcus = 0, pendingOnly = false) => {
    let sql = `
        SELECT 
            IF(h.sj_approve=1, "Sudah", IF(h.sj_approve=2, "Batal", "")) AS Approved,
            v.Divisi,
            h.sj_nomor AS Nomor,
            DATE_FORMAT(h.sj_tanggal, '%d-%m-%Y') AS Tanggal,
            h.sj_gdg_kode AS KodeGdg,
            g.gdg_nama AS Gudang,
    `;

    if (parseInt(zcus) === 1) {
        sql += ` h.sj_cus_kode AS KodeCustomer, c.cus_nama AS Customer, h.sj_alamat_customer AS Alamat, h.sj_kota_customer AS Kota, `;
    }

    sql += `
            h.sj_keterangan AS Keterangan,
            h.sj_perush_kode AS ID
        FROM tsj_hdr h 
        LEFT JOIN tgudang g ON g.gdg_kode = h.sj_gdg_kode 
        LEFT JOIN tcustomer c ON c.cus_kode = h.sj_cus_kode 
        LEFT JOIN tdivisi v ON v.kode = h.sj_divisi
        WHERE h.date_create >= "2020-08-24"
    `;

    const params = [];

    // Filter kondisi dari btnShowClick vs btnRefreshClick
    if (pendingOnly) {
        sql += ` AND h.sj_status_otomatis <> 1 AND h.sj_approve = 0 `;
    } else {
        sql += ` AND h.sj_status_otomatis = 0 AND h.sj_tanggal BETWEEN ? AND ? `;
        params.push(startDate, endDate);
    }

    // Filter berdasarkan Cabang/Gudang seperti di Delphi
    if (cab === 'P01') sql += ` AND h.sj_gdg_kode = "GJ002" `;
    else if (cab === 'P02') sql += ` AND h.sj_gdg_kode = "WH002" `;
    else if (cab === 'P04') sql += ` AND h.sj_gdg_kode = "GJ001" `;
    else if (cab === 'P05') sql += ` AND h.sj_gdg_kode = "WH-010" `;

    sql += ` ORDER BY h.sj_approve, h.sj_nomor `;

    const [rows] = await pool.query(sql, params);
    return rows;
};

/**
 * Logika Menampilkan Data Detail
 */
const getDetailSj = async (startDate, endDate, cab, pendingOnly = false) => {
    let sql = `
        SELECT 
            d.sjd_sj_nomor AS Nomor,
            d.sjd_spk_nomor,
            s.spk_nama,
            d.sjd_ukuran,
            s.spk_panjang AS Panjang,
            s.spk_lebar AS Lebar,
            d.sjd_jumlah,
            d.sjd_keterangan
        FROM tsj_hdr h
        INNER JOIN tsj_dtl d ON h.sj_nomor = d.sjd_sj_nomor 
        LEFT JOIN tspk s ON s.spk_Nomor = d.sjd_spk_nomor 
        WHERE h.date_create >= "2020-08-24"
    `;

    const params = [];

    if (pendingOnly) {
        sql += ` AND h.sj_status_otomatis = 0 `;
    } else {
        sql += ` AND h.sj_status_otomatis = 0 AND h.sj_tanggal BETWEEN ? AND ? `;
        params.push(startDate, endDate);
    }

    if (cab === 'P01') sql += ` AND h.sj_gdg_kode = "GJ002" `;
    else if (cab === 'P02') sql += ` AND h.sj_gdg_kode = "WH002" `;
    else if (cab === 'P04') sql += ` AND h.sj_gdg_kode = "GJ001" `;
    else if (cab === 'P05') sql += ` AND h.sj_gdg_kode = "WH-010" `;

    sql += ` ORDER BY d.sjd_sj_nomor `;

    const [rows] = await pool.query(sql, params);
    return rows;
};

/**
 * Logika Proses Approval1Click
 */
const approveSj = async (nomor, kodeGdg) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Validasi Status SJ saat ini sebelum update
        const [check] = await conn.query('SELECT sj_approve FROM tsj_hdr WHERE sj_nomor = ?', [nomor]);
        if (!check.length) throw new Error('Data Surat Jalan tidak ditemukan.');
        
        const currentStatus = check[0].sj_approve;
        if (currentStatus === 1) throw new Error('Sudah di approve.');
        if (currentStatus === 2) throw new Error('Masukkan ke Pending dulu baru di Approve.');

        // 2. Update status header menjadi approved (1)
        await conn.query('UPDATE tsj_hdr SET sj_approve = 1 WHERE sj_nomor = ?', [nomor]);

        // 3. Ambil rincian detail SJ untuk dimasukkan ke tsj_approve
        const [details] = await conn.query(
            'SELECT SJD_SJ_Nomor, sjd_spk_nomor, sjd_ukuran, SJD_jumlah FROM tsj_dtl WHERE SJD_SJ_Nomor = ?', 
            [nomor]
        );

        // 4. Looping insert ke tsj_approve (mirip while not tsql.Eof)
        if (details.length > 0) {
            const sqlInsApprove = `
                INSERT INTO tsj_approve (sja_nomor, sja_spk_nomor, sja_size, sja_jumlah, sja_gdg_kode) 
                VALUES ?
            `;
            const values = details.map(d => [
                d.SJD_SJ_Nomor,
                d.sjd_spk_nomor,
                d.sjd_ukuran,
                d.SJD_jumlah,
                kodeGdg
            ]);
            await conn.query(sqlInsApprove, [values]);
        }

        await conn.commit();
        return { success: true, message: 'Sukses Approve.' };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Logika Proses Pending1Click (Membatalkan Approve)
 */
const pendingSj = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Validasi status
        const [check] = await conn.query('SELECT sj_approve FROM tsj_hdr WHERE sj_nomor = ?', [nomor]);
        if (!check.length) throw new Error('Data tidak ditemukan.');
        if (check[0].sj_approve === 0) throw new Error('Status belum di approve. Tidak perlu dibatalkan.');

        // Update header set sj_approve = 0
        await conn.query('UPDATE tsj_hdr SET sj_approve = 0 WHERE sj_nomor = ?', [nomor]);

        // Delete data dari tsj_approve
        await conn.query('DELETE FROM tsj_approve WHERE sja_nomor = ?', [nomor]);

        await conn.commit();
        return { success: true, message: 'Sukses memindahkan ke Pending.' };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Logika Proses BatalSJ1Click
 */
const batalSj = async (nomor) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // Validasi status
        const [check] = await conn.query('SELECT sj_approve FROM tsj_hdr WHERE sj_nomor = ?', [nomor]);
        if (!check.length) throw new Error('Data tidak ditemukan.');
        if (check[0].sj_approve === 1) throw new Error('Sudah di approve. Silahkan di Pending utk membatalkan Approve, baru dibatalkan.');
        if (check[0].sj_approve === 2) throw new Error('SJ ini sudah batal.');

        // 1. Update header set sj_approve = 2 (Batal)
        await conn.query('UPDATE tsj_hdr SET sj_approve = 2 WHERE sj_nomor = ?', [nomor]);

        // 2. Update status pengerjaan SPK (mengurangi kuantiti prasj)
        const sqlUpdateSpk = `
            UPDATE tspk s 
            SET s.spk_prasj = s.spk_prasj - IFNULL(
                (SELECT SUM(d.SJD_Jumlah) 
                 FROM tsj_dtl d 
                 WHERE d.SJD_SJ_Nomor = ? AND d.sjd_spk_nomor = s.spk_nomor), 0
            )
        `;
        await conn.query(sqlUpdateSpk, [nomor]);

        await conn.commit();
        return { success: true, message: 'Sukses membatalkan Surat Jalan.' };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

module.exports = {
    getMasterSj,
    getDetailSj,
    approveSj,
    pendingSj,
    batalSj
};