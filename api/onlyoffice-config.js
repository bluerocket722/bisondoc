const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const SECRET = process.env.ONLYOFFICE_JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const BUCKET = 'documents';

const CELL = ['xls','xlsx','xlsm','xlt','xltx','ods','ots','csv'];
const SLIDE = ['ppt','pptx','pptm','pps','ppsx','pot','potx','odp','otp'];

function docType(ext){
  if (CELL.includes(ext)) return 'cell';
  if (SLIDE.includes(ext)) return 'slide';
  return 'word';
}

module.exports = async (req, res) => {
  try {
    const file = (req.query.file || '').toString();
    if (!file) { res.status(400).json({ error: 'file query param required' }); return; }

    // Authenticate the requester from their Supabase access token.
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) { res.status(401).json({ error: 'not authenticated' }); return; }
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) { res.status(401).json({ error: 'invalid session' }); return; }

    // The file must live inside the requester's own folder.
    if (!file.startsWith(user.id + '/')) { res.status(403).json({ error: 'forbidden' }); return; }

    const ext = file.split('.').pop().toLowerCase();
    const host = req.headers['x-forwarded-host'] || req.headers.host;

    // Bucket is private, so hand OnlyOffice a short-lived signed URL to fetch the file.
    const { data: signed, error: signErr } = await admin.storage
      .from(BUCKET).createSignedUrl(file, 60 * 60);
    if (signErr || !signed) { res.status(500).json({ error: signErr ? signErr.message : 'could not sign url' }); return; }

    const callbackUrl = `https://${host}/api/onlyoffice-callback?file=${encodeURIComponent(file)}`;

    const config = {
      document: {
        fileType: ext,
        key: file.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + Date.now(),
        title: file.split('/').pop(),
        url: signed.signedUrl
      },
      documentType: docType(ext),
      editorConfig: {
        mode: 'edit',
        callbackUrl: callbackUrl,
        customization: {
          goback: { text: 'Back to Documents', requestClose: true }
        }
      }
    };

    config.token = jwt.sign(config, SECRET);
    res.status(200).json(config);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
