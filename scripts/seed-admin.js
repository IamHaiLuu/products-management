import dns from 'dns';
import md5 from 'md5';
import { config } from 'dotenv';
import { disconnect } from 'mongoose';

import { mongooseConnect } from '../config/database.js';
import Account from '../models/account.model.js';
import Role from '../models/role.model.js';

config();

if (process.env.NODE_ENV === 'dev') {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
}

const ADMIN_EMAIL = 'dluu57328@gmail.com';
const ADMIN_PASSWORD = '@Luu123456';

const ADMIN_PERMISSIONS = [
    'products-category_view',
    'products-category_create',
    'products-category_edit',
    'products-category_delete',
    'products_view',
    'products_create',
    'products_edit',
    'products_delete',
    'roles_view',
    'roles_create',
    'roles_edit',
    'roles_delete',
    'roles_permissions',
    'accounts_view',
    'accounts_create',
    'accounts_edit',
    'accounts_delete',
    'users_view',
    'users_create',
    'users_edit',
    'users_delete',
    'comments_view',
    'comments_create',
    'comments_edit',
    'comments_delete',
    'setting'
];

async function seedAdmin() {
    const connected = await mongooseConnect();
    if (!connected) {
        process.exitCode = 1;
        return;
    }

    let adminRole = await Role.findOne({ title: 'Admin' });

    if (!adminRole) {
        adminRole = new Role({
            title: 'Admin',
            description: 'Full access admin role',
            permissions: ADMIN_PERMISSIONS,
            deleted: false
        });
    } else {
        adminRole.description = adminRole.description || 'Full access admin role';
        adminRole.permissions = ADMIN_PERMISSIONS;
        adminRole.deleted = false;
        adminRole.deleteAt = undefined;
    }

    await adminRole.save();

    const adminAccount = await Account.findOne({ email: ADMIN_EMAIL });
    const accountData = {
        fullName: 'Admin',
        email: ADMIN_EMAIL,
        password: md5(ADMIN_PASSWORD),
        phone: '',
        avatar: '',
        public_id: '',
        role_id: adminRole.id,
        status: 'active',
        deleted: false,
        deleteAt: undefined,
        refreshToken: null,
        refreshTokenExpires: null
    };

    if (!adminAccount) {
        await Account.create(accountData);
        console.log(`Created admin account: ${ADMIN_EMAIL}`);
    } else {
        await Account.updateOne({ _id: adminAccount._id }, accountData);
        console.log(`Updated admin account: ${ADMIN_EMAIL}`);
    }

    console.log('Admin seed completed.');
    console.log(`Email: ${ADMIN_EMAIL}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
}

try {
    await seedAdmin();
} catch (error) {
    console.error('Admin seed failed:');
    console.error(error);
    process.exitCode = 1;
} finally {
    await disconnect();
}
