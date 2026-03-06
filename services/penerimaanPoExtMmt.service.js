const pool = require('../config/db.config');

exports.getBrowseData = async (start, end, cab) => {
    let sql = `
        SELECT h.bpe_nomor AS Nomor, h.bpe_tanggal AS Tanggal, h.bpe_po AS NomorPO, 
               h.bpe_cab AS Cab, h.bpe_spk_nomor AS SPK, s.spk_nama AS NamaSPK,
               h.bpe_sup AS Kdsup, u.Sup_nama AS Supplier, h.bpe_jumlah AS Jumlah,
               h.bpe_ket AS Keterangan
        FROM tbpbpoexternal_hdr h
        LEFT JOIN tspk s ON s.spk_nomor = h.bpe_spk_nomor
        LEFT JOIN tsupplier u ON u.Sup_kode = h.bpe_sup
        WHERE h.bpe_tanggal BETWEEN ? AND ?
    `;
    
    const params = [start, end];
    if (cab && cab !== 'ALL') {
        sql += ` AND h.bpe_cab = ?`;
        params.push(cab);
    } else {
        sql += ` AND h.bpe_cab IN ("P02", "P05")`;
    }
    sql += ` ORDER BY h.bpe_nomor DESC`;

    const [rows] = await pool.query(sql, params);
    return rows;
};

exports.deleteBPB = async (nomorBPB, userCab) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Cek Cabang & Ambil Nomor PO terkait (Logika Delphi)
        const [header] = await conn.query(
            'SELECT bpe_cab, bpe_po FROM tbpbpoexternal_hdr WHERE bpe_nomor = ?', 
            [nomorBPB]
        );

        if (header.length === 0) throw new Error("Data tidak ditemukan.");
        if (userCab && userCab !== "" && header[0].bpe_cab !== userCab) {
            throw new Error("Anda tidak berhak menghapus data cabang lain.");
        }

        const nomorPO = header[0].bpe_po;

        // 2. Hapus Data
        await conn.query('DELETE FROM tbpbpoexternal_hdr WHERE bpe_nomor = ?', [nomorBPB]);
        // Jika ada tabel detail: await conn.query('DELETE FROM tbpbpoexternal_dtl WHERE bped_nomor = ?', [nomorBPB]);

        // 3. Update Status PO (Replikasi Logika cxButton4Click Delphi)
        // Hitung total yang dipesan di PO
        const [poQty] = await conn.query(
            'SELECT SUM(poe_jumlah) as total FROM tpoexternal_hdr WHERE poe_nomor = ?', 
            [nomorPO]
        );
        
        // Hitung total yang sudah diterima (setelah BPB ini dihapus)
        const [recQty] = await conn.query(
            'SELECT IFNULL(SUM(bpe_jumlah), 0) as total FROM tbpbpoexternal_hdr WHERE bpe_po = ?', 
            [nomorPO]
        );

        const nPO = poQty[0].total || 0;
        const nSJ = recQty[0].total || 0;

        let status = "OPEN";
        if (nSJ >= nPO && nPO > 0) status = "CLOSE";
        else if (nSJ > 0) status = "PROSES";

        await conn.query(
            'UPDATE tpoexternal_hdr SET poe_status = ? WHERE poe_nomor = ?', 
            [status, nomorPO]
        );

        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

exports.getDetailByNomor = async (nomor) => {
    // Implementasi pengambilan header + detail untuk mode EDIT
    const [header] = await pool.query('SELECT * FROM tbpbpoexternal_hdr WHERE bpe_nomor = ?', [nomor]);
    if (header.length === 0) throw new Error("Data tidak ditemukan");
    
    // Asumsi ada tabel detail
    const [details] = await pool.query('SELECT * FROM tbpbpoexternal_dtl WHERE bped_nomor = ?', [nomor]);
    
    return { ...header[0], Detail: details };
};

exports.saveBPB = async (data, user) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const { nomorPo, terimaBaru, tanggal, cabang, supKode, gpAsalKode, gpTujuanKode, nomorSpk, keterangan } = data;

        // 1. Generate Nomor Otomatis (Replikasi getmaxnomor)
        const year = new Date(tanggal).getFullYear();
        const [rows] = await conn.query(
            `SELECT IFNULL(MAX(RIGHT(bpe_nomor, 5)), 0) AS max_num 
             FROM tbpbpoexternal_hdr WHERE LEFT(bpe_nomor, 8) = ?`,
            [`BPE.${year}`]
        );
        const nextNum = parseInt(rows[0].max_num) + 1;
        const currentNomor = `BPE.${year}${String(nextNum).padStart(5, '0')}`;

        // 2. Insert Header BPB (tbpbpoexternal_hdr)
        const sqlInsert = `
            INSERT INTO tbpbpoexternal_hdr 
            (bpe_nomor, bpe_tanggal, bpe_po, bpe_spk_nomor, bpe_cab, bpe_sup, bpe_gpasal, 
             bpe_gptujuan, bpe_ket, bpe_jumlah, date_create, user_create)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)
        `;
        await conn.query(sqlInsert, [
            currentNomor, tanggal, nomorPo, nomorSpk, cabang, supKode,
            gpAsalKode, gpTujuanKode, keterangan, terimaBaru, user
        ]);

        // 3. Update Status PO (Replikasi Logika F10 Delphi)
        // Hitung total PO vs total akumulasi BPB
        const [poData] = await conn.query('SELECT poe_jumlah FROM tpoexternal_hdr WHERE poe_nomor = ?', [nomorPo]);
        const [bpbData] = await conn.query(
            'SELECT IFNULL(SUM(bpe_jumlah), 0) as total FROM tbpbpoexternal_hdr WHERE bpe_po = ?', 
            [nomorPo]
        );

        const nPO = poData[0].poe_jumlah;
        const nSJ = bpbData[0].total;

        let status = "PROSES";
        if (nSJ >= nPO) status = "CLOSE";
        else if (nSJ === 0) status = "OPEN";

        await conn.query('UPDATE tpoexternal_hdr SET poe_status = ? WHERE poe_nomor = ?', [status, nomorPo]);

        await conn.commit();
        return { nomor: currentNomor };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

exports.getSudahTerima = async (nomorPo) => {
    const [rows] = await pool.query(
        'SELECT IFNULL(SUM(bpe_jumlah), 0) as jml FROM tbpbpoexternal_hdr WHERE bpe_po = ?',
        [nomorPo]
    );
    return rows[0];
};