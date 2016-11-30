import express from 'express';
import scrape from './scrape';

const router = express.Router();

router
  .use('/scrape', scrape);

module.exports = router;