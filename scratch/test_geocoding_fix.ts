async function getCoordinates(address: string) {
  try {
    // Clean address: remove (CEP: ...), replace hyphens with commas
    const cleanAddr = address.replace(/\(CEP:.*?\)/g, '').replace(/-/g, ',').trim();
    console.log('Original:', address);
    console.log('Cleaned:', cleanAddr);

    const searchAddr = cleanAddr.includes('Caçapava') ? cleanAddr : `${cleanAddr}, Caçapava, SP, Brasil`;
    console.log('Searching for:', searchAddr);
    
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddr)}&limit=1`, {
      headers: {
        'User-Agent': 'DeliciasDeMaria/1.0'
      }
    });
    const data = await response.json();
    console.log('Response length:', data.length);

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
}

test();
