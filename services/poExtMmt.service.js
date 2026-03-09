// backend/src/services/poExternal.service.js
const pool = require('../config/db.config');

/**
 * Mendapatkan daftar PO dengan logika warna/status seperti di Delphi
 */
const getPoExternalBrowse = async (startDate, endDate, userCab) => {
    const sql = `
        SELECT x.*,
        IFNULL((
            SELECT 
                CASE 
                    WHEN pin_acc = '' AND pin_dipakai = '' THEN 'WAIT'
                    WHEN pin_acc = 'Y' AND pin_dipakai = '' THEN 'ACC'
                    WHEN pin_acc = 'Y' AND pin_dipakai = 'Y' THEN ''
                    WHEN pin_acc = 'N' THEN 'TOLAK'
                    ELSE ''
                END
            FROM tspk_pin5 
            WHERE pin_trs = "PO EXT MMT" AND pin_nomor = x.Nomor 
            ORDER BY pin_urut DESC LIMIT 1
        ), "") AS Ngedit
        FROM (
            SELECT 
                h.poe_nomor AS Nomor, h.poe_tanggal AS Tanggal, h.poe_dateline AS DateLinePO,
                h.poe_cab AS Cab, h.poe_spk_nomor AS SPK, s.spk_nama AS NamaSPK,
                h.poe_sup AS KdSup, u.Sup_nama AS Supplier, h.poe_jumlah AS QtyPO,
                (SELECT IFNULL(SUM(hh.bpe_jumlah), 0) FROM tbpbpoexternal_hdr hh WHERE hh.bpe_po = h.poe_nomor) AS QtyBPB,
                h.poe_total AS Nominal,
                (SELECT IFNULL(SUM(c.poed2_nominal), 0) FROM tpoexternal_dtl2 c WHERE c.poed2_nomor = h.poe_nomor) AS DP,
                (SELECT IFNULL(SUM(v.voud_total), 0) FROM tvoucher_dtl v WHERE v.voud_nota = h.poe_nomor) AS Voucher,
                h.poe_status AS Status, h.user_create AS Usr, h.date_create AS Created
            FROM tpoexternal_hdr h
            LEFT JOIN tspk s ON s.spk_nomor = h.poe_spk_nomor
            LEFT JOIN tsupplier u ON u.Sup_kode = h.poe_sup
            WHERE h.poe_tanggal BETWEEN ? AND ?
            AND h.poe_cab IN ('P02', 'P05')
            ${userCab ? 'AND h.poe_cab = ?' : ''}
        ) x
        ORDER BY x.Nomor DESC
    `;
    
    const params = [startDate, endDate];
    if (userCab) params.push(userCab);

    const [rows] = await pool.query(sql, params);
    return rows;
};

/**
 * Logika Hapus dengan Proteksi Ketat (Sama dengan cxButton4Click di Delphi)
 */
const deletePoExternal = async (nomor, userCab) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Ambil data Header
        const [rows] = await connection.query(
            `SELECT poe_tanggal, poe_status, poe_cab,
            (SELECT IFNULL(SUM(bpe_jumlah), 0) FROM tbpbpoexternal_hdr WHERE bpe_po = poe_nomor) as QtyBPB,
            (SELECT IFNULL(SUM(voud_total), 0) FROM tvoucher_dtl WHERE voud_nota = poe_nomor) as Voucher
            FROM tpoexternal_hdr WHERE poe_nomor = ?`, [nomor]
        );

        if (rows.length === 0) throw new Error("Data tidak ditemukan");
        const data = rows[0];

        // 2. Cek Cabang
        if (userCab && data.poe_cab !== userCab) throw new Error("Bukan data cabang anda");

        // 3. Cek Closing (Logika zMonth/zYear Delphi)
        const tgl = new Date(data.poe_tanggal);
        // Misal tgl close adalah tanggal 25 bulan berikutnya
        const limitClose = new Date(tgl.getFullYear(), tgl.getMonth() + 1, 25);
        if (new Date() > limitClose) throw new Error("Transaksi sudah close periode");

        // 4. Cek Status & Linkage
        if (data.poe_status !== 'OPEN') throw new Error("PO sudah diproses/close");
        if (data.QtyBPB > 0) throw new Error("PO sudah ada penerimaan (BPB)");
        if (data.Voucher > 0) throw new Error("PO sudah ada voucher pembayaran");

        // 5. Eksekusi Hapus
        await connection.query('DELETE FROM tpoexternal_hdr WHERE poe_nomor = ?', [nomor]);
        await connection.query('DELETE FROM tpoexternal_dtl WHERE poed_nomor = ?', [nomor]);

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

/**
 * Logika Pengajuan Perubahan Data (PIN / Approval)
 */
const ajukanPerubahan = async (nomor, alasan, currentUser) => {
    // Ambil info urutan terakhir
    const [lastPin] = await pool.query(
        'SELECT pin_urut, pin_dipakai FROM tspk_pin5 WHERE pin_trs="PO EXT MMT" AND pin_nomor=? ORDER BY pin_urut DESC LIMIT 1',
        [nomor]
    );

    let urut = 1;
    if (lastPin.length > 0) {
        urut = lastPin[0].pin_dipakai === '' ? lastPin[0].pin_urut : lastPin[0].pin_urut + 1;
    }

    const [header] = await pool.query('SELECT poe_tanggal, poe_spk_nomor FROM tpoexternal_hdr WHERE poe_nomor=?', [nomor]);

    const sql = `
        INSERT INTO tspk_pin5 
        (pin_trs, pin_nomor, pin_urut, pin_tgl_trs, pin_ket, pin_tgl_minta, pin_user_minta, pin_alasan)
        VALUES ("PO EXT MMT", ?, ?, ?, ?, NOW(), ?, ?)
        ON DUPLICATE KEY UPDATE 
        pin_acc="", pin_tgl_minta=NOW(), pin_user_minta=VALUES(pin_user_minta), pin_alasan=VALUES(pin_alasan)
    `;

    await pool.query(sql, [
        nomor, urut, header[0].poe_tanggal, header[0].poe_spk_nomor, currentUser, alasan
    ]);

    return { status: 'WAIT', urut };
};

const getLookupPoForBpb = async (keyword) => {
    try {
        let sql = `
            SELECT 
                h.poe_nomor AS Nomor, 
                h.poe_tanggal AS Tanggal, 
                h.poe_sup AS KodeSup, 
                u.Sup_nama AS Supplier,
                h.poe_status AS Status,
                h.poe_jumlah AS TotalQtyPO,
                (SELECT IFNULL(SUM(bpe_jumlah), 0) FROM tbpbpoexternal_hdr WHERE bpe_po = h.poe_nomor) AS TotalQtyBPB
            FROM tpoexternal_hdr h
            LEFT JOIN tsupplier u ON u.Sup_kode = h.poe_sup
            WHERE (h.poe_status = 'OPEN' OR h.poe_status = 'PROSES')
        `;

        const params = [];
        if (keyword) {
            sql += ` AND (h.poe_nomor LIKE ? OR u.Sup_nama LIKE ?)`;
            params.push(`%${keyword}%`, `%${keyword}%`);
        }

        sql += ` HAVING TotalQtyBPB < TotalQtyPO ORDER BY h.poe_nomor DESC LIMIT 50`;

        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throw new Error("Gagal mengambil lookup PO: " + error.message);
    }
};

/**
 * Lookup Detail PO: Digunakan untuk menarik item-item setelah PO dipilih
 * Menghitung sisa Qty yang boleh diterima
 */
const getPoDetailForBpb = async (noPo) => {
    try {
        const sql = `
            SELECT 
                d.poed_nomor AS Nomor,
                d.poed_nourut AS NoUrut,
                d.poed_brg_kode AS KodeBrg,
                b.brg_nama AS NamaBrg,
                d.poed_satuan AS Satuan,
                d.poed_jumlah AS QtyPO,
                IFNULL(SUM(bh.bpe_jumlah), 0) AS QtySdhTerima,
                (d.poed_jumlah - IFNULL(SUM(bh.bpe_jumlah), 0)) AS SisaQty
            FROM tpoexternal_dtl d
            LEFT JOIN tbarang_mmt b ON d.poed_brg_kode = b.brg_kode
            LEFT JOIN tbpbpoexternal_hdr bh ON bh.bpe_po = d.poed_nomor -- Asumsi relasi detail ke header BPB
            WHERE d.poed_nomor = ?
            GROUP BY d.poed_nourut
            HAVING SisaQty > 0
            ORDER BY d.poed_nourut
        `;

        const [rows] = await pool.query(sql, [noPo]);
        return rows;
    } catch (error) {
        throw new Error("Gagal mengambil detail PO untuk BPB: " + error.message);
    }
};

module.exports = { getPoExternalBrowse, deletePoExternal, ajukanPerubahan, getLookupPoForBpb, getPoDetailForBpb};