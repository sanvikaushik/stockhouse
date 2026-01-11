// ============================================================================
// API Configuration
// ============================================================================
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
let authToken = null;

// ============================================================================
// Auth Functions
// ============================================================================

async function signup(firstName, lastName, email, password, userType = 'investor') {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, password, userType })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Signup failed');
        }
        
        const data = await response.json();
        console.log('✅ Signup successful:', data);
        return data;
    } catch (err) {
        console.error('❌ Signup error:', err);
        throw err;
    }
}

async function login(email, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Login failed');
        }
        
        const data = await response.json();
        authToken = data.token;
        localStorage.setItem('authToken', authToken);
        console.log('✅ Login successful');
        return data;
    } catch (err) {
        console.error('❌ Login error:', err);
        throw err;
    }
}

// ============================================================================
// Properties Functions
// ============================================================================

// Function to load properties from your Node.js backend
async function loadProperties() {
    try {
        console.log('📡 Fetching properties from:', `${API_BASE_URL}/properties`);
        
        const response = await fetch(`${API_BASE_URL}/properties`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            }
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load properties');
        }
        
        const properties = await response.json();
        console.log('✅ Loaded properties:', properties);
        
        const container = document.getElementById('property-container');
        if (!container) {
            console.warn('⚠️ #property-container not found');
            return;
        }
        
        container.innerHTML = ''; // Clear existing content

        if (properties.length === 0) {
            container.innerHTML = '<p>No properties available</p>';
            return;
        }

        properties.forEach(prop => {
            const card = `
                <div class="property-card">
                    <h3>${prop.address || prop.externalPropertyId}</h3>
                    <p>Valuation: $${prop.valuation ? prop.valuation.toLocaleString() : 'N/A'}</p>
                    <p>Available Shares: ${prop.availableShares}/${prop.totalShares}</p>
                    <p>Share Price: $${prop.sharePrice ? prop.sharePrice.toFixed(2) : 'N/A'}</p>
                    <button onclick="buyShare('${prop._id}')">Buy Share</button>
                    <button onclick="syncProperty('${prop._id}')">Sync Valuation</button>
                </div>
            `;
            container.innerHTML += card;
        });
    } catch (err) {
        console.error("❌ Connection failed! Is the backend running?", err);
        const container = document.getElementById('property-container');
        if (container) {
            container.innerHTML = `<p style="color: red;">Error loading properties: ${err.message}</p>`;
        }
    }
}

async function getProperty(propertyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/properties/${propertyId}`, {
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });
        
        if (!response.ok) throw new Error('Failed to fetch property');
        return await response.json();
    } catch (err) {
        console.error('❌ Error fetching property:', err);
        throw err;
    }
}

// ============================================================================
// Share Purchase Functions
// ============================================================================

async function buyShare(propertyId) {
    const userId = prompt('Enter your User ID:');
    if (!userId) return;
    
    const sharesToBuy = prompt('How many shares to buy?');
    if (!sharesToBuy || isNaN(sharesToBuy)) return;

    try {
        console.log('💳 Processing share purchase...');
        
        const response = await fetch(`${API_BASE_URL}/properties/purchase`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            body: JSON.stringify({
                userId,
                propertyId,
                sharesToBuy: parseInt(sharesToBuy),
                isResident: false
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Purchase failed');
        }

        const result = await response.json();
        alert(`✅ ${result.message}\nShares: ${result.sharesOwned}\nRemaining Pool: ${result.remainingPool}`);
        loadProperties(); // Refresh list
    } catch (err) {
        console.error('❌ Purchase error:', err);
        alert(`❌ Purchase failed: ${err.message}`);
    }
}

// ============================================================================
// Portfolio Functions
// ============================================================================

async function loadPortfolio(userId) {
    try {
        console.log('📊 Loading portfolio for user:', userId);
        
        const response = await fetch(`${API_BASE_URL}/properties/portfolio/${userId}`, {
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to load portfolio');
        }

        const portfolio = await response.json();
        console.log('✅ Portfolio loaded:', portfolio);
        
        return portfolio;
    } catch (err) {
        console.error('❌ Portfolio load error:', err);
        throw err;
    }
}

// ============================================================================
// Equity & Legal Functions
// ============================================================================

async function calculateMonthlyDues(propertyId, occupantId, investorShares) {
    try {
        const response = await fetch(`${API_BASE_URL}/properties/calculate-dues/${propertyId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            body: JSON.stringify({ occupantId, investorShares })
        });

        if (!response.ok) throw new Error('Failed to calculate dues');
        return await response.json();
    } catch (err) {
        console.error('❌ Calculate dues error:', err);
        throw err;
    }
}

async function validateEquity(propertyId) {
    try {
        const response = await fetch(`${API_BASE_URL}/properties/validate-equity/${propertyId}`, {
            headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
        });

        if (!response.ok) throw new Error('Validation failed');
        return await response.json();
    } catch (err) {
        console.error('❌ Validation error:', err);
        throw err;
    }
}

async function transferShares(propertyId, fromUserId, toUserId, sharesAmount, price) {
    try {
        const response = await fetch(`${API_BASE_URL}/properties/transfer-shares`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            },
            body: JSON.stringify({
                propertyId,
                fromUserId,
                toUserId,
                sharesAmount,
                transactionPrice: price
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Transfer failed');
        }

        return await response.json();
    } catch (err) {
        console.error('❌ Transfer error:', err);
        throw err;
    }
}

// ============================================================================
// Valuation Sync Functions
// ============================================================================

async function syncProperty(propertyId) {
    try {
        console.log('🔄 Syncing property valuation...');
        
        const response = await fetch(`${API_BASE_URL}/properties/sync/${propertyId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Sync failed');
        }

        const result = await response.json();
        alert(`✅ ${result.message}\nOld: $${result.oldValuation?.toLocaleString()}\nNew: $${result.newValuation?.toLocaleString()}`);
        loadProperties(); // Refresh list
    } catch (err) {
        console.error('❌ Sync error:', err);
        alert(`❌ Sync failed: ${err.message}`);
    }
}

// ============================================================================
// Initialize on Page Load
// ============================================================================

// Check if user is logged in
if (localStorage.getItem('authToken')) {
    authToken = localStorage.getItem('authToken');
    console.log('✅ Auth token restored from storage');
}

// Call the function when the page loads
window.onload = () => {
    console.log('🚀 Initializing StockHouse App');
    console.log('API Base URL:', API_BASE_URL);
    loadProperties();
};