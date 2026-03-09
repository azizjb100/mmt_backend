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
            WHERE 1=1 -- Memudahkan penambahan AND secara dinamis
        `;

        const params = [];
        if (keyword) {
            sql += ` AND (h.poe_nomor LIKE ? OR u.Sup_nama LIKE ?)`;
            params.push(`%${keyword}%`, `%${keyword}%`);
        }

        // MENGHAPUS FILTER STATUS DAN HAVING AGAR SEMUA TAMPIL
        sql += ` ORDER BY h.poe_nomor DESC LIMIT 100`;

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
        // Query Gabungan sesuai logika Delphi edtnopoExit
        const sql = `
            SELECT h.*, 
                   s.spk_nama, s.spk_kain, s.spk_ukuran, s.spk_jumlah, s.spk_jo_kode, 
                   s.spk_divisi, s.spk_panjang, s.spk_lebar,
                   v.divisi AS nama_divisi, 
                   j.jo_nama,
                   u.Sup_nama, u.Sup_alamat, u.Sup_kota,
                   -- Hitung total yang sudah diterima (History)
                   (SELECT IFNULL(SUM(bh.bpe_jumlah), 0) 
                    FROM tbpbpoexternal_hdr bh 
                    WHERE bh.bpe_po = h.poe_nomor) AS totalTerima
            FROM tpoexternal_hdr h
            LEFT JOIN tspk s ON s.spk_nomor = h.poe_spk_nomor
            LEFT JOIN tdivisi v ON v.kode = s.spk_divisi
            LEFT JOIN tjenisorder j ON j.jo_kode = s.spk_jo_kode
            LEFT JOIN tsupplier u ON u.Sup_kode = h.poe_sup
            WHERE h.poe_nomor = ?
        `;

        const [rows] = await pool.query(sql, [noPo]);
        if (rows.length === 0) return null;

        const header = rows[0];

        // Ambil Data Alokasi (Grid Detail)
        const [alokasi] = await pool.query(
            `SELECT poeda_nomor AS NomorPO, poeda_nourut AS NoUrut, 
                    poeda_kota AS KodeBrg, poeda_kota AS NamaBrg, 
                    poeda_jumlah AS QtyPO 
             FROM tpoexternal_dtl_alokasi 
             WHERE poeda_nomor = ? ORDER BY poeda_nourut`, 
            [noPo]
        );

        return {
            ...header,
            details: alokasi
        };
    } catch (error) {
        console.error("Database Error (getPoDetailForBpb):", error);
        throw error;
    }
};

const getSudahTerima = async (noPo) => {
    // Perbaikan: Tambahkan JOIN atau pastikan alias h benar
    const sql = `
        SELECT IFNULL(SUM(h.bpe_jumlah), 0) AS totalTerima
        FROM tbpbpoexternal_hdr h
        WHERE h.bpe_po = ?
    `;
    const [rows] = await pool.query(sql, [noPo]);
    return rows[0].totalTerima;

};

module.exports = { getPoExternalBrowse, deletePoExternal, ajukanPerubahan, getLookupPoForBpb, getPoDetailForBpb, getSudahTerima };