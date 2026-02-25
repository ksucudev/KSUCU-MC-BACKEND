const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const REQUESTER_EMAIL = 'esther.juma164@gmail.com';
const ADMIN_EMAIL = 'admin@ksucumcsuperadmin.co.ke';

async function verifyFlow() {
    console.log('🚀 Starting Requisition Flow Verification...');

    try {
        // 1. Login as Requester
        console.log('👤 Step 1: Logging in as Requester (Esther Juma)...');
        const loginResponse = await axios.post(`${BASE_URL}/users/login`, {
            email: REQUESTER_EMAIL,
            password: 'testuser123'
        });

        const requesterCookie = loginResponse.headers['set-cookie'];
        console.log('✅ Login successful');

        // 2. Submit a requisition
        console.log('📝 Step 2: Submitting test requisition...');
        const now = new Date();
        const later = new Date(now.getTime() + 8 * 60 * 60 * 1000); // 8 hours later

        const requisitionData = {
            recipientName: 'Esther Juma',
            recipientPhone: '0710397118',
            timeReceived: now.toISOString(),
            timeToReturn: later.toISOString(),
            items: [{ itemName: 'Test Table', quantity: 1 }],
            totalAmount: 500,
            purpose: 'Test Purpose',
            assetTransfer: {
                receivedByName: 'Esther Juma',
                receivedBySignature: 'esther-sig-base64-data',
                date: new Date().toISOString().split('T')[0]
            }
        };

        const submitResponse = await axios.post(`${BASE_URL}/api/requisitions`, requisitionData, {
            headers: { Cookie: requesterCookie }
        });

        const requisitionId = submitResponse.data._id;
        console.log(`✅ Requisition submitted! ID: ${requisitionId}`);

        // 3. Login as Admin
        console.log('🔑 Step 3: Logging in as Super Admin...');
        const adminLoginResponse = await axios.post(`${BASE_URL}/sadmin/login`, {
            email: ADMIN_EMAIL,
            password: 'newsAdmin01q7'
        });

        const adminCookie = adminLoginResponse.headers['set-cookie'];
        console.log('✅ Admin login successful');

        // 4. Approve Requisition (and persist signatures)
        console.log('✍️ Step 4: Approving Requisition (with Admin Signature)...');
        const approvalData = {
            approvedBy: 'Overseer',
            comments: 'Approved for testing',
            approvalSignature: 'admin-sig-base64-data',
            assetTransfer: {
                ...requisitionData.assetTransfer,
                releasedByName: 'Admin',
                releasedBySignature: 'admin-sig-base64-data-released'
            }
        };

        await axios.patch(`${BASE_URL}/api/requisitions/${requisitionId}/approve`, approvalData, {
            headers: { Cookie: adminCookie }
        });

        console.log('✅ Requisition approved and released!');

        // 5. Verify final state
        console.log('🔍 Step 5: Verifying final state...');
        const finalResponse = await axios.get(`${BASE_URL}/api/requisitions/${requisitionId}`, {
            headers: { Cookie: requesterCookie }
        });

        const finalReq = finalResponse.data;
        console.log('📊 Final Data:');
        console.log(`   Status: ${finalReq.status}`);
        console.log(`   Admin Signature Present (assetTransfer): ${finalReq.assetTransfer?.releasedBySignature ? 'YES' : 'NO'}`);
        console.log(`   Admin Signature Present (approval): ${finalReq.approvalSignature ? 'YES' : 'NO'}`);

        if (finalReq.status === 'approved' && (finalReq.assetTransfer?.releasedBySignature || finalReq.approvalSignature)) {
            console.log('\n🎉 SUCCESS: The flow is working correctly. The "Download Signed PDF" button will now be visible to the user.');
        } else {
            console.error('\n❌ FAILURE: Data was not persisted correctly.');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ ERROR during verification:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('   Message:', error.message);
        }
        process.exit(1);
    }
}

verifyFlow();
