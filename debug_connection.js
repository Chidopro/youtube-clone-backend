// Debug script to test backend connection
const API_BASE_URL = 'https://backend-hidden-firefly-7865.fly.dev';

async function testBackendConnection() {
    console.log('Testing backend connection...');
    
    try {
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthResponse = await fetch(`${API_BASE_URL}/api/health`);
        console.log('Health status:', healthResponse.status);
        
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log('Health data:', healthData);
        } else {
            console.error('Health check failed:', await healthResponse.text());
        }
        
        // Test ping endpoint
        console.log('\n2. Testing ping endpoint...');
        const pingResponse = await fetch(`${API_BASE_URL}/api/ping`);
        console.log('Ping status:', pingResponse.status);
        
        if (pingResponse.ok) {
            const pingData = await pingResponse.json();
            console.log('Ping data:', pingData);
        } else {
            console.error('Ping failed:', await pingResponse.text());
        }
        
        // Test create-product endpoint
        console.log('\n3. Testing create-product endpoint...');
        const createResponse = await fetch(`${API_BASE_URL}/api/create-product`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                thumbnail: 'https://example.com/test.jpg',
                videoUrl: 'https://example.com/test.mp4',
                screenshots: []
            })
        });
        
        console.log('Create product status:', createResponse.status);
        console.log('Create product headers:', Object.fromEntries(createResponse.headers.entries()));
        
        if (createResponse.ok) {
            const createData = await createResponse.json();
            console.log('Create product data:', createData);
        } else {
            const errorText = await createResponse.text();
            console.error('Create product failed:', errorText);
        }
        
    } catch (error) {
        console.error('Connection test failed:', error);
    }
}

// Run the test
testBackendConnection(); 