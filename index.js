import express from 'express'
import { join } from 'path'
import methodOverride from 'method-override'
import bodyParser from 'body-parser'
import flash from 'express-flash'
import cookieParser from 'cookie-parser'
import session from 'express-session'
import moment from 'moment'
import { createServer } from 'http'
import { Server } from "socket.io"
import cors from 'cors'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import passport from 'passport';

import { config } from 'dotenv'
config()

await import('./config/passport.js');
import { cleanupExpiredTokens } from './helpers/tokenCleanup.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

import { mongooseConnect } from './config/database.js'
await mongooseConnect();

const { prefixAdmin } = await import('./config/system.js');

const router = (await import('./routes/clients/index.route.js')).default;
const routerAdmin = (await import('./routes/admin/index.route.js')).default;

const app = express()
const port = process.env.PORT 

// parse application
app.use(bodyParser.urlencoded({ extended: false }))

app.use(methodOverride('_method'))

app.set('views', `${__dirname}/views`)
app.set('view engine', 'pug')

// Socket.io
const server = createServer(app);
const io = new Server(server);
global._io = io;
io.setMaxListeners(0); 

// Initialize socket handlers once
const chatSocket = await import('./socket/client/chat.socket.js');
chatSocket.default();

// Flash
app.use(cookieParser('IamHaiLuu')); 
app.use(session({
    secret: 'IamHaiLuu',      
    resave: false,                   
    saveUninitialized: false,  
    cookie: { maxAge: 15 * 60 * 1000 }  // (15 phút)
}))
app.use(flash());

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());
// End Flash

// CORS 
app.use(cors());

// TinyMCE
app.use('/tinymce', express.static(join(__dirname, 'node_modules', 'tinymce')));

app.use(express.static(`${__dirname}/public`))

import formatCurrency from './helpers/formatCurrency.js'
// app local variables
app.locals.prefixAdmin = prefixAdmin
app.locals.moment = moment
app.locals.formatCurrency = formatCurrency

// router
routerAdmin(app)
router(app)

// Global error handler
app.use((err, req, res, next) => {
    // Bỏ qua ECONNRESET errors
    if (err.code === 'ECONNRESET' || err.errno === -4077) {
        return res.status(500).json({ error: 'Connection reset. Please try again.' });
    }
    
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.get('*', (req, res) => {
    res.render('client/pages/error/404', {
        title: 'Trang lỗi'
    })
})

server.listen(port, () => {
    console.log(`App listening on port ${port}`)
    
    // Cleanup expired tokens mỗi 24 giờ
    setInterval(async () => {
        try {
            await cleanupExpiredTokens();
        } catch (error) {
            console.error('Token cleanup job failed:', error.message);
        }
    }, 24 * 60 * 60 * 1000); // 24 hours
    
    // Cache cleanup mỗi 6 giờ (silent mode)
    setInterval(async () => {
        try {
            const result = await cacheCleanup.comprehensiveCleanup({
                maxAgeHours: 12, // Xóa cache cũ hơn 12 giờ
                cleanOrphaned: true,
                cleanExpired: true
            });
        } catch (error) {
            // Silent cleanup - no logs
        }
    }, 6 * 60 * 60 * 1000); // 6 hours
    
    // Cleanup ban đầu sau 10 giây (silent mode)
    setTimeout(async () => {
        try {
            await cleanupExpiredTokens();
            
            // Initial cache cleanup (silent)
            const cacheResult = await cacheCleanup.cleanupExpiredCache();
        } catch (error) {
            // Silent cleanup - no logs
        }
    }, 10000); 
})
