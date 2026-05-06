async function getCoordinates(address: string) {
  try {
    const searchAddr = address.includes('Caçapava') ? address : `${address}, Caçapava, SP, Brasil`;
    console.log('Searching for:', searchAddr);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddr)}&limit=1`, {
      headers: {
        'User-Agent': 'DeliciasDeMaria/1.0'
      }
    });
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

async function test() {
  console.log('Testing store address...');
  const store = await getCoordinates("Rua Joaquim Pereira, 87 - Jardim Rafael, Caçapava (CEP: 12288410)");
  console.log('Store coords:', store);

  console.log('\nTesting customer address (CEP)...');
  const customer = await getCoordinates("12288410"); // Example CEP
  console.log('Customer coords:', customer);
}

test();
