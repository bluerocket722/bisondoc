const jwt = require('jsonwebtoken');

const SECRET = process.env.ONLYOFFICE_JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const BUCKET = 'documents';

const WORD = ['doc','docx','docm','dot','dotx','odt','ott','rtf','txt','html','htm','pdf','epub','fb2','xps','djvu'];
const CELL = ['xls','xlsx','xlsm','xlt','xltx','ods','ots','csv'];
const SLIDE = ['ppt','pptx','pptm','pps','ppsx','pot','potx','odp','otp'];

function docType(ext){
  if (CELL.includes(ext)) return 'cell';
  if (SLIDE.includes(ext)) return 'slide';
  return 'word';
}

module.exports = (req, res) => {
  const file = (req.query.file || '').toString();
  if (!file) { res.status(400).json({ error: 'file query param required' }); return; }

  const ext = file.split('.').pop().toLowerCase();
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(file)}`;
  const callbackUrl = `https://${host}/api/onlyoffice-callback?file=${encodeURIComponent(file)}`;

  const config = {
    document: {
      fileType: ext,
      key: file.replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + Date.now(),
      title: file,
      url: fileUrl
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
};
