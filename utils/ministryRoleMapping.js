/**
 * Central ministry-to-role mapping.
 * All form submission handlers must use this single source of truth.
 *
 * To add a new ministry: add an entry here. Nothing else needs to change.
 */
const ministryRoleMapping = {
    // Worship Coordinator
    'Wanazambe': 'Worship Coordinator',
    'Wananzambe': 'Worship Coordinator', // Legacy support
    'Praise and Worship': 'Worship Coordinator',
    'Choir': 'Worship Coordinator',

    // Missions Coordinator
    'High School Ministry': 'Missions Coordinator',
    'High School': 'Missions Coordinator', // Legacy support
    'Compassion and Counselling Ministry': 'Missions Coordinator',
    'Compassion': 'Missions Coordinator', // Legacy support

    // Boards Coordinator
    'Creativity Ministry': 'Boards Coordinator',
    'Creativity': 'Boards Coordinator', // Legacy support

    // Prayer Coordinator
    'Intercessory Ministry': 'Prayer Coordinator',
    'Intercessory': 'Prayer Coordinator', // Legacy support

    // Vice Chair
    'Ushering': 'Vice Chair',
    'Church School Ministry': 'Vice Chair',
    'Church School': 'Vice Chair', // Legacy support
};

/**
 * Returns the overseer role for a given ministry name.
 * Defaults to 'Overseer' if no mapping is found.
 *
 * @param {string} ministry - The ministry name from the form submission
 * @returns {string} - The assigned overseer role
 */
function getRoleForMinistry(ministry) {
    return ministryRoleMapping[ministry] || 'Overseer';
}

module.exports = { ministryRoleMapping, getRoleForMinistry };
