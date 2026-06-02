// backend/src/controllers/planningProduksi.controller.js

const planningService = require('../services/planningProduksi.service');

exports.getBrowsePlanning = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Parameter tanggal harus diisi" });
        }

        const data = await planningService.getPlanningProduksiData(startDate, endDate);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getDetailPlanning = async (req, res) => {
    try {
        const { nomor } = req.params;
        const data = await planningService.getPlanningByNomor(nomor);
        res.json(data);
    } catch (error) {
        res.status(404).json({ error: error.message });
    }
};


exports.getSpkDetailForPlanning = async (req, res) => {
    try {
        const { nomor } = req.params;
        
        // Replikasi query loaddataall gabungan master spk + detail planning yang ada
        const [spkHeader] = await req.pool.query(
            `SELECT *, 
                    DATE_FORMAT(spk_tanggal, "%Y-%m-%d") as tgl, 
                    DATE_FORMAT(spk_dateline, "%Y-%m-%d") as dateline 
             FROM tspk WHERE spk_nomor = ?`, 
            [nomor]
        );
        
        if (spkHeader.length === 0) {
            return res.status(404).json({ message: "Nomor SPK tidak ditemukan" });
        }

        const [details] = await req.pool.query(
            `SELECT * FROM tplanningspk_mmt WHERE plan_spk = ?`, 
            [nomor]
        );

        res.json({
            data: {
                header: spkHeader[0],
                detail: details
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.savePlanning = async (req, res) => {
    try {
        const result = await planningService.savePlanningProduksi(req.body);
        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};