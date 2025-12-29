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
exports.getPermintaanBahanData = async (startDate, endDate) => {
    try {
        // --- 1. Sub-query untuk menghitung total kuantitas dari Detail ---
        const sqlAggregates = `
            SELECT
                mbd_mb_nomor,
                SUM(mbd_qty) AS Total_Diminta,
                SUM(mbd_qty_po) AS Total_DiPO,
                SUM(mbd_qty_terima) AS Total_Diterima
            FROM tmintabahan_mmt_dtl
            GROUP BY mbd_mb_nomor
        `;

        const sqlMaster = `
            SELECT
                t1.mb_nomor AS Nomor,
                t1.mb_gdg_kode AS Gudang,
                t1.mb_to_user AS To_User,
                t1.mb_to_cab AS To_Cabang,
                t3.gdg_nama AS Nama,
                DATE_FORMAT(t1.mb_tanggal, '%d-%M-%Y') AS Tanggal,
                t1.mb_keterangan AS Keterangan,
                IFNULL(t2.user_nama, t1.user_create) AS Dibuat,
                t1.mb_acc_req AS Req_ACC,
                t1.mb_acc AS ACC,

                -- TAMBAHKAN LOGIKA STATUS ACC DI SINI --
                CASE 
                    WHEN t1.mb_acc = 'Y' THEN 'Acc Manager'
                    WHEN t1.mb_acc_req = 'Y' THEN 'Acc SPV'
                    ELSE 'PENDING'
                END AS Status_Acc,
                
                -- JOIN KE HASIL AGREGASI DETAIL
                t2.Total_Diminta,
                t2.Total_DiPO,
                t2.Total_Diterima,

                -- LOGIKA STATUS PO BARU
                CASE
                    WHEN t2.Total_DiPO = t2.Total_Diminta THEN 'CLOSED'
                    WHEN t2.Total_DiPO > 0 AND t2.Total_DiPO < t2.Total_Diminta THEN 'ONPROSES'
                    ELSE 'OPEN'
                END AS Status_PO,

                -- LOGIKA STATUS DITERIMA BARU
                CASE
                    WHEN t2.Total_Diterima >= t2.Total_Diminta THEN 'CLOSED'
                    WHEN t2.Total_Diterima > 0 AND t2.Total_Diterima < t2.Total_Diminta THEN 'ONPROSES'
                    ELSE 'OPEN'
                END AS Status_Diterima

            FROM tmintabahan_mmt_hdr t1
            LEFT JOIN (${sqlAggregates}) t2 ON t2.mbd_mb_nomor = t1.mb_nomor
            LEFT JOIN tgudang t3 ON t3.gdg_kode = t1.mb_gdg_kode
            LEFT JOIN tuser t2 ON t1.user_create = t2.user_kode
            WHERE t1.mb_tanggal BETWEEN ? AND ?
            ORDER BY t1.mb_tanggal DESC;
        `;

        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate]);
        const masterNomors = masterResults.map(row => row.Nomor);
        if (masterNomors.length === 0) return [];

        // Query Detail tetap sama
        const sqlDetail = `
            SELECT
                mbd_mb_nomor AS Nomor, mbd_spk_nomor AS Nomor_SPK, TRIM(spk_nama) AS spk_nama,
                brg_kode AS Kode, mbd_qty_terima AS Jumlah_terima, TRIM(brg_nama) AS Nama_Bahan, mbd_qty AS Jumlah,
                mbd_brg_satuan AS Satuan, brg_panjang AS Panjang, brg_lebar AS Lebar
            FROM tmintabahan_mmt_dtl
            LEFT JOIN tbarang_mmt ON mbd_brg_kode = brg_kode
            LEFT JOIN (SELECT spk_nomor, spk_nama FROM tspk UNION ALL SELECT mspk_nomor, mspk_nama from tmemospk) x ON x.spk_nomor=mbd_spk_nomor
            WHERE mbd_mb_nomor IN (?)
            ORDER BY mbd_mb_nomor, mbd_nourut;
        `;

        const [detailResults] = await pool.query(sqlDetail, [masterNomors]);

        const dataMap = new Map();
        masterResults.forEach(item => dataMap.set(item.Nomor, { ...item, Detail: [] }));
        detailResults.forEach(detail => {
            if (dataMap.has(detail.Nomor)) {
                dataMap.get(detail.Nomor).Detail.push(detail);
            }
        });

        return Array.from(dataMap.values());

    } catch (error) {
        throwDbError('Gagal mengambil data Permintaan Bahan', error);
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
exports.approveByManager = async (nomor, userKD) => {
    const sql = `
        UPDATE tmintabahan_mmt_hdr 
        SET mb_acc = 'Y', mb_acc_user = ?, date_modified = NOW() 
        WHERE mb_nomor = ? AND mb_acc_req = 'Y'
    `;
    // Syarat: Manager hanya bisa approve jika SPV sudah (mb_acc_req = 'Y')
    const [result] = await pool.query(sql, [userKD, nomor]);
    return result.affectedRows > 0;
};

exports.getPermintaanBahanByNomor = async (nomor) => {
    try {
        // 1. Ambil Header
        const sqlHeader = `
            SELECT
                mb_nomor AS Nomor, mb_tanggal AS Tanggal, mb_gdg_kode AS Gudang_Asal_Kode,
                tgudang.gdg_nama AS Gudang_Asal_Nama, mb_keterangan AS Keterangan,
                mb_acc_req AS Req_ACC, mb_acc_req_user AS Req_ACC_User,
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
                mbd_keterangan AS KeteranganItem
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
        // --- 1. AMBIL HEADER (Sama seperti sebelumnya) ---
        const sqlMaster = `
            SELECT
                mb_nomor AS Nomor,
                DATE_FORMAT(mb_tanggal, '%Y-%m-%d') AS Tanggal,
                mb_gdg_kode AS KodeGudang,
                gdg_nama AS NamaGudang,
                mb_keterangan AS Keterangan,
                mb_acc AS ACC
            FROM tmintabahan_mmt_hdr
            LEFT JOIN tgudang ON gdg_kode = mb_gdg_kode
            WHERE mb_close_po = 0
            ORDER BY mb_tanggal DESC, mb_nomor DESC;
        `;

        const filterStatus = (status === 'OPEN' || status === 'PENDING') ? 'N' : 'Y';
        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate, filterStatus]);

        // Jika tidak ada hasil header, segera kembalikan array kosong
        const masterNomors = masterResults.map(row => row.Nomor);
        if (masterNomors.length === 0) return [];


        // --- 2. AMBIL DETAIL (Menggunakan IN (?)) ---
        const sqlDetail = `
            SELECT
                mbd_mb_nomor AS Nomor, mbd_spk_nomor AS Nomor_SPK, TRIM(spk_nama) AS spk_nama,
                brg_kode AS Kode, TRIM(brg_nama) AS Nama_Bahan, mbd_qty AS Jumlah,
                mbd_brg_satuan AS Satuan, brg_panjang AS Panjang, brg_lebar AS Lebar
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

// backend/src/services/permintaanBahan.service.js

// backend/src/services/permintaanBahan.service.js

exports.generateMaxKode = async (tanggal) => {
    const NOMERATOR = 'MMT.MB';
    const yyMm = format(new Date(tanggal), 'yyMM');
    const prefix = `${NOMERATOR}.${yyMm}.%`;
    const sql = `SELECT MAX(CAST(RIGHT(mb_nomor, 4) AS UNSIGNED)) AS max_num FROM tmintabahan_mmt_hdr WHERE mb_nomor LIKE ?`;

    const [rows] = await pool.query(sql, [prefix]);

    const maxNum = rows[0].max_num ? parseInt(rows[0].max_num) : 0;

    // --- KOREKSI LOGIKA KRITIS: MENGGUNAKAN padStart ---
    const nextNumber = maxNum + 1; // Jika maxNum=1, nextNumber=2

    // Menghasilkan string 4 digit (misal: 2 menjadi '0002')
    const paddedNextNumber = String(nextNumber).padStart(4, '0');

    return `${NOMERATOR}.${yyMm}.${paddedNextNumber}`;
};
// ===================================
// SAVE (Insert / Update) - saveMintaMmt
// ===================================

// backend/src/services/permintaanBahan.service.js

// backend/src/services/permintaanBahan.service.js

// Perhatikan parameter ketiga: saya beri nama 'user'
exports.savePermintaanBahan = async (data, nomorToEdit, userLogin) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const currentNomor = nomorToEdit || await exports.generateMaxKode(data.Tanggal);
        const serverTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

        if (nomorToEdit) {
            // UPDATE HEADER
            const sqlUpdate = `
    UPDATE tmintabahan_mmt_hdr SET
        mb_gdg_kode   = ?,
        mb_tanggal    = ?,
        mb_to_user    = ?,
        mb_to_cab     = ?,
        mb_keterangan = ?,
        date_modified = ?,
        user_modified = ?
    WHERE mb_nomor = ?
`;

            await connection.query(sqlUpdate, [
                data.GudangKode,
                data.Tanggal,
                data.Kepada,
                data.Cabang,
                data.Keterangan,
                serverTime,
                userLogin,
                currentNomor
            ]);


            // 🔥 WAJIB: HAPUS DETAIL LAMA
            await connection.query(
                'DELETE FROM tmintabahan_mmt_dtl WHERE mbd_mb_nomor = ?',
                [currentNomor]
            );
        }
        else {
            const sqlInsert = `
                INSERT INTO tmintabahan_mmt_hdr 
                (
                    mb_nomor, mb_tanggal, mb_gdg_kode, mb_to_user, 
                    mb_to_cab, mb_keterangan, date_create, user_create, 
                    mb_acc_req, mb_acc_req_user
                ) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'N', NULL)
            `;
            await connection.query(sqlInsert, [
                currentNomor,
                data.Tanggal,
                data.GudangKode,
                data.Kepada,
                data.Cabang,
                data.Keterangan,
                serverTime,
                userLogin, // user_create (tetap terisi sebagai pembuat)
                // mb_acc_req_user sudah NULL di query string atas
            ]);
        }
        // --- INSERT DETAIL ---
        if (data.Detail && data.Detail.length > 0) {
            const detailValues = data.Detail.map((d, index) => [
                currentNomor, d.SPK || null, d.SKU, d.Satuan, d.QTY, d.KeteranganItem || null, index + 1
            ]);

            const sqlInsertDetail = `
                INSERT INTO tmintabahan_mmt_dtl 
                (mbd_mb_nomor, mbd_spk_nomor, mbd_brg_kode, mbd_brg_satuan, mbd_qty, mbd_keterangan, mbd_nourut) 
                VALUES ?
            `;
            await connection.query(sqlInsertDetail, [detailValues]);
        }

        await connection.commit();
        return { Nomor: currentNomor };

    } catch (error) {
        await connection.rollback();
        throw error; // Melempar error agar ditangkap oleh catch di Controller
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
                mbd_keterangan AS Keterangan, 
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