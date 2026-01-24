// backend/src/services/permintaanBahan.service.js

const pool = require('../config/db.config');
const { format } = require('date-fns');

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(message + ': ' + error.message);
};

// Helper: Generate Max Kode (Replikasi getmaxkode)

// ===================================
// READ ALL (getPermintaanBahanData)
// ===================================
exports.getInvoicePembelianData = async (startDate, endDate) => {
    try {
        // --- 1. Query Master (Header) ---
        const sqlMaster = `
            SELECT
                h.invp_nomor AS Nomor,
                DATE_FORMAT(h.invp_tanggal,'%d-%m-%Y') AS Tanggal,
                s.sup_nama AS Supplier,
                h.invp_status AS Status,
                IFNULL(SUM(d.invpd_jumlah * d.invpd_harga), 0) AS Total
            FROM tinvp_hdr h
            LEFT JOIN tsupplier s ON s.sup_kode = h.invp_sup_kode
            LEFT JOIN tinvp_dtl d ON d.invpd_inv_nomor = h.invp_nomor
            WHERE h.invp_tanggal BETWEEN ? AND ?
            GROUP BY h.invp_nomor, h.invp_tanggal, s.sup_nama, h.invp_status
            ORDER BY h.invp_tanggal DESC
        `;

        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate]);
        
        // Jika tidak ada data, langsung kembalikan array kosong
        if (masterResults.length === 0) return [];

        // Ambil semua nomor invoice untuk filter detail
        const masterNomors = masterResults.map(row => row.Nomor);

        // --- 2. Query Detail ---
        const sqlDetail = `
            SELECT
                invpd_inv_nomor AS Nomor,
                invpd_nourut AS NoUrut,
                invpd_brg_kode AS Kode,
                invpd_brg_nama AS Nama,
                invpd_satuan AS Satuan,
                invpd_jumlah AS Jumlah,
                invpd_harga AS Harga,
                (invpd_jumlah * invpd_harga) AS SubTotal
            FROM tinvp_dtl
            WHERE invpd_inv_nomor IN (?)
            ORDER BY invpd_inv_nomor, invpd_nourut
        `;

        const [detailResults] = await pool.query(sqlDetail, [masterNomors]);

        // --- 3. Mapping Data (Menggabungkan Master dan Detail) ---
        const dataMap = new Map();
        
        // Inisialisasi Map dengan data Header
        masterResults.forEach(item => {
            dataMap.set(item.Nomor, { 
                ...item, 
                Detail: [] 
            });
        });

        // Masukkan Detail ke dalam Header yang sesuai
        detailResults.forEach(detail => {
            if (dataMap.has(detail.Nomor)) {
                // Hapus properti 'Nomor' dari objek detail agar tidak double di dalam array
                const { Nomor, ...detailContent } = detail;
                dataMap.get(Nomor).Detail.push(detailContent);
            }
        });

        // Kembalikan hasil sebagai array
        return Array.from(dataMap.values());

    } catch (error) {
        throwDbError('Gagal mengambil data Invoice Pembelian', error);
    }
};

// Fungsi Approval oleh SPV
exports.approveBySPV = async (nomor, userKD) => {
    const sql = `
        UPDATE tmintabahan_mmt_hdr 
        SET mb_acc_req = 'Y', mb_acc_req_user = ?, date_modified = NOW() 
        WHERE mb_nomor = ?
    `;
    const [result] = await pool.query(sql, [userKD, nomor]);
    return result.affectedRows > 0;
};

// Fungsi Approval Final oleh Manager


exports.getPermintaanBahanByNomor = async (nomor) => {
    try {
        // 1. Ambil Header
        const sqlHeader = `
            SELECT
                mb_nomor AS Nomor, mb_tanggal AS Tanggal, mb_gdg_kode AS Gudang_Asal_Kode,
                tgudang.gdg_nama AS Gudang_Asal_Nama, mb_keterangan AS Keterangan,
                mb_acc_req AS Req_ACC, mb_acc_req_user AS Req_ACC_User, mb_to_user AS Kepada, mb_to_cab AS Cabang,
                mb_acc AS ACC, mb_acc_user AS Acc_User
            FROM tmintabahan_mmt_hdr
            LEFT JOIN tgudang ON tgudang.gdg_kode = mb_gdg_kode
            WHERE mb_nomor = ?;
        `;
        const [headerResults] = await pool.query(sqlHeader, [nomor]);

        if (headerResults.length === 0) {
            throw new Error(`Transaksi Permintaan Bahan dengan nomor ${nomor} tidak ditemukan.`);
        }

        const headerData = headerResults[0];

        // 2. Ambil Detail
        const sqlDetail = `
            SELECT
                mbd_nourut AS NoUrut, mbd_spk_nomor AS Nomor_SPK,
                (SELECT TRIM(spk_nama) FROM tspk WHERE spk_nomor = mbd_spk_nomor 
                 UNION ALL SELECT TRIM(mspk_nama) FROM tmemospk WHERE mspk_nomor = mbd_spk_nomor) AS spk_nama,
                mbd_brg_kode AS Kode, TRIM(tbarang_mmt.brg_nama) AS Nama_Bahan,
                mbd_qty AS Jumlah, mbd_brg_satuan AS Satuan,
                tbarang_mmt.brg_panjang AS Panjang, tbarang_mmt.brg_lebar AS Lebar,
                mbd_keterangan AS KeteranganItem,mbd_acc AS Is_Acc -- TAMBAHKAN INI
            FROM tmintabahan_mmt_dtl
            LEFT JOIN tbarang_mmt ON mbd_brg_kode = tbarang_mmt.brg_kode
            WHERE mbd_mb_nomor = ?
            ORDER BY mbd_nourut;
        `;
        const [detailResults] = await pool.query(sqlDetail, [nomor]);

        // 3. Gabungkan dan Kembalikan
        return {
            ...headerData,
            Detail: detailResults
        };

    } catch (error) {
        throwDbError(`Gagal mengambil data Permintaan Bahan (${nomor})`, error);
    }
};


exports.getPermintaanBahanForLookup = async (startDate, endDate, status = 'OPEN') => {
    try {
        const sqlMaster = `
SELECT
    h.mb_nomor AS Nomor,
    DATE_FORMAT(h.mb_tanggal, '%Y-%m-%d') AS Tanggal,
    h.mb_gdg_kode AS KodeGudang,
    g.gdg_nama AS NamaGudang,
    h.mb_keterangan AS Keterangan,
    h.mb_acc AS ACC,

    CASE
        WHEN IFNULL(a.Jml_Item_Acc,0) = 0 THEN 'OPEN'
        WHEN IFNULL(a.Total_DiPO,0) = 0 THEN 'OPEN'
        WHEN a.Total_DiPO >= a.Total_Diminta THEN 'CLOSE'
        ELSE 'PROGRESS'
    END AS Status_Proses

FROM tmintabahan_mmt_hdr h
LEFT JOIN tgudang g ON g.gdg_kode = h.mb_gdg_kode

LEFT JOIN (
    SELECT
        mbd_mb_nomor,
        SUM(CASE WHEN mbd_acc='Y' THEN mbd_qty ELSE 0 END) AS Total_Diminta,
        SUM(CASE WHEN mbd_acc='Y' THEN IFNULL(mbd_qty_po,0) ELSE 0 END) AS Total_DiPO,
        COUNT(CASE WHEN mbd_acc='Y' THEN 1 END) AS Jml_Item_Acc
    FROM tmintabahan_mmt_dtl
    GROUP BY mbd_mb_nomor
) a ON a.mbd_mb_nomor = h.mb_nomor

ORDER BY h.mb_tanggal DESC, h.mb_nomor DESC
`;


        const filterStatus = (status === 'OPEN' || status === 'PENDING') ? 'N' : 'Y';
        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate, filterStatus]);

        // Jika tidak ada hasil header, segera kembalikan array kosong
        const masterNomors = masterResults.map(row => row.Nomor);
        if (masterNomors.length === 0) return [];


        // --- 2. AMBIL DETAIL (Menggunakan IN (?)) ---
        const sqlDetail = `
    SELECT
        mbd_mb_nomor AS Nomor, 
        mbd_spk_nomor AS Nomor_SPK, 
        TRIM(spk_nama) AS spk_nama,
        brg_kode AS Kode, 
        TRIM(brg_nama) AS Nama_Bahan, 
        mbd_qty AS Jumlah,
        mbd_brg_satuan AS Satuan, 
        brg_panjang AS Panjang, 
        brg_lebar AS Lebar 
    FROM tmintabahan_mmt_dtl
    LEFT JOIN tbarang_mmt ON mbd_brg_kode = brg_kode
            LEFT JOIN (SELECT spk_nomor, spk_nama FROM tspk UNION ALL SELECT mspk_nomor, mspk_nama from tmemospk) x ON x.spk_nomor=mbd_spk_nomor
            WHERE mbd_mb_nomor IN (?)
            
            ORDER BY mbd_mb_nomor, mbd_nourut;
        `;
        const [detailResults] = await pool.query(sqlDetail, [masterNomors]);


        // --- 3. GABUNGKAN HEADER DAN DETAIL ---
        const dataMap = new Map();
        // Isi map dengan data header, inisialisasi Detail[]
        masterResults.forEach(item => dataMap.set(item.Nomor, { ...item, Detail: [] }));

        // Masukkan detail ke header yang sesuai
        detailResults.forEach(detail => {
            if (dataMap.has(detail.Nomor)) {
                dataMap.get(detail.Nomor).Detail.push(detail);
            }
        });

        // Kembalikan array hasil gabungan
        return Array.from(dataMap.values());


    } catch (error) {
        throwDbError('Gagal mengambil data Permintaan Bahan untuk Lookup', error);
    }
};


exports.deletePermintaanBahan = async (nomor) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Hapus Detail
        await connection.query('DELETE FROM tmintabahan_mmt_dtl WHERE mbd_mb_nomor = ?', [nomor]);

        // 2. Hapus Header
        const [result] = await connection.query('DELETE FROM tmintabahan_mmt_hdr WHERE mb_nomor = ?', [nomor]);

        await connection.commit();
        return result.affectedRows > 0;

    } catch (error) {
        await connection.rollback();
        throwDbError('Database Transaction Error on Delete', error);
    } finally {
        connection.release();
    }
};


exports.generateMaxKode = async (tanggal) => {
    const NOMERATOR = 'MMT.MB';
    const yyMm = format(new Date(tanggal), 'yyMM');
    const prefix = `${NOMERATOR}.${yyMm}.%`;
    const sql = `SELECT MAX(CAST(RIGHT(mb_nomor, 4) AS UNSIGNED)) AS max_num FROM tmintabahan_mmt_hdr WHERE mb_nomor LIKE ?`;

    const [rows] = await pool.query(sql, [prefix]);

    const maxNum = rows[0].max_num ? parseInt(rows[0].max_num) : 0;
    const nextNumber = maxNum + 1;
    const paddedNextNumber = String(nextNumber).padStart(4, '0');

    return `${NOMERATOR}.${yyMm}.${paddedNextNumber}`;
};
// ===================================
// SAVE (Insert / Update) - saveMintaMmt
// ===================================

// backend/src/services/permintaanBahan.service.js

// backend/src/services/permintaanBahan.service.js



exports.savePermintaanBahan = async (data, nomorToEdit, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const currentNomor = nomorToEdit || await exports.generateMaxKode(data.Tanggal);
        const serverTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

        // =====================================
        // AMBIL STATUS ACC DARI PENGAJUAN
        // =====================================
        let accSpv = 'N';
        let accSpvUser = null;

        if (data.NoPengajuan) {
            const [rows] = await connection.query(`
                SELECT 
                    pp_acc_req      AS acc,
                    pp_acc_req_user AS acc_user
                FROM tpengajuan_permintaan_hdr
                WHERE pp_nomor = ?
                LIMIT 1
            `, [data.NoPengajuan]);

            if (rows.length && rows[0].acc === 'Y') {
                accSpv = 'Y';
                accSpvUser = rows[0].acc_user;
            }
        }

        // =====================================
        // UPDATE / INSERT HEADER
        // =====================================
        if (nomorToEdit) {

            const sqlUpdate = `
    UPDATE tmintabahan_mmt_hdr SET
        mb_gdg_kode      = ?,
        mb_tanggal       = ?,
        mb_to_user       = ?,
        mb_to_cab        = ?,
        mb_priority      = ?,
        mb_keterangan    = ?,
        mb_acc_req       = ?,
        mb_acc_req_user  = ?,
        mb_pp_nomor      = ?,     
        date_modified    = ?,
        user_modified    = ?
    WHERE mb_nomor = ?
`;

await connection.query(sqlUpdate, [
    data.GudangKode,
    data.Tanggal,
    data.Kepada,
    data.Cabang,
    data.Priority,
    data.Keterangan,
    accSpv,
    accSpvUser,
    data.NoPengajuan || null,   
    serverTime,
    userLogin,
    currentNomor
]);


            await connection.query(
                'DELETE FROM tmintabahan_mmt_dtl WHERE mbd_mb_nomor = ?',
                [currentNomor]
            );

        } else {

            const sqlInsert = `
    INSERT INTO tmintabahan_mmt_hdr 
    (
        mb_nomor, mb_tanggal, mb_gdg_kode, mb_to_user, 
        mb_to_cab, mb_priority, mb_keterangan, 
        mb_pp_nomor,            
        date_create, user_create,
        mb_acc_req, mb_acc_req_user
    ) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

await connection.query(sqlInsert, [
    currentNomor,
    data.Tanggal,
    data.GudangKode,
    data.Kepada,
    data.Cabang,
    data.Priority,
    data.Keterangan,
    data.NoPengajuan || null,   
    serverTime,
    userLogin,
    accSpv,
    accSpvUser
]);

        }

        // =====================================
        // INSERT DETAIL (IKUT STATUS HEADER)
        // =====================================
        if (Array.isArray(data.Detail) && data.Detail.length > 0) {

            const detailValues = data.Detail.map((d, index) => [
                currentNomor,
                d.SPK || null,
                d.SKU,
                d.Satuan,
                d.QTY,
                d.KeteranganItem || null,
                index + 1,
                accSpv === 'Y' ? 'Y' : 'N'   // ✅ ikut header
            ]);

            const sqlInsertDetail = `
                INSERT INTO tmintabahan_mmt_dtl 
                (
                    mbd_mb_nomor, mbd_spk_nomor, mbd_brg_kode,
                    mbd_brg_satuan, mbd_qty, mbd_keterangan,
                    mbd_nourut, mbd_acc
                ) 
                VALUES ?
            `;

            await connection.query(sqlInsertDetail, [detailValues]);
        }

        await connection.commit();
        return { Nomor: currentNomor };

    } catch (error) {
        await connection.rollback();
        console.error("Error in savePermintaanBahan:", error);
        throw error;
    } finally {
        connection.release();
    }
};




exports.getPermintaanBahanForPrint = async (nomor) => {
    try {
        const sqlHeader = `
            SELECT
                t1.mb_nomor AS NoPermintaan,
                IFNULL(CONCAT(t1.mb_to_user, ' - ', t1.mb_to_cab), t1.mb_to_cab) AS Kepada,
                t1.mb_priority AS Priority,
                t1.mb_keterangan AS Keterangan,
                DATE_FORMAT(t1.mb_tanggal, '%d %M %Y') AS Tanggal, 
                
                -- MAPPING SESUAI REQUEST
                IFNULL(u1.user_nama, t1.user_create) AS Dibuat, 
                IFNULL(u2.user_nama, t1.mb_acc_req_user) AS Diketahui,
                IFNULL(u3.user_nama, t1.mb_acc_user) AS Disetujui
                
            FROM tmintabahan_mmt_hdr t1
            LEFT JOIN tuser u1 ON t1.user_create = u1.user_kode
            LEFT JOIN tuser u2 ON t1.mb_acc_req_user = u2.user_kode
            LEFT JOIN tuser u3 ON t1.mb_acc_user = u3.user_kode
            WHERE t1.mb_nomor = ?;
        `;

        const [headerResult] = await pool.query(sqlHeader, [nomor]);
        if (headerResult.length === 0) throw new Error("Data tidak ditemukan.");

        const header = headerResult[0];

        // Query Detail (Tetap sama seperti sebelumnya)
        const sqlDetail = `
            SELECT
                mbd_nourut AS No, mbd_spk_nomor AS SPK, 
                IF(brg_panjang IS NULL, TRIM(brg_nama), CONCAT(TRIM(brg_nama), ' (', brg_panjang, ' x ', brg_lebar, ')')) AS Jenis,
                mbd_keterangan AS Keterangan, mbd_acc AS Is_Acc,
                mbd_brg_satuan AS Satuan,
                mbd_qty AS QTY,
                CONCAT(mbd_qty, ' ', mbd_brg_satuan) AS Jumlah
            FROM tmintabahan_mmt_dtl
            LEFT JOIN tbarang_mmt ON mbd_brg_kode = brg_kode
            WHERE mbd_mb_nomor = ?
            ORDER BY mbd_nourut;
        `;
        const [detailResults] = await pool.query(sqlDetail, [nomor]);

        return {
            ...header,
            Details: detailResults,
            // Fallback jika nama kosong agar tampilan cetak rapi
            Dibuat: header.Dibuat || '................',
            Diketahui: header.Diketahui || '................',
            Disetujui: header.Disetujui || '................'
        };
    } catch (error) {
        throwDbError(`Gagal mengambil data cetak`, error);
    }
};

// backend/src/services/permintaanBahan.service.js

exports.approveByManager = async (nomor, userKD, itemApprovals) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Update Header: Set Manager ACC = 'Y'
        const sqlHeader = `
            UPDATE tmintabahan_mmt_hdr 
            SET mb_acc = 'Y', mb_acc_user = ?, date_modified = NOW() 
            WHERE mb_nomor = ? AND mb_acc_req = 'Y'
        `;
        const [headerResult] = await connection.query(sqlHeader, [userKD, nomor]);

        if (headerResult.affectedRows === 0) {
            throw new Error("Gagal ACC Header. Pastikan SPV sudah melakukan ACC terlebih dahulu.");
        }

        // 2. Update Detail: Loop melalui item yang dikirim dari frontend
        // itemApprovals diharapkan berisi: [{ sku: 'A', isAcc: true }, { sku: 'C', isAcc: false }]
        if (itemApprovals && itemApprovals.length > 0) {
            const queries = itemApprovals.map(item => {
                return connection.query(
                    `UPDATE tmintabahan_mmt_dtl 
                     SET mbd_acc = ? 
                     WHERE mbd_mb_nomor = ? AND mbd_brg_kode = ?`,
                    [item.isAcc ? 'Y' : 'N', nomor, item.sku]
                );
            });
            await Promise.all(queries);
        }

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};