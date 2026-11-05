// Load text with Ajax synchronously: takes path to file and optional MIME type
function loadTextFileAjaxSync(filePath, mimeType) {
  var xmlhttp = new XMLHttpRequest();
  xmlhttp.open("GET", filePath, false);
  if (mimeType != null) {
    if (xmlhttp.overrideMimeType) {
      xmlhttp.overrideMimeType(mimeType);
    }
  }
  xmlhttp.send();
  if (xmlhttp.status === 200 && xmlhttp.readyState === 4) {
    return xmlhttp.responseText;
  } else {
    // TODO Throw exception
    return null;
  }
}

const startupFiles = new Set([
  "/config.json",
  "/config-dev.json",
  "/gitinfo.json"
]);
const startupValues = new Map();

const loadJSON = filePath => {
  if (startupValues.has(filePath)) return startupValues.get(filePath);

  try {
    const data = JSON.parse(loadTextFileAjaxSync(filePath, "application/json"));
    if (data && typeof data === "object" && startupFiles.has(filePath)) {
      startupValues.set(filePath, data);
    }
    return data;
  } catch (e) {
    return null;
  }
};

export { loadJSON };
