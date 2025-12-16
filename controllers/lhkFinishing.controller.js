const lhkFinishingService = require('../services/lhkFinishing.service');
const { subDays } = require('date-fns');

exports.getAllHeaders = async (req, res) => {
  try {
    const endDate = req.query.endDate || new Date();
    const startDate = req.query.startDate || subDays(endDate, 30);
    
    const data = await lhkFinishingService.getAllHeaders(startDate, endDate);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data LHK Finishing', error: error.message });
  }
};

exports.getDetails = async (req, res) => {
  try {
    const { nomor } = req.query;
    if (!nomor) {
      return res.status(400).json({ message: 'Nomor LHK diperlukan' });
    }
    const data = await lhkFinishingService.getDetailsByNomor(nomor);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail', error: error.message });
  }
};

exports.deleteHeader = async (req, res) => {
  try {
    const { nomor } = req.params;
    const result = await lhkFinishingService.deleteLhk(nomor);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};