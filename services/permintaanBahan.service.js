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
                t3.gdg_nama AS Nama,
                DATE_FORMAT(t1.mb_tanggal, '%d-%M-%Y') AS Tanggal,
                t1.mb_keterangan AS Keterangan,
                t1.mb_acc_req AS Req_ACC,
                t1.mb_acc AS ACC,
                
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
                    -- Jika Total Diterima == 0
                    ELSE 'OPEN'
                END AS Status_Diterima

            FROM tmintabahan_mmt_hdr t1
            LEFT JOIN (${sqlAggregates}) t2 ON t2.mbd_mb_nomor = t1.mb_nomor
            LEFT JOIN tgudang t3 ON t3.gdg_kode = t1.mb_gdg_kode
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

exports.savePermintaanBahan = async (data, nomorToEdit, user) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Ambil nomor atau generate nomor baru. Jika nomorToEdit null/undefined, generate.
    const currentNomor = nomorToEdit || await exports.generateMaxKode(data.Tanggal);
    const serverTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
    
    // Map status ACC
    const reqAcc = data.Req_ACC === true ? 'Y' : 'N';
    const acc = data.ACC === true ? 'Y' : 'N';

    if (nomorToEdit) {

      const sqlUpdate = `
        UPDATE tmintabahan_mmt_hdr SET
          mb_gdg_kode = ?, mb_tanggal = ?, mb_keterangan = ?, date_modified = ?, user_modified = ?,
          mb_acc_req = ?, mb_acc_req_user = ?, mb_acc = ?, mb_acc_user = ?
        WHERE mb_nomor = ?
      `;
      await connection.query(sqlUpdate, [
        data.GudangKode, data.Tanggal, data.Keterangan, serverTime, user,
        reqAcc, data.ReqAccUser, acc, data.AccUser, currentNomor
      ]);
      
      // Hapus Detail Lama
      await connection.query('DELETE FROM tmintabahan_mmt_dtl WHERE mbd_mb_nomor = ?', [currentNomor]);

    } else {
      const sqlInsert = `
        INSERT INTO tmintabahan_mmt_hdr 
        (mb_nomor, mb_tanggal, mb_gdg_kode, mb_keterangan, date_create, user_create, mb_acc_req, mb_acc_req_user, mb_acc, mb_acc_user) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await connection.query(sqlInsert, [
        currentNomor, data.Tanggal, data.GudangKode, data.Keterangan, serverTime, user,
        reqAcc, data.ReqAccUser, acc, data.AccUser
      ]);
    }
    
    // --- INSERT DETAIL BARU ---
    const detailValues = data.Detail.map((d, index) => [
      currentNomor, d.SPK || null, d.SKU, d.Satuan, d.QTY, d.KeteranganItem || null, index + 1
    ]);
        
        // Hanya jalankan INSERT Detail jika ada data
        if (detailValues.length > 0) {
            const sqlInsertDetail = `
                INSERT INTO tmintabahan_mmt_dtl 
                (mbd_mb_nomor, mbd_spk_nomor, mbd_brg_kode, mbd_brg_satuan, mbd_qty, mbd_keterangan, mbd_nourut) 
                VALUES ?
            `;
            await connection.query(sqlInsertDetail, [detailValues]); 
        }

    await connection.commit();
    return { Nomor: currentNomor, message: 'Data berhasil disimpan.' };
    
  } catch (error) {
    await connection.rollback();
    throwDbError('Gagal menyimpan transaksi Permintaan MMT', error);
  } finally {
    connection.release();
  }
};


exports.getPermintaanBahanForPrint = async (nomor) => {
    try {
        // --- 1. Ambil Data Header ---
        const sqlHeader = `
            SELECT
                mb_nomor AS NoPermintaan, 
                DATE_FORMAT(mb_tanggal, '%d %M %Y') AS Tanggal, 
                mb_acc_req_user AS Dibuat,
                mb_acc_user AS Menyetujui
            FROM tmintabahan_mmt_hdr
            WHERE mb_nomor = ?;
        `;
        const [headerResult] = await pool.query(sqlHeader, [nomor]);
        if (headerResult.length === 0) {
            throw new Error(`Data Permintaan MMT dengan nomor ${nomor} tidak ditemukan.`);
        }
        const header = headerResult[0];

        // --- 2. Ambil Data Detail ---
        const sqlDetail = `
            SELECT
    mbd_nourut AS No, 
    mbd_spk_nomor AS SPK, 
    CASE
        WHEN brg_panjang IS NULL AND brg_lebar IS NULL THEN
            TRIM(brg_nama)
        ELSE
            CONCAT(TRIM(brg_nama), ' (', brg_panjang, ' x ', brg_lebar, ')')
    END AS Jenis,
    mbd_keterangan AS Keterangan, 
    CONCAT(mbd_qty, ' ', mbd_brg_satuan) AS Jumlah
FROM tmintabahan_mmt_dtl
LEFT JOIN tbarang_mmt ON mbd_brg_kode = brg_kode
WHERE mbd_mb_nomor = ?
ORDER BY mbd_nourut;

        `;
        const [detailResults] = await pool.query(sqlDetail, [nomor]);

        // --- 3. Gabungkan dan Format Hasil (Sesuai Struktur Gambar) ---
        // Karena data detail pada gambar seringkali digrup, kita perlu logika formatting.
        
        let formattedDetails = [];
        let currentGroup = null;

        detailResults.forEach(item => {
            // Cek apakah item ini memulai grup baru (ada No. Urut)
            if (item.No !== null && item.No !== '') {
                // Jika ada grup sebelumnya, push dulu
                if (currentGroup) {
                    formattedDetails.push(...currentGroup);
                }
                
                // Mulai grup baru (Header item)
                currentGroup = [{
                    No: item.No,
                    SPK: item.SPK,
                    Jenis: item.Jenis,
                    Keterangan: item.Keterangan,
                    Jumlah: item.Jumlah
                }];

            } else {
                // Item adalah sub-detail (SPK/Jenis/No dikosongkan)
                currentGroup.push({
                    No: '', // Dikosongkan untuk baris sub-detail
                    SPK: '', 
                    Jenis: '', 
                    Keterangan: item.Keterangan, // Sub-keterangan (misal: warna C, M, Y, K)
                    Jumlah: item.Jumlah
                });
            }
        });

        // Push grup terakhir jika ada
        if (currentGroup) {
            formattedDetails.push(...currentGroup);
        }
        
        // --- Asumsi default user jika data ACC User kosong ---
        const DibuatText = header.Dibuat ? `(${header.Dibuat})` : '(TEAM MMT)';
        const DiketahuiText = header.Diketahui ? `(${header.Diketahui})` : '(SPV MMT)';
        const DisetujuiText = header.Disetujui ? `(${header.Disetujui})` : '(MANAGER PRODUKSI)';

        return {
            NoPermintaan: header.NoPermintaan,
            Tanggal: header.Tanggal,
            Details: formattedDetails,
            Dibuat: DibuatText,
            Diketahui: DiketahuiText,
            Disetujui: DisetujuiText,
        };

    } catch (error) {
        throwDbError(`Gagal mengambil data cetak Permintaan MMT untuk nomor ${nomor}`, error);
    }
};