const pool = require("../config/db.config");

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(`${message}: ${error.message}`);
};

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toText = (value) => (value == null ? "" : String(value).trim());

const getNextNomor = async () => {
    try {
        const sql = "SELECT IFNULL(MAX(SUBSTR(sup_kode, 1, 5)), 0) AS jumlah FROM tsupplier";
        const [rows] = await pool.query(sql);
        const jumlah = toNumber(rows?.[0]?.jumlah, 0);
        const generated = 100001 + jumlah;
        return generated.toString().substring(1);
    } catch (error) {
        throwDbError("Gagal generate nomor otomatis", error);
    }
};

const getNextSupplierKode = async () => {
    const kode = await getNextNomor();
    return { kode };
};

const mapSupplierRow = (row) => ({
    Kode: row.sup_kode,
    Nama: row.sup_nama,
    Alamat: row.sup_alamat,
    Kota: row.sup_kota,
    Fax: row.sup_fax,
    Telp: row.sup_telp,
    Contact: row.sup_cp,
    TargetMitra: toNumber(row.sup_targetmitra, 0),
    Keterangan: row.sup_ket,
    KodeNPWP: row.sup_npwp,
    NamaNPWP: row.sup_nama_npwp,
    AlamatNPWP: row.sup_alamat_npwp,
    KotaNPWP: row.sup_kota_npwp,
    Top: toNumber(row.sup_top, 0),
    NoRekening: row.sup_rekening,
    Bank: row.sup_bank,
    AtasNama: row.sup_atasnama,
    Cabang: row.sup_cabang,
    SaldoHutang: toNumber(row.sup_hutang, 0),
});

const getSuppliers = async (keyword = "") => {
    try {
        let sql = `
            SELECT
                sup_kode,
                sup_nama,
                sup_alamat,
                sup_kota,
                sup_fax,
                sup_telp,
                sup_cp,
                sup_targetmitra,
                sup_ket,
                sup_npwp,
                sup_nama_npwp,
                sup_alamat_npwp,
                sup_kota_npwp,
                sup_top,
                sup_rekening,
                sup_bank,
                sup_atasnama,
                sup_cabang,
                sup_hutang
            FROM tsupplier
        `;
        const params = [];
        const q = toText(keyword);

        if (q) {
            sql += ` WHERE sup_kode LIKE ? OR sup_nama LIKE ? OR sup_kota LIKE ? OR sup_cp LIKE ?`;
            const kw = `%${q}%`;
            params.push(kw, kw, kw, kw);
        }

        sql += " ORDER BY sup_nama";
        const [rows] = await pool.query(sql, params);
        return rows.map(mapSupplierRow);
    } catch (error) {
        throwDbError("Gagal mengambil data supplier", error);
    }
};

const getSupplierByKode = async (kode) => {
    try {
        const [rows] = await pool.query("SELECT * FROM tsupplier WHERE sup_kode = ? LIMIT 1", [kode]);
        if (!rows.length) return null;
        return mapSupplierRow(rows[0]);
    } catch (error) {
        throwDbError("Gagal mengambil detail supplier", error);
    }
};

const saveSupplier = async (data, isUpdate, userLogin) => {
    try {
        const isEdit = Boolean(isUpdate);
        const user = toText(userLogin) || "SYSTEM";

        if (isEdit) {
            const kode = toText(data.Kode);
            const sql = `
                UPDATE tsupplier SET
                    sup_nama = ?,
                    sup_alamat = ?,
                    sup_kota = ?,
                    sup_telp = ?,
                    sup_fax = ?,
                    sup_cp = ?,
                    sup_npwp = ?,
                    sup_nama_npwp = ?,
                    sup_alamat_npwp = ?,
                    sup_kota_npwp = ?,
                    sup_top = ?,
                    sup_rekening = ?,
                    sup_bank = ?,
                    sup_atasnama = ?,
                    sup_cabang = ?,
                    sup_targetmitra = ?,
                    sup_ket = ?,
                    date_modified = NOW(),
                    user_modified = ?
                WHERE sup_kode = ?
            `;

            const params = [
                toText(data.Nama),
                toText(data.Alamat),
                toText(data.Kota),
                toText(data.Telp),
                toText(data.Fax),
                toText(data.Contact),
                toText(data.KodeNPWP),
                toText(data.NamaNPWP),
                toText(data.AlamatNPWP),
                toText(data.KotaNPWP),
                toNumber(data.Top, 0),
                toText(data.NoRekening),
                toText(data.Bank),
                toText(data.AtasNama),
                toText(data.Cabang),
                toNumber(data.TargetMitra, 0),
                toText(data.Keterangan),
                user,
                kode,
            ];

            const [result] = await pool.query(sql, params);
            if (!result.affectedRows) {
                throw new Error(`Supplier dengan kode ${kode} tidak ditemukan`);
            }
            return { kode };
        }

        const newKode = await getNextNomor();
        const sql = `
            INSERT INTO tsupplier (
                sup_kode,
                sup_nama,
                sup_alamat,
                sup_kota,
                sup_telp,
                sup_fax,
                sup_cp,
                sup_npwp,
                sup_nama_npwp,
                sup_alamat_npwp,
                sup_kota_npwp,
                sup_top,
                sup_targetmitra,
                sup_rekening,
                sup_bank,
                sup_atasnama,
                sup_cabang,
                sup_ket,
                user_create,
                date_create
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())
        `;

        const params = [
            newKode,
            toText(data.Nama),
            toText(data.Alamat),
            toText(data.Kota),
            toText(data.Telp),
            toText(data.Fax),
            toText(data.Contact),
            toText(data.KodeNPWP),
            toText(data.NamaNPWP),
            toText(data.AlamatNPWP),
            toText(data.KotaNPWP),
            toNumber(data.Top, 0),
            toNumber(data.TargetMitra, 0),
            toText(data.NoRekening),
            toText(data.Bank),
            toText(data.AtasNama),
            toText(data.Cabang),
            toText(data.Keterangan),
            user,
        ];

        await pool.query(sql, params);
        return { kode: newKode };
    } catch (error) {
        throwDbError("Gagal simpan data supplier", error);
    }
};

const deleteSupplier = async (kode) => {
    try {
        const [result] = await pool.query("DELETE FROM tsupplier WHERE sup_kode = ?", [kode]);
        return result.affectedRows > 0;
    } catch (error) {
        throwDbError("Gagal menghapus supplier", error);
    }
};

module.exports = {
    getNextSupplierKode,
    getSuppliers,
    getSupplierByKode,
    saveSupplier,
    deleteSupplier,
};
