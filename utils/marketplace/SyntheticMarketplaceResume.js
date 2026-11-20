/** Builds a valid, clearly labeled PDF fixture without persisting a real résumé. */
class SyntheticMarketplaceResume {
  static createBuffer() {
    const stream = [
      'BT',
      '/F1 18 Tf',
      '72 730 Td',
      '(Marketplace QA Candidate) Tj',
      '/F1 12 Tf',
      '0 -28 Td',
      '(SYNTHETIC STAGING TEST DATA - NOT A REAL CANDIDATE) Tj',
      '0 -28 Td',
      '(Created only to test partner submission and status synchronization.) Tj',
      'ET',
    ].join('\n');
    const streamData = `${stream}\n`;
    const objects = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
      `<< /Length ${Buffer.byteLength(streamData, 'ascii')} >>\nstream\n${streamData}endstream`,
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (let index = 0; index < objects.length; index += 1) {
      offsets.push(Buffer.byteLength(pdf, 'ascii'));
      pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'ascii');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets.slice(1)) {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return Buffer.from(pdf, 'ascii');
  }
}

module.exports = { SyntheticMarketplaceResume };
