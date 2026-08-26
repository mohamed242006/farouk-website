import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'

const app = express()
const port = process.env.PORT || 3000
const secret = process.env.SESSION_SECRET || 'fallback_sirr_secret_key'
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// Schema Definitions
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
    passwordHash: { type: String, required: true }
}, { timestamps: true })

const conversationSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    anonCode: { type: String, required: true },
    deletedByStudent: { type: Boolean, default: false },
    deletedByTeacher: { type: Boolean, default: false },
    lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true })

const messageSchema = new mongoose.Schema({
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderRole: { type: String, enum: ['student', 'teacher', 'admin'], required: true },
    type: { type: String, enum: ['text', 'image'], default: 'text' },
    content: { type: String, required: true }
}, { timestamps: true })

const User = mongoose.model('User', userSchema)
const Conversation = mongoose.model('Conversation', conversationSchema)
const Message = mongoose.model('Message', messageSchema)

const auth = async (req, res, next) => {
    try {
        const token = req.cookies.sirr_session
        if (!token) return res.status(401).json({ error: 'Please sign in first.' })
        const decoded = jwt.verify(token, secret)
        const user = await User.findById(decoded.sub)
        if (!user) return res.status(401).json({ error: 'User session expired.' })
        req.user = user
        next()
    } catch {
        res.status(401).json({ error: 'Invalid or expired session.' })
    }
}

app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
app.use(express.static(path.join(rootDir, 'dist')))

// Sign Up Handler
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { role, username, displayName, password, accessCode } = req.body

        if (!['student', 'teacher', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid user role selected.' })
        }

        let finalUsername = ''
        let finalDisplayName = ''
        let passwordToHash = password

        if (role === 'student') {
            if (!username || !username.trim() || !password || password.length < 6) {
                return res.status(400).json({ error: 'Student requires a username and at least 6-character password.' })
            }
            finalUsername = username.trim().toLowerCase()
            finalDisplayName = 'Anonymous Student'
        } else if (role === 'teacher') {
            if (!displayName || !displayName.trim() || !accessCode) {
                return res.status(400).json({ error: 'Teacher requires Teacher Name and Access Code.' })
            }
            const validCode = process.env.TEACHER_ACCESS_CODE || 'TEACHER2026'
            if (accessCode !== validCode) {
                return res.status(403).json({ error: 'Incorrect Teacher Access Code.' })
            }
            finalDisplayName = displayName.trim()
            finalUsername = `teacher_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            passwordToHash = accessCode // Use code as default hash for teacher login
        } else if (role === 'admin') {
            if (!accessCode) {
                return res.status(400).json({ error: 'Admin Access Code is required.' })
            }
            const validAdminCode = process.env.ADMIN_ACCESS_CODE || 'ADMIN2026'
            if (accessCode !== validAdminCode) {
                return res.status(403).json({ error: 'Incorrect Admin Access Code.' })
            }
            finalDisplayName = 'Student Council Admin'
            finalUsername = `admin_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            passwordToHash = accessCode
        }

        if (await User.exists({ username: finalUsername })) {
            return res.status(409).json({ error: 'Username already taken. Please choose another.' })
        }

        const passwordHash = await bcrypt.hash(passwordToHash, 10)
        const user = await User.create({ username: finalUsername, displayName: finalDisplayName, role, passwordHash })

        const token = jwt.sign({ sub: user._id, role: user.role }, secret, { expiresIn: '7d' })
        res.cookie('sirr_session', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.json({ message: 'Account created successfully.', user: { id: user._id, role: user.role, displayName: user.displayName } })
    } catch (error) {
        return res.status(500).json({ error: 'Server registration error: ' + error.message })
    }
})

// Sign In Handler
app.post('/api/auth/signin', async (req, res) => {
    try {
        const { username, password, accessCode, role } = req.body

        let queryUsername = username ? username.toLowerCase().trim() : ''
        let passToCheck = password

        if (role === 'teacher' || role === 'admin') {
            passToCheck = accessCode
        }

        let user = null
        if (queryUsername) {
            user = await User.findOne({ username: queryUsername })
        } else if (role) {
            user = await User.findOne({ role }).sort({ createdAt: -1 })
        }

        if (!user || !(await bcrypt.compare(passToCheck || '', user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid credentials or access code.' })
        }

        const token = jwt.sign({ sub: user._id, role: user.role }, secret, { expiresIn: '7d' })
        res.cookie('sirr_session', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
        })

        return res.json({ message: 'Signed in successfully.', user: { id: user._id, role: user.role, displayName: user.displayName } })
    } catch {
        return res.status(500).json({ error: 'Sign in failed due to server error.' })
    }
})

app.post('/api/auth/signout', (req, res) => res.clearCookie('sirr_session').json({ message: 'Signed out.' }))

app.get('/api/session', auth, (req, res) => {
    res.json({ user: { id: req.user._id, role: req.user.role, displayName: req.user.displayName, username: req.user.username } })
})

app.get('/api/teachers', auth, async (req, res) => {
    const teachers = await User.find({ role: 'teacher' }).select('_id displayName').sort('displayName')
    res.json({ teachers })
})

app.get('/api/conversations', auth, async (req, res) => {
    try {
        let query = {}
        if (req.user.role === 'student') {
            query = { studentId: req.user._id, deletedByStudent: false }
        } else if (req.user.role === 'teacher') {
            query = { teacherId: req.user._id, deletedByTeacher: false }
        } // Admin gets all conversations

        const convs = await Conversation.find(query)
            .populate('teacherId', 'displayName')
            .sort({ lastMessageAt: -1 })
            .lean()

        const formatted = convs.map(c => ({
            id: c._id,
            title: req.user.role === 'teacher' ? c.anonCode : (c.teacherId?.displayName || 'Teacher'),
            studentCode: c.anonCode,
            lastMessageAt: c.lastMessageAt
        }))

        res.json({ conversations: formatted })
    } catch {
        res.status(500).json({ error: 'Could not fetch conversations.' })
    }
})

app.get('/api/conversations/:id/messages', auth, async (req, res) => {
    try {
        const conv = await Conversation.findById(req.params.id)
        if (!conv) return res.status(404).json({ error: 'Chat not found.' })

        const messages = await Message.find({ conversationId: conv._id }).sort({ createdAt: 1 }).lean()
        res.json({ messages })
    } catch {
        res.status(500).json({ error: 'Error reading messages.' })
    }
})

app.post('/api/messages', auth, async (req, res) => {
    try {
        const { teacherId, conversationId, content, type = 'text' } = req.body
        let conv

        if (conversationId) {
            conv = await Conversation.findById(conversationId)
        } else if (teacherId && ['student', 'admin'].includes(req.user.role)) {
            conv = await Conversation.findOne({ studentId: req.user._id, teacherId })
            if (!conv) {
                const randCode = `Student #${Math.floor(1000 + Math.random() * 9000)}`
                conv = await Conversation.create({ studentId: req.user._id, teacherId, anonCode: randCode })
            }
        }

        if (!conv) return res.status(400).json({ error: 'Destination required.' })

        conv.deletedByStudent = false
        conv.deletedByTeacher = false
        conv.lastMessageAt = new Date()
        await conv.save()

        const msg = await Message.create({
            conversationId: conv._id,
            senderId: req.user._id,
            senderRole: req.user.role,
            type,
            content
        })

        res.status(201).json({ message: msg, conversationId: conv._id })
    } catch {
        res.status(500).json({ error: 'Could not deliver message.' })
    }
})

app.delete('/api/conversations/:id', auth, async (req, res) => {
    try {
        const conv = await Conversation.findById(req.params.id)
        if (!conv) return res.status(404).json({ error: 'Conversation not found.' })
        if (req.user.role === 'student') conv.deletedByStudent = true
        if (req.user.role === 'teacher') conv.deletedByTeacher = true
        await conv.save()
        res.json({ message: 'Chat removed.' })
    } catch {
        res.status(500).json({ error: 'Deletion failed.' })
    }
})

app.get('*', (req, res) => res.sendFile(path.join(rootDir, 'dist', 'index.html')))

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI missing.')
mongoose.connect(process.env.MONGODB_URI).then(() => {
    app.listen(port, () => console.log(`Sirr backend live on port ${port}`))
})