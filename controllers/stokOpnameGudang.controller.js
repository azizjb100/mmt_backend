// backend/src/controllers/stokOpname.controller.js

const opnameService = require('../services/stokOpnameGudang.service');

exports.startSession = async (req, res) => {
    try {
        const { gdgKode, user } = req.body;

        if (!gdgKode || !user) {
            return res.status(400).json({ success: false, message: "Gudang dan User harus diisi" });
        }

        const result = await opnameService.startOpnameSession(gdgKode, user);
        res.status(201).json({
            success: true,
            message: `Sesi Opname ${result.sessionID} berhasil dimulai`,
            sessionID: result.sessionID
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.scanBarcode = async (req, res) => {
    try {
        const { barcode, sessionID } = req.query;

        if (!barcode || !sessionID) {
            return res.status(400).json({ success: false, message: "Barcode dan SessionID diperlukan" });
        }

        const data = await opnameService.scanBarcodeOpname(barcode, sessionID);
        
        if (!data) {
            return res.status(404).json({ 
                success: false, 
                message: "Barcode tidak ditemukan dalam daftar sesi opname ini" 
            });
        }

        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateResult = async (req, res) => {
    try {
        const { sessionID, barcode, fisik } = req.body;

        if (!sessionID || !barcode || fisik === undefined) {
            return res.status(400).json({ success: false, message: "Data tidak lengkap" });
        }

        const success = await opnameService.updateScanResult(sessionID, barcode, fisik);
        
        if (!success) {
            return res.status(404).json({ success: false, message: "Data tidak ditemukan atau gagal diupdate" });
        }

        res.status(200).json({ success: true, message: "Hasil opname berhasil disimpan" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPending = async (req, res) => {
    try {
        const { sessionID } = req.params;
        const data = await opnameService.getAllSessionData(sessionID);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};