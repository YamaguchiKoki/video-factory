export const fetchJson = (url: string, init: RequestInit): Promise<unknown> =>
  fetch(url, init).then((r) => {
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    }
    return r.json();
  });

export const fetchArrayBuffer = (
  url: string,
  init: RequestInit,
): Promise<ArrayBuffer> =>
  fetch(url, init).then((r) => {
    if (!r.ok) {
      throw new Error(`HTTP ${r.status}: ${r.statusText}`);
    }
    return r.arrayBuffer();
  });
