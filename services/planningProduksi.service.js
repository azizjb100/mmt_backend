// backend/src/services/planningProduksi.service.js

const pool = require('../config/db.config');

/**
 * Mengambil data Planning Produksi MMT
 * Sesuai dengan prosedur btnRefreshClick di Delphi
 */
exports.getPlanningProduksiData = async (startDate, endDate) => {
    try {
        // --- 1. Query Master (Persis SQL di Delphi s) ---
        // Menghitung SUM detail di awal agar data master memiliki total status
        const sqlMaster = `
            SELECT 
                s.spk_nomor AS Nomor,
                s.spk_dateline AS Dateline,
                s.spk_tipe AS Tipe,
                s.spk_cab AS Cab,
                s.spk_statuskerja AS Kepentingan,
                s.spk_nama AS NamaSPK, 
                s.spk_panjang AS Panjang, 
                s.spk_lebar AS Lebar, 
                s.spk_jumlah AS JumlahSPK,
                s.spk_kain AS Bahan,
                s.spk_finishing AS Finishing,
                IFNULL(p.Plan_Bahan_Datang, 0) AS Plan_Bhn_Datang,
                IFNULL(p.Plan_Cetak, 0) AS Plancetak,
                IFNULL(p.Plan_Finishing, 0) AS Plan_finishing,
                IFNULL(p.Plan_Kirim, 0) AS Plan_kirim
            FROM tspk s
            LEFT JOIN (
                SELECT 
                    plan_spk,
                    SUM(plan_datang) AS Plan_Bahan_Datang,
                    SUM(plan_cetak) AS Plan_Cetak, 
                    SUM(plan_finishing) AS Plan_Finishing,
                    SUM(plan_kirim) AS Plan_Kirim
                FROM tplanningspk_mmt
                GROUP BY plan_spk
            ) p ON p.plan_spk = s.spk_nomor
            WHERE s.spk_cmo <> "" 
              AND s.spk_aktif = "Y" 
              AND s.spk_divisi IN (5) 
              AND s.spk_jo_kode IN ("MT")
              AND DATE(s.spk_tanggal) BETWEEN ? AND ?
            ORDER BY s.date_create
        `;

        const [masterResults] = await pool.query(sqlMaster, [startDate, endDate]);

        if (masterResults.length === 0) return [];

        const masterNomors = masterResults.map(row => row.Nomor);

        // --- 2. Query Detail (Persis SQL di Delphi s untuk detail) ---
        const sqlDetail = `
            SELECT 
                p.plan_spk AS Nomor,
                p.plan_tanggal AS TglEstimasi,
                p.plan_datang AS Bahan_Datang, 
                p.plan_mesin AS Mesin, 
                p.plan_cetak AS Cetak, 
                p.plan_finishing AS Finishing,
                p.plan_kirim AS Kirim,
                p.plan_ketcetak AS Ket_Cetak,
                p.plan_ketfinishing AS Ket_Finishing,
                p.plan_ketkirim AS Ket_Kirim
            FROM tplanningspk_mmt p 
            WHERE p.plan_spk IN (?)
            ORDER BY p.plan_spk, p.plan_tanggal
        `;

        const [detailResults] = await pool.query(sqlDetail, [masterNomors]);

        // --- 3. Mapping Data (Master-Detail Structure) ---
        const result = masterResults.map(master => {
            return {
                ...master,
                // Filter detail yang miliki nomor SPK yang sama
                Detail: detailResults.filter(dtl => dtl.Nomor === master.Nomor)
            };
        });

        return result;

    } catch (error) {
        console.error("Error in getPlanningProduksiData:", error.message);
        throw new Error(`Gagal memuat Planning Produksi: ${error.message}`);
    }
};

/**
 * Mengambil satu data SPK untuk diedit (Replikasi loaddataall)
 */
exports.getPlanningByNomor = async (nomor) => {
    try {
        const [rows] = await pool.query("SELECT * FROM tspk WHERE spk_nomor = ?", [nomor]);
        if (rows.length === 0) throw new Error("Data tidak ditemukan");
        
        const [details] = await pool.query("SELECT * FROM tplanningspk_mmt WHERE plan_spk = ?", [nomor]);
        
        return {
            ...rows[0],
            Detail: details
        };
    } catch (error) {
        throw new Error(`Database Error: ${error.message}`);
    }
};

exports.savePlanningProduksi = async (payload) => {
    const { spk_nomor, panjang, lebar, details, forceSave = false } = payload;
    const connection = await pool.getConnection(); // Ambil koneksi manual untuk Transaksi
    
    try {
        await connection.beginTransaction();

        // -----------------------------------------------------------------
        // LAHNGKAH 1: Validasi Kapasitas Harian Mesin (Kecuali jika forceSave = true)
        // -----------------------------------------------------------------
        if (!forceSave) {
            // Ambil kapasitas maksimal semua mesin cetak dari tmesin_mmt
            const [mesinKapasitas] = await connection.query(
                'SELECT msn_kode, msn_kapasitas FROM tmesin_mmt WHERE msn_jenis = "C" AND msn_note = "CETAK"'
            );

            // Mapping kapasitas ke object key-value agar mudah diakses: { MT01: 500, MT02: 400, ... }
            const kapasitasMap = {};
            mesinKapasitas.forEach(m => {
                kapasitasMap[m.msn_kode] = parseFloat(m.msn_kapasitas) || 0;
            });

            // Loop setiap detail yang dikirim dari Vue untuk divalidasi kapasitasnya
            for (const row of details) {
                if (!row.mesin || !row.tanggal) continue;

                // Hitung total plan_cetak yang SUDAH ADA di database untuk tanggal & mesin tersebut (milik SPK lain)
                const [existingPlan] = await connection.query(
                    `SELECT SUM(plan_cetak) AS total_cetak 
                     FROM tplanningspk_mmt 
                     WHERE plan_tanggal = ? AND plan_mesin = ? AND plan_spk <> ?`,
                    [row.tanggal, row.mesin, spk_nomor]
                );

                const currentCetakDb = parseFloat(existingPlan[0].total_cetak) || 0;
                const inputCetakBaru = parseFloat(row.cetak) || 0;
                const kapasitasMax = kapasitasMap[row.mesin] || 0;

                // Formula Delphi: (Total database + input baru) jika melebihi kapasitas
                if (kapasitasMax > 0 && (currentCetakDb + inputCetakBaru) > kapasitasMax) {
                    // Hitung Luas Planning dalam M2 berdasarkan rumus Delphi: (jml * panjang * lebar)
                    const totalM2Planning = (currentCetakDb + inputCetakBaru) * parseFloat(panjang) * parseFloat(lebar);
                    
                    // Kembalikan flag alert ke frontend (Vue) agar memicu confirm dialog
                    await connection.rollback();
                    connection.release();
                    return {
                        overCapacityAlert: true,
                        message: `Tanggal ${row.tanggal}, Mesin: ${row.mesin} Melebihi Kapasitas produksi!\n` +
                                 `Kapasitas/Hari = ${kapasitasMax} M2\n` +
                                 `Planning cetak saat ini = ${totalM2Planning.toFixed(2)} M2`
                    };
                }
            }
        }

        // -----------------------------------------------------------------
        // LANGKAH 2: Bersihkan data lama berdasarkan nomor SPK (Delete Old Record)
        // -----------------------------------------------------------------
        await connection.query("DELETE FROM tplanningspk_mmt WHERE plan_spk = ?", [spk_nomor]);

        // -----------------------------------------------------------------
        // LANGKAH 3: Simpan Data Baru (Insert New Detail Loops)
        // -----------------------------------------------------------------
        const insertSql = `
            INSERT INTO tplanningspk_mmt 
            (plan_spk, plan_tanggal, plan_datang, plan_mesin, plan_cetak, plan_finishing, plan_kirim, plan_ketcetak, plan_ketfinishing, plan_ketkirim, plan_usr, plan_dtusr)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const row of details) {
            // Abaikan jika baris kosong / tidak ada mesin terpilih
            if (!row.mesin) continue; 

            await connection.query(insertSql, [
                spk_nomor,
                row.tanggal,
                parseFloat(row.datang) || 0,
                row.mesin,
                parseFloat(row.cetak) || 0,
                parseFloat(row.finishing) || 0,
                parseFloat(row.kirim) || 0,
                row.ketcetak || '',
                row.ketfinishing || '',
                row.ketkirim || '',
                row.usr || 'SYSTEM',
                row.dtusr || new Date()
            ]);
        }

        await connection.commit();
        connection.release();
        return { success: true, message: "Planning berhasil disimpan" };

    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error("Error in savePlanningProduksi:", error);
        throw new Error(error.message);
    }
};