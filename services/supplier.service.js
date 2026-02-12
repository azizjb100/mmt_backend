// backend/src/services/supplierService.js

const pool = require('../config/db.config'); 

const throwDbError = (message, error) => {
    console.error(message, error.message);
    throw new Error(message + ': ' + error.message);
};


const getNextNomor = async () => {
    try {
        const s = 'SELECT IFNULL(MAX(SUBSTR(sup_kode, 1, 5)), 0) AS jumlah FROM tsupplier';
        const [rows] = await pool.query(s);
        const ajumlah = 100001 + parseFloat(rows[0].jumlah);
        // Mengambil 5 digit terakhir (misal: 00002)
        return ajumlah.toString().substring(1);
    } catch (error) {
        throwDbError('Gagal generate nomor otomatis', error);
    }
};
// Replikasi logika SQLMaster dari ufrmBrowseSupplier.btnRefreshClick
exports.getSuppliers = async (keyword) => {
    try {
        let sql = `
            SELECT
                sup_kode AS Kode,
                sup_nama AS Nama,
                sup_alamat AS Alamat,
                sup_kota AS Kota,
                sup_telp AS Telp
            FROM tsupplier
        `;
        const params = [];
        
        // Menambahkan filter jika ada kata kunci pencarian
        if (keyword) {
            sql += `
                WHERE sup_kode LIKE ? OR sup_nama LIKE ?
            `;
            // Menyiapkan parameter untuk prepared statement
            const searchKeyword = `%${keyword}%`;
            params.push(searchKeyword, searchKeyword); 
        }

        sql += ` ORDER BY sup_nama`;
        
        const [rows] = await pool.query(sql, params);
        return rows;

    } catch (error) {
        throwDbError('Gagal mengambil data supplier dari database', error);
    }
};



// GET ALL (Replikasi SQLMaster Delphi)
exports.getSuppliers = async (keyword) => {
    try {
        let sql = `
            SELECT 
                sup_kode AS Kode, sup_nama AS Nama, sup_alamat AS Alamat, 
                sup_kota AS Kota, sup_fax AS Fax, sup_telp AS Telp, 
                sup_cp AS Contact, sup_targetmitra AS TargetMitra, 
                sup_ket AS Keterangan 
            FROM tsupplier
        `;
        const params = [];
        if (keyword) {
            sql += ` WHERE sup_kode LIKE ? OR sup_nama LIKE ?`;
            params.push(`%${keyword}%`, `%${keyword}%`);
        }
        sql += ` ORDER BY sup_nama`;
        const [rows] = await pool.query(sql, params);
        return rows;
    } catch (error) {
        throwDbError('Gagal mengambil data supplier', error);
    }
};

// GET BY KODE (Untuk Form Edit - loaddata di Delphi)
exports.getSupplierByKode = async (kode) => {
    const [rows] = await pool.query('SELECT * FROM tsupplier WHERE sup_kode = ?', [kode]);
    if (rows.length > 0) {
        const r = rows[0];
        // Mapping manual dari field database ke properti Frontend
        return {
            Kode: r.sup_kode,
            Nama: r.sup_nama,
            Alamat: r.sup_alamat,
            Kota: r.sup_kota,
            Telp: r.sup_telp,
            Fax: r.sup_fax,
            Contact: r.sup_cp,
            KodeNPWP: r.sup_npwp,
            NamaNPWP: r.sup_nama_npwp,
            AlamatNPWP: r.sup_alamat_npwp,
            KotaNPWP: r.sup_kota_npwp,
            Top: r.sup_top,
            NoRekening: r.sup_rekening,
            Bank: r.sup_bank,
            AtasNama: r.sup_atasnama,
            Cabang: r.sup_cabang,
            TargetMitra: r.sup_targetmitra,
            Keterangan: r.sup_ket,
            SaldoHutang: r.sup_hutang
        };
    }
    return null;
};

exports.saveSupplier = async (data, isUpdate) => {
    try {
        if (isUpdate) {
            // Logika UPDATE
            const sql = `UPDATE tsupplier SET 
                sup_nama = ?, sup_alamat = ?, sup_kota = ?, sup_telp = ?, sup_fax = ?, 
                sup_cp = ?, sup_npwp = ?, sup_nama_npwp = ?, sup_alamat_npwp = ?, 
                sup_kota_npwp = ?, sup_top = ?, sup_rekening = ?, sup_bank = ?, 
                sup_atasnama = ?, sup_cabang = ?, sup_targetmitra = ?, sup_ket = ?,
                date_modified = NOW(), user_modified = ?
                WHERE sup_kode = ?`;
            
            const params = [
                data.Nama, data.Alamat, data.Kota, data.Telp, data.Fax,
                data.Contact, data.KodeNPWP, data.NamaNPWP, data.AlamatNPWP,
                data.KotaNPWP, data.Top, data.NoRekening, data.Bank,
                data.AtasNama, data.Cabang, data.TargetMitra, data.Keterangan,
                data.User, data.Kode
            ];
            await pool.query(sql, params);
            return { kode: data.Kode };
        } else {
            // Logika INSERT + Get Nomor Otomatis
            const newKode = data.Kode || await getNextNomor();
            const sql = `INSERT INTO tsupplier 
                (sup_kode, sup_nama, sup_alamat, sup_kota, sup_telp, sup_fax, sup_cp, 
                sup_npwp, sup_nama_npwp, sup_alamat_npwp, sup_kota_npwp, sup_top, 
                sup_targetmitra, sup_rekening, sup_bank, sup_atasnama, sup_cabang, 
                sup_ket, user_create, date_create) 
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`;
            
            const params = [
                newKode, data.Nama, data.Alamat, data.Kota, data.Telp, data.Fax, data.Contact,
                data.KodeNPWP, data.NamaNPWP, data.AlamatNPWP, data.KotaNPWP, data.Top,
                data.TargetMitra, data.NoRekening, data.Bank, data.AtasNama, data.Cabang,
                data.Keterangan, data.User
            ];
            await pool.query(sql, params);
            return { kode: newKode };
        }
    } catch (error) {
        throwDbError('Gagal simpan data supplier', error);
    }
};


// DELETE
exports.deleteSupplier = async (kode) => {
    try {
        await pool.query('DELETE FROM tsupplier WHERE sup_kode = ?', [kode]);
        return true;
    } catch (error) {
        throwDbError('Gagal menghapus supplier', error);
    }
};