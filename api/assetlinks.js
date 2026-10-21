module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send(JSON.stringify([{
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: "app.vercel.radarx9.twa",
      sha256_cert_fingerprints: ["0A:54:67:70:2D:57:68:5E:E9:AB:5E:57:CF:61:89:50:21:05:9C:DF:CD:4B:9A:8D:3D:B6:CE:EB:3D:D8:F5:56"]
    }
  }]));
};