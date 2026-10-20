// SQL Studio: "Use my own data". Reads CSV files (our parser) and .xlsx files (SheetJS), then builds a schema.
(function (root) {
  'use strict';
  const SS = root.SS;

  const hasExcel = () => !!(root.XLSX && root.XLSX.read);

  function readAs(file, how) {
    return new Promise((ok, bad) => {
      const r = new FileReader();
      r.onload = () => ok(r.result);
      r.onerror = () => bad(new SS.UploadError(`We couldn't read ${file.name}.`));
      if (how === 'text') r.readAsText(file); else r.readAsArrayBuffer(file);
    });
  }

  // Returns [{ name, rows }] for one file.
  async function sheetsFromFile(file) {
    if (file.size > SS.LIMITS.maxBytes) throw new SS.UploadError(`${file.name} is bigger than 5 MB. Try a smaller file.`);
    if (/\.csv$/i.test(file.name) || file.type === 'text/csv') return [{ name: file.name, rows: SS.parseCSV(await readAs(file, 'text')) }];
    if (/\.xlsx$/i.test(file.name)) {
      if (!hasExcel()) throw new SS.UploadError('Excel files are not supported here. Save the sheet as .csv and upload that.');
      const wb = root.XLSX.read(await readAs(file, 'buffer'), { type: 'array', cellDates: true });
      return wb.SheetNames.map(name => ({ name, rows: root.XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false }) }));
    }
    throw new SS.UploadError(`${file.name} isn't a .csv${hasExcel() ? ' or .xlsx' : ''} file.`);
  }

  // Opens the file picker. Resolves to { schema, renamed } or null if the student cancels; throws UploadError.
  function pickUpload() {
    return new Promise((resolve, reject) => {
      const input = SS.h('input', { type: 'file', multiple: true, accept: hasExcel() ? '.csv,.xlsx,text/csv' : '.csv,text/csv', style: { display: 'none' } });
      input.addEventListener('change', async () => {
        const files = [...input.files];
        input.remove();
        if (!files.length) { resolve(null); return; }
        try {
          const sheets = (await Promise.all(files.map(sheetsFromFile))).flat();
          resolve(SS.buildUploadSchema(sheets));
        } catch (e) {
          reject(e instanceof SS.UploadError ? e : new SS.UploadError('Something went wrong reading that file.'));
        }
      });
      input.addEventListener('cancel', () => { input.remove(); resolve(null); });
      document.body.append(input);
      input.click();
    });
  }

  root.SS = Object.assign(SS, { pickUpload, hasExcel });
})(this);
