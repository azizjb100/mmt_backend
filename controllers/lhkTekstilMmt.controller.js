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

module.exports = { getLhkList, getLhkDetails, removeLhk,
    handleSaveLhk 
 };