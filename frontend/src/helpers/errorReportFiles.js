// Zap Komunick: attachment rules of the error report (RF-030). The backend
// checks the same limits again and reads the real type from the file content.
export const ERROR_REPORT_MAX_FILES = 5;
export const ERROR_REPORT_MAX_TOTAL_MB = 15;
export const ERROR_REPORT_MAX_TOTAL_BYTES =
  ERROR_REPORT_MAX_TOTAL_MB * 1024 * 1024;
export const ERROR_REPORT_ACCEPT =
  "image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime,application/pdf";

const EXTENSIONS = /\.(png|jpe?g|gif|webp|mp4|webm|mov|pdf)$/i;

export const isErrorReportFile = file =>
  ERROR_REPORT_ACCEPT.split(",").includes(file?.type) ||
  (!file?.type && EXTENSIONS.test(file?.name || ""));

export const totalBytes = files =>
  files.reduce((sum, file) => sum + (file.size || 0), 0);

/**
 * Adds the incoming files to the ones already chosen. Returns the new list
 * and, when something was left out, the reason: { code, name? }.
 */
export const addErrorReportFiles = (current, incoming) => {
  const files = [...current];
  let rejected = null;
  incoming.forEach(file => {
    if (rejected) return;
    if (!isErrorReportFile(file)) {
      rejected = { code: "type", name: file.name };
    } else if (files.length >= ERROR_REPORT_MAX_FILES) {
      rejected = { code: "tooMany" };
    } else if (totalBytes(files) + file.size > ERROR_REPORT_MAX_TOTAL_BYTES) {
      rejected = { code: "tooLarge" };
    } else {
      files.push(file);
    }
  });
  return { files, rejected };
};

export const megabytes = bytes =>
  (bytes / (1024 * 1024)).toFixed(1).replace(".", ",");
