// backend/src/controllers/invoice.controller.js

const invoiceService = require('../services/invoice.service');

const getInvoiceByNomor = async (req, res) => {
  try {
    const { nomor } = req.params;
    const data = await invoiceService.getInvoiceById(nomor);

    if (!data) {
      return res.status(404).json({ message: `Invoice ${nomor} tidak ditemukan.` });
    }

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const saveInvoice = async (req, res) => {
  try {
    const { nomorToEdit } = req.body; // Jika ada, berarti mode EDIT
    const currentUser = req.user?.username || 'SYSTEM'; // Asumsi middleware auth tersedia

    const result = await invoiceService.saveInvoice(req.body, nomorToEdit, currentUser);

    res.status(200).json({
      message: nomorToEdit ? "Invoice berhasil diupdate" : "Invoice berhasil disimpan",
      data: result
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const printInvoice = async (req, res) => {
  try {
    const { nomor } = req.params;
    const printData = await invoiceService.getInvoiceForPrint(nomor);

    res.json(printData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getNextNomor = async (req, res) => {
  try {
    const { kodePerush, tanggal } = req.query;
    if (!kodePerush || !tanggal) {
      return res.status(400).json({ message: "Kode Perusahaan dan Tanggal diperlukan." });
    }

    const nomor = await invoiceService.getNextInvoiceNumber(kodePerush, tanggal);
    res.json({ nextNomor: nomor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getInvoiceByNomor,
  saveInvoice,
  printInvoice,
  getNextNomor
};