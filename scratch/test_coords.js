
async function test() {
  const ceps = ['12288410', '12212750'];
  for (const cep of ceps) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&postalcode=${cep}&country=Brazil&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Test/1.0' } });
    const data = await res.json();
    console.log(`CEP ${cep}:`, data[0]?.lat, data[0]?.lon, data[0]?.display_name);
  }
}
test();
