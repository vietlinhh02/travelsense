const allRoles = {
    user: 'user',
    admin: 'admin',
    superAdmin: 'superAdmin'
};

const roles = Object.values(allRoles);
const roleRights = {
    user: ['read'],
    admin: ['read', 'write', 'delete'],
    superAdmin: ['read', 'write', 'delete', 'manage']
};

module.exports = {
    allRoles,
    roles,
    roleRights
};