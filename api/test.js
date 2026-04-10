module.exports = async function handler(req, res) {
  return res.status(200).json({
    ok: true,
    message: 'test api works',
    hasResendKey: !!process.env.RESEND_API_KEY
  });
};