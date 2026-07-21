const pool = require("../../config/db.config");

const throwDbError = (message, error) => {
    throw new Error(message + ": " + error.message);
};

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const normalizeStatus = (status) => {
    const allowed = ["F", "S", "P", "B", "N", "-"];
    const s = String(status || "").trim().toUpperCase();
    return allowed.includes(s) ? s : "S";
};

exports.getBahanData = async ({ zdivisi = null, keyword = "" } = {}) => {
    try {
        // Query disesuaikan 100% dengan kebutuhan browse spanduk Delphi asli kamu
        let sql = `
            SELECT  
                gdg.gdg_nama AS GUDANG,  
                divs.divisi AS DIVISI, 
                ktg.ktg_nama AS KTGORI, 
                brg.brg_kode AS KODE,
                brg.brg_nama AS \`NAMA BARANG\`, 
                jns.jb_nama AS JENIS, 
                sup.sup_nama AS SUPPLIER, 
                brg.brg_gramasi AS KONSTRUKSI,
                brg.brg_panjang AS PANJANG,
                brg.brg_lebar AS LEBAR, 
                brg.brg_satuan AS SATUAN,
                IF(brg.brg_status = 'F', CONCAT('FM', ROUND(brg.brg_lebar * 100)), 
                    IF(brg.brg_status = 'S', CONCAT('SM', ROUND(brg.brg_lebar * 100)), 
                        IF(brg.brg_status = 'P', CONCAT('SA', ROUND(brg.brg_lebar * 100)), 
                            IF(brg.brg_status = 'B', CONCAT('BA', ROUND(brg.brg_lebar * 100)), 
                                CONCAT(brg.brg_status, ROUND(brg.brg_lebar * 100))
                            )
                        )
                    )
                ) AS STATUS,  
                IF(brg.brg_ktg_kode = 1, IFNULL(x.stock_1, 0), IFNULL(y.stock_2, 0)) AS STOK 
            FROM tbarang_NEW brg
            LEFT JOIN (
                SELECT 
                    mst_brg_kode, 
                    SUM(IFNULL(mst_stok_in, 0) - IFNULL(mst_stok_out, 0)) AS stock_1 
                FROM tmasterstok_NEW 
                GROUP BY mst_brg_kode
            ) x ON x.mst_brg_kode = brg.brg_kode 
            LEFT JOIN (
                SELECT 
                    mst_brg_kode, 
                    SUM(IFNULL(mst_stok_in, 0) - IFNULL(mst_stok_out, 0)) AS stock_2 
                FROM tmasterstok_penolong 
                GROUP BY mst_brg_kode
            ) y ON y.mst_brg_kode = brg.brg_kode 
            LEFT JOIN tkategori     ktg  ON ktg.ktg_kode = brg.brg_ktg_kode
            LEFT JOIN tgroup        gr   ON gr.gr_kode = brg.brg_gr_kode
            LEFT JOIN tjenisbarang  jns  ON jns.jb_kode = brg.brg_jenis
            LEFT JOIN tsupplier     sup  ON sup.sup_kode = brg.brg_sup_kode
            LEFT JOIN tgudang       gdg  ON gdg.gdg_kode = brg.brg_gdg_default
            LEFT JOIN tdivisi       divs ON divs.kode = brg.brg_divisi
            WHERE 1=1
        `;

        const params = [];

        // Dinamisasi filter divisi dari parameter request frontend vue
        if (zdivisi !== null) {
            const z = Number(zdivisi);
            if (z === 1) {
                sql += ` AND brg.brg_divisi IN (1, 5) `;
            } else if (z === 4) {
                sql += ` AND brg.brg_divisi IN (3, 4) `;
            }
        } else {
            // Default bawaan delphi spanduk kalau zdivisi kosong
            sql += ` AND brg.brg_divisi IN (1, 5) `;
        }

        // Jalankan global live filter keyword pencarian nama/kode barang
        if (keyword) {
            sql += ` AND (brg.brg_kode LIKE ? OR brg.brg_nama LIKE ?) `;
            const q = `%${keyword}%`;
            params.push(q, q);
        }

        sql += ` ORDER BY brg.brg_kode ASC `;

        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError("Gagal mengambil data Master Barang Spanduk", error);
    }
};

exports.getBahanByKode = async (kode) => {
    try {
        const sql = `
            SELECT
                b.brg_kode AS Kode,
                b.brg_nama AS Nama,
                b.brg_satuan AS Satuan,
                b.brg_satuan_harga,
                COALESCE(b.brg_hrgbeli, 0) AS HrgBeli,
                COALESCE(b.brg_hrgjual, 0) AS HrgJual,
                COALESCE(b.brg_gramasi, '') AS Gramasi,
                b.brg_panjang AS Panjang,
                b.brg_lebar AS Lebar,
                COALESCE(b.brg_stok, 0) AS Stok,
                b.brg_gdg_default AS GdgDefault,
                b.brg_sup_kode AS SupKode,
                b.brg_jenis AS Jenis,
                b.brg_ktg_kode AS KtgKode,
                COALESCE(b.brg_divisi, '') AS Divisi,
                COALESCE(b.brg_isaktif, 0) AS isAktif,
                COALESCE(b.brg_isstok, 0) AS isStok,
                COALESCE(b.brg_isexpired, 0) AS isExpired,
                COALESCE(b.brg_status, 'S') AS Status,
                COALESCE(g.gdg_nama, '') AS GudangNama,
                COALESCE(s.sup_nama, '') AS SupplierNama,
                COALESCE(j.jb_nama, '') AS JenisNama,
                COALESCE(k.ktg_nama, '') AS TipeNama,
                COALESCE(d.divisi, '') AS DivisiNama
            FROM tbarang_mmt b
            LEFT JOIN tgudang g ON g.gdg_kode = b.brg_gdg_default
            LEFT JOIN tsupplier s ON s.sup_kode = b.brg_sup_kode
            LEFT JOIN tjenisbarang j ON j.jb_kode = b.brg_jenis
            LEFT JOIN tkategori k ON k.ktg_kode = b.brg_ktg_kode
            LEFT JOIN tdivisi d ON d.kode = b.brg_divisi
            WHERE b.brg_kode = ?
            LIMIT 1
        `;

        const [rows] = await pool.query(sql, [kode]);
        if (!rows.length) throw new Error("Kode Barang tidak ditemukan.");
        return rows[0];
    } catch (error) {
        throwDbError(`Gagal memuat detail Barang dengan kode ${kode}`, error);
    }
};

exports.saveBahan = async (payload = {}, userLogin = "SYSTEM") => {
    try {
        const {
            Kode, Nama, Satuan, Gramasi, Panjang, Lebar, KtgKode,
            GdgDefault, SupKode, HrgJual, HrgBeli, isAktif, isStok,
            isExpired, Status, Jenis, Divisi, isEditMode
        } = payload;

        const kode = String(Kode || "").trim();
        const nama = String(Nama || "").trim();

        if (kode.length < 3) throw new Error("Kode Barang minimal 3 karakter.");
        if (!nama) throw new Error("Nama Barang wajib diisi.");

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            const commonValues = [
                nama, String(Jenis || "").trim(), String(Satuan || "").trim(),
                String(Gramasi || "").trim(), toNumber(Panjang, 0), toNumber(Lebar, 0), 0,
                String(KtgKode || "").trim(), String(GdgDefault || "WH-16").trim(),
                String(SupKode || "").trim(), toNumber(HrgJual, 0), toNumber(HrgBeli, 0),
                Number(isAktif) ? 1 : 0, Number(isStok) ? 1 : 0, Number(Divisi || 0),
                Number(isExpired) ? 1 : 0, normalizeStatus(Status)
            ];

            if (isEditMode) {
                const sqlUpdate = `
                    UPDATE tbarang_mmt SET
                        brg_nama = ?, brg_jenis = ?, brg_satuan = ?, brg_gramasi = ?,
                        brg_panjang = ?, brg_lebar = ?, brg_stok = ?, brg_ktg_kode = ?,
                        brg_gdg_default = ?, brg_sup_kode = ?, brg_hrgjual = ?, brg_hrgbeli = ?,
                        brg_isaktif = ?, brg_isstok = ?, brg_divisi = ?, brg_isexpired = ?,
                        brg_status = ?, date_modified = NOW(), user_modified = ?
                    WHERE brg_kode = ?
                `;
                const [result] = await conn.query(sqlUpdate, [...commonValues, userLogin, kode]);
                if (!result.affectedRows) throw new Error("Data barang yang diubah tidak ditemukan.");
            } else {
                const sqlInsert = `
                    INSERT INTO tbarang_mmt (
                        brg_kode, brg_nama, brg_satuan, brg_gramasi, brg_panjang,
                        brg_lebar, brg_stok, brg_ktg_kode, brg_gdg_default, brg_sup_kode,
                        brg_hrgjual, brg_hrgbeli, brg_isaktif, brg_isstok,
                        brg_isexpired, date_create, user_create, brg_status,
                        brg_jenis, brg_divisi
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)
                `;
                await conn.query(sqlInsert, [
                    kode, nama, String(Satuan || "").trim(), String(Gramasi || "").trim(),
                    toNumber(Panjang, 0), toNumber(Lebar, 0), 0, String(KtgKode || "").trim(),
                    String(GdgDefault || "WH-16").trim(), String(SupKode || "").trim(),
                    toNumber(HrgJual, 0), toNumber(HrgBeli, 0), Number(isAktif) ? 1 : 0,
                    Number(isStok) ? 1 : 0, Number(isExpired) ? 1 : 0, userLogin,
                    normalizeStatus(Status), String(Jenis || "").trim(), Number(Divisi || 0)
                ]);
            }

            await conn.commit();
            return { kode };
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }
    } catch (error) {
        throwDbError("Gagal simpan Master Barang", error);
    }
};

exports.getLookupKategori = async (keyword = "") => {
    try {
        const sql = `
            SELECT ktg_kode AS Kode, ktg_nama AS Nama
            FROM tkategori
            WHERE LENGTH(ktg_kode) > 1
                AND (? = '' OR ktg_kode LIKE ? OR ktg_nama LIKE ?)
            ORDER BY ktg_nama
        `;
        const q = `%${keyword}%`;
        const [rows] = await pool.query(sql, [keyword, q, q]);
        return rows;
    } catch (error) {
        throwDbError("Gagal mengambil lookup kategori", error);
    }
};

exports.getLookupGudang = async (keyword = "") => {
    try {
        const sql = `
            SELECT gdg_kode AS Kode, gdg_nama AS Nama
            FROM tgudang
            WHERE gdg_kode LIKE 'WH-%'
                AND (? = '' OR gdg_kode LIKE ? OR gdg_nama LIKE ?)
            ORDER BY gdg_kode
        `;
        const q = `%${keyword}%`;
        const [rows] = await pool.query(sql, [keyword, q, q]);
        return rows;
    } catch (error) {
        throwDbError("Gagal mengambil lookup gudang", error);
    }
};

exports.getLookupSupplier = async (keyword = "") => {
    try {
        const sql = `
            SELECT sup_kode AS Kode, sup_nama AS Nama
            FROM tsupplier
            WHERE (? = '' OR sup_kode LIKE ? OR sup_nama LIKE ?)
            ORDER BY sup_nama
        `;
        const q = `%${keyword}%`;
        const [rows] = await pool.query(sql, [keyword, q, q]);
        return rows;
    } catch (error) {
        throwDbError("Gagal mengambil lookup supplier", error);
    }
};

exports.getLookupJenis = async (keyword = "") => {
    try {
        const sql = `
            SELECT jb_kode AS Kode, jb_nama AS Nama
            FROM tjenisbarang
            WHERE (? = '' OR jb_kode LIKE ? OR jb_nama LIKE ?)
            ORDER BY jb_nama
        `;
        const q = `%${keyword}%`;
        const [rows] = await pool.query(sql, [keyword, q, q]);
        return rows;
    } catch (error) {
        throwDbError("Gagal mengambil lookup jenis", error);
    }
};

exports.getLookupDivisi = async (keyword = "") => {
    try {
        // PERBAIKAN: Query SQL ditambahkan klausul WHERE agar filtering 'LIKE' berfungsi penuh
        const sql = `
            SELECT kode AS Kode, divisi AS Nama
            FROM tdivisi
            WHERE (? = '' OR kode LIKE ? OR divisi LIKE ?)
            ORDER BY kode
        `;
        const q = `%${keyword}%`;
        const [rows] = await pool.query(sql, [keyword, q, q]);
        return rows;
    } catch (error) {
        throwDbError("Gagal mengambil lookup divisi", error);
    }
};

exports.getBahanDetailByKodeMmt = async (kode) => {
    try {
        const sql = `
            SELECT brg_kode AS Kode, brg_nama AS Nama, brg_satuan AS Satuan,
                   brg_panjang AS Panjang, brg_lebar AS Lebar, brg_jenis AS Jenis,
                   brg_ktg_kode AS KtgKode, brg_divisi AS Divisi, brg_gdg_default AS GdgDefault,
                   brg_sup_kode AS SupKode
            FROM tbarang_mmt 
            WHERE brg_kode = ?;
        `;
        const [rows] = await pool.query(sql, [kode]);
        if (rows.length === 0) throw new Error("Kode Bahan tidak ditemukan.");
        return rows[0];
    } catch (error) {
        throwDbError(`Gagal memuat detail Bahan dengan kode ${kode}`, error);
    }
};

exports.getLookupGdgProduksiMMT = async (keyword) => {
    try {
        let sql = `
            SELECT b.brg_kode AS Kode, b.brg_nama AS Nama, b.brg_jenis AS Jenis,
                   b.brg_satuan AS Satuan, b.brg_lebar AS Lebar,
                   COALESCE(s.mst_panjang, b.brg_panjang) AS Panjang,
                   COALESCE(SUM(s.mst_stok_in) - SUM(s.mst_stok_out), 0) AS Stok
            FROM tbarang_mmt b
            LEFT JOIN tmasterstok_mmt s ON s.mst_brg_kode = b.brg_kode AND s.mst_gdg_kode = 'GPM'
            WHERE 1=1
        `;
        const params = [];
        if (keyword) {
            sql += ` AND (b.brg_kode LIKE ? OR b.brg_nama LIKE ?) `;
            const key = `%${keyword}%`;
            params.push(key, key);
        }
        sql += `
            GROUP BY b.brg_kode, b.brg_nama, b.brg_jenis, b.brg_satuan, b.brg_lebar, COALESCE(s.mst_panjang, b.brg_panjang)
            HAVING Stok > 0
            ORDER BY Nama ASC, Panjang DESC
        `;
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError("Gagal mengambil data lookup master & sisa produksi", error);
    }
};