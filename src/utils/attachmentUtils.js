const ATTACHMENT_SEPARATOR = '||::||';

function getNameFromUrl(url = '', fallback = 'Attachment') {
  try {
    const parsed = new URL(url, window.location.origin);
    const lastPart = parsed.pathname.split('/').filter(Boolean).pop();
    return decodeURIComponent(lastPart || fallback);
  } catch {
    return fallback;
  }
}

export function parseAttachmentItem(rawValue = '', index = 0) {
  const raw = String(rawValue || '').trim();
  if (!raw) {
    return null;
  }

  if (raw.includes(ATTACHMENT_SEPARATOR)) {
    const [encodedName, ...rest] = raw.split(ATTACHMENT_SEPARATOR);
    const value = rest.join(ATTACHMENT_SEPARATOR).trim();
    if (!value) return null;
    return {
      name: decodeURIComponent(encodedName || `Attachment-${index + 1}`),
      value,
      isDataUrl: value.startsWith('data:'),
    };
  }

  if (raw.startsWith('data:')) {
    return {
      name: `Attachment-${index + 1}`,
      value: raw,
      isDataUrl: true,
    };
  }

  return {
    name: getNameFromUrl(raw, `Attachment-${index + 1}`),
    value: raw,
    isDataUrl: false,
  };
}

export function serializeAttachmentItem(item = {}) {
  const name = encodeURIComponent(String(item.name || 'Attachment').trim());
  const value = String(item.value || '').trim();
  if (!value) return '';
  return `${name}${ATTACHMENT_SEPARATOR}${value}`;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file?.name || 'Attachment',
        value: String(reader.result || ''),
        isDataUrl: true,
      });
    };
    reader.onerror = () => reject(new Error('Unable to read selected file.'));
    reader.readAsDataURL(file);
  });
}
