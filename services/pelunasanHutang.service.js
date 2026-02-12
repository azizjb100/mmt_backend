// backend/src/services/pelunasan.service.js
exports.bayarHutang = async (payData) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const { NoBayar, TglBayar, NoInvoice, JumlahBayar, AkunKas, User } = payData;

        // 1. Catat Pelunasan
        await connection.query('INSERT INTO tpembayaran_hutang (pay_nomor, pay_tgl, pay_inv_nomor, pay_jumlah, pay_user) VALUES (?,?,?,?,?)',
        [NoBayar, TglBayar, NoInvoice, JumlahBayar, User]);

        // 2. Jurnal Pelunasan
        // Debit: Hutang (Mengurangi hutang)
        await connection.query('INSERT INTO tjurnal (jur_tgl, jur_akun, jur_debit, jur_referensi) VALUES (?,?,?,?)',
        [TglBayar, '2101', JumlahBayar, NoBayar]);
        
        // Kredit: Kas/Bank (Akun dari input)
        await connection.query('INSERT INTO tjurnal (jur_tgl, jur_akun, jur_kredit, jur_referensi) VALUES (?,?,?,?)',
        [TglBayar, AkunKas, JumlahBayar, NoBayar]);

        // 3. Update Status Invoice jika sudah lunas (Simple logic)
        await connection.query('UPDATE tinvoice_pembelian SET inv_status="CLOSED" WHERE inv_nomor=?', [NoInvoice]);

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};