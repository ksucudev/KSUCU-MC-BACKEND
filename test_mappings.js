const { getRoleForMinistry } = require('./utils/ministryRoleMapping');

const testCases = [
    { ministry: 'Wanazambe', expected: 'Worship Coordinator' },
    { ministry: 'Wananzambe', expected: 'Worship Coordinator' },
    { ministry: 'Praise and Worship', expected: 'Worship Coordinator' },
    { ministry: 'Choir', expected: 'Worship Coordinator' },
    { ministry: 'High School Ministry', expected: 'Missions Coordinator' },
    { ministry: 'High School', expected: 'Missions Coordinator' },
    { ministry: 'Compassion and Counselling Ministry', expected: 'Missions Coordinator' },
    { ministry: 'Compassion', expected: 'Missions Coordinator' },
    { ministry: 'Creativity Ministry', expected: 'Boards Coordinator' },
    { ministry: 'Creativity', expected: 'Boards Coordinator' },
    { ministry: 'Intercessory Ministry', expected: 'Prayer Coordinator' },
    { ministry: 'Intercessory', expected: 'Prayer Coordinator' },
    { ministry: 'Ushering', expected: 'Vice Chair' },
    { ministry: 'Church School Ministry', expected: 'Vice Chair' },
    { ministry: 'Church School', expected: 'Vice Chair' },
    { ministry: 'Unknown Ministry', expected: 'Overseer' }
];

console.log('--- Ministry Role Mapping Verification ---');
let allPassed = true;
testCases.forEach(tc => {
    const actual = getRoleForMinistry(tc.ministry);
    const passed = actual === tc.expected;
    console.log(`${passed ? '✅' : '❌'} ${tc.ministry} -> ${actual} (Expected: ${tc.expected})`);
    if (!passed) allPassed = false;
});

if (allPassed) {
    console.log('\nAll role mappings are CORRECT!');
    process.exit(0);
} else {
    console.log('\nSome role mappings FAILED!');
    process.exit(1);
}
