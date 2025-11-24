const Minutes = require('../models/minutes');
const fs = require('fs');
const path = require('path');

// Upload minutes document
exports.uploadMinutes = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { title, date, description } = req.body;

    // Validate required fields
    if (!title || !date) {
      // Delete the uploaded file if validation fails
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
      return res.status(400).json({ error: 'Title and date are required' });
    }

    // Validate date format
    const minutesDate = new Date(date);
    if (isNaN(minutesDate.getTime())) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Create minutes document
    const minutes = new Minutes({
      title: title.trim(),
      date: minutesDate,
      uploadedBy: req.user._id,
      filename: req.file.filename,
      originalName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      description: description?.trim() || '',
      status: 'active'
    });

    await minutes.save();

    res.status(201).json({
      message: 'Minutes uploaded successfully',
      minutes: {
        _id: minutes._id,
        title: minutes.title,
        date: minutes.date,
        uploadedAt: minutes.uploadedAt,
        status: minutes.status
      }
    });
  } catch (error) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }
    console.error('Error uploading minutes:', error);
    res.status(500).json({ error: 'Failed to upload minutes' });
  }
};

// Get all minutes with optional date filtering
exports.getMinutes = async (req, res) => {
  try {
    const { startDate, endDate, status = 'active', search } = req.query;

    // Build filter
    let filter = {};

    if (status) {
      filter.status = status;
    }

    // Date range filtering
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    // Search in title and description
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const minutes = await Minutes.find(filter)
      .sort({ date: -1 })
      .populate('uploadedBy', 'fullName email')
      .exec();

    res.status(200).json({
      count: minutes.length,
      minutes
    });
  } catch (error) {
    console.error('Error fetching minutes:', error);
    res.status(500).json({ error: 'Failed to fetch minutes' });
  }
};

// Get a single minute by ID
exports.getMinuteById = async (req, res) => {
  try {
    const minute = await Minutes.findById(req.params.id)
      .populate('uploadedBy', 'fullName email');

    if (!minute) {
      return res.status(404).json({ error: 'Minutes not found' });
    }

    res.status(200).json(minute);
  } catch (error) {
    console.error('Error fetching minute:', error);
    res.status(500).json({ error: 'Failed to fetch minute' });
  }
};

// Download minutes document
exports.downloadMinute = async (req, res) => {
  try {
    const minute = await Minutes.findById(req.params.id);

    if (!minute) {
      return res.status(404).json({ error: 'Minutes not found' });
    }

    // Check if file exists
    if (!fs.existsSync(minute.filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Update download count and timestamp
    minute.downloadCount += 1;
    minute.lastDownloadedAt = new Date();
    await minute.save();

    // Send file
    res.download(minute.filePath, minute.originalName, (err) => {
      if (err) {
        console.error('Error downloading file:', err);
      }
    });
  } catch (error) {
    console.error('Error downloading minute:', error);
    res.status(500).json({ error: 'Failed to download minute' });
  }
};

// Update minutes (title, date, description)
exports.updateMinute = async (req, res) => {
  try {
    const { title, date, description, status } = req.body;
    const minute = await Minutes.findById(req.params.id);

    if (!minute) {
      return res.status(404).json({ error: 'Minutes not found' });
    }

    // Update fields
    if (title) minute.title = title.trim();
    if (date) {
      const newDate = new Date(date);
      if (isNaN(newDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }
      minute.date = newDate;
    }
    if (description !== undefined) minute.description = description.trim();
    if (status && ['active', 'archived'].includes(status)) minute.status = status;

    await minute.save();

    res.status(200).json({
      message: 'Minutes updated successfully',
      minutes: minute
    });
  } catch (error) {
    console.error('Error updating minute:', error);
    res.status(500).json({ error: 'Failed to update minute' });
  }
};

// Delete minutes document
exports.deleteMinute = async (req, res) => {
  try {
    const minute = await Minutes.findById(req.params.id);

    if (!minute) {
      return res.status(404).json({ error: 'Minutes not found' });
    }

    // Delete file from disk
    if (fs.existsSync(minute.filePath)) {
      fs.unlink(minute.filePath, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }

    // Delete from database
    await Minutes.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'Minutes deleted successfully' });
  } catch (error) {
    console.error('Error deleting minute:', error);
    res.status(500).json({ error: 'Failed to delete minute' });
  }
};

// Archive minutes (soft delete)
exports.archiveMinute = async (req, res) => {
  try {
    const minute = await Minutes.findById(req.params.id);

    if (!minute) {
      return res.status(404).json({ error: 'Minutes not found' });
    }

    minute.status = 'archived';
    await minute.save();

    res.status(200).json({
      message: 'Minutes archived successfully',
      minutes: minute
    });
  } catch (error) {
    console.error('Error archiving minute:', error);
    res.status(500).json({ error: 'Failed to archive minute' });
  }
};

// Get minutes statistics (for dashboard)
exports.getMinutesStats = async (req, res) => {
  try {
    const totalMinutes = await Minutes.countDocuments();
    const activeMinutes = await Minutes.countDocuments({ status: 'active' });
    const archivedMinutes = await Minutes.countDocuments({ status: 'archived' });
    const totalDownloads = await Minutes.aggregate([
      { $group: { _id: null, total: { $sum: '$downloadCount' } } }
    ]);

    res.status(200).json({
      totalMinutes,
      activeMinutes,
      archivedMinutes,
      totalDownloads: totalDownloads[0]?.total || 0
    });
  } catch (error) {
    console.error('Error fetching minutes stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};
