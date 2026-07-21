const pool = require("../../config/db.config");

const throwDbError = (message, error) => {
    throw new Error(`${message}: ${error.message}`);
};

// Generasi otomatis nomor transaksi sesuai aturan Delphi getmaxkode
const generateMaxKode = async (conn, isTax, tanggalStr) => {
    const NOMERATOR = 'RIP';
    // Format tanggal ke YYMM (contoh: 2026-07-20 -> 2607)
    const dateObj = new Date(tanggalStr);
    const yy = String(dateObj.getFullYear()).slice(-2);
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yymm = `${yy}${mm}`;
    
    const prefix = `${NOMERATOR}.${yymm}.%`;
    const taxValue = isTax ? 1 : 0;

    if (isTax) {
        const sql = `
            SELECT MAX(RIGHT(rec_nomor, 4)) AS max_num 
            FROM tREC_hdr_penolong 
            WHERE rec_nomor LIKE ? AND rec_istax = 1
        `;
        const [rows] = await conn.query(sql, [prefix]);
        const currentMax = rows[0]?.max_num ? parseInt(rows[0].max_num, 10) : 0;
        // Aturan Delphi: RightStr(IntToStr(10000 + fields[0].AsInteger + 1), 4)
        const nextNum = String(10000 + currentMax + 1).slice(-4);
        return `${NOMERATOR}.${yymm}.${nextNum}`;
    } else {
        const sql = `
            SELECT MAX(RIGHT(rec_nomor, 3)) AS max_num 
            FROM tREC_hdr_penolong 
            WHERE rec_nomor LIKE ? AND rec_istax = 0
        `;
        const [rows] = await conn.query(sql, [prefix]);
        const currentMax = rows[0]?.max_num ? parseInt(rows[0].max_num, 10) : 0;
        // Aturan Delphi: RightStr(IntToStr(15000 + fields[0].AsInteger + 1), 4)
        const nextNum = String(15000 + currentMax + 1).slice(-4);
        return `${NOMERATOR}.${yymm}.${nextNum}`;
    }
};

// 1. READ ALL (Browse Data PO Penolong)
exports.getBrowsePO = async ({ keyword = "" } = {}) => {
    try {
        let sql = `
            SELECT 
                h.rec_nomor AS Nomor,
                h.rec_tanggal AS Tanggal,
                h.rec_sup_kode AS SupKode,
                s.sup_nama AS SupplierNama,
                h.rec_gdg_kode AS GdgKode,
                g.gdg_nama AS GudangNama,
                h.rec_amount AS TotalAmount,
                h.rec_istax AS isTax,
                h.rec_memo AS Memo,
                h.user_create AS Creator
            FROM tREC_hdr_penolong h
            LEFT JOIN tsupplier s ON h.rec_sup_kode = s.sup_kode
            LEFT JOIN tgudang g ON h.rec_gdg_kode = g.gdg_kode
            WHERE h.rec_type = 1
        `;
        const params = [];
        if (keyword) {
            sql += ` AND (h.rec_nomor LIKE ? OR s.sup_nama LIKE ? OR h.rec_memo LIKE ?)`;
            const q = `%${keyword}%`;
            params.push(q, q, q);
        }
        sql += ` ORDER BY h.date_create DESC`;

        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError("Gagal memuat browse PO Penolong", error);
    }
};

// 2. READ BY NOMOR (Load Data untuk Edit / Detail)
exports.getPOByNomor = async (nomor) => {
    try {
        // Fetch Header
        const sqlHeader = `
            SELECT 
                rec_nomor AS Nomor, rec_tanggal AS Tanggal, rec_memo AS Memo,
                rec_sup_kode AS SupKode, rec_gdg_kode AS GdgKode,
                rec_disc_faktur AS DiscFaktur, rec_disc_fakturpr AS DiscFakturPr,
                rec_istax AS isTax, rec_dateline AS Dateline, rec_amount AS TotalAmount,
                rec_taxamount AS TaxAmount
            FROM tREC_hdr_penolong
            WHERE rec_nomor = ? AND rec_type = 1 LIMIT 1
        `;
        const [headers] = await pool.query(sqlHeader, [nomor]);
        if (!headers.length) throw new Error("Nomor PO Penolong tidak ditemukan.");

        // Fetch Detail + Kalkulasi Nilai Bersih baris
        const sqlDetail = `
            SELECT 
                d.recd_brg_kode AS SKU,
                b.brg_nama AS NamaBarang,
                d.recd_brg_satuan AS Satuan,
                d.recd_qty AS QTY,
                d.recd_harga AS Harga,
                d.recd_discpr AS Disc,
                d.recd_keterangan AS Keterangan,
                d.recd_nourut AS NoUrut,
                (d.recd_qty * d.recd_harga * (100 - d.recd_discpr) / 100) AS Nilai
            FROM trec_dtl_penolong d
            LEFT JOIN tbarang_penolong b ON b.brg_kode = d.recd_brg_kode
            WHERE d.recd_rec_nomor = ?
            ORDER BY d.recd_nourut ASC
        `;
        const [details] = await pool.query(sqlDetail, [nomor]);

        return {
            ...headers[0],
            details
        };
    } catch (error) {
        throwDbError(`Gagal mengambil detail PO ${nomor}`, error);
    }
};

// 3. SAVE DATA (Insert / Update dengan ACID Transaction)
exports.savePO = async (payload = {}, userLogin = "SYSTEM") => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const {
            isEditMode, Nomor, Tanggal, Memo, SupKode, GdgKode,
            Disc, DiscPr, Total, PPN, isTax, Dateline, details = []
        } = payload;

        if (!SupKode) throw new Error("Supplier belum dipilih.");
        if (!GdgKode) throw new Error("Gudang belum dipilih.");
        if (!details.length) throw new Error("Item detail PO tidak boleh kosong.");

        let finalNomor = String(Nomor || "").trim();
        const taxFlag = Number(isTax) ? 1 : 0;

        if (isEditMode) {
            // Logika Update Header
            const sqlUpdate = `
                UPDATE tREC_hdr_penolong SET
                    rec_sup_kode = ?, rec_gdg_kode = ?, rec_memo = ?,
                    rec_disc_faktur = ?, rec_disc_fakturpr = ?, rec_amount = ?,
                    rec_taxamount = ?, rec_istax = ?, rec_dateline = ?,
                    date_modified = NOW(), user_modified = ?
                WHERE rec_nomor = ? AND rec_type = 1
            `;
            await conn.query(sqlUpdate, [
                SupKode, GdgKode, String(Memo || ""), Number(Disc || 0), Number(DiscPr || 0),
                Number(Total || 0), Number(PPN || 0), taxFlag, Dateline, userLogin, finalNomor
            ]);
        } else {
            // Generate nomor urut otomatis jika baru
            finalNomor = await generateMaxKode(conn, taxFlag, Tanggal);

            const sqlInsert = `
                INSERT INTO tREC_hdr_penolong (
                    rec_nomor, rec_tanggal, rec_memo, rec_sup_kode, rec_gdg_kode,
                    rec_disc_faktur, rec_disc_fakturpr, rec_amount, rec_taxamount,
                    rec_istax, rec_dateline, date_create, user_create, rec_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 1)
            `;
            await conn.query(sqlInsert, [
                finalNomor, Tanggal, String(Memo || ""), SupKode, GdgKode,
                Number(Disc || 0), Number(DiscPr || 0), Number(Total || 0), Number(PPN || 0),
                taxFlag, Dateline, userLogin
            ]);
        }

        // Hapus detail lama (Metode Replika Delphi: Delete then Insert)
        await conn.query(`DELETE FROM trec_dtl_penolong WHERE recd_rec_nomor = ?`, [finalNomor]);

        // Loop Insert Detail Item
        const sqlInsertDetail = `
            INSERT INTO trec_dtl_penolong (
                recd_rec_nomor, recd_brg_kode, recd_brg_satuan, recd_qty,
                recd_discpr, recd_harga, recd_keterangan, recd_nourut
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (let i = 0; i < details.length; i++) {
            const item = details[i];
            if (!item.SKU) throw new Error(`Baris ke-${i + 1}: SKU barang belum dipilih.`);
            if (!Number(item.QTY)) throw new Error(`Baris ke-${i + 1}: QTY tidak boleh kosong/nol.`);

            await conn.query(sqlInsertDetail, [
                finalNomor, item.SKU, String(item.Satuan || ""), Number(item.QTY || 0),
                Number(item.Disc || 0), Number(item.Harga || 0), String(item.Keterangan || ""), (i + 1)
            ]);
        }

        await conn.commit();
        return { nomor: finalNomor };
    } catch (error) {
        await conn.rollback();
        throwDbError("Gagal memproses transaksi PO Penolong", error);
    } finally {
        conn.release();
    }
};

// 4. LOOKUP BARANG PENOLONG (Bantuansku & initViewSKU di Delphi)
exports.getLookupSKU = async (keyword = "") => {
    try {
        const sql = `
            SELECT 
                brg_kode AS SKU,
                LEFT(brg_nama, 30) AS NamaBarang,
                brg_satuan AS Satuan,
                brg_gramasi AS Konstruksi,
                brg_lebar AS Lebar
            FROM tbarang_penolong
            WHERE (? = '' OR brg_kode LIKE ? OR brg_nama LIKE ?)
            ORDER BY brg_nama ASC
        `;
        const q = `%${keyword}%`;
        const [rows] = await pool.query(sql, [keyword, q, q]);
        return rows;
    } catch (error) {
        throwDbError("Gagal memuat lookup SKU barang penolong", error);
    }
};