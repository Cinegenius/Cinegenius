// Invoked by native code in an isolated WKContentWorld. No page handler accepts
// identity, locations, cookies or tokens. Only authenticated GETs are performed.
return await (async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  async function get(path) {
    const response = await fetch(path, {
      credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    if (response.status === 401) throw new Error('signInRequired');
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) throw new Error('accountUnavailable');
    return response.json();
  }
  try {
    const before = await get('/api/responsible-person');
    if (typeof before.userId !== 'string' || !/^user_[a-zA-Z0-9]{1,128}$/.test(before.userId)) throw new Error('accountUnavailable');
    const listing = await get('/api/listings?mine=true');
    const after = await get('/api/responsible-person');
    if (before.userId !== after.userId) throw new Error('accountChanged');
    if (!Array.isArray(listing.data)) throw new Error('accountUnavailable');
    const locations = listing.data.filter(row => row.type === 'location' && row.user_id === before.userId)
      .map(row => ({ id: row.id, title: row.title, city: row.city || '' }));
    return JSON.stringify({ accountID: before.userId, locations, limited: listing.data.length >= 200 });
  } catch (error) {
    const code = ['signInRequired', 'accountChanged'].includes(error.message) ? error.message : 'accountUnavailable';
    return JSON.stringify({ error: code });
  } finally { clearTimeout(timeout); }
})();
