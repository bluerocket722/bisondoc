const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const SECRET = process.env.ONLYOFFICE_JWT_SECRET;
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const BUCKET = 'documents';

module.exports = async (req, res) => {
  try {
    const body = req.body || {};
    if (body.token) jwt.verify(body.token, SECRET);

    // status 2 = ready to save, 6 = force-saved
    if (body.status === 2 || body.status === 6) {
      const file = (req.query.file || '').toString();
      const resp = await fetch(body.url);
      const buffer = Buffer.from(await resp.arrayBuffer());
      await supabase.storage.from(BUCKET).upload(file, buffer, { upsert: true });
    }
    res.status(200).json({ error: 0 });
  } catch (e) {
    res.status(200).json({ error: 0 });
  }
};
