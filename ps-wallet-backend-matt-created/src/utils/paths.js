/**
 * Expand ~ in paths to the user's home directory (Linux/macOS/Windows).
 */
function expandHomePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return filePath;
  if (!filePath.startsWith('~')) return filePath;
  const home =
    process.env.HOME ||
    process.env.USERPROFILE ||
    (process.env.HOMEDRIVE && process.env.HOMEPATH
      ? process.env.HOMEDRIVE + process.env.HOMEPATH
      : '') ||
    '';
  if (!home) return filePath;
  return filePath.replace(/^~(?=$|[\\/])/, home).replace(/^~\//, `${home}/`);
}

module.exports = { expandHomePath };
