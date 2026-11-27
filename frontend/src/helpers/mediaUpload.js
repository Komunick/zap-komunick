import Compressor from "compressorjs";

// Zap Komunick: the files of a ticket leave one at a time, in the order they
// were chosen. Each one waits for its own compression and its own request, so
// a slow computer or a long list never sends a request without its files, and
// a failure says exactly which files did not go.

const isImage = file => /^image\//.test(file?.type || "");

// A smaller copy of an image. The original goes when the browser cannot
// compress it (HEIC, a damaged file).
export const compressImage = file =>
  new Promise(resolve => {
    new Compressor(file, {
      quality: 0.7,
      success: resolve,
      error: () => resolve(file)
    });
  });

const prepareMedia = file => (isImage(file) ? compressImage(file) : file);

// Sends `files` in order through `post(formData, onProgress)`, one request
// per file, and stops at the first failure. `pending` holds what was not
// sent, starting with the file that failed.
export const sendMediasInOrder = async (files, post, onProgress = () => {}) => {
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    try {
      const media = await prepareMedia(file);
      const name = media.name || file.name;
      const formData = new FormData();
      formData.append("fromMe", true);
      // The third parameter is required: a compressed image is a Blob.
      formData.append("medias", media, name);
      formData.append("body", name);
      await post(formData, fraction =>
        onProgress((index + fraction) / files.length)
      );
    } catch (error) {
      return { sent: index, pending: files.slice(index), error };
    }
  }
  return { sent: files.length, pending: [], error: null };
};
