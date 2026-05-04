const lhkService = require('../services/lhkTekstilMmt.service');

const getLhkList = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const data = await lhkService.getAllHeaders(startDate, endDate);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getLhkDetails = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await lhkService.getDetailsByNomor(nomor);
        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const removeLhk = async (req, res) => {
    try {
        const { nomor } = req.params;
        await lhkService.deleteLhk(nomor);
        res.json({ message: "Berhasil dihapus." });
    } catch (error) {
        res.status(500).json({ message: "Gagal Hapus." });
    }
};
const handleSaveLhk = async (req, res) => {
    try {
        const result = await lhkService.saveLhk(req.body);
        res.status(200).json(result);
    } catch (error) {
        console.error("Error Saving LHK:", error);
        res.status(500).json({ 
            success: false, 
            message: "Gagal menyimpan data LHK Tekstil." 
        });
    }
};
const getLhkFullData = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await lhkService.getLhkByNomor(nomor);
        
        if (!data) {
            return res.status(404).json({ success: false, message: "Data tidak ditemukan." });
        }
        
        // Sesuaikan struktur response agar sesuai dengan frontend (res.data.data)
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getLhkLookup = async (req, res) => {
    try {
        // Ambil dari req.query untuk method GET
        const { tanggal, shift } = req.query; 
        
        console.log("Filter diterima:", { tanggal, shift }); // Cek di terminal backend

        const data = await lhkService.getLookupLhkTekstil(tanggal, shift);
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const handleSaveApproval = async (req, res) => {
    try {
        // req.body berisi { header: {...}, details: [...] }
        const result = await lhkService.saveApproval(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: "Gagal memproses approval: " + error.message 
        });
    }
};

const getApprovalList = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        // Memanggil fungsi baru di service
        const data = await lhkService.getAllApprovalHeaders(startDate, endDate);
        res.json(data);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getApprovalFullData = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await lhkService.getApprovalFullByNomor(nomor);
        
        if (!data) {
            return res.status(404).json({ success: false, message: "Data Approval tidak ditemukan." });
        }
        
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = { getLhkList, getLhkDetails, removeLhk,
    handleSaveLhk, getLhkFullData, getLhkLookup, handleSaveApproval, getApprovalList, getApprovalFullData
 };