// Import service
const lhkFinishingService = require('../services/lhkFinishing.service');
const { subDays, format, isValid, parseISO } = require('date-fns');

exports.getAllHeaders = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
    const today = new Date();
    
    if (!endDate || !isValid(parseISO(endDate))) {
      endDate = format(today, 'yyyy-MM-dd');
    }
    if (!startDate || !isValid(parseISO(startDate))) {
      startDate = format(subDays(parseISO(endDate), 30), 'yyyy-MM-dd');
    }

    // Pemanggilan fungsi service
    const data = await lhkFinishingService.getAllHeaders(startDate, endDate);
    
    res.status(200).json(data);
  } catch (error) {
    console.error("Controller Error:", error);
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mengambil data LHK Finishing', 
      error: error.message 
    });
  }
};

exports.getDetails = async (req, res) => {
  try {
    const { nomor } = req.query; // Sesuai routes: /details?nomor=...
    const data = await lhkFinishingService.getDetailsByNomor(nomor);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
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