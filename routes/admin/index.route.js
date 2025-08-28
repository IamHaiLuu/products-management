import { prefixAdmin } from '../../config/system.js'

import { reuireAuth } from '../../middlewares/admin/auth.middleware.js'
import { autoRefreshToken } from '../../middlewares/admin/autoRefresh.middleware.js'

import dashboardRoute from './dashboard.route.js'
import productRoute from './product.route.js'
import productCategoryRoute from './product-category.route.js'
import roleRoute from './role.route.js'
import accountRoute from './account.route.js'
import authRoute from './auth.route.js'
import my_accountRoute from './my-account.route.js'
import settingRoute from './setting.route.js'
import userRoute from './user.route.js'
import commentRoute from './comment.route.js'
import tokenRoute from './token.route.js'

import { login } from '../../controllers/admin/auth.controller.js'

export default (app) => {
    const PATH_ADMIN = prefixAdmin

    app.get(PATH_ADMIN + '/', login)

    app.use(PATH_ADMIN, autoRefreshToken)

    app.use(PATH_ADMIN + '/dashboard', reuireAuth, dashboardRoute)

    app.use(PATH_ADMIN + '/products', reuireAuth, productRoute)

    app.use(PATH_ADMIN + '/products-category', reuireAuth, productCategoryRoute)

    app.use(PATH_ADMIN + '/roles', reuireAuth, roleRoute)

    app.use(PATH_ADMIN + '/accounts', reuireAuth, accountRoute)

    app.use(PATH_ADMIN + '/auth', authRoute)

    app.use(PATH_ADMIN + '/my-account', reuireAuth, my_accountRoute)

    app.use(PATH_ADMIN + '/setting', reuireAuth, settingRoute)

    app.use(PATH_ADMIN + '/users', reuireAuth, userRoute)

    app.use(PATH_ADMIN + '/comments', reuireAuth, commentRoute)
    
    app.use(PATH_ADMIN + '/token', tokenRoute)
}