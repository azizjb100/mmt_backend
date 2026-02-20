// backend/src/controllers/invoicePembelian.controller.js

const invoicePembelianService = require('../services/invoicePembelian.service');

// =============================
// GET BY NOMOR
// =============================
exports.getInvoiceByNomor = async (req, res) => {
    try {
        const { nomor } = req.params;

        const data = await invoicePembelianService.getInvoicePembelianByNomor(nomor);

        res.json(data);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// =============================
// GET LIST (BY DATE)
// =============================
exports.getInvoiceList = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'startDate dan endDate wajib diisi' });
        }

        const data = await invoicePembelianService.getInvoicePembelianData(startDate, endDate);
        res.json(data);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// =============================
// SAVE (INSERT / UPDATE)
// =============================
exports.saveInvoice = async (req, res) => {
  try {
    const { nomorToEdit, inv_tanggal, inv_tanggal_tempo } = req.body;
    const currentUser = req.user?.username || 'SYSTEM';

    // ===== VALIDASI TANGGAL =====
    if (!inv_tanggal) {
      return res.status(400).json({ message: "Tanggal invoice wajib diisi" });
    }

    const tglInvoice = new Date(inv_tanggal);
    if (isNaN(tglInvoice.getTime())) {
      return res.status(400).json({ message: "Format tanggal invoice tidak valid" });
    }

    let tglTempo = null;
    if (inv_tanggal_tempo) {
      tglTempo = new Date(inv_tanggal_tempo);
      if (isNaN(tglTempo.getTime())) {
        return res.status(400).json({ message: "Format tanggal tempo tidak valid" });
      }
    }

    // overwrite body supaya pasti valid
    req.body.inv_tanggal = tglInvoice;
    req.body.inv_tanggal_tempo = tglTempo;

    const result = await invoicePembelianService.saveInvoicePembelian(req.body, nomorToEdit, currentUser);

    res.status(200).json({
      message: nomorToEdit ? "Invoice berhasil diupdate" : "Invoice berhasil disimpan",
      data: result
    });
  } catch (error) {
    console.error("SAVE INVOICE ERROR:", error);
    res.status(500).json({ message: error.message });
  }
};


// =============================
// PRINT
// =============================
exports.printInvoice = async (req, res) => {
    try {
        const { nomor } = req.params;

        const data = await invoicePembelianService.getInvoicePembelianForPrint(nomor);

        res.json(data);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// =============================
// GENERATE NOMOR BARU
// =============================
exports.getNextNomor = async (req, res) => {
    try {
        const { kodePerush, tanggal } = req.query;

        if (!kodePerush || !tanggal) {
            return res.status(400).json({ message: 'kodePerush dan tanggal wajib diisi' });
        }

        const nomor = await invoicePembelianService.generateMaxKode(kodePerush, tanggal);

        res.json({ nextNomor: nomor });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};


exports.deleteInvoice = async (req, res) => {
    try {
        const { nomor } = req.params;
        // Panggil service yang menghapus tinvp_hdr & tjurnal_mmt secara transaksional
        await invoicePembelianService.deleteInvoice(nomor); 
        res.json({ message: "Invoice dan Jurnal terkait berhasil dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};